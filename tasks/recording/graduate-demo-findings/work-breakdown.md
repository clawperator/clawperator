# Work Breakdown

## Execution Summary

- This is a cleanup-and-graduation task, not a behavior-change task.
- Use `tasks/recording/demo/findings.md` as source material, not as a final
  artifact.
- Delete the demo task files once their durable knowledge is safely migrated.

## Hard Rules

- Do not leave durable guidance stranded in `tasks/`.
- Do not preserve retrospective narrative when a direct doc statement is enough.
- Run the docs build before considering this done.

## Required Reading

- `tasks/recording/demo/findings.md`
- `tasks/recording/demo/meta-problem-summary.md`
- `docs/api/recording.md`
- `docs/skills/authoring.md`

## Phase Plan

### P1. Migrate durable knowledge

- Tier: `default`
- Requirements:
  - move recording-as-evidence guidance into `docs/api/recording.md`
  - move non-trivial-skill authoring guidance into `docs/skills/authoring.md`
  - include the proven lessons from the Solax work without overfitting docs to
    Samsung-specific coordinates

### P2. Validate and retire demo files

- Tier: `default`
- Requirements:
  - run `./scripts/docs_build.sh`
  - delete `tasks/recording/demo/findings.md` and `plan.md` once migrated
  - delete `meta-problem-summary.md` too if the brain/hand problem definition
    fully supersedes it

