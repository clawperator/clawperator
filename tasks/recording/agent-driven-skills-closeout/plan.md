# W2b Closeout (Agent-Driven Skills Follow-Up)

## Executive Summary

This pack closes the remaining `skills/agent-driven` branch work after the
main W2b runtime shape landed. Four phases (C1, C2.0, C2, C3) ship across two
PRs. The Clawperator PR carries C1, the C2.0 probe evidence, and the C3
reliability artifacts (because reliability lives under Clawperator
`docs/internal/design/reliability/`). The skills PR carries C2 (harness
thinning, strict-agentic SKILL.md hardening, codex-only docs). Current state:
C1 is next, no phases complete, no blockers.

The pack makes Clawperator runtime and docs truthful, probes whether the
Solax orchestrated skill depends on a hidden codex bypass toggle, thins the
Solax orchestrated harness into a truthful codex wrapper, hardens `SKILL.md`
against GPT-5-family lazy-mode behavior, and captures the 10-run reliability
protocol with a lazy-success detection pass so false-positive successes
cannot game the threshold.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 4 (C1, C2.0, C2, C3) |
| Completed | none |
| Remaining | C1, C2.0, C2, C3 |
| Current / Next | C1 |
| Blockers | none; C2 is gated on C2.0 probe commit, C3 is gated on C2 shipping and on a physical Samsung device being available |

## Goal

Close the remaining gaps so W2b can ship as two reviewable PRs with honest
language about the codex-only v1 limitation, no hidden runtime toggles, a
thin truthful Solax orchestrated harness, committed reliability evidence,
and matching source-of-truth state in the task packs.

## Why Now

The macro review of `main..HEAD` found nine concrete gaps:

1. `runSkill` silently downgrades to scripted execution when `skill.json.agent`
   is malformed (`apps/node/src/domain/skills/runSkill.ts` lines 280-290),
   and the existing regression test actively pins that behavior.
2. `SKILL_AGENT_CLI_UNAVAILABLE` is missing from the public Error Codes
   table in `docs/skills/overview.md`.
3. The orchestrated runtime env-var contract (`CLAWPERATOR_SKILL_AGENT_CLI`,
   `_CLI_PATH`, `_TIMEOUT_MS`, `CLAWPERATOR_SKILL_PROGRAM`, `_INPUTS`, `_ID`,
   skill-scoped `CLAWPERATOR_DEVICE_ID`) is undocumented.
4. The Solax orchestrated `scripts/run.js` is 637 lines and embeds Solax
   navigation, Samsung tap coordinates, a codex-specific prompt, and a
   duplicated `SkillResult` parser.
5. The same harness couples to a sibling-repo layout (`../clawperator`) and
   the branch-local dist path, so it cannot run from a normal install.
6. `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` is a hidden, undocumented env
   toggle that inserts `--dangerously-bypass-approvals-and-sandbox` into
   codex argv.
7. The codex-only W2b v1 decision is implicit; there is no visible
   documentation of the limitation.
8. W2b v1 runs under codex (GPT-5 family), and OpenClaw's public strict-
   agentic contract documents that GPT-5-family runs emit plan-only turns
   instead of calling tools. Our reliability protocol does not yet detect
   this lazy-mode failure pattern, so a frame-clean run that never touches
   the device could pass as success.
9. P4 reliability has exactly one recorded live run and an empty
   `docs/internal/design/reliability/` directory. The 10-run gate is not
   met.

The Clawperator repo half is close to PR-ready; the skills repo half is not.
This pack makes both ready, and does so without broadening scope into W3.

## In Scope

- Clawperator runtime strictness on malformed orchestrated manifests
- Clawperator public docs: error codes table row and orchestrated env-var
  reference
- One-shot C2.0 bypass-dependency probe and its committed evidence
- Solax orchestrated harness thinning (deletion job; SKILL.md already
  contains the runtime program)
- Solax orchestrated `SKILL.md` hardening with strict-agentic discipline
  rules
- Codex-only W2b v1 limitation language in the skill and in public skill
  docs
- P4 10-run reliability protocol with lazy-success detection
- Status-table updates in this pack and in `agent-driven-skills/`
- Conditional (bucket B only): a declared `skill.json.agent` contract
  extension that replaces the hidden bypass toggle

