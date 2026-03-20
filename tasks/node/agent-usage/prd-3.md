# PRD-3: Skill Preflight With Payload Dry-run

Workstream: WS-3
Priority: 3
Proposed PR: PR-3

Merged from both agents. Other agent proposed documenting the compose chain; this analysis
proposes making it a single command. See `reconciliation.md` for the resolution.

---

## Problem Statement

`skills validate` checks integrity (files, metadata). `skills compile-artifact` compiles a skill to an execution payload. `execute --validate-only` validates an execution payload against the action schema. These three primitives exist, but no single command composes them. An agent must run all three in sequence - and in practice does not. A skill with a schema violation in its compiled artifact passes `skills validate` and only fails at runtime on a live device.

---

## Evidence

**From `apps/node/src/domain/skills/validateSkill.ts`:**

`validateSkill` and `validateAllSkills` check:
- Registry entry exists
- `skill.json`, `skillFile`, `scripts`, and `artifacts` files are present
- `skill.json` metadata fields match the registry entry

No execution payload compilation. No schema validation against the action schema.

**From `apps/node/src/cli/index.ts` (per other agent's inspection):**

The CLI already points to `execute --validate-only` after `skills compile-artifact` in its help text. The building blocks are documented but not composed.

**From `tasks/node/agent-usage/issues.md`, Issue #8:**
> The GloBird skill had an invalid `format: "ascii"` parameter. This was only caught at runtime, on the device, after the app was opened.
> I assumed if the skill script runs without errors, the skill is valid.

**From `tasks/agent-ui-loop/api-improvement-suggestions.md` (GAP-02):**
The `format` parameter was removed from `snapshot_ui`. Skills written before the removal are structurally valid but generate invalid payloads.

---

## Current Behavior

1. `skills validate <id>` - checks file integrity and metadata. Returns `ok: true` even when the compiled artifact would fail schema validation.
2. `skills compile-artifact <id> --artifact <name>` - compiles skill to execution payload JSON.
3. `execute --validate-only --execution <file>` - validates payload against action schema without touching the device.
4. `skills run` - no preflight. Spawns the skill script directly.

The validation chain exists. It is not composed.

---

## Proposed Change

### 1. Add `--dry-run` to `skills validate`

`clawperator skills validate <skill_id> --dry-run`

When `--dry-run` is specified:
1. Run the existing integrity checks (unchanged - files, metadata).
2. Inspect `skill.artifacts`:
   - **Artifact-backed skills** (one or more entries in `skill.artifacts`): compile each artifact using the same logic as `skills compile-artifact`, then validate the compiled payload against the action schema using the same path as `execute --validate-only`. Report any schema violations using the enriched error format from PRD-2.
   - **Script-only skills** (empty or absent `skill.artifacts`): run integrity checks only. Exit 0. Include a top-level `dryRun` field in the JSON output:
     ```json
     "dryRun": {
       "payloadValidation": "skipped",
       "reason": "skill has no pre-compiled artifacts; payload is generated at runtime by the skill script"
     }
     ```
     In pretty mode, print: `  [INFO] Payload validation skipped: no pre-compiled artifacts`
3. Do not attempt to execute or simulate the skill script for script-only skills. The dynamic payload path cannot be validated statically.

`--dry-run` coverage is explicitly scoped: it is a payload schema check, not a UI behavior simulation. Script-only skills get integrity validation only. Document this distinction prominently so agents understand what passes `--dry-run` and what does not.

### 2. Keep `skills validate` (no flag) unchanged

Without `--dry-run`, behavior is identical to today. This is an opt-in capability.

Do not make it the default until the impact on existing skills (particularly device-dependent script-only skills) is assessed.

### 3. Update `docs/skills/skill-development-workflow.md`

Add `skills validate --dry-run` as the recommended pre-device step:

```
Recommended pre-device workflow:
1. clawperator skills validate <id> --dry-run   # integrity + payload schema
2. clawperator skills validate <id>             # integrity only (if no artifacts)
3. clawperator skills run <id> --device-id <device_id>
```

Explain what `--dry-run` does and does not cover (no runtime behavior, no UI validation).

### 4. Surface dry-run failure using PRD-2 error format

When `--dry-run` detects a schema violation, the output should match the enriched `EXECUTION_VALIDATION_FAILED` format:

```json
{
  "ok": false,
  "code": "SKILL_VALIDATION_FAILED",
  "message": "Skill com.globird.energy.get-usage: artifact payload schema violation",
  "details": {
    "artifact": "get-usage.json",
    "actionId": "snap",
    "actionType": "snapshot_ui",
    "invalidKeys": ["format"],
    "hint": "'format' was removed from snapshot_ui. Remove this parameter."
  }
}
```

---

## Why This Matters for Agent Success

A single `--dry-run` flag catches the GloBird class of error (stale API usage in a compiled artifact) in under a second, before touching any device. Without it, the same error surfaces only after the app is opened on the device - wasting a device interaction and producing an error that does not identify the action.

---

## Scope Boundaries

In scope:
- `skills validate --dry-run`: integrity + artifact compilation + schema validation
- Uses enriched error format from PRD-2
- `docs/skills/skill-development-workflow.md` update

Out of scope:
- Changing default behavior of `skills validate`
- Validating runtime UI behavior (scrolling, click targets) offline
- Simulating device state for device-dependent skill scripts
- Changes to the Android Operator APK

---

## Dependencies

- PRD-2 should land first or concurrently. The enriched error format makes the dry-run failure output actionable. Can be developed in parallel but should merge after PRD-2.
- `skills compile-artifact` must be callable in isolation (no device connection required) for at least the common case of pre-compiled artifacts.

---

## Risks and Tradeoffs

**Risk: script-only skills with device-dependent payload generation**
Some skill scripts may generate their payload by querying device state. For these, the `--dry-run` compile step will fail or produce an incomplete payload. Document this limitation clearly. Do not fail with a misleading error; detect the device-dependency and report it explicitly.

**Risk: compile-artifact and validate using different schemas**
If `skills compile-artifact` and `execute --validate-only` diverge in the schema they use, dry-run can give a false pass. Both must reference the same schema module. Enforce at the code level.

**Tradeoff: `--dry-run` as explicit opt-in**
Making `--dry-run` the default would break CI for skills that can't compile without a device. Start as opt-in. Promote to default after assessing existing skill impact.

---

## Testing Plan

### Fixtures

Create minimal test skills in `test/fixtures/skills/`:

**`test-skill-invalid-artifact/`** — artifact-backed skill with a schema violation
- `skill.json`: valid metadata, one artifact entry pointing to `artifact.json`
- `artifact.json`: `{ "actions": [{ "id": "snap", "type": "snapshot_ui", "params": { "format": "ascii" } }] }`

**`test-skill-valid-artifact/`** — artifact-backed skill with a valid payload
- `skill.json`: valid metadata, one artifact
- `artifact.json`: valid action (e.g., a `tap` with correct params)

**`test-skill-script-only/`** — no artifacts field in skill.json
- `skill.json`: valid metadata, no `artifacts` key

**`test-skill-empty-artifacts/`** — artifacts array is present but empty
- `skill.json`: valid metadata, `"artifacts": []`

Two-artifact failure case: add a second invalid artifact to `test-skill-invalid-artifact`
for the "all failures reported" test, or create a separate fixture if cleaner.

### TDD Sequence

**Step 1 — before adding `--dry-run` at all:**
Write T1 (existing behavior unchanged). It passes. This is the pin. After every
subsequent change, T1 must still pass.

**Step 2 — scaffold `--dry-run` flag but before wiring compile + validate:**
Write T2 (valid artifact passes). It should pass once the scaffold correctly routes
artifact-backed skills. This confirms the scaffolding before the validation logic.

**Step 3 — wire compile + validate logic:**
Write T3, T4, T5, T6. Run them; most fail. Implement. All must pass. T1 must still pass.

### Unit Tests

**T1 — `skills validate` without `--dry-run` still passes invalid artifact (regression anchor)**
- Input: `test-skill-invalid-artifact`, no `--dry-run` flag
- Expected: `{ ok: true }` (integrity is fine; payload schema is not checked)
- Failure mode protected: `--dry-run` accidentally changes the behavior of the base
  `validate` command; existing CI that runs `skills validate` starts failing

**T2 — `--dry-run` passes for valid artifact-backed skill (happy-path anchor)**
- Input: `test-skill-valid-artifact`, `--dry-run` flag
- Expected: `{ ok: true }`; no `dryRun.payloadValidation: "skipped"` (it was validated)
- Failure mode protected: over-broad check blocks all skills including valid ones;
  dry-run becomes useless as a pre-device gate

**T3 — `--dry-run` fails for invalid artifact with actionable error**
- Input: `test-skill-invalid-artifact`, `--dry-run` flag
- Expected: `{ ok: false, code: "SKILL_VALIDATION_FAILED", details: { actionId: "snap", actionType: "snapshot_ui", invalidKeys: ["format"] } }`
- Failure mode protected: dry-run silently passes the invalid artifact; the point of the
  feature is missed

**T4 — `--dry-run` on script-only skill exits cleanly with skip notice**
- Input: `test-skill-script-only`, `--dry-run` flag
- Expected: `{ ok: true, dryRun: { payloadValidation: "skipped", reason: <non-empty string> } }`
- Failure mode protected: script-only skills crash or return `ok: false`; agents
  using `--dry-run` on all skills start seeing false failures for script-only skills

**T5 — `--dry-run` on empty artifacts array treated same as script-only**
- Input: `test-skill-empty-artifacts`, `--dry-run` flag
- Expected: same shape as T4 — `payloadValidation: "skipped"`
- Failure mode protected: `artifacts: []` handled differently from absent `artifacts`;
  empty array causes a crash or silent schema miss

**T6 — `--dry-run` reports all failures when multiple artifacts are invalid**
- Input: a skill with two artifacts, each with a different schema violation
- Expected: response contains entries for both artifacts (not just the first)
- Failure mode protected: early return on first failure; second invalid artifact goes
  undetected and surfaces at runtime

### CLI / Contract Regression

**T7 — `--dry-run` output in JSON mode is parseable for both pass and fail**
- Commands:
  1. `clawperator skills validate test-skill-valid-artifact --dry-run --output json`
  2. `clawperator skills validate test-skill-invalid-artifact --dry-run --output json`
- Expected for both: `JSON.parse(stdout)` succeeds; no interleaved text
- Failure mode protected: error path prints non-JSON to stdout and breaks agent
  that parses the result

**T8 — compile and validate use the same schema (static check)**
- In the implementation, compile-artifact and execute's validation must import the
  action schema from the same module. Add a comment in both call sites naming the
  shared import. Write a test that imports both and asserts they reference the same
  object (or at minimum the same module path).
- Failure mode protected: schema drift between compile and validate produces a false
  pass where `--dry-run` says valid but `execute` says invalid

### Integration Tests

One integration test is sufficient here. No device is needed — `--dry-run` is
explicitly designed to work without a device.

**T9 — real bundled skill passes `--dry-run`**
- Precondition: registry contains a bundled skill with a pre-compiled artifact (e.g.,
  `com.android.settings.capture-overview` if it ships with the repo)
- Command: `clawperator skills validate <bundled-skill-id> --dry-run`
- Expected: `ok: true`; no `payloadValidation: "skipped"` (it has an artifact)
- Failure mode protected: real skill infrastructure not correctly wired to `--dry-run`

### What to Skip

- Do not test runtime UI behavior via `--dry-run` (out of scope by design).
- Do not test device-dependent script-only skills in dry-run (they correctly return
  "skipped"; testing against a real device adds no value here).
- Skip testing every invalid parameter type — T3 is sufficient to confirm the validation
  path works; the underlying validation logic is covered by PRD-2 tests.

### Manual Verification

**M1 — actionable failure message**
- Run: `clawperator skills validate test-skill-invalid-artifact --dry-run`
- Confirm: the output names the skill, the artifact file, the action id (`snap`), and the
  invalid parameter (`format`); a developer can fix the artifact without opening docs

---

## Acceptance Criteria

- `clawperator skills validate <id> --dry-run` compiles all skill artifacts and validates them against the action schema for artifact-backed skills.
- A skill with `format: "ascii"` in a `snapshot_ui` action fails `--dry-run` with `details.actionId`, `details.actionType`, `details.invalidKeys`.
- `clawperator skills validate <id> --dry-run` on a script-only skill exits 0 and reports `dryRun.payloadValidation: "skipped"` with an explicit reason.
- `clawperator skills validate <id>` (no flag) behaves identically to today.
- A skill with valid files and valid payload passes `--dry-run`.
- `docs/skills/skill-development-workflow.md` documents `--dry-run` as the pre-device validation step for artifact-backed skills, with an explicit note that script-only skills cannot be statically validated.
