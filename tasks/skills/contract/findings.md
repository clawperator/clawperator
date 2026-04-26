# SkillResult Contract - Authoritative Findings

**Date:** 2026-04-26
**Sources reconciled:** findings-claude.md, findings-codex.md, findings-skill-survey.md
**Verified against:**
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/contracts/skillResult.ts`
- 14 skill scripts in `../clawperator-skills/skills/`

---

## 1. Executive Summary

The contract is **not safe for general agent consumption** in its current state. Two issues block it:

1. **Frame duplication in JSON mode.** The `output` field in JSON-mode responses contains the raw `[Clawperator-Skill-Result]` marker and the embedded JSON blob that is already parsed into `skillResult`. Agents receive the answer twice - once structured, once as escaped text inside a string. The fix is a single conditional in `skills.ts`.

2. **No canonical result location.** `SkillResult` has no `result` field. The answer to "what did this skill return?" is buried at different depths in different fields depending on which skill ran. Agents must have per-skill knowledge to extract the answer.

Everything else in this document is real but non-blocking. Fix these two first.

---

## 2. Core Contract Issues (CLI + Runtime)

### C-1 - High: Frame embedded in `output` in JSON mode

**Code location:** `apps/node/src/cli/commands/skills.ts:546-548`

```ts
output: options.format === "pretty"
  ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
  : result.output,
