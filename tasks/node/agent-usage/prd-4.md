# PRD-4: Progress Visibility During Skills Run

Workstream: WS-4a
Priority: 4
Proposed PR: PR-4

Split from the original PRD-4 per reviewer feedback. This PRD covers live progress
forwarding for `skills run` only. Persistent logging is PRD-5.

---

## Problem Statement

`skills run` is completely silent until the skill script exits or times out. `runSkill.ts` buffers all stdout and stderr and only returns them in the final result. A 30-120 second skill run produces no observable output, so an agent cannot distinguish "working normally" from "stuck" from "already failed silently."

---

## Evidence

**From `apps/node/src/domain/skills/runSkill.ts:102-106`:**

```typescript
const child = spawn(cmd, cmdArgs, {
  stdio: ["ignore", "pipe", "pipe"],  // fully buffered
  env: childEnv,
});

let stdout = "";
let stderr = "";
// ...
child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
```

Output is accumulated and only returned in the final result. No forwarding to the caller during execution.

**GloBird incident (OpenClaw session logs):**
> Running GloBird skill. 30 seconds pass. Is it working? Should I wait? Cancel? Check the device? I have no idea.
> I treated it like a synchronous function call: send request, wait for response. But it's actually a sequence of actions over time, and I need visibility into that sequence.

---

## Current Behavior

1. `skills run` produces no output until the skill script exits or times out.
2. `SkillRunResult.output` contains the accumulated stdout, but only delivered after the fact.
3. `--expect-contains` operates on the full accumulated output.

---

## Proposed Change

### 1. Add optional `onOutput` callback to `runSkill`

Keep `runSkill.ts` as a pure domain helper. Add an optional `callbacks` parameter.

**Current signature** (confirmed from source):
```typescript
export async function runSkill(
  skillId: string,
  args: string[],
  registryPath?: string,
  timeoutMs?: number,
  env?: SkillRunEnv
): Promise<SkillRunResult | SkillRunError>
```

Add `callbacks` as the 6th parameter:
```typescript
export interface SkillRunCallbacks {
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
}

export async function runSkill(
  skillId: string,
  args: string[],
  registryPath?: string,
  timeoutMs?: number,
  env?: SkillRunEnv,
  callbacks?: SkillRunCallbacks,    // new optional parameter
): Promise<SkillRunResult | SkillRunError>
```

In the `data` handlers, call `callbacks?.onOutput(chunk, "stdout")` in addition to accumulating the string. The domain helper does not write to `process.stdout` directly - output routing is the CLI layer's responsibility.

### 2. Wire the callback at the CLI layer

In `apps/node/src/cli/commands/skills.ts` (or equivalent), when invoking `runSkill` for the `skills run` command:

- `pretty` / TTY mode: pass `onOutput` that calls `process.stdout.write(chunk)` for `"stdout"` chunks and `process.stderr.write(chunk)` for `"stderr"` chunks.
- `json` mode: do not pass `onOutput`. No live output interleaving; stdout receives only the final JSON result envelope.

### 3. Final result shape unchanged

`SkillRunResult.output` continues to carry the full accumulated stdout string. The
callback does not replace it. `--expect-contains` continues to operate on the full
accumulated output after the process exits.

**Note on `--expect-contains` location**: this check is implemented in the CLI layer
(`cli/commands/skills.ts`), not in `runSkill.ts`. It reads `result.output` after
`runSkill` returns. Confirm this before touching it — do not accidentally move it
into the streaming path.

### 4. Pre-run context banner in pretty mode

Before calling `runSkill`, the CLI layer prints a brief orientation header in
pretty/TTY mode only. This gives an agent the key operating context before any
skill output arrives.

Banner format (printed to stdout before skill output):

```
[Clawperator] v<version>  APK: <OK|MISSING>  Logs: <absolute-log-path>  Docs: https://docs.clawperator.com/llms.txt
```

Example:

```
[Clawperator] v0.3.3  APK: OK (com.clawperator.operator.dev)  Logs: /Users/<user>/.clawperator/logs/clawperator-2026-03-21.log  Docs: https://docs.clawperator.com/llms.txt
Running skill: globird-get-usage
```

If the APK check returns a non-pass result:

```
[Clawperator] v0.3.3  APK: MISSING - run `clawperator operator setup --apk <path>`  Logs: /Users/<user>/.clawperator/logs/clawperator-2026-03-21.log  Docs: https://docs.clawperator.com/llms.txt
```

Implementation details:
- **Version**: read from `package.json` or the version constant already in the CLI.
- **APK check**: call `checkApkPresence(config)` from `readinessChecks.ts` (same
  function PRD-1 adds to `runExecution.ts`). Use the same `RuntimeConfig` built from
  CLI options. This check is **informational only** - the banner always lets skill
  execution proceed regardless of APK state. The gate at execute-time in PRD-1 handles
  blocking. The banner tells the agent what to expect before the skill starts.
- **Log path**: compute `~/.clawperator/logs/clawperator-YYYY-MM-DD.log` using the
  same date-path logic from PRD-5. If PRD-5 has not landed yet, compute the expected
  path anyway (it is still useful to show where logs will appear once PR-5 ships). Use
  `os.homedir()` for the absolute path, not `~`.
- **Suppress entirely in JSON mode**: any output written to stdout before the final
  JSON envelope breaks machine-readable callers. No banner, no newlines.
- One line only. Do not add a spinner or multi-line block - keep it scannable.

---

## Why This Matters for Agent Success

Without this change, a 30-second skill run is 30 seconds of silence. With it, the skill's own print/log statements reach the agent in real time. The agent can see partial results, progress markers that skill authors wrote, and error messages before the timeout fires.

---

## Documentation updates in PR-4

- `docs/node-api-for-agents.md`: document the pre-run banner output format so agents
  know what to expect before skill output begins. Note that the banner is suppressed in
  JSON mode. Document that `skills run` now streams output in real time in pretty mode.

---

## Scope Boundaries

In scope:
- `runSkill.ts`: `SkillRunCallbacks` type, optional parameter, callback invocation in `data` handlers
- `cli/commands/skills.ts`: callback wiring based on output mode; pre-run banner
- Backward compatibility: call sites that omit `callbacks` are unchanged
- One source doc update (node-api-for-agents)

Out of scope:
- Persistent log files (PRD-5)
- `--log-level` flag (PRD-5)
- Android-side per-action event streaming (requires APK changes)
- Replacing the terminal envelope contract
- Adding progress output to `execute` directly (that path has no script subprocess)
- A `--pre-check` flag to make the APK check blocking at `skills run` level (deferred; the
  execute-time gate from PRD-1 covers the critical path)

---

## Dependencies

- Independent of PRD-1 and PRD-2.
- **Ordering constraint from PRD-3**: PRD-3 adds a dry-run validation gate to `skills run`
  in `cli/commands/skills.ts`. When implementing the pre-run banner in the same function,
  the banner must be inserted BEFORE that gate. The intended execution order is:
  1. Banner prints (version, APK status, log path, docs link)
  2. Dry-run validation runs
  3. If validation fails, skill exits — but the agent already saw the banner context
  If PR-3 has already shipped when this PR is implemented (which it will per the plan
  sequencing), read `cli/commands/skills.ts` and confirm the banner call precedes the
  dry-run check, not after it.
- PRD-5 (persistent logging) may add an additional `onOutput` consumer at the CLI layer - the callback pattern is forward-compatible with that.

---

## Risks and Tradeoffs

**Risk: `--expect-contains` broken by streaming change**
`skills run --expect-contains <text>` checks the full accumulated output after the process exits. The streaming change must not cause partial output to be passed to the `--expect-contains` check. The accumulated `stdout` string must remain intact and checked only on process close.

**Risk: interleaved output in JSON mode**
Any path that writes to `process.stdout` during a `--output json` run will break machine-readable output. The guard at the CLI layer (`if format !== "json"`) must be explicit and tested.

---

## Testing Plan

### Fixtures

Three small shell scripts in `test/fixtures/scripts/`:
- `chunked-output.sh`: `printf 'chunk1
'; sleep 0.1; printf 'chunk2
'`
- `mixed-streams.sh`: one line to stdout, one to stderr
- `split-word.sh`: `printf 'hel'; printf 'lo
'` (tests `--expect-contains` on
  accumulated output)

