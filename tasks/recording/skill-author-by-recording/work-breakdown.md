# Skill Author By Recording Work Breakdown

Parent plan: `tasks/recording/skill-author-by-recording/plan.md`

## Executive Summary

Total PRs: 3. Total phases: 3.

- P1: close out the replay-first front-door workflow
- P2: close out the orchestrated authoring path without expanding runtime scope
- P3: validate the full story against the Solax demo path and graduate durable
  guidance

Current state: a first repo-local workflow draft already exists at
`.agents/skills/skill-author-by-recording/`, but the task pack now needs to
reflect the actual implementation order and the replay-first default product
stance.

## Hard Rules

- Do not claim that the recording alone generates a reliable skill.
- Do not hide the intermediate artifacts. The workflow must surface them.
- Do not imply the recording export becomes the runtime program. The export is
  authoring evidence.
- Do not hardcode the Solax proving case into the front-door workflow. The
  workflow must be able to help author a developer's own skill id and goal.
- Do not make first-time users learn replay versus orchestrated before they can
  create a skill.
- Do not skip showing the orchestrated code and verification logic when the
  orchestrated path is chosen.
- Do not declare authoring done until the newly written skill has been invoked
  once and its emitted `SkillResult` is inspectable.
- Keep one human-facing entrypoint: `skill-author-by-recording`.
- If helper skills are introduced, they sit behind that entrypoint.
- Reuse the named orchestrated runtime contract from
  `docs/skills/overview.md#orchestrated-runtime-contract`.
- Do not introduce a top-level skill named `skill-author-orchestrator`.
- Do not require both replay and orchestrated output variants in the first pass
  unless the task explicitly calls for both.
- Do not expand this task into bundled runtime-family work such as a single
  registry skill with internal replay and orchestrated subfolders.

## Required Reading

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-author-by-recording/problem-definition.md` | Refined product framing and north star |
| `tasks/recording/skill-author-by-recording/plan.md` | Stable scope and ordered delivery shape |
| `tasks/recording/video-draft.md` | Demo north star |
| `docs/api/recording.md` | Recording lifecycle commands and artifacts |
| `docs/skills/authoring.md` | Scaffold and authoring contract |
| `docs/skills/overview.md` | Named orchestrated runtime contract |
| `docs/internal/design/skill-design.md` | Durable orchestrated skill design lessons and failure modes |
| `apps/node/src/contracts/skillResult.ts` | Universal `SkillResult` return shape |
| `apps/node/src/domain/skills/runSkill.ts` | Runtime parsing and injected source behavior |

## Phase P1: Replay-First Workflow Closeout

Status: next

### Goal

Tighten the front-door workflow so it truthfully supports "record once, author
the right skill shape" while defaulting to replay-first authoring when replay
is sufficient.

### Acceptance Criteria

- The task pack and repo-local skill explicitly say that the workflow authors
  one requested or recommended skill shape per pass.
- The default recommendation is replay when the captured flow is replay-safe.
- The workflow still honors an explicit user request for `-orchestrated` or
  `-replay`.
- The workflow explicitly includes:
  - capture or confirm the target skill id and plain-language goal
  - prompt agent to start recording
  - tell human when to perform the phone flow
  - stop and pull recording
  - export the recording artifact
  - pass the recording evidence to an authoring-time agent
  - author the chosen skill shape
  - run one self-test invocation of the authored skill
  - show the key generated files
- The workflow makes the "how" visible to a developer by surfacing the concrete
  recording/export commands and resulting files.
- The workflow distinguishes clearly between:
  - authoring evidence
  - replay script logic
  - orchestrated runtime program plus thin harness
- The workflow keeps the Solax proving case separate from the generic path.

## Phase P2: Orchestrated Path Closeout

Status: pending

### Goal

Close out the orchestrated authoring path so the same front-door workflow can
truthfully produce an orchestrated skill when replay would not be sufficient or
when the user explicitly asks for orchestrated.

### Acceptance Criteria

- The repo-local skill reuses the durable orchestrated runtime contract wording
  from `docs/skills/overview.md#orchestrated-runtime-contract`.
- The workflow uses the recording export and optional user clarification to
  author orchestrated `SKILL.md`, `skill.json`, and thin `run.js`.
- The retained compare baseline rules remain explicit and truthful.
- The workflow makes clear that replay and orchestrated are peers, but the
  workflow is now intentionally taking the more advanced orchestrated branch.
- A developer can still use the workflow for a non-Solax skill without editing
  the skill first.

## Phase P3: Demo Validation And Graduation

Status: pending

### Goal

Run the workflow against the Solax proving case and make sure the resulting
experience is understandable from start to finish, while keeping the generic
workflow framing truthful.

### Acceptance Criteria

- A developer can follow the workflow and understand:
  - what was recorded
  - how the recording evidence informed the authored skill
  - how replay and orchestrated differ when each is chosen
  - how the orchestrated skill is split across `SKILL.md`, `skill.json`, and
    the thin `run.js` when the orchestrated path is demonstrated
  - how the brain/hand model is embodied in code and in the first-run
    `SkillResult`
- The chosen decomposition still feels like one workflow to the user rather
  than a menu of competing authoring skills.
- The workflow's default narrative preserves replay as a first-class category
  and does not redefine the whole product story as orchestrated-only just
  because the demo path is orchestrated.
- `docs/skills/authoring.md` includes a concrete "debugging a failed
  orchestrated run" section covering the minimum set a developer reads: agent
  stderr stream, `SkillResult.checkpoints`, and compare output when a recording
  baseline exists.
- Any other durable guidance discovered here is migrated into
  `docs/skills/authoring.md`.

## Closeout Notes

Expected closeout shape:

- keep one parent task pack until the final PR ships
- land the work in ordered reviewable PRs
- update this pack after each phase so sequencing stays explicit
- retire the pack only after the durable guidance is fully reflected in docs,
  code, and the repo-local skill