```

In JSON mode, `result.output` is raw child stdout - progress lines, the `[Clawperator-Skill-Result]` marker, and the embedded JSON blob are all present. In pretty mode, `sanitizePrettySkillStdout` calls `stripTrailingSkillResultFrame` to remove the frame. The JSON path never strips it.

- **Agent impact:** Agents receive a duplicate of the structured result as an escaped substring inside `output`. Any agent that parses `output` for the answer hits marker noise and potentially double-parses. The `skillResult` field is the correct location; `output` in JSON mode should contain only the pre-frame human-readable progress lines.
- **Operator impact:** The raw frame and JSON add significant payload for no machine benefit.
- **Minimal fix:** Apply `stripTrailingSkillResultFrame(result.output, result.skillResult !== null)` on the JSON path in the same conditional. One line.
- **Compat risk:** Consumers scraping the frame out of `output` would break. Those consumers are doing the wrong thing - `skillResult` exists for them - but a changelog note is warranted.

### C-2 - Medium: Wrapper `status: "indeterminate"` is not documented relative to `skillResult.status`

**Code location:** `apps/node/src/domain/skills/runSkill.ts:1003-1015`

```ts
if (hasDeclaredVerification && !contractVerification.ok) {
  finish({
    ok: null,
    status: "indeterminate",
    ...
    skillResult: parsedSkillResult.skillResult,
  });
}
```

When a declared verification contract (`skill.json` → `contract.verification.matcher`) fails to pass, the wrapper emits `status: "indeterminate"` while the nested `skillResult.status` may still be `"success"` (the skill reported success; the wrapper could not verify it). No documented precedence rule tells agents which status to trust.

- **Agent impact:** Agents reading `result.skillResult.status` directly will miss the wrapper's rejection.
- **Minimal fix:** Document the read order explicitly:
  1. Branch on outer `status` (`"success"` / `"indeterminate"` / `"failed"`).
  2. Read `skillResult.status` only after outer `status === "success"`.
  3. Treat `skillResult` as child-authored evidence the wrapper may reject.
- **Compat risk:** None - documentation only.

### C-3 - Low: Success and failure shapes use different stdout field names

**Code location:** `skills.ts:543` (success, `output`), `skills.ts:572-584` (assertion failure, `output`), `skills.ts:586-599` (general failure, `stdout` + `stderr`)

On success and output-assertion failure the response uses `output`. On general execution failure (process error, spawn failure, timeout) the response uses `stdout` and `stderr` as separate fields. The asymmetry is undocumented.

- **Minimal fix:** Document the two shapes in `docs/skills/runtime.md`. Long term, unify to `stdout` + `stderr` on all paths.
- **Compat risk:** Medium if unifying field names; low if documentation only.

---

## 3. SkillResult Schema Issues

### S-1 - High: No `result` field - the answer has no canonical location

**Code location:** `apps/node/src/contracts/skillResult.ts:97-108` (interface), lines 190-200 (Zod schema)

```ts
export interface SkillResult {
  contractVersion: string;
  skillId: string;
  source: SkillResultSource;
  goal?: JsonObject;
  inputs?: JsonObject;
  status: SkillResultStatus;
  checkpoints: SkillCheckpoint[];
  terminalVerification?: SkillTerminalVerification | null;
  execEnvelopes?: ResultEnvelope[];
  diagnostics?: SkillDiagnostics;
  // No result field.
}
```

Neither the TypeScript interface nor `emittedSkillResultSchema` define a `result` field. The domain answer is implied by proof artifacts (checkpoints, terminalVerification) rather than declared as a first-class output.

- **Agent impact:** Extracting the answer requires per-skill knowledge: which checkpoint id, or whether to read `terminalVerification.observed`, or whether the answer is in `diagnostics`. There is no `skillResult.result` shortcut that works across skills.
- **Minimal fix:**

  Add to `SkillResult` and `emittedSkillResultSchema`:
  ```ts
  result?: SkillCheckpointEvidence | null;
  ```
  Reusing `SkillCheckpointEvidence` (`kind: "text"`, `kind: "json"`, or `kind: "result_envelope_ref"`) avoids introducing a second evidence vocabulary. Skills that return a value set it explicitly; proof fields remain as-is. Additive - no compat risk.

### S-2 - Medium: `SkillDiagnostics` catchall enables diagnostics as an untyped overflow bag

**Code location:** `skillResult.ts:90-95`, `skillDiagnosticsSchema:184-188`

```ts
export interface SkillDiagnostics {
  runtimeState?: SkillRuntimeState;
  warnings?: string[];
  hints?: string[];
  [key: string]: JsonValue | string[] | undefined;  // catchall
}
```

The `[key: string]` index signature accepts any field. `skillDiagnosticsSchema` uses `.catchall(jsonValueSchema)`, so arbitrary keys survive Zod validation and appear in CLI output. This is the mechanism by which two skills (see X-1) attach their primary output to `diagnostics`.

- **Agent impact:** Agents have no reason to look in `diagnostics` for the answer. The field name implies runtime health; extra arbitrary fields are invisible to any consumer reading docs or types.
- **Minimal fix:** The catchall itself is acceptable for runtime-state extensions. The fix is a documented convention: only `runtimeState`, `warnings`, and `hints` carry skill-authored content; structured results must go in `result`. Enforce through authoring docs and skill review, not schema changes.

### S-3 - Medium: `terminalVerification.observed` intended as proof, used as result carrier

**Code location:** `skillResult.ts:83-88`, runtime matcher at `runSkill.ts:546-562`

`SkillTerminalVerification.observed` accepts any `SkillCheckpointEvidence`, including `kind: "json"`. The runtime's declared verification logic (`runSkill.ts:553-555`) calls `extractTextEvidence` on `observed`, which returns `null` for non-text evidence. If a skill uses `kind: "json"` in `observed` and the runtime's declared matcher runs, it will always fail to match.

- **Agent impact:** `terminalVerification` looks like the answer because it is near the top of `skillResult` and contains observed evidence. It is a proof artifact, not the answer channel. Skills that put structured data in `observed.value` compound this by conflating verification with result delivery.
- **Minimal fix:** Document that `terminalVerification` is a proof artifact. When `skillResult.result` exists, agents should prefer it. Skill authors should not rely on `observed` for structured output.
- **Compat risk:** Documentation only.

---

## 4. Cross-Skill Inconsistencies

Survey of 14 skills that emit `[Clawperator-Skill-Result]` frames.

### X-1 - High: Answer location varies by skill with no documented canonical path

| Skill | Answer location |
|---|---|
| `com.solaxcloud.starter.get-battery` | `skillResult.result` (correct) |
| `com.android.vending.install-app` | `skillResult.result` (correct) |
| `com.globird.energy.get-yesterday-usage-cost-replay` | `skillResult.checkpoints[1].evidence.text` |
| `com.google.android.apps.chromecast.app.set-temperature-replay` | `skillResult.terminalVerification.observed.text` |
| `com.google.android.apps.chromecast.app.set-power-replay` | `skillResult.terminalVerification.observed.text` |
| `com.netflix.mediaclient.set-my-list-state-replay` | `skillResult.terminalVerification.observed.text` |
| `au.com.polyaire.airtouch5.set-zone-state` (+ shared lib) | `skillResult.terminalVerification.observed.text` |
| `com.solaxcloud.starter.set-discharge-to-limit-replay` | `skillResult.terminalVerification.observed.text` |
| `com.google.android.apps.chromecast.app.get-climate-replay` | `skillResult.diagnostics.climate` (worst case - see below) |
| `com.amazon.mShop.android.shopping.search-products` | `skillResult.diagnostics.results` |
| `com.android.vending.search-app` | `skillResult.terminalVerification.observed.value` (json kind) |
| Orchestrated harnesses | defer to wrapped skill's result |

Two skills are correct. Twelve are not. The fix for all of them is to populate `skillResult.result` once S-1 is resolved.

### X-2 - High: `diagnostics` used as primary result carrier (2 skills)

- `get-climate-replay`: climate object (device name, power state, temperature, mode, fan speed) at `skillResult.diagnostics.climate`. Also duplicated at `checkpoints[2].evidence.value` and `terminalVerification.observed.value` - three copies in total with no documented canonical location.
- `search-products` (Amazon): structured product list at `skillResult.diagnostics.results`.

`diagnostics` is designed for runtime health data. These fields survive Zod because `skillDiagnosticsSchema` uses `.catchall()` (see S-2). An agent skipping `diagnostics` silently misses the entire output for these two skills.

**Minimal fix:** Move primary output to `skillResult.result`. `get-climate-replay` also collapses its three-location duplication to one.

### X-3 - Medium: Two checkpoint construction patterns with incompatible null-handling

**Map/state-machine pattern** (pre-populated with `"skipped"`, then updated):
- `set-temperature-replay`, `set-power-replay`, `set-discharge-to-limit-replay`, `get-climate-replay`
- All declared checkpoint ids are always present; absent progress shows as `status: "skipped"`.

**Push-based pattern** (empty array, appended as skill progresses):
- `install-app`, `search-app`, `search-products`, `set-my-list-state-replay`, `set-zone-state`, `get-battery`
- Only reached checkpoints appear; later checkpoints are absent on early failure.

An agent calling `checkpoints.find(c => c.id === "terminal_state_verified")` gets `{ status: "skipped" }` on map-based skills and `undefined` on push-based skills for the same early-failure scenario. These require different null-handling logic.

**Minimal fix:** Document both patterns and the required null-handling for each. Standardize new skills on the map/state-machine pattern to guarantee all declared checkpoint ids are always present.

### X-4 - Low: `diagnostics` conditionally absent (1 skill)

`set-discharge-to-limit-replay` attaches `diagnostics` only when `warnings.length > 0`. On a clean run, `skillResult.diagnostics` is `undefined`. Agents checking `result.skillResult.diagnostics?.warnings` get `undefined` on success and an array on partial failure.

**Minimal fix:** Include `diagnostics: { warnings: [] }` unconditionally.

### X-5 - Low: `expected === observed` on terminal verification success (1 skill)

`set-my-list-state-replay` sets both `terminalVerification.expected` and `observed` to the same interpolated string on success. The fields carry no contrast - verification shows what was set, not what was separately observed to confirm it.

**Minimal fix:** Set `expected` to the declaration (what the skill was looking for) and `observed` to what the device actually reported.

---

## 5. Verified Deviations and Corrections

### Correction 1: N-3 schema behavior is wrong in the survey

`findings-skill-survey.md` states that the root-level `results` field in `search-app` "pass[es] Zod's `passthrough` behavior." This is incorrect.

`emittedSkillResultSchema` is `z.object({...})` with no `.passthrough()` call (`skillResult.ts:190-200`). Zod strips unknown root-level keys by default. The `results` field emitted by `search-app` is silently dropped during parsing and **does not appear in `skillResult`** in the CLI output.

The actual location of the results data for `search-app` is `skillResult.terminalVerification.observed.value` (kind: "json"), which does survive because `observed` is typed as `SkillCheckpointEvidence | null`.

The finding that search-app's answer location is non-standard stands - but the mechanism and the accessible location differ from the survey's description.

### Correction 2: Codex line references

`findings-codex.md` cites `runSkill.ts:833` as the start of stdout/stderr capture. Line 833 is the `settled = true` assignment inside `finish()`. Actual stdout capture is at line 842 (`child.stdout?.on("data", ...)`) and stderr at line 856 (`child.stderr?.on("data", ...)`). The substantive claim is accurate; the line number is off by ~10 lines.

### Confirmation: C-1 is verified

Both the Claude and Codex documents identify the frame-in-output bug but from different angles. Claude correctly identifies `skills.ts:546-548` as the root cause. Codex identifies the operator-UX consequence. Both are correct and consistent. The fix is the same: apply `stripTrailingSkillResultFrame` on the JSON path.

### Confirmation: `output` field asymmetry (C-3) is real

Codex finding 3 correctly describes the asymmetry. `skills.ts:543` passes `output` on success; `skills.ts:586-599` passes `stdout` + `stderr` on general failure; `skills.ts:572-584` passes `output` on assertion failure. The three paths have different field sets.

---

## 6. Required Closeout Work

Ordered by impact. Items 1-3 apply to the runtime/CLI. Items 4-8 apply to individual skills.

- [ ] **C-1: Strip frame from `output` in JSON mode.** One conditional in `skills.ts:546-548`. Apply `stripTrailingSkillResultFrame` when `skillResult !== null` on the JSON path. Add changelog note.
- [ ] **S-1: Add `result?: SkillCheckpointEvidence | null` to `SkillResult`.** Update both the TypeScript interface (`skillResult.ts:97-108`) and `emittedSkillResultSchema` (`skillResult.ts:190-200`). Update skill authoring docs to require `result` for any skill whose purpose is to return a value.
- [ ] **C-2: Document status precedence rule.** Wrapper `status` → `skillResult.status` → proof fields. Add to `docs/skills/runtime.md`.
- [ ] **X-2 (get-climate-replay): Move `diagnostics.climate` to `result`.** Collapse the three-location duplication. `diagnostics.climate`, `checkpoints[2].evidence.value`, and `terminalVerification.observed.value` collapse to `result: { kind: "json", value: climate }`. This is the highest-severity single-skill case.
- [ ] **X-2 (search-products): Move `diagnostics.results` to `result`.** `result: { kind: "json", value: items }`.
- [ ] **X-1 (remaining read skills): Populate `result`.** Once S-1 is merged, update all read skills to emit `skillResult.result`. Setter skills may emit `result: { kind: "text", text: confirmedValue }` when they verify a terminal state.
- [ ] **X-4: Emit `diagnostics` unconditionally in set-discharge-to-limit-replay.**
- [ ] **X-5: Differentiate `expected` from `observed` in set-my-list-state-replay.**
