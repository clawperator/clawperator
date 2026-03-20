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

**From `tasks/node/agent-usage/issues.md`, Issues #4, #6:**
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

Keep `runSkill.ts` as a pure domain helper. Add an optional `callbacks` parameter:

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

`SkillRunResult.output` continues to carry the full accumulated stdout string. The callback does not replace it. `--expect-contains` continues to operate on the full accumulated output after the process exits.

---

## Why This Matters for Agent Success

Without this change, a 30-second skill run is 30 seconds of silence. With it, the skill's own print/log statements reach the agent in real time. The agent can see partial results, progress markers that skill authors wrote, and error messages before the timeout fires.

---

## Scope Boundaries

In scope:
- `runSkill.ts`: `SkillRunCallbacks` type, optional parameter, callback invocation in `data` handlers
- `cli/commands/skills.ts`: callback wiring based on output mode
- Backward compatibility: call sites that omit `callbacks` are unchanged

Out of scope:
- Persistent log files (PRD-5)
- `--log-level` flag (PRD-5)
- Android-side per-action event streaming (requires APK changes)
- Replacing the terminal envelope contract
- Adding progress output to `execute` directly (that path has no script subprocess)

---

## Dependencies

- Independent of PRD-1, PRD-2, PRD-3.
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

**`test/fixtures/scripts/chunked-output.sh`** — writes two chunks with a short delay:
```sh
#!/bin/sh
printf 'chunk1\n'
sleep 0.1
printf 'chunk2\n'
```

**`test/fixtures/scripts/mixed-streams.sh`** — writes to both stdout and stderr:
```sh
#!/bin/sh
printf 'stdout-line\n'
printf 'stderr-line\n' >&2
```

**`test/fixtures/scripts/no-output.sh`** — exits 0 with no output:
```sh
#!/bin/sh
exit 0
```

**`test/fixtures/scripts/split-word.sh`** — tests `--expect-contains` on accumulation:
```sh
#!/bin/sh
printf 'hel'
printf 'lo\n'
```

### TDD Sequence

**Before touching `runSkill.ts`:**
Write T1 (backward-compatible: no callbacks, output accumulated). Passes against the
existing code. This is the regression pin. After every change, T1 must still pass.

**After adding the `callbacks` parameter:**
Write T2 (callback receives chunks), T3 (output still accumulated), T4 (stderr chunks
with correct `stream` field). All must pass.

**After wiring the CLI layer:**
Write T5 (`--expect-contains` on split output), T6 (JSON mode has no interleaved text).

### Unit Tests

**T1 — `runSkill` without callbacks accumulates and returns output (regression anchor)**
- Setup: skill command that runs `chunked-output.sh`; no `callbacks` argument
- Expected: `SkillRunResult.output === "chunk1\nchunk2\n"`; no error thrown
- Failure mode protected: adding the `callbacks` parameter breaks the existing signature
  for callers that omit it; existing CLI code that calls `runSkill` without callbacks
  starts getting `undefined` or throws
- When: write before touching `runSkill.ts`; must pass before and after

**T2 — `onOutput` callback receives each chunk in order**
- Setup: skill runs `chunked-output.sh`; pass `callbacks: { onOutput: (chunk) => recorded.push(chunk) }`
- Expected: `recorded` contains `["chunk1\n", "chunk2\n"]` (in order) before the promise
  resolves; both chunks are in `recorded` by the time `await runSkill(...)` returns
- Failure mode protected: callback never called; chunks received out of order; callback
  fires after the promise resolves (useless for real-time display)

**T3 — `SkillRunResult.output` is still full string when `onOutput` is provided**
- Setup: same as T2
- Expected: `result.output === "chunk1\nchunk2\n"` (not `""`, not just `"chunk2\n"`)
- Failure mode protected: the callback consumes the output instead of duplicating it;
  the final result is empty, breaking any code that reads `result.output` after the
  skill finishes

**T4 — stderr chunks tagged with `stream: "stderr"`**
- Setup: skill runs `mixed-streams.sh`; `onOutput` records `{ chunk, stream }` pairs
- Expected: recorded pairs include `{ chunk: "stdout-line\n", stream: "stdout" }` and
  `{ chunk: "stderr-line\n", stream: "stderr" }` (order may vary)
- Failure mode protected: stderr never reaches the callback; or stderr and stdout both
  tagged as `"stdout"`, caller cannot distinguish error output

**T5 — `--expect-contains` works on accumulated output, not per-chunk**
- Setup: skill runs `split-word.sh`; `--expect-contains "hello"` (the word spans two
  `printf` calls and will never appear in a single chunk)
- Expected: check passes (accumulated output is `"hello\n"`)
- Failure mode protected: check accidentally moved to per-chunk evaluation; `"hello"`
  never found in any single chunk; `--expect-contains` starts false-failing for any
  output produced in multiple writes

**T6 — no output when `onOutput` not provided (edge case)**
- Setup: skill runs `no-output.sh`; `onOutput` callback provided and records calls
- Expected: `result.output === ""`; callback invoked 0 times; no error thrown
- Failure mode protected: zero-output path crashes or returns `undefined`

### CLI / Contract Regression

**T7 — `skills run --output json` produces only final JSON on stdout**
- Setup: a skill that prints progress text during execution (use a script that writes
  several lines then exits)
- Command: `clawperator skills run <skill-id> --output json`; capture stdout separately
  from stderr
- Expected: `JSON.parse(stdout)` succeeds; the JSON object is the result envelope only;
  no skill output lines appear in stdout (they go to stderr or are suppressed)
- Failure mode protected: `onOutput` wired to `process.stdout` regardless of output
  mode; JSON mode output becomes unparseable for agents that read it

### Integration Tests

One integration test. Requires no specific device state — any skill that produces
visible output during a run works.

**T8 — pretty mode shows output as it arrives**
- Command: `clawperator skills run <skill-with-stdout> --output pretty` in a TTY
- Expected: skill's stdout lines appear before the final result envelope; not all at once
  at the end
- Failure mode protected: onOutput wired but never actually flushed to terminal; output
  appears to arrive all at once (the buffering bug survives)

### What to Skip

- Do not write a test for `onOutput` that throws — this would test error-handling in a
  domain helper for a caller bug; the behavior (log to stderr, continue) is the right
  default but the test infrastructure cost (ensure the skill process keeps running after
  the callback throws) is high relative to the risk.
- Do not write concurrent-invocation tests for streaming — runSkill is one-process-per-
  call; concurrency is not a concern at this layer.

### Manual Verification

**M1 — visible progress during skill run**
- Run a skill known to take 5+ seconds with several print statements
- Command: `clawperator skills run <skill-id>` (TTY mode)
- Confirm: output appears incrementally (not all at once after 5 seconds)
- Confirm: `--output json` run of the same skill produces clean parseable JSON with no
  progress text in stdout

---

## Acceptance Criteria

- `skills run` in pretty/TTY mode: skill stdout is visible to the caller as it arrives.
- `skills run --output json`: no interleaving; stdout receives only the final JSON result.
- `runSkill.ts` does not write to `process.stdout` or `process.stderr` directly.
- `SkillRunResult.output` is unchanged (full accumulated string, not a stream reference).
- `--expect-contains` passes and fails correctly in both output modes.
- Call sites that do not pass `callbacks` compile and run without changes.