## Out of Scope

- Generic multi-CLI runtime portability. W2b v1 is codex-only at runtime
  and this pack must not gate on non-codex support.
- Turn-level retry in `runSkill`. OpenClaw's "retry with act-now steer" is
  a runtime model change and belongs to later contract work.
- A new `blocked` terminal `SkillResult` status variant. Contract bump.
- Runtime tool-call-evidence enforcement inside `runSkill`. The lazy-mode
  gate in this pack lives in `SKILL.md` and in C3 classification only.
- Replacing the Pi harness with codex. Not our architecture.
- Shared orchestrated harness helpers or a generic thin-harness utility.
- Richer parse sub-codes for `SKILL_RESULT_PARSE_FAILED`.
- W3 `skill.json.contract`.
- W4 compare work.
- Any edit to the replay sibling
  (`skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`).

## Existing Artifact Scope

This pack edits artifacts that already contain content. Scope boundaries for
each:

- `apps/node/src/domain/skills/runSkill.ts`: one stricter check at the
  malformed-manifest path (C1 Step 1). Rest preserved as-is.
- `apps/node/src/test/unit/skills.test.ts`: the existing
  "rejects framed SkillResults when skill.json has a malformed agent block"
  test case whose non-framed assertion expects `legacy-output-only` is in
  scope to rewrite (C1 Step 2). The rest of the file is preserved.
- `docs/skills/overview.md`: one new row in the Error Codes table around
  line 569 (C1 Step 3). Surrounding content preserved.
- `docs/api/environment.md`: add orchestrated runtime env-var section (C1
  Step 4). Existing `CLAWPERATOR_SKILLS_REGISTRY` content preserved.
- `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md`:
  already contains the runtime program (checkpoints, navigation, terminal
  verification, reference success JSON). C2 Step 5 appends strict-agentic
  discipline rules; C2 Step 6 adds a short codex-only note. Existing
  playbook, navigation policy, recovery branch, and reference success JSON
  must stay intact.
- `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js`
  (637 lines): primarily a deletion target (C2 Steps 1-4). The final shape
  is a thin codex wrapper. Do not preserve Solax-specific logic, the
  duplicated `SkillResult` parser, the `CHECKPOINT_IDS` array, the Samsung
  tap coordinates, the `../clawperator` resolution, or
  `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS`.
- `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json`:
  preserved as-is unless C2.0 bucket B forces a declared `agent` field
  extension.
- `skills/com.solaxcloud.starter.set-discharge-to-limit-replay/` (any file):
  out of scope. Do not edit.
- `tasks/recording/agent-driven-skills/plan.md` and `work-breakdown.md`:
  preserve all existing content. C3 Step 9 only updates the P4 status row
  to match the measured reliability outcome.
- `tasks/recording/agent-driven-skills-closeout/plan.md` and
  `work-breakdown.md`: update the Status tables to reflect completed
  phases as they ship.

Any existing file not listed above is out of scope for this pack.

## Surfaces and Ownership

| Surface | Repo | Phase |
| --- | --- | --- |
| `runSkill` malformed-agent rejection | clawperator | C1 |
| Skills unit tests (`skills.test.ts`) | clawperator | C1 |
| Error Codes table (`docs/skills/overview.md`) | clawperator | C1 |
| Orchestrated env-var docs (`docs/api/environment.md`) | clawperator | C1 |
| C2.0 probe evidence dir (`docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`) | clawperator | C2.0 |
| Solax orchestrated harness (`scripts/run.js`) | clawperator-skills | C2 |
| Solax orchestrated runtime program (`SKILL.md`) | clawperator-skills | C2 |
| Codex-only language in public skill docs | clawperator | C2 |
| `skill.json.agent` contract extension (conditional, bucket B only) | clawperator + clawperator-skills | C2 |
| C3 reliability artifacts (`docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/run-01..run-10`, `summary.md`, `baseline.md`) | clawperator | C3 |
| Task-pack status tables | clawperator | C3 |

## Source Of Truth

Verify every claim against the code or authored surface, not against existing
task docs or memory.

