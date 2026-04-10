# Work Breakdown

## Execution Summary

- This is a cross-repo task. Work in the Clawperator repo and the sibling
  `../clawperator-skills` repo together.
- Keep the Solax skill as the proving case throughout. Do not design compare
  support in the abstract and “apply it later”.
- Use TDD for the compare implementation. Start from real fixtures captured from
  the Solax recording and validated run traces, then build the compare behavior
  against those fixtures.
- Keep compare scoped to diagnosis. Do not turn this task into the general
  "make skills reliable" workstream.
- Commit at natural checkpoints in each repo. Do not amend.
- Validate with live device behavior, not only unit tests or JSON shape checks.

## Hard Rules

- Do not compare skill runs to raw recording events one-to-one.
- Do not depend on `record parse` as the only baseline artifact.
- Do not rely on synthetic toy fixtures alone. At least one regression fixture
  set must come from the Solax recording and the corresponding validated run
  evidence from this task line.
- Do not let tests read from `../clawperator-skills/` at runtime. Copy any
  required sanitized fixtures into the Clawperator test tree.
- Do not call the feature “replay validation” unless final persisted state is
  included in the proof path.
- If the compare output cannot explain the first divergence for the Solax flow,
  the compare design is not done.
- If durable learnings emerge, migrate them to real docs in the same phase that
  proves them.

## Required Reading

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- `apps/node/src/domain/recording/exportRecording.ts`
- `apps/node/src/cli/registry.ts`
- `tasks/recording/demo/findings.md`
- `tasks/recording/demo/meta-problem-summary.md`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js`

## Phase Plan

### P1. Define the compare model

- Tier: `thinking`
- Output:
  - normalized checkpoint model
  - trace artifact proposal
  - divergence output proposal
  - initial fixture plan for TDD
- Required decisions:
  - how the run trace is produced:
    - exec-native trace emission
    - helper-wrapped skill trace accumulation
    - post-hoc reconstruction
  - what a checkpoint is
  - what evidence is baseline-only versus runtime-only
  - what counts as a meaningful mismatch
  - which Solax snippets become stable test fixtures
  - how compare distinguishes:
    - skill divergence
    - poisoned runtime state
    - runtime unavailable state
- Deliverable:
  - update this task pack if any stable decisions need to be clarified
  - optionally add a compact design note only if the model cannot fit cleanly in
    implementation docs

### P2. Implement trace and compare support in Clawperator

- Tier: `default`
- Likely surfaces:
  - `apps/node/src/`
  - tests under `apps/node/src/test/`
  - docs updates if the interface becomes user-visible in this phase
- Requirements:
  - add failing tests first using real compare fixtures
  - emit or assemble a run trace with enough information to explain divergence
  - compare against a recording export baseline
  - return machine-readable output and a clear human summary
  - cover valid, invalid, and missing-value CLI behavior if new flags are added
  - add regression coverage for both:
    - a matching path
    - a first-divergence path
  - ensure the implementation still works when the baseline recording export was
    created with `snapshotMode: omit`

### P3. Prove the model with the Solax skill

- Tier: `default`
- Repo:
  - `../clawperator-skills`
- Requirements:
  - wire the Solax skill into the compare workflow as a real proving case
  - demonstrate:
    - a matching successful run
    - a real intentionally or historically divergent run shape
  - verify that the compare output identifies the first meaningful difference
  - retain small, sanitized snippets from the proving run as durable fixtures if
    they are needed to keep compare regressions trustworthy
- Validation:
  - live device run
  - direct persisted-state verification in the Solax UI

### P4. Finish docs and cleanup

- Tier: `default`
- Requirements:
  - migrate durable guidance into `docs/`
  - leave task files only with temporary execution value
  - note whether `.agents/skills/skill-author-by-recording` should consume the
    new compare workflow immediately or in a follow-up

## Sequencing

1. Finish P1 before implementing command shape.
2. Land the Solax integrity/reliability task separately before treating Solax as
   a trustworthy compare proving case.
3. Finish P2 enough to generate real compare output before broad docs work.
4. Run P3 on-device before declaring the feature sound.
5. Complete P4 in the same change series, not as a forgotten follow-up.

## Findings File

Create `tasks/recording/compare/findings.md` only when implementation starts.
Do not prefill it with retrospective prose.

When created, it must capture only:

- compare artifact paths
- runtime validation facts
- first-divergence examples
- false starts or discarded compare heuristics
- durable lessons to migrate into docs or skills

## Validation Expectations

- For Clawperator changes:
  - `npm --prefix apps/node run build`
  - `npm --prefix apps/node run test`
  - compare-focused tests must include real fixture coverage from this Solax
    task line, not only synthetic examples
- For any Android/runtime-sensitive change that affects live behavior:
  - real-device validation with the Samsung Galaxy used in this task line
- For Solax skill proof:
  - run the skill
  - run compare
  - verify the persisted `Discharge to` value in the app UI

## PR Shape

- PR 1:
  - compare model and Clawperator implementation
  - tests
  - core docs
- PR 2:
  - Solax proving integration
  - follow-up docs refinements
  - any repo-local skill guidance updates if warranted

Keep the split only if it stays reviewable. If the implementation remains small
and tightly coupled after P1, collapsing to one PR is acceptable.
