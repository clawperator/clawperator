# Recording Workstreams

## Purpose

This file is the top-level orchestration plan for the recording-related work in
`tasks/recording/`.

Use it to understand:

- why the work expanded beyond one Solax skill
- which task packs exist
- the order they should run
- which packs are active, blocked, or downstream

This file is the entrypoint. The sub-task packs hold the executable detail.

## Current Goal

Turn the Solax recording effort into a truthful proving case, then use that
proving case to build the missing skill-layer contract and only then implement
recording-versus-run compare.

## Service Improvement Outcome

When this program of work is complete, Clawperator the runtime is meaningfully
stronger than it is today in the following concrete ways. This section is the
yardstick for whether the subtree is finished.

### What the brain can know after a skill run that it cannot know today

Today: a skill returns `{ ok, output: string, exitCode }`. The brain reads a
stdout blob it must hand-parse, and must trust that the script wrote the
truth.

After this work:

- the brain reads a typed `SkillResult` with declared goal, inputs,
  enumerated checkpoints, terminal verification evidence, embedded exec
  envelopes, and a top-level run state of `success`, `failed`, or
  `indeterminate`
- "indeterminate" is a real state distinct from success: it means the skill
  ran without exec failure but did not prove its declared verification
- the brain can branch on checkpoint identity, not on substring matches
- the brain can tell which checkpoint was the *first* divergence from a
  recording baseline, classified by category, without re-running the skill

### What kinds of failures become diagnosable

Today: failures present as "exit non-zero plus a stdout blob" or worse,
"exit zero with a stdout blob that looks like success".

After this work the brain can distinguish at least:

- exec failure inside the skill (a `clawperator exec` step returned non-zero)
- declared verification not proved (skill produced output but did not satisfy
  its own contract)
- baseline divergence (skill diverged from the recording-export path at a
  specific named checkpoint)
- runtime poisoned state (the operator was in a stuck or invalid state when
  the skill tried to run)
- runtime unavailable state (accessibility service down, device disconnected)
- terminal verification false (skill reached the end, but the persisted app
  state did not match the requested goal)

These are not just better error strings. They are typed signals the brain can
act on.

For v1, `runtime_poisoned` and `runtime_unavailable` must be backed by an
explicit runtime-state signal carried through the skill-layer contract. If W2
cannot provide that signal cleanly, compare must downgrade those cases to
`upstream_failure` rather than guessing from string matching.

### What kinds of skill claims become enforceable

Today: `skill.json` is registry metadata. There is no machine-readable
declaration of what a skill is *for*. `SKILL.md` is prose. `runSkill` only
checks exit code and an optional substring.

After this work:

- a skill can declare `inputs`, `goal`, and `verification` in `skill.json`
- the runtime cross-checks declared verification against emitted
  `SkillResult.terminalVerification`
- a skill that says it sets a value but never proves the value was set
  cannot return `success` to the brain
- legacy skills with no declaration keep working unchanged

### What "deterministic replay for deterministic UI" means in stronger practical terms

Today: "deterministic replay" effectively means "the script worked once on
this device when I last ran it". There is no re-checkable evidence that the
intended state was reached.

After this work, deterministic replay has a precise practical definition:

- the skill emits a `SkillResult` whose checkpoint sequence matches the
  recording baseline at all enumerated checkpoints
- the skill's `terminalVerification` proves the requested final state is
  actually present in the app
- compare can confirm both of those facts in CI-style conditions, against
  fixtures, without a live device, on every change

### What the docs and authoring reality become truer about

Today: `docs/skills/authoring.md` describes the scaffold and validation
mechanics, and is silent on terminal verification, checkpoint shape, and
result emission. `docs/api/recording.md` correctly says recording is evidence,
but the workflow that consumes it implies recordings can become skills with
just light cleanup.

After this work:

- `docs/skills/authoring.md` describes the structured `SkillResult` shape
  and the required pattern for non-trivial skills (truthful exit, terminal
  verification, optional declared contract)
- `docs/api/recording.md` describes recordings as evidence and points to the
  compare workflow as the way to validate replay against a baseline
- the durable Solax learnings (input persistence workaround, accessibility
  service restart, container vs label clickability) live in the right docs
  instead of in `tasks/`

## Program Definition Of Done

The recording subtree is complete when **all** of the following are true:

- Solax `v0` exits truthfully on forced failure (skill-checkpoints W1)
- Solax verifies the persisted `Discharge to <n>%` row before reporting
  success (skill-checkpoints W1)
- A regression test in `apps/node/src/test/` proves a stub skill that exits
  non-zero is reported by `runSkill` as `ok:false` (skill-checkpoints W1)
- The non-zero-exit regression is exercised by the normal
  `npm --prefix apps/node run test` path used in CI, or CI is updated in the
  same PR so the regression is actually enforced (skill-checkpoints W1)