| Topic | Verify against |
| --- | --- |
| `runSkill` orchestrated detection and malformed-manifest behavior | `apps/node/src/domain/skills/runSkill.ts` lines 280-290, 305-335 |
| Manifest parser strictness | `apps/node/src/domain/skills/skillManifest.ts` |
| Validation-time manifest rejection | `apps/node/src/domain/skills/validateSkill.ts` lines 176-199 |
| Skill contract types and error codes | `apps/node/src/contracts/skills.ts` |
| SkillResult frame shape and versioning | `apps/node/src/contracts/result.ts` |
| Existing "legacy permissive" regression test | `apps/node/src/test/unit/skills.test.ts` around the "rejects framed SkillResults when skill.json has a malformed agent block" case (look for `legacy-output-only` literal) |
| Error Codes table | `docs/skills/overview.md` around line 569 |
| Env var reference surface | `docs/api/environment.md` |
| Orchestrated authoring surface | `docs/skills/authoring.md` and `docs/skills/overview.md` |
| Current Solax orchestrated harness | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js` |
| Current Solax runtime program | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md` |
| Skill manifest | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json` |
| Replay control (untouched) | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/` |
| Thin-harness exemplar | `apps/node/src/test/fixtures/skills/com.test.agent-skill-result/scripts/run.js` |
| Skills registry shape | `../clawperator-skills/skills/skills-registry.json` and `skills-registry.schema.json` |
| Reliability dir convention | `docs/internal/design/reliability/` (currently empty) |
| Recording program principles | `tasks/recording/plan.md` |
| W2b runtime-shape reference | `tasks/recording/agent-driven-skills/plan.md` and `work-breakdown.md` |
| Task-author quality bar | `.agents/skills/task-author/SKILL.md` |
| Docs build skill | `.agents/skills/docs-build/SKILL.md` |
| Docs author skill | `.agents/skills/docs-author/SKILL.md` |
| Repo conventions (no em dashes, conventional commits, test discipline) | `CLAUDE.md` |

Do not write code or docs from the task pack alone. Read the verification
file first.

## Deterministic Versus Judgment

Deterministic. Do not re-derive or relax.

- C1 Step 1 result: `runSkill` must return a typed error when
  `readSkillManifestMetadata` returns `ok: false`. The error code is
  `SKILL_VALIDATION_FAILED` (reuse existing code, do not invent new).
- C1 Step 2 result: the legacy-permissive test must no longer assert
  permissive behavior for a malformed-agent manifest. It may still assert
  permissive behavior for an absent-agent manifest.
- C1 Step 3 result: exactly one new row in the Error Codes table for
  `SKILL_AGENT_CLI_UNAVAILABLE`.
- C1 Step 4 env-var list: exactly `CLAWPERATOR_SKILL_AGENT_CLI`,
  `CLAWPERATOR_SKILL_AGENT_CLI_PATH`, `CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS`,
  `CLAWPERATOR_SKILL_PROGRAM`, `CLAWPERATOR_SKILL_INPUTS`,
  `CLAWPERATOR_SKILL_ID`, and the skill-scoped use of
  `CLAWPERATOR_DEVICE_ID`. Do not add or omit entries.
- C2.0 bucket classification: use the three-bucket table in "Decision
  Rules" below verbatim. Do not invent a fourth bucket.
- C2 Step 4 action: branch only on the committed C2.0 bucket result. Do
  not re-interpret.
- C2 Step 5 required rules: the five strict-agentic rules in the work
  breakdown are non-negotiable content. Phrasing may be tightened;
  meaning may not be diluted.
- C3 Step 6 lazy-success thresholds: the three classification rules
  (`<5 distinct Clawperator invocations`, `no terminal read call`, `no
  evidence-cited checkpoint notes`) are fixed. Do not relax them.
- C3 Step 9 status-table update must match the measured threshold
  outcome. Do not soften the plan language if the threshold was not met.

Judgment. These require synthesis and may escalate.

- C2 Step 1 decisions about which exact lines of `scripts/run.js` to
  delete vs move. The shape is constrained (thin codex wrapper); the
  diff is not scripted.
- C2 Step 5 rule phrasing (meaning is fixed, exact wording may be
  refined).
