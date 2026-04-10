# Recording Compare

## Executive Summary

Add a recording-versus-run comparison workflow that lets an agent identify the
first meaningful divergence between a recorded baseline and a later skill run.
This is cross-repo work: Clawperator owns `SkillResult` consumption, compare
behavior, and fixture-driven tests, while `../clawperator-skills` provides the
proving skills and runtime validation target.

Compare now has to support two realities:

- replay runs whose path is expected to match the recording closely
- agent-driven orchestrated runs whose path may differ while still reaching the
  same terminal outcome

Start by proving the design against the Solax replay and orchestrated pair,
then generalize only the parts that survive that live exercise.

This task is strictly about diagnosis. It does not own the separate work of
making skills more reliable via in-skill checkpoints, terminal-state
verification, or better selector strategies. That work belongs in a sibling
task pack.

This task is also downstream of the skill-level result contract. Compare should
consume `SkillResult`, not invent an overlapping trace mechanism first.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 after W2 |
| Blockers | `tasks/recording/skill-result-contract/` must define `SkillResult` first; live proving also waits on `tasks/recording/agent-driven-skills/` |

## Goal

Make it possible to compare a skill run against recording-derived expectations
so an agent can say where the run first diverged and why.

## Why Now

The Solax `v0` work showed two truths at once:

- deterministic replay remains essential for some app flows
- current skill authoring lacks a structured way to compare runtime behavior to
  a recording baseline

Without comparison support, agents must infer divergence from screenshots,
ad-hoc UI dumps, and logs. That is slow, fragile, and difficult to generalize.

Comparison support is needed because diagnosis is weak today. It is not itself
the mechanism that makes replay reliable.

## In Scope

- define the compare model for replay-style literal comparison and
  agent-driven semantic comparison
- define and implement normalization from raw recording export into a
  compareable checkpoint baseline
- compare `SkillResult` checkpoints against that derived baseline
- build the feature test-first using real fixtures from the Solax recording and
  validated run traces
- surface the first meaningful divergence in machine-readable and human-usable
  form
- prove the model with the Solax discharge-limit skill
- document what belongs in Clawperator versus the skills repo

## Out of Scope

- fully autonomous recovery or planning from divergence
- generic “brain” architecture changes beyond what compare support requires
- strict raw-event replay matching
- retrofitting every existing skill in one pass
- in-skill checkpoint conventions, terminal-state verification, or reliability
  retrofits beyond what compare proofing minimally needs

## Existing Artifact Scope

Edits are expected in:

- `apps/node/` for compare behavior that consumes `SkillResult`
- `docs/api/` or `docs/skills/` for durable documentation
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay`
  as the historical replay baseline and
  `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated`
  as the proving skill

The existing recording demo task files remain in scope only as temporary
working notes. Durable guidance must migrate out of `tasks/`.

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/` | Clawperator repo | `SkillResult` consumption, compare CLI/API, contracts |
| `docs/` | Clawperator repo | Durable user/developer docs |
| `../clawperator-skills/` | Skills repo | Orchestrated proving skill, replay baseline, validation target, adoption feedback |
| `tasks/recording/compare/` | Clawperator repo | Temporary execution contract for this work |

## Source Of Truth

