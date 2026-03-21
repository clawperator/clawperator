# PRD-3: Skill Preflight With Payload Dry-run and Pre-run Gate [DONE]

Workstream: WS-3
Priority: 3
Proposed PR: PR-3
Status: [DONE]

Completed on branch `codex/prd-3-skill-preflight-dry-run`. The implementation landed, was verified on a real Android device, and the remaining notes are preserved here for history.

Merged from both agents. Other agent proposed documenting the compose chain; this analysis
proposes making it a single command and gating `skills run` on it by default. The
single-command approach was chosen because the three-step manual chain is not reliably
followed in practice - and since all Clawperator skills require an Android device, there
is no class of device-free skill that would be broken by a pre-run check.

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
4. `skills run` - no preflight. Spawns the skill script directly. Schema violations
   discovered mid-execution on a live device waste a device interaction and produce
   errors that do not identify the offending action.

The validation chain exists. It is not composed, and it is not enforced.

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

Without `--dry-run`, behavior is identical to today.

### 3. Gate `skills run` on dry-run validation by default

`clawperator skills run <skill_id>` runs the dry-run check before spawning the skill
script. This happens at the CLI layer, before `runSkill` is called.

**Implementation**: in the `skills run` CLI handler, call `validateSkill` with
`{ dryRun: true }` on the skill id. Inspect the result:

- `ok: false` - abort. Print the `SKILL_VALIDATION_FAILED` error. Exit non-zero.
  Do not call `runSkill`.
- `ok: true` and `dryRun.payloadValidation === "skipped"` (script-only skill) -
  proceed. Print `[INFO] Payload validation skipped: no pre-compiled artifacts` in
  pretty mode only. Do not print in JSON mode.
- `ok: true` (artifact-backed, validation passed) - proceed silently.

**`--skip-validate` flag**: add to `skills run`. When present, bypass the pre-run
dry-run check entirely. Exit-code and JSON contract are unchanged when this flag is used.
Document it as an escape hatch for CI or development scenarios, not as a routine option.

**Pre-run banner interaction (PRD-4)**: the banner (version, APK status, log path, docs
link) prints first. Then the dry-run check runs. If the check fails, the skill does not
start. The banner still appeared, giving the agent context for the failure.

### 4. Update the skill development workflow doc

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
Running a skill:
  clawperator skills run <id> --device-id <device_id>

skills run validates the skill payload automatically before touching the device.
If validation fails, the skill does not start and the error identifies the
offending action, type, and invalid parameters.

To see validation results before running:
  clawperator skills validate <id> --dry-run

To bypass pre-run validation (CI or development use only):
  clawperator skills run <id> --skip-validate --device-id <device_id>