- C2 Step 6 placement of the codex-only note (skill vs overview vs
  authoring, or all three).
- C3 Step 1 baseline definition (concrete device state fields).
- C3 Step 8 replay control run interpretation.
- Any C2 bucket-B contract-extension design: field name, type, default,
  doc placement. Escalate on bucket B; do not guess a shape.

Do not re-derive deterministic rules. Use the tables verbatim.

## Decision Rules

### C2.0 Probe Outcome Buckets

Classify the probe run result into exactly one bucket. First-match-wins.

| Bucket | Observation | C2 Step 4 action |
| --- | --- | --- |
| A | `probe.json` contains a SkillResult with `status: "success"` and `terminalVerification.status: "verified"` | Delete `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` from `scripts/run.js` in C2 Step 4 with no contract change. The probe run may count as `run-00` in C3. |
| B | `probe.stderr` cites codex sandbox, approval, "denied", "read-only", "cannot write", subprocess-blocked, or codex refused to spawn the Clawperator child | Stop. Do not delete the flag. Escalate to declared-contract design: add a new field to `apps/node/src/contracts/skills.ts`, parse it in `skillManifest.ts`, thread it through `runSkill.ts` as a new env var, document it in `docs/skills/authoring.md` and `docs/skills/overview.md`, and only then replace the hidden env var in `scripts/run.js`. |
| C | Failure real but unrelated to sandbox/approval (flake, timeout, layout drift, app state). Stderr shows no sandbox/approval signal. | Retry the probe up to 2 more times from the same clean baseline. If all 3 attempts fail without citing sandbox/approval, treat as bypass-independent unreliability: delete the flag in C2 Step 4 AND flag C3 reliability as at-risk in the probe `README.md`. |

### C3 Per-Run Lazy-Mode Classification

Classify every captured reliability run into exactly one category.
First-match-wins.

| Observed in the run | Classification | Counts toward ≥8/10 threshold? |
| --- | --- | --- |
| `status: success` AND ≥5 distinct Clawperator CLI invocations in stderr AND a Clawperator `read` call targeting `Discharge to <percent>%` AND checkpoint notes cite concrete Clawperator commands | evidence-backed success | Yes |
| `status: success` AND fewer than 5 distinct Clawperator invocations in stderr | lazy-success | No |
| `status: success` AND no terminal `read` call of `Discharge to <percent>%` in stderr | lazy-success | No |
| `status: success` AND checkpoint notes do not cite the concrete Clawperator commands used | lazy-success | No |
| `status: failed` | failed | No |
| `status: indeterminate` | indeterminate | No |
| Frame parse failure, SKILL_RESULT_PARSE_FAILED, or any `runtime_poisoned` state | runtime_poisoned | No. Also blocks ship. |

Only the first row counts toward the ≥8/10 threshold. A ten-run protocol
with zero `runtime_poisoned` but fewer than 8 evidence-backed successes has
not met the gate, regardless of how many raw `status: success` frames it
produced.

## Failure Modes To Prevent

1. **Silent downgrade**: a future broken orchestrated skill runs as a
   scripted replay because `runSkill` drops `manifestAgent` to `undefined`
   when the manifest parse failed.
2. **Parser drift**: the orchestrated harness re-implements the
   `SkillResult` contract and diverges from Clawperator's parser on
   subsequent contract bumps.
3. **Codex-only left implicit**: integrators assume runtime portability
   the code does not deliver.
4. **Hidden bypass smuggled back in**: a C2 implementer preserves
   `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` because they remember a past
   run needing it. C2.0 probe evidence prevents this.
5. **Lazy-mode false positive reliability**: GPT-5-family codex emits a
   clean `status: success` frame without calling any Clawperator tools.
   The skill records "success" while the device was never touched. C3
   Step 6 classification prevents this.
6. **Reliability pre-declared**: status tables updated before evidence
   exists.
7. **Replay regression**: registry or SKILL.md edits accidentally break
   the replay sibling.
8. **Cross-repo ordering drift**: skills PR is marked ready before
   Clawperator's reliability commits land, leaving skills PR
   un-validatable.