- `SkillResult` is defined in `apps/node/src/contracts/`, parsed by
  `runSkill`, exposed on `SkillRunResult`, with backward compatibility for
  legacy skills (skill-result-contract W2)
- The Solax skill emits a parseable `SkillResult` with enumerated
  checkpoints and terminal verification (skill-result-contract W2)
- `skill.json` supports an optional `contract` block, scaffold writes a
  starter, and `runSkill` returns a distinct `indeterminate` state when a
  declared verification is not proved (skill-contract-declaration W3)
- Solax `skill.json` declares its contract (skill-contract-declaration W3)
- `clawperator recording compare` consumes a `SkillResult` and a recording
  export, identifies the first divergence with a typed category, runs
  test-first against local fixtures with no live device dependency, and is
  proven against both a baseline-drift and a verification-failure divergence
  on the Solax case (compare W4)
- Durable recording and authoring learnings live in `docs/api/recording.md`
  and `docs/skills/authoring.md`, regenerated by `./scripts/docs_build.sh`
  (graduate-demo-findings W5)
- `tasks/recording/demo/` is deleted; `brain-hand-contract/` is deleted once
  the contract docs land; this top-level plan is deleted when no active
  recording workstreams remain

Durable design decisions for this program - including the `SkillResult` frame
marker, version-compatibility policy, checkpoint evidence shape, runtime-state
classification policy, and `indeterminate` semantics - must live in code and,
if not self-evident there, in `docs/internal/design/`. They must not remain
discoverable only through `tasks/`.

## Why This Exists

The original task was to create one Solax skill from a recording.

That work succeeded enough to expose a broader problem:

- recordings are evidence, not executable skills
- non-trivial skills need truthfulness and terminal verification
- the brain/hand split is not real at the skill boundary yet because skills
  return opaque stdout, not structured results
- compare is useful, but it is downstream of a proper skill-level contract

So this subtree now contains multiple linked workstreams rather than one task.

## Workstreams

| Order | Task Pack | State | Purpose |
| --- | --- | --- | --- |
| 0 | `brain-hand-contract/` | active reference | problem definition and architectural framing |
| 1 | `skill-checkpoints/` | next | make Solax truthful and checkpointed enough to trust |
| 2 | `skill-result-contract/` | ready after 1 | define `SkillResult` and make skills legible to the brain |
| 3 | `skill-contract-declaration/` | blocked on 2 | declare inputs, goal, and verification in `skill.json` |
| 4 | `compare/` | blocked on 2 | compare recording baseline against emitted `SkillResult` |
| 5a | `graduate-demo-findings/` (wave A) | active | graduate recording-as-evidence and operations facts that do not depend on `SkillResult` shape |
| 5b | `graduate-demo-findings/` (wave B) | blocked on 2 | graduate skill-contract and authoring facts once W2 wording is stable |

## Required Sequence

1. Finish `skill-checkpoints/`
2. Finish `skill-result-contract/`
3. Start `skill-contract-declaration/`
4. Start `compare/`
5. Run `graduate-demo-findings/`

`graduate-demo-findings/` wave A may run in parallel with `skill-checkpoints/`
because its content does not depend on the contract shape. Wave B still waits
for W2 wording to stabilize.

## Preferred PR Grouping

Group work into as few PRs as is reasonable, but do not hide repo boundaries or
mix unrelated risk levels just to reduce count.

### PR-1a: W1 Clawperator-side regression for `runSkill` failure propagation

Scope:

- a stub skill fixture under `apps/node/src/test/` that exits non-zero
- a focused regression test asserting `runSkill` returns `ok:false` with
  `code: SKILL_EXECUTION_FAILED`
- no Solax changes in this PR

Why separated from PR-1b:

- this lives in the Clawperator repo and protects the propagation path itself
  from regression
- it can land before the Solax-side fix and unblock review of PR-1b

### PR-1b: W1 Solax skill truthfulness

Scope:

- `tasks/recording/skill-checkpoints/` P1 and P2
- Solax implementation changes in `../clawperator-skills`

Why grouped:

- this is one coherent behavior fix
- Solax should become truthful in one reviewable step

Keep separate from:

- generalized docs changes in this repo, unless they remain very small and are
  already proven by the Solax fix

### PR-2: W1 durable authoring guidance

Scope:

- `tasks/recording/skill-checkpoints/` P3
- small update to `docs/skills/authoring.md`

Why separate by default:

- different repo
- much lower risk than the live Solax behavior change
- can merge quickly once the Solax proof is stable

Acceptable collapse:

- if the docs wording is tiny and directly tied to the same validated Solax
  change, folding this into the same overall review cycle is acceptable

### PR-3: W2 skill result contract in Clawperator

Scope:

- `tasks/recording/skill-result-contract/` P1 and P2
- contract definition
- `runSkill` parsing
- tests

Why grouped:

- contract shape and parser/tests should land together
- splitting these creates churn without reducing much risk

