# PRD-3: Skill Preflight With Payload Dry-run

Workstream: WS-3
Priority: 3
Proposed PR: PR-3

Merged from both agents. Other agent proposed documenting the compose chain; this analysis
proposes making it a single command. The single-command approach was chosen because the
three-step manual chain is not reliably followed in practice.

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

**GloBird incident (OpenClaw session logs):**
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

**Before implementing**: locate the compile-artifact and validate-only domain functions.
Search `apps/node/src/domain/skills/` for the module that handles artifact compilation
(the CLI command `skills compile-artifact` maps to a domain function). Also note that
`execute --validate-only` reuses `validateExecution` from `validateExecution.ts` -
you can call it directly rather than going through the CLI command. The dry-run path
should call `validateExecution(artifactJson)` after reading the artifact file. Do not
duplicate the schema validation logic.

When `--dry-run` is specified:
1. Run the existing integrity checks (unchanged - files, metadata).
2. Inspect `skill.artifacts`:
   - **Artifact-backed skills** (one or more entries in `skill.artifacts`): read each
     artifact JSON file from the resolved path in `ValidateSkillResult.checks.artifactPaths`,
     parse it, and call `validateExecution(parsed)`. If it throws, extract the
     `ValidationFailure` details and report them. Use the enriched error format from PRD-2.
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

### 3. Update the skill development workflow doc

**IMPORTANT - do not edit the generated file.** Per `CLAUDE.md`, `sites/docs/docs/` is
generated output that must never be edited directly. The generated page
`sites/docs/docs/skills/skill-development-workflow.md` is produced from the source at:

```
../clawperator-skills/docs/skill-development-workflow.md
```

(Confirmed via `sites/docs/source-map.yaml` line 207-210.)

This source lives in the sibling `clawperator-skills` repo, not in this repo. To update
it:

1. Edit `../clawperator-skills/docs/skill-development-workflow.md` in the sibling repo.
2. Submit a PR to the `clawperator-skills` repo with the change.
3. After that PR merges, run the `docs-generate` skill in this repo to regenerate
   `sites/docs/docs/skills/skill-development-workflow.md`.

Content to add (in the sibling repo source):

```
Recommended pre-device workflow:
1. clawperator skills validate <id> --dry-run   # integrity + payload schema
2. clawperator skills validate <id>             # integrity only (if no artifacts)
3. clawperator skills run <id> --device-id <device_id>
```

Explain what `--dry-run` does and does not cover (no runtime behavior, no UI validation).

If coordinating the sibling repo PR is out of scope for the implementing agent, note this
as a follow-up item in the PR description.

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

- PRD-2 should land first or concurrently. `--dry-run` is fully functional without PRD-2
  (it exits with `SKILL_VALIDATION_FAILED` regardless). The dependency is about error
  quality only: with PRD-2, the output includes `actionId`, `actionType`, `invalidKeys`,
  and `hint`. Without PRD-2, the output has only `code` and `message`. Merge after PRD-2
  to ship the complete user experience.
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

Four minimal skill fixtures in `test/fixtures/skills/`:
- `test-skill-invalid-artifact/`: valid `skill.json` + `artifact.json` containing
  `snapshot_ui` with `format: "ascii"`
- `test-skill-valid-artifact/`: valid `skill.json` + `artifact.json` with a valid `tap`
  action
- `test-skill-script-only/`: valid `skill.json` with no `artifacts` field
- `test-skill-empty-artifacts/`: valid `skill.json` with `"artifacts": []`

### TDD Sequence

1. Write T1 (existing behavior pinned — no flag). Passes unchanged. This is the safety
   net for every subsequent step; it must pass throughout.
2. Scaffold `--dry-run` flag. Write T2 (valid artifact passes). Passes once routing works.
3. Write T3 (invalid fails), T4 (script-only skips). Wire compile + validate logic.
   T1 must still pass.
4. Write T5 (JSON mode parseable). Quick to verify and catches CLI output regressions.
5. Run integration test T6 with a real bundled skill.

### Unit Tests

**T1 — `skills validate` (no flag) still passes invalid artifact (regression anchor)**
- Input: `test-skill-invalid-artifact`, no `--dry-run`; expected: `{ ok: true }`
- Protects: flag changes base command behavior; CI that runs `skills validate` starts
  failing; must pass throughout all development steps

**T2 — `--dry-run` passes for valid artifact-backed skill (happy-path anchor)**
- Input: `test-skill-valid-artifact --dry-run`; expected: `{ ok: true }`
- Protects: over-broad check blocks all skills; dry-run useless as a pre-device gate

**T3 — `--dry-run` fails with actionable details for invalid artifact**
- Input: `test-skill-invalid-artifact --dry-run`
- Expected: `{ ok: false, code: "SKILL_VALIDATION_FAILED",
  details: { actionId: "snap", actionType: "snapshot_ui", invalidKeys: ["format"] } }`
- Protects: dry-run silently passes; the feature's core purpose is missed

**T4 — `--dry-run` on script-only skill exits cleanly with skip notice**
- Input: `test-skill-script-only --dry-run`
- Expected: `{ ok: true, dryRun: { payloadValidation: "skipped", reason: <non-empty> } }`
- Protects: script-only skills crash or return false; agents get false failures for all
  non-artifact skills

**T5 — `--dry-run` JSON output is parseable for both pass and fail**
- Commands: dry-run on valid and invalid skills with `--output json`
- Expected: `JSON.parse(stdout)` succeeds in both cases
- Protects: error path writes non-JSON to stdout; agent that parses the result breaks

### Integration Tests

No device required — `--dry-run` is designed to work without one.

**T6 — real bundled skill passes `--dry-run`**
- Command: `clawperator skills validate <bundled-skill-id> --dry-run`
- Expected: `ok: true`; no "skipped" (the skill has an artifact)
- Protects: fixture tests pass but real skill infrastructure not correctly wired

**Fallback if no installed skill has pre-compiled artifacts**: use
`test-skill-valid-artifact` fixture as the stand-in and note in the PR that T6 against
a real bundled skill is deferred until a bundled skill with artifacts is confirmed to
exist in the installed registry.

### Manual Verification

- Run `--dry-run` on `test-skill-invalid-artifact`; output should name the skill, artifact,
  action id, and invalid parameter; fixable without consulting docs

---

## Acceptance Criteria

- `clawperator skills validate <id> --dry-run` compiles all skill artifacts and validates them against the action schema for artifact-backed skills.
- A skill with `format: "ascii"` in a `snapshot_ui` action fails `--dry-run` with `details.actionId`, `details.actionType`, `details.invalidKeys`.
- `clawperator skills validate <id> --dry-run` on a script-only skill exits 0 and reports `dryRun.payloadValidation: "skipped"` with an explicit reason.
- `clawperator skills validate <id>` (no flag) behaves identically to today.
- A skill with valid files and valid payload passes `--dry-run`.
- `../clawperator-skills/docs/skill-development-workflow.md` (source in sibling repo) documents `--dry-run` as the pre-device validation step for artifact-backed skills, with an explicit note that script-only skills cannot be statically validated. The generated output at `sites/docs/docs/skills/skill-development-workflow.md` must NOT be edited directly.