| Area | Source |
| --- | --- |
| Recording export schema | `apps/node/src/domain/recording/exportRecording.ts` |
| Current recording workflow | `docs/api/recording.md` |
| Skill scaffolding behavior | `docs/skills/authoring.md` and `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Skill runtime contract | `apps/node/src/cli/registry.ts`, `apps/node/src/contracts/` |
| Skill-level result contract | `tasks/recording/brain-hand-contract/problem-definition.md` and the future `tasks/recording/skill-result-contract/` task pack |
| Solax proving behavior | live device validation plus the orchestrated and replay skills in `../clawperator-skills` |
| Test fixtures for compare behavior | sanitized snippets copied into the Clawperator test tree from Solax recording/run evidence |

## Deterministic Versus Judgment

Deterministic:

- normalized checkpoint extraction
- compare output schema
- divergence ordering rules
- the rules for when compare uses literal path matching versus semantic
  terminal-outcome matching

Judgment:

- choosing which checkpoints are meaningful
- deciding what baseline evidence is stable enough to compare
- deciding which Solax-specific findings generalize

## Decision Rules

- Compare normalized checkpoints, not raw event streams.
- Prefer recording export as baseline evidence over parsed step log alone.
- Raw recording export is input evidence, not a ready-made checkpoint
  baseline. W4 must define how export events and timeline facts normalize into
  the checkpoint baseline used for compare.
- Treat the first divergence as the primary diagnostic output.
- Do not claim replay parity unless the final persisted app state is verified.
- Generalize only after the Solax proving case works end to end.
- Treat tests as part of the product surface. The compare model is not accepted
  until fixtures from the Solax case prove both matching and divergent paths.
- Design for recording baselines created with `snapshotMode: omit`; compare must
  still be useful without baseline UI dumps.
- Keep fixtures inside the Clawperator repo. Tests must not depend on the
  sibling skills repo being present at runtime.
- Compare must not require a live device to exercise tests. Live device proof is
  for proving the contract against Solax, not for routine compare regression
  coverage.
- Compare has two first-class modes:
  - `literal` for path-sensitive replay comparison
  - `semantic` for agent-driven runs where terminal outcome can still match
    even when intermediate checkpoints differ
- Compare determines the mode automatically from `SkillResult.source.kind`.
  If `source.kind === "agent"`, compare uses `semantic` mode. If
  `source.kind === "script"`, compare uses `literal` mode. The `--mode` flag
  can override the auto-detected choice. This field is guaranteed to be
  present in any `SkillResult` produced by `runSkill` (it is injected at
  parse time, not emitted by the skill). Compare does not need the skills
  registry to determine the mode - the result is self-describing.
- For agent-driven runs, "outcome matches, path differs" is a successful
  compare result, not a divergence failure.
- For agent-driven runs that fail (terminal verification not proved), compare
  still uses `semantic` mode and reports the first checkpoint divergence
  within that frame. The `compareMode` field in the output always reflects
  the mode compare used, regardless of whether the run succeeded or failed.
- CLI surface for v1 is
  `clawperator recording compare --baseline <export.json> --result <skills-run-json.json> [--json]`.
  Both inputs are local files. For v1, `--result` accepts the full saved JSON
  output of `clawperator skills run --json`, not a bare extracted
  `SkillResult` document. Compare reads that wrapper, extracts `skillResult`,
  and emits a typed report. Exit code is `0` for "no meaningful divergence",
  non-zero for "divergence" or input/parse errors. The `--json` flag is the
  brain-facing surface and must include the typed divergence report.
- A `SkillResult` whose `status` is `failed` is *not* a compare divergence on
  its own. Compare reports the upstream failure verbatim and only walks
  checkpoints up to the failure point. Compare does not invent divergence
  for steps that never ran.
- A `SkillResult` whose `status` is `indeterminate` (declared verification
  not proved) must be reported by compare as a distinct outcome class even
  if checkpoints otherwise match the baseline.
- `runtime_poisoned` and `runtime_unavailable` are only valid compare classes
  if W2 emits an explicit runtime-state signal. If W2 does not ship that
  signal, compare must classify those cases as `upstream_failure` in v1 and
  document the limitation.

## Failure Modes To Prevent

- building a compare system that depends on lossy `record parse` output alone
- comparing timestamps or raw event counts that are not stable enough to matter
- shipping a trace format that is too thin to explain divergence
- treating a successful agent-driven run as a failure just because it took a
  different route than the recording baseline
- overfitting compare logic to Solax-specific implementation details
- leaving durable guidance trapped in `tasks/`
- under-testing compare behavior with synthetic-only fixtures that do not
  reflect real skill brittleness
- blurring "skill diverged from baseline" with "runtime was poisoned or
  unavailable"

## Output Contract

This task should produce:

- a compare command or equivalent compare-capable workflow
- a normalization step or helper that derives a checkpoint baseline from raw
  recording export evidence
- a fixture set derived from the Solax recording/run evidence that can anchor
  TDD-style regression coverage
- an explicit compare mode or outcome field that distinguishes:
  - "literal match"
  - "outcome matches, path differs"
  - true divergence
- divergence output that identifies:
  - baseline checkpoint
  - actual checkpoint
  - first divergence point
  - evidence summary
  - likely class of mismatch
  - whether the failure is:
    - baseline divergence
    - runtime poisoned state
    - runtime unavailable state
- a conscious documented fallback to `upstream_failure` if runtime-state
  signaling is not part of the shipped W2 contract
- Solax validation showing the compare output is useful in practice
- durable docs updates

## Idempotency

`SkillResult`-derived compare outputs may vary in timestamps, incidental
metadata, and the exact path an agent-driven run took. Checkpoint identities,
declared compare mode, divergence ordering, and final-state conclusions should
remain stable across reruns of the same deterministic replay flow and across
meaningfully equivalent agent-driven runs.

## Durable Follow-Up

Before deleting this task pack, move durable guidance into:

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- any repo-local skill guidance needed for `.agents/skills/skill-author-by-recording`