### TDD Sequence

1. Write T1 (no callbacks, output accumulated). Passes unchanged. Pin this before
   touching `runSkill.ts`.
2. Add `callbacks` parameter. Write T2, T3, T4. All must pass. T1 must still pass.
3. Write T5 (`--expect-contains` still works). Wire CLI callback.
4. Write T6 (JSON mode clean). This catches the output-mode guard in the CLI layer.
5. Write T7 (banner present in pretty mode), T8 (banner absent in JSON mode). Both
   fail. Wire banner. Both must pass. T6 must still pass.
6. Run integration test T9 with a real skill.

### Unit Tests

**T1 — `runSkill` without callbacks accumulates and returns output (regression anchor)**
- Input: `chunked-output.sh`, no `callbacks`; expected: `result.output === "chunk1
chunk2
"`
- Protects: adding the optional parameter breaks existing call sites; must pass before
  and after the change

**T2 — `onOutput` callback receives each chunk**
- Input: `chunked-output.sh`, `callbacks: { onOutput: collect }`
- Expected: `collect` receives `"chunk1
"` then `"chunk2
"` before promise resolves
- Protects: callback never invoked; chunks arrive after resolution (useless for progress)

**T3 — `SkillRunResult.output` is still the full string when `onOutput` is provided**
- Expected: `result.output === "chunk1
chunk2
"` (not empty, not just the last chunk)
- Protects: callback consumes output instead of duplicating it; `result.output` becomes `""`

**T4 — stderr chunks tagged `stream: "stderr"`**
- Input: `mixed-streams.sh`; expected: callback receives stdout chunk with
  `stream: "stdout"` and stderr chunk with `stream: "stderr"`
- Protects: stderr silently dropped; both streams tagged the same way

**T5 — `--expect-contains` works on accumulated output, not per-chunk**
- Input: `split-word.sh`, `--expect-contains "hello"`
- Expected: check passes (`"hello
"` is the accumulated string; no single chunk contains it)
- Protects: check moved to per-chunk evaluation; false failures for split output

**T6 — `skills run --output json` produces no interleaved text**
- Command: skill that prints during execution, with `--output json`; capture stdout
- Expected: `JSON.parse(stdout)` succeeds; no skill output lines in stdout
- Protects: `onOutput` wired to `process.stdout` regardless of output mode; JSON broken

**T7 — banner appears in pretty mode before skill output (regression anchor)**
- Method: capture stdout at the CLI layer for a `skills run` call in pretty mode
- Expected: first line contains `"[Clawperator]"` with version, log path, and docs URL
- Protects: banner not wired in CLI layer; agents get no orientation before skill runs

**T8 — banner absent in JSON mode (regression anchor)**
- Method: capture stdout for the same skill call with `--output json`
- Expected: `JSON.parse(stdout)` succeeds with no parse error; no `[Clawperator]` line
- Protects: banner written regardless of output mode; JSON output broken for machine callers

### Integration Tests

**T9 — TTY mode shows banner then incremental output**
- Command: `clawperator skills run <skill-with-stdout>` in a TTY
- Expected: first line is the `[Clawperator]` banner; subsequent lines are skill output;
  all arrive before the final result envelope
- Protects: callback wired but never flushed; banner placed after skill output instead of before

### Manual Verification

- Run a 5+ second skill in TTY mode; banner appears first, then skill output arrives
  incrementally, not in a batch
- Same skill with `--output json`; stdout is clean parseable JSON only; no banner

---

## Acceptance Criteria

- `skills run` in pretty/TTY mode: a one-line `[Clawperator]` banner is printed first,
  containing version, APK status, today's log path (absolute), and the llms.txt URL.
- `skills run` in pretty/TTY mode: skill stdout is visible to the caller as it arrives.
- `skills run --output json`: no banner, no interleaving; stdout receives only the final
  JSON result.
- `runSkill.ts` does not write to `process.stdout` or `process.stderr` directly.
- `SkillRunResult.output` is unchanged (full accumulated string, not a stream reference).
- `--expect-contains` passes and fails correctly in both output modes.
- Call sites that do not pass `callbacks` compile and run without changes.
