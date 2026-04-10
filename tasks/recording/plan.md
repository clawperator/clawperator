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

Turn the Solax recording effort into a truthful proving case for two distinct
skill layers:

- a preserved `-replay` baseline that is deterministic, verified, and useful as
  baseline evidence
- an `-orchestrated` proving skill that is **agent-driven at runtime** through
  `SKILL.md` plus a thin harness, emits `SkillResult`, declares its contract,
  and is reliable enough to anchor the recording promo video

Then build compare and guided authoring around that corrected split instead of
around the older "scripted orchestrated skill" assumption.

## Architectural Correction Now Absorbed

These decisions are durable program rules:

- Orchestrated skills are agent-driven by definition. If a skill's `run.js`
  contains the execution logic itself instead of spawning an agent on `SKILL.md`,
  it is replay-shaped regardless of its suffix.
- `SKILL.md` is the runtime agent's program. `scripts/run.js` is a thin harness
  that starts the configured agent CLI and forwards its output.
- The recording export is authoring evidence only. It can be retained as a
  sanitized compare baseline under `references/compare-baseline.export.json`,
  but it is not a runtime artifact and is not passed into the runtime agent.
- The recording promo video is allowed to stay focused on the orchestrated wow
  path, but the program itself must continue to treat replay skills as a
  first-class maintained category.
- Compare consumes the full saved `clawperator skills run --json` wrapper,
  extracts `skillResult`, and compares that against the retained sanitized
  baseline.

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

### What the Solax proving case looks like after the program

Today: there is one Solax skill, and it mixes together several concerns:
replay behavior, device-specific caveats, emerging reliability fixes, and the
future brain/hand path.

After this work:

- `com.solaxcloud.starter.set-discharge-to-limit-replay` exists as the
  durable replay-style baseline for deterministic UI
- `com.solaxcloud.starter.set-discharge-to-limit-orchestrated` exists as the
  brain/hand proving skill that emits `SkillResult`, declares its contract,
  and participates in compare
- the replay skill remains useful as a baseline and fallback, rather than
  being overwritten and lost
- the orchestrated skill becomes the concrete proving case for what
  “agent-controlled” means in this repo

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
- `docs/api/recording.md` describes recordings as evidence. After W4 ships,
  it also points to the compare workflow as the way to validate replay
  against a baseline
- the durable Solax learnings (input persistence workaround, accessibility
  service restart, container vs label clickability) live in the right docs
  instead of in `tasks/`

### What the developer-facing authoring workflow becomes

Today: creating a serious skill from a recording still requires an expert to
manually manage recording lifecycle commands, inspect the export, scaffold the
skill, and then hand-author the reliable parts.

After this work:

- it is safe to build a repo-local `.agents/skills/skill-author-by-recording/`
  workflow that guides an agent through the full process as the single
  developer-facing entrypoint
- that workflow can tell the human exactly when to perform the recorded UI
  flow, manage `record start` / `record stop` / `record pull` / `recording
  export`, hand the captured evidence to an authoring-time agent, and then
  help author the orchestrated skill from that evidence
- if the workflow becomes large, it is explicitly allowed to orchestrate
  narrower helper skills behind the scenes, similar to `release-orchestrator`,
  but the human-facing entrypoint remains `skill-author-by-recording`
- the resulting artifacts are inspectable by both developers and agents:
  recording export, orchestrated `SKILL.md`, thin `run.js`, declared contract,
  first-run `SkillResult`, and compare output
- the workflow remains honest that recordings are evidence, while still making
  end-to-end skill creation feel guided rather than manual
- the workflow is generic enough to help author a developer's own skill, not
  just replay the Solax proving case. Solax is the proving example, not the
  product boundary.

## Program Definition Of Done

The recording subtree is complete when **all** of the following are true:

- Solax `v0` exits truthfully on forced failure (skill-checkpoints W1)
- Solax verifies the persisted `Discharge to <n>%` row before reporting
  success (skill-checkpoints W1)
