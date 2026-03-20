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
2. For each artifact defined in `skill.artifacts`, compile it using the same logic as `skills compile-artifact`.
3. Validate the compiled payload against the action schema using the same path as `execute --validate-only`.
4. Report any schema violations using the enriched error format from PRD-2: action `id`, `type`, `invalidKeys`, and `hint`.

If a skill has no artifacts (script-only skills), step 2-3 produce no output for the payload validation phase. Document this: `--dry-run` on a script-only skill validates integrity but cannot validate the payload since there is no pre-compiled artifact.

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

## Validation Plan

1. Unit test: `skills validate --dry-run` returns `SKILL_VALIDATION_FAILED` for a skill with `{ type: "snapshot_ui", params: { format: "ascii" } }` in its artifact.
2. Unit test: response includes `details.actionId`, `details.actionType`, `details.invalidKeys`.
3. Unit test: `details.hint` is populated for the `snapshot_ui.format` case.
4. Unit test: `skills validate` (no flag) still returns `ok: true` for the same skill (existing behavior unchanged).
5. Integration test: `skills validate --dry-run com.android.settings.capture-overview` passes (real bundled skill with valid artifact).
6. Manual verification: dry-run failure message is sufficient to fix the payload without consulting docs.

---

## Acceptance Criteria

- `clawperator skills validate <id> --dry-run` compiles all skill artifacts and validates them against the action schema.
- A skill with `format: "ascii"` in a `snapshot_ui` action fails `--dry-run` with `details.actionId`, `details.actionType`, `details.invalidKeys`.
- `clawperator skills validate <id>` (no flag) behaves identically to today.
- A skill with valid files and valid payload passes `--dry-run`.
- `docs/skills/skill-development-workflow.md` documents `--dry-run` as the pre-device validation step.