9. **Generated-vs-authored docs confusion**: error table fix lands in
   `sites/docs/.build/` instead of `docs/skills/overview.md`.
10. **Test-as-afterthought**: the malformed-agent fix ships without the
    regression test that locks down the new behavior.

## Output Contract

At the end of this pack, the following must exist.

**clawperator repo:**

- `apps/node/src/domain/skills/runSkill.ts` returns a typed error for
  malformed `skill.json.agent` in every path, including the non-framed
  legacy path.
- `apps/node/src/test/unit/skills.test.ts` contains a new regression
  test asserting that a non-framed legacy script with a malformed agent
  manifest returns a typed error, and the former `legacy-output-only`
  permissive assertion only applies when `agent` is absent.
- `docs/skills/overview.md` Error Codes table contains a
  `SKILL_AGENT_CLI_UNAVAILABLE` row.
- `docs/api/environment.md` documents the seven orchestrated runtime
  env vars listed in "Deterministic Versus Judgment".
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`
  contains `README.md` (bucket classification), `probe.json` or attempts
  `probe-attempt-1.json` through `-3.json`, `probe.stderr` or attempts,
  `codex-version.txt`, and `codex-sandbox-flags.txt`.
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/baseline.md`
  defines the clean pre-run device state.
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/run-01/`
  through `run-10/` each contain `result.json`, `stderr.txt`,
  `frame.json`, `metadata.json`.
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/summary.md`
  classifies every run and states whether the ≥8/10 evidence-backed
  threshold held.
- `tasks/recording/agent-driven-skills-closeout/plan.md` and
  `work-breakdown.md` Status tables match the committed evidence.
- `tasks/recording/agent-driven-skills/plan.md` and `work-breakdown.md`
  P4 status row matches the measured outcome.

**clawperator-skills repo:**

- `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js`
  is a thin codex wrapper in the shape of
  `apps/node/src/test/fixtures/skills/com.test.agent-skill-result/scripts/run.js`
  plus the codex-specific spawn shape. No Solax-specific logic, no
  duplicated `SkillResult` parser, no `CHECKPOINT_IDS` array, no Samsung
  coordinate hints, no `../clawperator` resolution, no
  `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS`.
- That skill's `SKILL.md` contains five strict-agentic discipline rules
  (see C2 Step 5) and an explicit codex-only note for W2b v1.
- The replay sibling is unchanged on disk.
- (Conditional, bucket B only) `skill.json` contains a declared agent
  field that replaces the hidden env toggle, and the matching runtime
  support in Clawperator has shipped.

## Idempotency

- C1 can be re-run safely. Test tightening and docs edits are idempotent.
- C2.0 probe artifacts are single-shot. Do not re-run the probe after the
  bucket is committed unless codex major-version or sandbox-default
  behavior changes.
- C2 harness thinning can iterate as draft-plus-refine, but the final
  shape must match C2 Acceptance Criteria before commit. Conditional
  bucket-B contract extension can iterate independently.
- C3 is not partially re-runnable. If the capture is restarted, discard
  prior incomplete runs and execute the full 10 from the same baseline.
  The `run-NN` directory numbering resets.
- Status-table updates in task files are idempotent but must match the
  committed evidence exactly at every commit.

## Durable Follow-Up

Knowledge in this pack that must outlive the closeout directory:

- Error-code semantics -> `docs/skills/overview.md` (via C1 Step 3)
- Orchestrated runtime env-var contract -> `docs/api/environment.md`
  (via C1 Step 4)
- Strict-agentic discipline rules -> Solax orchestrated `SKILL.md`
  (via C2 Step 5), with a general-advice cross-reference in
  `docs/skills/authoring.md`
- Codex-only W2b v1 limitation -> Solax orchestrated `SKILL.md` and
  `docs/skills/overview.md` (via C2 Step 6)
- Reliability evidence -> stays in
  `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/`
  (the artifacts themselves are the durable record; do not migrate to
  `docs/` prose summaries)
- Conditional bucket-B contract field -> `apps/node/src/contracts/skills.ts`
  plus `docs/skills/authoring.md`

When `tasks/recording/agent-driven-skills-closeout/` is eventually
deleted, none of the above knowledge is lost because every item above
has a durable home named explicitly.