- The replay-style Solax baseline is preserved as
  `com.solaxcloud.starter.set-discharge-to-limit-replay` instead of being
  silently replaced in-place (skill-checkpoints W1)
- A regression test in `apps/node/src/test/` proves a stub skill that exits
  non-zero is reported by `runSkill` as `ok:false` (skill-checkpoints W1)
- The non-zero-exit regression is exercised by the normal
  `npm --prefix apps/node run test` path used in CI, or CI is updated in the
  same PR so the regression is actually enforced (skill-checkpoints W1)
- `SkillResult` is defined in `apps/node/src/contracts/`, parsed by
  `runSkill`, exposed on `SkillRunResult`, with backward compatibility for
  legacy skills (skill-result-contract W2)
- The preserved replay sibling
  `com.solaxcloud.starter.set-discharge-to-limit-replay` is retrofitted in
  the same workstream to also emit a parseable `SkillResult`, using the
  coarse-subset checkpoint list defined by W2, so the recording program
  does not ship a first-class replay skill that still speaks opaque
  stdout (skill-result-contract W2)
- A new Solax brain/hand proving skill exists at
  `com.solaxcloud.starter.set-discharge-to-limit-orchestrated`, and that
  proving skill is agent-driven at runtime:
  - `SKILL.md` is the runtime agent's program
  - `scripts/run.js` is a thin harness that spawns the configured agent CLI
  - the embedded runtime agent emits a parseable `SkillResult` with declared
    checkpoint identities and terminal verification
  - the reliability validation phase has been run against a live Samsung
    target and recorded a passing outcome rate (agent-driven-skills W2b)
- `skill.json` supports an optional `contract` block, scaffold writes a
  starter, and `runSkill` returns a distinct `indeterminate` state when a
  declared verification is not proved (skill-contract-declaration W3)
- The orchestrated Solax `skill.json` declares its contract
  (skill-contract-declaration W3)
- `clawperator recording compare` consumes a `SkillResult` and a recording
  export, identifies the first divergence with a typed category, runs
  test-first against local fixtures with no live device dependency, and is
  proven against both a baseline-drift and a verification-failure divergence
  on the orchestrated Solax case (compare W4)
- The retained sanitized compare baseline lives under a reference-style path
  such as `references/compare-baseline.export.json`, is not listed under
  `skill.json.artifacts`, and is not passed into the runtime agent prompt
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
| 1 | `skill-checkpoints/` | next | preserve the current Solax path as the truthful `-replay` baseline |
| 2 | `skill-result-contract/` | ready after 1 | define `SkillResult`, parse it in `runSkill`, and retrofit the replay baseline to emit it |
| 2b | `agent-driven-skills/` | ready after 2 | define the runtime agent shape for orchestrated skills and prove it on the Solax `-orchestrated` skill |
| 3 | `skill-contract-declaration/` | blocked on 2 and 2b | declare inputs, goal, and verification in the agent-driven orchestrated `skill.json` |
| 4 | `compare/` | blocked on 2 for implementation and 2b for proving | compare recording baseline against emitted `SkillResult`, including agent-driven runs that may take a different path |
| 5a | `graduate-demo-findings/` (wave A) | active | graduate recording-as-evidence and operations facts that do not depend on `SkillResult` shape |
| 5b | `graduate-demo-findings/` (wave B) | blocked on 2 | graduate skill-contract and authoring facts once W2 wording is stable |
| 6 | `skill-author-by-recording/` | blocked on 2b, 3, 4, and 5 | package the proven recording-to-orchestrated workflow into a repo-local agent skill |

## Required Sequence

1. Finish `skill-checkpoints/`
2. Finish `skill-result-contract/`
3. Finish `agent-driven-skills/`
4. Start `skill-contract-declaration/`
5. Start `compare/`
6. Run `graduate-demo-findings/`

`graduate-demo-findings/` wave A may run in parallel with `skill-checkpoints/`
because its content does not depend on the contract shape. Wave B still waits
for W2 wording to stabilize. W6 waits until the runtime agent shape, declared
contract semantics, compare model, and durable docs are all stable enough to
teach honestly.

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
- rename/preserve the current skill as
  `com.solaxcloud.starter.set-discharge-to-limit-replay`

