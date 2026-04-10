# Skill Author By Recording Work Breakdown

Parent plan: `tasks/recording/skill-author-by-recording/plan.md`

## Executive Summary

Total PRs: 1. Total phases: 3.

- P1: define the guided workflow and artifact contract
- P2: implement the repo-local skill
- P3: validate the workflow on the Solax proving case and graduate any durable
  guidance

Current state: blocked until the earlier recording workstreams have landed.

## Hard Rules

- Do not claim that the recording alone generates a reliable skill.
- Do not hide the intermediate artifacts. The workflow must surface them.
- Do not imply the recording export becomes the runtime program. The export is
  authoring evidence; `SKILL.md` is the runtime program.
- Do not skip showing the orchestrated code and verification logic. This
  workflow exists to make the "how" understandable.
- Do not declare authoring done until the newly written skill has been invoked
  once and its emitted `SkillResult` is inspectable.
- Keep one human-facing entrypoint: `skill-author-by-recording`.
- If helper skills are introduced, they sit behind that entrypoint. Do not
  make the user choose among multiple top-level authoring skills for this flow.
- Do not introduce a top-level skill named `skill-author-orchestrator`.
  That name is too easy to confuse with `skill-author-orchestrated`.

## Required Reading

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-author-by-recording/plan.md` | Stable scope and end-state |
| `tasks/recording/plan.md` | Overall recording program sequencing |
| `tasks/recording/agent-driven-skills/` | Runtime-agent shape the authored skill must target |
| `docs/api/recording.md` | Recording lifecycle commands and artifacts |
| `docs/skills/authoring.md` | Scaffold and authoring contract |
| `tasks/recording/skill-result-contract/` | Universal `SkillResult` return shape |
| `tasks/recording/skill-contract-declaration/` | Declared contract expectations |
| `tasks/recording/compare/` | How replay and orchestrated output are later compared |

## Phase P1: Define The Workflow Contract

### Goal

Specify exactly what the skill-authoring workflow must do and show.

### Acceptance Criteria

- The workflow explicitly includes:
  - prompt agent to start recording
  - tell human when to perform the phone flow
  - stop and pull recording
  - export the recording artifact
  - pass the recording evidence to an authoring-time agent
  - author the orchestrated skill
  - run one self-test invocation of the authored skill
  - show the key generated files
  - highlight the instructions and code that perform checkpoints and verification
- The workflow makes the "how" visible to a developer by surfacing:
  - the concrete recording/export commands it ran
  - the exact files produced by those commands
  - the exact orchestrated code surfaces that should be opened next
- The workflow distinguishes clearly between:
  - what is authoring-time evidence
  - what is the runtime program the embedded agent will later read
- The workflow names the specific artifacts it must surface, at minimum:
  - recording export
  - retained sanitized compare baseline under the authored skill, e.g.
    `references/compare-baseline.export.json`
  - orchestrated `SKILL.md`
  - orchestrated `skill.json`
  - orchestrated runtime script
  - first-run `SkillResult`
  - any compare or verification artifact added by the earlier workstreams
- The workflow explicitly defines whether implementation is:
  - monolithic inside `skill-author-by-recording`, or
  - decomposed behind it into helper skills
- If helper skills are used, the default recommended decomposition is:
  - `recording-capture-export`
  - `skill-author-orchestrated-from-recording`
  - `skill-validate-authored-skill`
- Replay-skill authoring is not required as part of the first front-door flow.
  If we later want replay authoring as a first-class workflow, it should be a
  deliberate follow-up task rather than an implicit requirement in W6.

## Phase P2: Implement The Repo-Local Skill

### Goal

Create `.agents/skills/skill-author-by-recording/` so an agent can execute the
defined workflow consistently.

### Acceptance Criteria

- The skill exists in `.agents/skills/`.
- It guides the operator rather than assuming silent background work.
- It points developers at the exact files that explain what was generated.
- It uses the recording export (required) and an optional plain-language
  description from the user explaining intent or device-specific nuance that
  the recording alone may not capture, along with the W2b/W3 contract shape,
  to author `SKILL.md`, `skill.json`, and the thin `run.js`. The authoring-time
  agent should ask for the user description if the recording export is not
  sufficient to infer the intent unambiguously.
- It retains one canonical sanitized baseline export under the authored skill,
  at a stable reference path such as
  `references/compare-baseline.export.json`, for future compare and maintenance
  work.
- It sanitizes the retained baseline before commit by templating
  environment-specific or personal values with angle-bracket placeholders such
  as `<device_serial>`, `<person_name>`, `<place_name>`, and
  `<account_email>`.
- It does not list that retained baseline under `skill.json.artifacts`, and it
  does not pass the retained baseline into the runtime agent prompt.
- If helper skills are introduced, the top-level skill clearly delegates to
  them and preserves resumability across phase boundaries.
- A developer following the workflow can understand the end-to-end path without
  extra narration from the original author.

## Phase P3: Validate And Tighten

### Goal

Run the workflow against the Solax proving case and make sure the resulting
experience is understandable from start to finish.

### Acceptance Criteria

- A developer can follow the workflow and understand:
  - what was recorded
  - how the recording evidence informed the authored `SKILL.md`
  - how the orchestrated skill is split across `SKILL.md`, `skill.json`, and
    the thin `run.js`
  - how the brain/hand model is embodied in code and in the first-run
    `SkillResult`
- The chosen decomposition still feels like one workflow to the user rather
  than a menu of competing authoring skills.
- Any durable guidance discovered here is migrated into `docs/skills/authoring.md`.