```

Explain what `--dry-run` does and does not cover (no runtime behavior, no UI validation).
Note that script-only skills cannot be statically validated; the check is skipped for them
and execution proceeds.

The implementing agent owns this cross-repo work: edit the sibling repo source, open the
`clawperator-skills` PR, and ensure it merges before this PR ships. Do not defer it.

### 5. Surface dry-run failure using PRD-2 error format

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

## Documentation updates in PR-3

- `docs/node-api-for-agents.md`: document `skills validate --dry-run` and
  `skills run --skip-validate` under the CLI reference section. Explain what
  the pre-run gate covers and that script-only skills skip payload validation
  with a logged reason.
- `docs/skills/skill-development-workflow.md` (sibling repo): add `--dry-run`
  as the recommended pre-device step before `skills run`. Show the full workflow:
  `skills validate --dry-run` then `skills run`.

---

## Scope Boundaries

In scope:
- `skills validate --dry-run`: integrity + artifact compilation + schema validation
- `skills run` pre-run gate: dry-run check runs automatically before skill execution
- `skills run --skip-validate`: escape hatch to bypass the pre-run check
- Uses enriched error format from PRD-2
- Two source doc updates (node-api-for-agents, skill-development-workflow in sibling repo)

Out of scope:
- Changing default behavior of `skills validate` (no flag)
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
- `skills compile-artifact` must be callable in isolation (no device connection required)
  for at least the common case of pre-compiled artifacts.
- **Pre-ship skills audit (blocking)**: the `skills run` gate must not ship until all
  skills in the `clawperator-skills` repo have been audited with `--dry-run` and any
  failures are fixed. The gate turning on immediately breaks any agent running a skill
  with a stale artifact. Procedure:
  1. Build the PRD-3 branch locally.
  2. Run `clawperator skills validate --all --dry-run` (or iterate over every skill id
     in the registry) against the current `clawperator-skills` install.
  3. Document every failure: skill id, artifact name, invalid action, invalid keys.
  4. Fix each failing skill in a `clawperator-skills` PR. The GloBird `format: "ascii"`
     case is the known example; others may exist.
  5. The `clawperator-skills` fix PR must be merged (or ready to merge atomically) before
     this PRD-3 PR ships. Do not merge the gate without the skill fixes landing first.

---

## Risks and Tradeoffs

**Risk: script-only skills with device-dependent payload generation**
Some skill scripts may generate their payload by querying device state. For these, the `--dry-run` compile step will fail or produce an incomplete payload. Document this limitation clearly. Do not fail with a misleading error; detect the device-dependency and report it explicitly.

**Risk: compile-artifact and validate using different schemas**
If `skills compile-artifact` and `execute --validate-only` diverge in the schema they use, dry-run can give a false pass. Both must reference the same schema module. Enforce at the code level.

**Tradeoff: pre-run gate vs. `--skip-validate`**
All current Clawperator skills require an Android device. Making the dry-run check the
default for `skills run` is the right call: it catches schema violations before the device
is touched, at no meaningful cost (milliseconds, no device connection required). The
`--skip-validate` flag exists as an explicit escape hatch, not as a routine option. If
artifact compilation proves unreliable at scale (false negatives blocking valid runs),
the failure mode is visible and the workaround (`--skip-validate`) is explicit rather than
silent.

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

1. Write T1 (existing behavior pinned — no flag). Passes unchanged. Safety net throughout.
2. Scaffold `--dry-run` flag. Write T2 (valid artifact passes). Passes once routing works.
3. Write T3 (invalid fails), T4 (script-only skips). Wire compile + validate logic.
   T1 must still pass.
4. Write T5 (JSON mode parseable). Catches CLI output regressions.
5. Write T7 (`skills run` aborts on invalid artifact). Fails until gate is wired.
6. Write T8 (`skills run` proceeds on valid artifact, mock verifies runSkill called).
7. Write T9 (`--skip-validate` bypasses gate, runSkill always called).
8. Run integration test T6 with a real bundled skill.

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

**T7 — `skills run` aborts when dry-run fails (gate enforcement)**
- Input: `skills run test-skill-invalid-artifact --device-id <any>`
- Mock `runSkill` to track whether it was called
- Expected: process exits non-zero, `SKILL_VALIDATION_FAILED` in output, `runSkill`
  was NOT called
- Protects: gate is added but never wired; invalid skills still reach the device

**T8 — `skills run` proceeds when dry-run passes (gate happy path)**
- Input: `skills run test-skill-valid-artifact --device-id <any>`
- Mock `runSkill` to return a success result
- Expected: process exits 0, `runSkill` WAS called
- Protects: over-broad validation blocks all skills from running

**T9 — `--skip-validate` bypasses gate and calls `runSkill`**
- Input: `skills run test-skill-invalid-artifact --skip-validate --device-id <any>`
- Mock `runSkill` to return a success result
- Expected: process exits 0, `runSkill` WAS called, no validation error in output
- Protects: `--skip-validate` flag is ignored; escape hatch is broken

### Manual Verification

- Run `--dry-run` on `test-skill-invalid-artifact`; output should name the skill, artifact,
  action id, and invalid parameter; fixable without consulting docs
- Run `skills run` on a skill with an invalid artifact without `--skip-validate`; confirm
  it aborts before the device is touched

---

## Acceptance Criteria

- `clawperator skills validate <id> --dry-run` compiles all skill artifacts and validates
  them against the action schema for artifact-backed skills.
- A skill with `format: "ascii"` in a `snapshot_ui` action fails `--dry-run` with
  `details.actionId`, `details.actionType`, `details.invalidKeys`.
- `clawperator skills validate <id> --dry-run` on a script-only skill exits 0 and reports
  `dryRun.payloadValidation: "skipped"` with an explicit reason.
- `clawperator skills validate <id>` (no flag) behaves identically to today.
- A skill with valid files and valid payload passes `--dry-run`.
- `clawperator skills run <id>` automatically runs the dry-run check before spawning the
  skill. If validation fails, the process exits non-zero and the skill does not start.
- `clawperator skills run <id> --skip-validate` bypasses the pre-run check and proceeds
  directly to execution.
- All skills in the `clawperator-skills` registry pass `--dry-run` before this PR ships.
  Any that do not are fixed in a coordinated `clawperator-skills` PR that merges first.
- `../clawperator-skills/docs/skill-development-workflow.md` (source in sibling repo)
  documents that `skills run` validates automatically, explains `--skip-validate`, and
  notes that `--dry-run` can be run standalone to inspect results before running. The
  generated output at `sites/docs/docs/skills/skill-development-workflow.md` must NOT
  be edited directly.