Why grouped:

- this is one coherent behavior fix
- Solax replay should become truthful and explicitly named in one reviewable
  step

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

### PR-4: W2 replay contract retrofit

Scope:

- `tasks/recording/skill-result-contract/` P3
- retrofit the preserved
  `com.solaxcloud.starter.set-discharge-to-limit-replay` sibling to emit
  `SkillResult`
- replay-skill `SkillResult` emission in `../clawperator-skills`

Why separate:

- different repo
- depends on PR-3 contract shape being real
- keeps W2 emitter-agnostic and leaves the orchestrated runtime shape to W2b

### PR-5a: W2b runtime agent support

Scope:

- `tasks/recording/agent-driven-skills/` P1 and P2
- `apps/node` runtime support for agent-driven skills
- doctor coverage and regression tests

Why separate:

- new runtime contract surface
- different risk profile from the skills-repo Solax proving case
- keeps the universal `SkillResult` work distinct from the runtime-agent path

### PR-5b: W2b Solax proving case and reliability validation

Scope:

- `tasks/recording/agent-driven-skills/` P3, P4, and P5
- create
  `com.solaxcloud.starter.set-discharge-to-limit-orchestrated`
- reliability validation and forced-failure capture for the video
- downstream plan/docs handoff

Why separate:

- different repo
- depends on PR-5a runtime support existing
- the video's "reliably run" claim must be backed by this proof, not by
  architecture notes alone

### PR-6: W2 downstream handoff updates

Scope:

- `tasks/recording/skill-result-contract/` P4
- any task-pack alignment needed after the contract lands

Why usually small:

- planning/documentation follow-through only

Acceptable collapse:

- if PR-3 leaves the task packs obviously aligned already, this can be folded
  into PR-3 instead of standing alone

### PR-7: W3 contract declaration

Scope:

- `tasks/recording/skill-contract-declaration/` P1 and P2 in this repo
- `tasks/recording/skill-contract-declaration/` P3 in `../clawperator-skills`

Recommended split:

- one Clawperator PR for scaffold/runtime support
- one skills-repo PR for Solax declaration proof

### PR-8: W4 compare

Scope:

- `tasks/recording/compare/` P1 through P4

Recommended grouping:

- one Clawperator PR for compare model, implementation, tests, and docs
- one small skills-repo PR only if Solax proving support needs a runtime change

Default preference:

- do not split compare into many PRs unless the implementation grows more than
  expected

### PR-9a: W5 wave A — graduate recording and operations facts

Scope:

- `tasks/recording/graduate-demo-findings/` P1A and P2A
- `docs/api/recording.md` and `docs/setup.md` updates
- delete `tasks/recording/demo/meta-problem-summary.md` (already done as
  part of the EM-level review) and trim wave A material out of
  `findings.md`

Why separated from PR-9b:

- wave A content is stable now and does not depend on W2 wording
- it can ship in parallel with the W1/W2 work and unblocks doc readers
  earlier

### PR-9b: W5 wave B — graduate skill contract authoring guidance

Scope:

- `tasks/recording/graduate-demo-findings/` P1B and P2B
- `docs/skills/authoring.md` updates
- final retirement of `tasks/recording/demo/` and
  `tasks/recording/brain-hand-contract/`

Why separate:

- depends on W2 contract wording being stable
- ends the recording subtree cleanup

## Principles Any Implementation Must Preserve

These are cross-cutting invariants for the whole program. If an implementation
violates one of these, it is wrong even if the local acceptance criteria look
green.

1. **Reliable outcome, not reliable path.** An agent-driven orchestrated skill
   is not deterministic by path. Two runs of the same skill with the same
   inputs may hit different intermediate checkpoints because the agent recovered
   from a surprise or took a different branch. The contract the brain relies on
   is the **terminal verification**, not the exact checkpoint sequence. This
   reframes what "reliability" means across W2b, W4, and the video.
