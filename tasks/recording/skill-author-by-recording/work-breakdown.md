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
- Do not skip the replay stage. The replay skill is part of the proving path.
- Do not skip showing the orchestrated code and verification logic. This
  workflow exists to make the "how" understandable.

## Required Reading

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-author-by-recording/plan.md` | Stable scope and end-state |
| `tasks/recording/plan.md` | Overall recording program sequencing |
| `docs/api/recording.md` | Recording lifecycle commands and artifacts |
| `docs/skills/authoring.md` | Scaffold and authoring contract |
| `tasks/recording/skill-result-contract/` | Orchestrated-skill result shape |
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
  - scaffold the replay skill
  - author the orchestrated sibling
  - show the key generated files
  - highlight the code that performs checkpoints and verification
- The workflow makes the "how" visible to a developer by surfacing:
  - the concrete recording/export commands it ran
  - the exact files produced by those commands
  - the exact replay and orchestrated code surfaces that should be opened next
- The workflow distinguishes clearly between:
  - what is shipped and usable today
  - what is the planned orchestrated future-state once the upstream workstreams
    have landed
- The workflow names the specific artifacts it must surface, at minimum:
  - recording export
  - replay `SKILL.md`
  - replay runtime script
  - orchestrated `skill.json`
  - orchestrated runtime script
  - any compare or verification artifact added by the earlier workstreams

## Phase P2: Implement The Repo-Local Skill

### Goal

Create `.agents/skills/skill-author-by-recording/` so an agent can execute the
defined workflow consistently.

### Acceptance Criteria

- The skill exists in `.agents/skills/`.
- It guides the operator rather than assuming silent background work.
- It points developers at the exact files that explain what was generated.
- A developer following the workflow can understand the end-to-end path without
  extra narration from the original author.

## Phase P3: Validate And Tighten

### Goal

Run the workflow against the Solax proving case and make sure the resulting
experience is understandable from start to finish.

### Acceptance Criteria

- A developer can follow the workflow and understand:
  - what was recorded
  - what the replay skill contains
  - what the orchestrated skill adds
  - how the brain/hand model is embodied in code
- Any durable guidance discovered here is migrated into `docs/skills/authoring.md`.
