# PRD-4: Skills Validate with Execution Payload Dry-run

Workstream: WS-4
Priority: 4
Proposed PR: PR-4

---

## Problem Statement

`clawperator skills validate` exists and checks a skill's file structure and metadata. It does not execute the skill's compile step and validate the resulting execution payload against the action schema. A skill with an invalid `format: "ascii"` parameter in a `snapshot_ui` action passes `skills validate` cleanly and only fails at runtime, on a live device, after the app has been opened.

This means skill authors - and agents that write or modify skills - have no way to catch schema violations before touching a device.

---

## Evidence

**From `tasks/node/agent-usage/issues.md`, Issue #8:**
> The GloBird skill had an invalid `format: "ascii"` parameter. This was only caught at runtime, on the device, after the app was opened. The skill script itself is valid JavaScript - the error was in the execution payload.
> I assumed if the skill script runs without errors, the skill is valid. But the skill generates an execution payload that gets validated later. There's no "compile" or "validate" step for skills.

**From `docs/node-api-for-agents.md` CLI reference:**
`skills validate <skill_id>` is listed as "Verify one local skill's metadata and required files before runtime testing."

The description says "metadata and required files" - not "execution payload." The current scope is explicitly file-structural.

**From `tasks/agent-ui-loop/api-improvement-suggestions.md` (GAP-02, HIGH):**
The `format` parameter being silently accepted (for a different reason - `enter_text clear: true`) is a broader pattern of contract gaps that survive structural validation.

---

## Current Behavior

```bash
clawperator skills validate com.globird.energy.get-usage
# Checks: skill directory exists, SKILL.md present, entry script present, registry entry valid
# Result: PASS

clawperator skills run com.globird.energy.get-usage --device-id <device_id>
# Opens GloBird app on device
# Dispatches execution payload
# Payload contains: { type: "snapshot_ui", params: { format: "ascii" } }
# EXECUTION_VALIDATION_FAILED: Unrecognized key(s) in object: 'format'
```

The validate step gave a false pass. The runtime failure happened after device interaction was already underway.

---

## Proposed Change

### 1. Add `--dry-run` flag to `skills validate`

`clawperator skills validate <skill_id> --dry-run`

When `--dry-run` is specified:
1. Run the existing structural validation checks (unchanged).
2. Compile the skill artifact: execute the skill's entry script with a mock or stub device context to produce the execution payload JSON. This must not require a connected device.
3. Validate the resulting execution payload JSON against the same action schema used by `execute --validate-only`.
4. Report any schema violations with the enriched error context from WS-2 (action `id`, `type`, invalid parameter names).

If the skill's entry script requires a connected device to produce its payload (e.g., it reads device state to decide which actions to include), the `--dry-run` flag should document this limitation and provide a best-effort partial validation.

### 2. Make `--dry-run` the default for `skills validate` (consideration)

If the compile step is fast and reliable in isolation (no device required), consider making payload validation the default behavior of `skills validate` rather than an opt-in flag. This ensures every future `skills validate` call catches schema violations.

This is a product decision that depends on how many existing skills require device state to compile. If the answer is "most skills," keep it as `--dry-run`. If the answer is "very few," make it the default and document that device-dependent skills need `--no-dry-run` to skip payload validation.

### 3. Add to skill development workflow docs

- `docs/skills/skill-development-workflow.md`: Add `skills validate --dry-run` as a required pre-commit step.
- Recommend: `skills validate --dry-run` should pass before `skills run` is attempted on a device.
- If CI/CD is used for skill development, add `skills validate --dry-run` to the pipeline.

### 4. `skills compile-artifact` as the underlying mechanism

`clawperator skills compile-artifact <id> --artifact <name>` already exists in the CLI. The dry-run validation can be built on top of this: compile the artifact, then run schema validation on the compiled JSON. If compile-artifact already fails for device-dependent skills, that failure mode is already documented.

---

## Why This Matters for Agent Success

An agent that modifies a skill (to fix a bug, update selectors, or add a step) has no way to verify the modified skill is schema-valid without running it on a device. With `--dry-run`, the agent can validate the payload in under a second, confirm there are no schema errors, and then proceed to the device run with confidence. This removes one category of live-device-required debugging entirely.

It also closes the false-confidence gap in `skills validate`: a skill that passes validate but fails immediately at runtime is a broken authoring contract.

---

## Scope Boundaries

In scope:
- `skills validate --dry-run`: compile artifact + schema validation
- Report offending action context (from WS-2 error enrichment)
- `docs/skills/skill-development-workflow.md` update

Out of scope:
- `--dry-run` simulating device state (no mock device)
- Validating runtime behavior (scroll, click, navigation) offline
- Any changes to the Android Operator APK

---

## Dependencies

- WS-2 (PRD-2) should ship first: the enriched error format (action `id`, `type`, invalid keys) is what makes the dry-run failure message actionable. Can be developed in parallel but should be merged after PRD-2.
- `skills compile-artifact` must be usable without a connected device for at least the common case.

---

## Risks and Tradeoffs

**Risk: device-dependent skill compilation**
Some skills may read device state (e.g., current package, screen dimensions) when generating their execution payload. For these, dry-run compilation will fail or produce an incomplete payload. Mitigation: document the limitation, provide a `--no-dry-run` escape hatch, and encourage skill authors to separate device-querying from payload construction.

**Risk: compile-artifact and validate going out of sync**
If the schema used for `execute` validation diverges from the schema used in `skills validate --dry-run`, a skill can pass dry-run but fail at runtime. Mitigation: both must use the same schema module. Enforce this at the code level, not the documentation level.

**Tradeoff: making --dry-run default**
If made default, skills that fail dry-run compilation (device-dependent) will see `skills validate` fail in CI even though the skill is correct. This is noisy. Start with `--dry-run` as an explicit opt-in; promote to default after assessing impact on existing skills.

---

## Validation Plan

1. Unit test: `skills validate --dry-run` fails for a skill with `{ type: "snapshot_ui", params: { format: "ascii" } }`.
2. Unit test: `skills validate --dry-run` passes for the same skill after removing the `format` parameter.
3. Unit test: error output includes action `id`, `type`, and `invalidKeys`.
4. Integration test: `skills validate --dry-run com.android.settings.capture-overview` passes (real bundled skill).
5. Manual verification: the dry-run failure message is sufficient for an agent to fix the payload without consulting docs.

---

## Acceptance Criteria

- `clawperator skills validate <skill_id> --dry-run` compiles the skill artifact and validates the resulting payload against the action schema.
- A skill with an invalid parameter (e.g., `format` in `snapshot_ui`) fails `--dry-run` with an error that includes the action `id`, `type`, and the invalid parameter name.
- A skill with valid structure and valid payload passes `--dry-run`.
- The validate command still passes for structurally valid skills when `--dry-run` is not specified (existing behavior unchanged).
- `docs/skills/skill-development-workflow.md` includes `--dry-run` as a pre-device validation step.