2. **The hand stays deterministic.** Even though the brain inside the skill is
   non-deterministic, every call it makes into Clawperator (exec, snapshot,
   checkpoint, skill-result) is deterministic. The agent cannot bypass the hand.
3. **The brain is inspectable.** A developer must be able to open `SKILL.md`
   and read the exact program the runtime agent was given. The brain is not a
   black box; it is a markdown file next to the skill. This is what
   distinguishes this design from "just ask Claude to do it."
4. **The declared contract is the source of truth for success.** The
   `skill.json` `contract` block (W3) plus `SkillResult.terminalVerification`
   are the only things that let the runtime say a skill succeeded. An agent that
   claims success in text but cannot prove terminal verification does not
   succeed; it returns `indeterminate`.
5. **Every artifact is inspectable code or data.** Recording export, `SKILL.md`,
   `skill.json`, `run.js` harness, `SkillResult` JSON, compare output. Nothing
   is hidden. A developer must be able to open each one and understand it.
6. **Authoring and runtime use the same agent CLI.** `codex` is the v1 default
   for both. A plan that introduces different CLIs at different stages without a
   clear reason is adding complexity the program does not need.
7. **Do not sell the Solax proving case as the only supported authoring path.**
   The task packs may use Solax as the concrete proving case, but the front-door
   workflow in W6 must support a developer authoring their own app-specific
   skill with the same recording-evidence and retained-baseline model.

## Hard Rules

- Do not start compare implementation before `skill-result-contract/` lands.
- Do not treat compare as the fix for replay reliability.
- Do not graduate temporary demo notes into docs until the durable wording is
  stable enough to survive the contract work.
- Do not create `.agents/skills/skill-author-by-recording/` yet.
- Orchestrated skills created from W2b onward are agent-driven by definition.
  A `run.js` that contains the skill logic itself instead of spawning an agent
  CLI is, by definition, a replay-shaped skill regardless of its id suffix.
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
- retiring the unsuffixed
  `com.solaxcloud.starter.set-discharge-to-limit` id in favor of
  `...-replay`, with any doc/reference sweep needed in the same PR
- failure propagation truthfulness
- terminal-state verification
- safer save sequencing

Does not own:

- compare
- generalized skill runtime contracts

Caller preference while both Solax skills exist:

- prefer `com.solaxcloud.starter.set-discharge-to-limit-replay` until W3
  lands and the orchestrated skill has both runtime-agent support and declared
  contract support
- treat `...-orchestrated` as the experimental proving sibling during W2b/W3

### `skill-result-contract/`

Owns:

- skill-level `SkillResult`
- `runSkill` parsing/support
- retrofit of the preserved replay Solax skill so the replay baseline also
  emits `SkillResult`

Does not own:

- agent-driven orchestrated skill runtime
- declarative `skill.json` goal/verification block
- compare implementation

### `agent-driven-skills/`

Owns:

- the runtime-agent shape for orchestrated skills
- the `agent` block in `skill.json`
- agent CLI resolution, validation, and doctor coverage
- the Solax `...-orchestrated` proving skill
- reliability validation for the orchestrated proving case

Does not own:

- the universal `SkillResult` contract itself
- replay-skill behavior beyond what W2 already owns
- compare implementation

### `skill-contract-declaration/`

Owns:

- optional `contract` block in `skill.json`
- scaffold/runtime follow-up for declaration
- cross-checking the declared contract against the emitted `SkillResult`

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

If an agent is picking up the architectural correction that unlocks the video
and the future authoring workflow, start with:

- `tasks/recording/agent-driven-skills/plan.md`
- `tasks/recording/video-draft.md`

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
  `clawperator recording compare` after that command has shipped
- the program definition of done above is satisfied

`tasks/recording/demo/meta-problem-summary.md` was deleted during the
EM-level review because it was already fully superseded by
`brain-hand-contract/problem-definition.md`. Its observations live more
rigorously in the brain-hand-contract document.
