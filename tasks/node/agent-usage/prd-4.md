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

## Validation Plan

1. Unit test: `runSkill` with `onOutput` callback - callback receives each chunk before the promise resolves.
2. Unit test: `SkillRunResult.output` contains full accumulated stdout regardless of whether `onOutput` is provided.
3. Unit test: `runSkill` without `callbacks` argument behaves identically to today (backward-compatible).
4. Unit test: `--expect-contains` still works correctly (operates on full accumulated output, not streaming chunks).
5. Unit test: `SKILL_EXECUTION_TIMEOUT` still returns partial `stdout` in the error.
6. Integration test: `skills run --output json` produces no interleaved progress text - only the final JSON result on stdout.
7. Integration test: `skills run` in pretty mode shows the skill's stdout lines as they arrive.

---

## Acceptance Criteria

- `skills run` in pretty/TTY mode: skill stdout is visible to the caller as it arrives.
- `skills run --output json`: no interleaving; stdout receives only the final JSON result.
- `runSkill.ts` does not write to `process.stdout` or `process.stderr` directly.
- `SkillRunResult.output` is unchanged (full accumulated string, not a stream reference).
- `--expect-contains` passes and fails correctly in both output modes.
- Call sites that do not pass `callbacks` compile and run without changes.