### PR-4: W2 Solax contract retrofit

Scope:

- `tasks/recording/skill-result-contract/` P3
- Solax `SkillResult` emission in `../clawperator-skills`

Why separate:

- different repo
- depends on PR-3 contract shape being real

### PR-5: W2 downstream handoff updates

Scope:

- `tasks/recording/skill-result-contract/` P4
- any task-pack alignment needed after the contract lands

Why usually small:

- planning/documentation follow-through only

Acceptable collapse:

- if PR-3 leaves the task packs obviously aligned already, this can be folded
  into PR-3 instead of standing alone

### PR-6: W3 contract declaration

Scope:

- `tasks/recording/skill-contract-declaration/` P1 and P2 in this repo
- `tasks/recording/skill-contract-declaration/` P3 in `../clawperator-skills`

Recommended split:

- one Clawperator PR for scaffold/runtime support
- one skills-repo PR for Solax declaration proof

### PR-7: W4 compare

Scope:

- `tasks/recording/compare/` P1 through P4

Recommended grouping:

- one Clawperator PR for compare model, implementation, tests, and docs
- one small skills-repo PR only if Solax proving support needs a runtime change

Default preference:

- do not split compare into many PRs unless the implementation grows more than
  expected

### PR-8a: W5 wave A — graduate recording and operations facts

Scope:

- `tasks/recording/graduate-demo-findings/` P1A and P2A
- `docs/api/recording.md` and `docs/setup.md` updates
- delete `tasks/recording/demo/meta-problem-summary.md` (already done as
  part of the EM-level review) and trim wave A material out of
  `findings.md`

Why separated from PR-8b:

- wave A content is stable now and does not depend on W2 wording
- it can ship in parallel with the W1/W2 work and unblocks doc readers
  earlier

### PR-8b: W5 wave B — graduate skill contract authoring guidance

Scope:

- `tasks/recording/graduate-demo-findings/` P1B and P2B
- `docs/skills/authoring.md` updates
- final retirement of `tasks/recording/demo/` and
  `tasks/recording/brain-hand-contract/`

Why separate:

- depends on W2 contract wording being stable
- ends the recording subtree cleanup

## Hard Rules

- Do not start compare implementation before `skill-result-contract/` lands.
- Do not treat compare as the fix for replay reliability.
- Do not graduate temporary demo notes into docs until the durable wording is
  stable enough to survive the contract work.
- Do not create `.agents/skills/skill-author-by-recording/` yet.
- Prefer bundling closely related phases into one PR when they share the same
  repo, risk level, and validation story.
- Prefer separate PRs when the work crosses repos, changes runtime contracts, or
  mixes live device behavior changes with lower-risk docs-only follow-up.

## What Each Pack Owns

### `brain-hand-contract/`

Owns:

- architectural problem definition
- recommended multi-stage path forward

Does not own:

- implementation

### `skill-checkpoints/`

Owns:

- Solax `v0` integrity fixes
- failure propagation truthfulness
- terminal-state verification
- safer save sequencing

Does not own:

- compare
- generalized skill runtime contracts

### `skill-result-contract/`

Owns:

- skill-level `SkillResult`
- `runSkill` parsing/support
- Solax retrofit to emit structured results

Does not own:

- declarative `skill.json` goal/verification block
- compare implementation

### `skill-contract-declaration/`

Owns:

- optional `contract` block in `skill.json`
- scaffold/runtime follow-up for declaration

### `compare/`

Owns:

- diagnosing first meaningful divergence between recording baseline and skill
  result

Does not own:

- replay reliability
- skill truthfulness

### `graduate-demo-findings/`

Owns:

- moving durable knowledge from demo task files into docs
- retiring temporary recording demo files

## Current Recommendation

If an agent is picking up work from this subtree and needs the next thing to
execute, start with:

- `tasks/recording/skill-checkpoints/plan.md`
- `tasks/recording/skill-checkpoints/work-breakdown.md`

If an agent is trying to understand the bigger "why", start with:

- `tasks/recording/brain-hand-contract/problem-definition.md`

## Cleanup Rule

When the durable docs and contract work are landed:

- `demo/` should be deleted
- `brain-hand-contract/` can be deleted once its content is fully superseded by
  docs and task history
- this top-level `plan.md` can be deleted once no active recording workstreams
  remain

`brain-hand-contract/problem-definition.md` can be deleted as soon as **all**
of these are true:

- `docs/skills/authoring.md` describes the `SkillResult` shape and the
  declared-contract pattern
- `docs/api/recording.md` describes recording as evidence and points to
  `clawperator recording compare`
- the program definition of done above is satisfied

`tasks/recording/demo/meta-problem-summary.md` was deleted during the
EM-level review because it was already fully superseded by
`brain-hand-contract/problem-definition.md`. Its observations live more
rigorously in the brain-hand-contract document.
