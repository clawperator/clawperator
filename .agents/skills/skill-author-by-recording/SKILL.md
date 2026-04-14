---
name: skill-author-by-recording
description: Create or update a Clawperator skill from a fresh phone recording. Use when a developer wants one front-door workflow that records a real device flow, retains the export as authoring evidence, explicitly recommends replay or orchestrated, authors one requested or recommended skill shape per pass, and runs one self-test that surfaces the emitted SkillResult.
---

# Skill Author By Recording

Guide a developer from "I can do this once on my phone" to "I now have a
truthful authored skill artifact."

This is one front door. Do not split the user across helper skills in this
phase. The workflow must stay centered on:

1. record the flow once
2. keep the evidence
3. author the right skill shape from that evidence
4. run it once and inspect the result

## What This Skill Owns

Use this skill when the user wants to create or revise a runtime skill from a
fresh phone recording.

This skill owns the authoring workflow only. The recording export is authoring
evidence, compare input, and maintenance evidence. It is not the runtime
program.

The runtime skill you author lives in the skills repo, typically
`../clawperator-skills/skills/<skill_id>/`.

## Required Reading During Use

Read these durable sources before making authoring decisions:

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- `docs/skills/overview.md`
- `docs/internal/design/skill-design.md`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/domain/skills/runSkill.ts`

Reuse those contracts. Do not invent a parallel recording, skill, or
`SkillResult` model inside this workflow.

## Non-Negotiable Rules

- Keep one human-facing entrypoint: `skill-author-by-recording`.
- Treat the recording export as evidence, not as a finished skill or runtime
  recipe.
- Surface the concrete commands you run and the files they produce.
- Make the replay versus orchestrated recommendation explicit before authoring
  begins.
- Honor an explicit user request for `-replay` or `-orchestrated`.
- Author one requested or recommended skill shape per pass unless the user
  explicitly asks for both.
- Default to replay when the captured flow is replay-safe.
- Move to orchestrated when replay would not be truthful or sufficient.
- Keep the retained sanitized baseline at
  `skills/<skill_id>/references/compare-baseline.export.json`.
- Do not list that retained baseline under `skill.json.artifacts`.
- For orchestrated skills, keep `SKILL.md` as the runtime agent program and
  keep `scripts/run.js` as a thin harness only.
- Do not declare success until you have run one self-test invocation and shown
  the resulting `SkillResult`.

## Inputs To Gather Up Front

Collect or confirm these inputs before recording:

- target `skill_id`
- plain-language goal
- whether the user explicitly wants `-replay`, `-orchestrated`, or wants the
  workflow to recommend the shape
- target device id when more than one device is connected
- operator package
  `com.clawperator.operator.dev` unless the user explicitly needs the release
  package

If the requested `skill_id` does not already encode `-replay` or
`-orchestrated`, keep that in mind while recommending the shape and naming the
authored artifact truthfully.

## Decision Table

Use this first-match-wins table exactly:

| Condition | Action |
| --- | --- |
| User explicitly requests `-replay` | Author replay and do not up-sell orchestrated in the same pass |
| User explicitly requests `-orchestrated` | Author orchestrated and do not force a replay-first detour |
| No explicit shape and flow is replay-safe | Recommend and author replay |
| No explicit shape and replay would not be truthful or sufficient | Explain why and author orchestrated |
| User explicitly wants both variants | Treat sibling authoring as intentional extra scope, not the default |

## Replay-Safe Versus Orchestrated

Recommend replay when the captured flow is short, deterministic, and truthful
to express as fixed script logic on a known UI path.

Recommend orchestrated when the next action depends on current UI state,
mid-flow recovery matters, the app may resume in different states, or the skill
must prove a persisted terminal condition rather than merely replaying taps.

Do not describe replay as a lower-grade artifact. Replay and orchestrated are
both first-class maintained skill shapes.

## Workflow

### 1. Confirm Scope And Show The Plan

Tell the user what you are about to do:

- start recording
- ask them to perform the flow once
- stop recording and pull the raw capture
- export the recording artifact
- retain a sanitized compare baseline
- recommend replay or orchestrated explicitly
- author one skill shape
- run one self-test and inspect the `SkillResult`

Keep the Solax proving case separate from the generic workflow. If the user is
not authoring Solax, do not drag Solax-specific assumptions into the session.

### 2. Start Recording

Use the selected device and operator package explicitly. Show the concrete
command before or while running it.

```bash
clawperator recording start --session-id <session_id> --device <device_serial> --operator-package <operator_package> --json
```

Then tell the human clearly that recording is active and it is their turn to
perform the target phone flow.

### 3. Human Performs The Flow

Pause for the human to do the workflow on the device. Do not guess what
happened. When they say the flow is complete, continue.

### 4. Stop, Pull, And Export

Run the full recording lifecycle in order and surface the resulting paths:

```bash
clawperator recording stop --session-id <session_id> --device <device_serial> --operator-package <operator_package> --json
clawperator recording pull --session-id <session_id> --device <device_serial> --operator-package <operator_package> --out ./recordings/<session_id> --json
clawperator recording export --input ./recordings/<session_id> --snapshots omit --json
```

Retain the pulled NDJSON as the raw capture.

Treat the export JSON as the canonical structured authoring artifact. Optional
`record parse` output is for human inspection only and does not replace the
export.

### 5. Retain The Sanitized Baseline

Copy or write the sanitized retained export baseline to:

```text
skills/<skill_id>/references/compare-baseline.export.json
```

Rules:

- keep this file as authoring and compare evidence
- keep it out of `skill.json.artifacts`
- do not present it as a runtime input
- do not treat `recording-context.json` as the long-term maintained compare
  path once this retained baseline exists

### 6. Analyze The Export And Recommend The Shape

Inspect the recording export and explain the recommendation explicitly.

Your explanation should name the deciding facts, for example:

- whether the recorded route is deterministic
- whether selectors look stable enough for replay
- whether runtime branching or continuation from current state is likely
- whether terminal verification requires reopened persisted-state proof

Then state one of:

- `Recommended shape: replay`
- `Recommended shape: orchestrated`

If the user explicitly requested a shape, still say whether the recording looks
replay-safe or orchestrated-shaped, but honor the request unless it would make
the artifact untruthful.

### 7. Scaffold The Runtime Skill

Create the runtime skill in the skills repo with recording context copied from
the export artifact:

```bash
clawperator skills new <skill_id> --recording-context <export_json> --json
```

This copies the export to `skills/<skill_id>/recording-context.json`.

Remember:

- `recording-context.json` is scaffold-time evidence for the author
- it is not the executable program
- `skills validate` still validates the registry-linked skill files, not the
  recording context

### 8. Author The Chosen Shape

Author exactly one requested or recommended shape in this pass.

For replay:

- keep the logic truthful to a deterministic path
- use the recording evidence to derive selectors, waits, and verification
- keep the retained compare baseline separate from runtime artifacts

For orchestrated:

- keep `skill.json.agent` as trusted runtime metadata
- write the app-specific runtime program in `SKILL.md`
- keep `scripts/run.js` as a thin launcher that forwards stdout and stderr
- do not bury app-specific navigation or verification policy in the harness

In both cases, make the terminal verification policy explicit and ensure the
artifact reflects what the runtime can actually prove.

### 9. Show The Authored Files

Surface the key authored files so the developer can inspect the result:

- `skills/<skill_id>/SKILL.md`
- `skills/<skill_id>/skill.json`
- `skills/<skill_id>/scripts/run.js`
- `skills/<skill_id>/recording-context.json`
- `skills/<skill_id>/references/compare-baseline.export.json`

If the chosen shape is replay, make clear which file contains the replay logic.

If the chosen shape is orchestrated, make clear that:

- `SKILL.md` is the runtime agent program
- `scripts/run.js` is only the thin harness

### 10. Run One Self-Test

Run exactly one first self-test invocation of the authored skill and save the
full JSON wrapper:

```bash
clawperator skills run <skill_id> --device <device_serial> --operator-package <operator_package> --json > ./recordings/<session_id>/<skill_id>.skills-run.json
```

If the skill takes inputs, pass the minimum truthful input set required for one
real run.

### 11. Surface The `SkillResult`

Inspect the saved `skills run --json` wrapper and surface the top-level
`skillResult`.

Call out at least:

- `skillResult.status`
- `skillResult.source`
- `skillResult.checkpoints`
- `skillResult.terminalVerification`
- `skillResult.diagnostics`

When compare is relevant, note that the saved wrapper file is the durable v1
`--result` input for:

```bash
clawperator recording compare --baseline skills/<skill_id>/references/compare-baseline.export.json --result ./recordings/<session_id>/<skill_id>.skills-run.json
```

Do not hand-edit a bare `SkillResult` and do not claim compare accepts only a
stripped result object.

## Truthfulness Checks

Stop and correct the workflow if you find yourself implying any of these:

- the recording export already is the skill
- replay is only a temporary or lower-grade artifact
- orchestrated is mandatory for every recording-driven workflow
- the retained compare baseline is a runtime artifact
- the harness owns the orchestrated skill logic
- authoring is done before a self-test run emits an inspectable `SkillResult`

## Output Standard

A complete pass should leave the developer with:

- one authored runtime skill shape
- one retained compare baseline
- one saved `skills run --json` wrapper from the self-test
- a clear statement of why replay or orchestrated was chosen
- visible file paths and commands that make the workflow inspectable

If any of those are missing, the pass is not done.
