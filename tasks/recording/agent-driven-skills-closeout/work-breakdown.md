# Agent-Driven Skills Closeout Work Breakdown (W2b Follow-Up)

## Executive Summary

Concrete remaining work for the `skills/agent-driven` branches after the main
W2b runtime work. This pack should be used for implementation. The older
`agent-driven-skills/` pack remains the history and runtime-shape reference.

## Status

| Item | Value |
| --- | --- |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | C1, C2.0, C2, C3 |
| Current / Next | C1 |

## Hard Rules

- Do not mark the skills-side PR ready before C3 is complete.
- Do not declare P4 reliability passed on fewer than 10 recorded runs.
- Do not leave codex-only as an implicit implementation detail. If it is the
  shipped W2b v1 reality, document it in the skill and in the public skill
  docs with the exact phrasing "W2b v1 orchestrated skills are codex-only at
  runtime" or equivalent.
- Do not preserve hidden runtime toggles as private operator knowledge. If a
  knob is needed, promote it into the public `skill.json.agent` contract or
  delete it. The delete-vs-promote decision for
  `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` must be backed by the C2.0 probe
  evidence, not by recollection.
- Do not begin C2 edits to `scripts/run.js` before C2.0 is committed.
- Do not treat a `status: success` SkillResult as a reliability success
  unless the captured stderr shows the runtime agent actually called the
  Clawperator CLI to produce evidence for each `ok` checkpoint and the
  terminal verification. Lazy-mode successes (prose planning without tool
  use) must be excluded from the reliability threshold even if the frame
  schema parsed cleanly.
- Do not broaden this pack into W3 or W4.
- Do not touch the replay sibling
  (`com.solaxcloud.starter.set-discharge-to-limit-replay`) as part of this
  closeout work. It is a control surface for reliability testing.
- Do not reintroduce Solax-specific logic into `scripts/run.js`. Solax runtime
  behavior lives in `SKILL.md`.
- Do not gate this pack on generic multi-CLI runtime portability. W2b v1 is
  allowed to be codex-specific at runtime.

## Phase C1: Close Clawperator Runtime And Docs Gaps

### Goal

Finish the remaining Clawperator-side branch deltas so the runtime repo is
honestly PR-ready.

### Current Reality To Verify Before Editing Code

- `apps/node/src/domain/skills/runSkill.ts` (around lines 280-290) computes
  `manifestAgent = manifestResult.ok ? manifestResult.metadata.agent : undefined`
  and then treats `isAgentDriven = false` when the manifest parse failed. In
  that branch, the scripted path runs even though the author clearly intended
  an orchestrated skill.
- The existing regression test in `apps/node/src/test/unit/skills.test.ts`
  at the "rejects framed SkillResults when skill.json has a malformed agent
  block" case also asserts that a non-framed legacy script "stays permissive"
  on the same malformed `skill.json.agent` (searches for `legacy-output-only`).
  That assertion must be updated: a malformed agent block should fail clearly,
  regardless of whether the script emits a frame.
- `docs/skills/overview.md` has an Error Codes table around line 569 that does
  not list `SKILL_AGENT_CLI_UNAVAILABLE`.
- `docs/api/environment.md` currently only documents `CLAWPERATOR_SKILLS_REGISTRY`
  from the skills surface. It does not document the orchestrated env-var
  contract that `runSkill` injects into agent-driven harnesses.

### Steps

1. Reject malformed `skill.json.agent` as a typed runtime error in
   `runSkill` for every path (framed or not). Concretely: if
   `readSkillManifestMetadata` returns `ok: false`, `runSkill` must return a
   `SkillRunError` with a descriptive `message` and a stable error code (reuse
   `SKILL_VALIDATION_FAILED` or the most appropriate existing code) before
   attempting to spawn anything. Do not silently fall through to scripted
   execution.
2. Update the "legacy permissive" regression test so it only covers the case
   where `skill.json.agent` is absent. Add a new positive-assert test that
   runs `runSkill` directly (bypassing CLI validation, mirroring the serve
   API path) with a malformed `skill.json.agent` and asserts a typed error is
   returned even when the script emits no frame.
3. Add `SKILL_AGENT_CLI_UNAVAILABLE` as a new row to the Error Codes table in
   `docs/skills/overview.md` with a short meaning line (e.g. "orchestrated
   skill declared `agent.cli` but the configured agent CLI could not be
   resolved").
4. Document the orchestrated runtime env-var contract on a public docs
   surface. Required entries:
   - `CLAWPERATOR_SKILL_AGENT_CLI` (configured CLI name, override capable)
   - `CLAWPERATOR_SKILL_AGENT_CLI_PATH` (resolved executable path)
   - `CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS` (effective timeout)
   - `CLAWPERATOR_SKILL_PROGRAM` (absolute path to SKILL.md)
   - `CLAWPERATOR_SKILL_INPUTS` (JSON-serialized args array)
   - `CLAWPERATOR_SKILL_ID`
   - `CLAWPERATOR_DEVICE_ID` (selected device, skill-scoped consumption)
   Preferred target page is `docs/api/environment.md`, with a
   cross-reference from `docs/skills/authoring.md`.
5. Regenerate docs outputs and verify `./scripts/docs_build.sh` succeeds end to
   end.
6. Run the full Clawperator iteration loop: `npm --prefix apps/node run build`
   then `npm --prefix apps/node run test`. Build before test. Do not run them
   in parallel.

### Acceptance Criteria

- malformed agent metadata returns a typed error in all `runSkill` paths,
  verified by a dedicated regression test that bypasses CLI validation
- the legacy-permissive test still passes for the correct case
  (agent block absent) but no longer covers the malformed case
- the docs reference surface includes `SKILL_AGENT_CLI_UNAVAILABLE`
- the orchestrated runtime env-var contract is documented publicly
- `apps/node` build + unit tests pass
- `./scripts/docs_build.sh` succeeds

## Phase C2.0: Bypass Dependency Probe (gate for C2)

### Goal

Produce committed evidence for the `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS`
delete-vs-promote fork *before* any edit to `scripts/run.js`. The caveat this
closes: nobody currently knows whether the one successful proving run
depended on `--dangerously-bypass-approvals-and-sandbox`. An implementation
agent must not silently re-smuggle the flag, and must not delete it blindly.

This phase is a hard gate. C2 cannot begin until C2.0 is complete and its
evidence is committed.

### Current Reality To Verify Before Probing

- `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js:12`
  reads `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` and, when set to `1`, splices
  `--dangerously-bypass-approvals-and-sandbox` into the codex argv.
- The flag is not documented in `SKILL.md`, `skill.json`, `docs/skills/`, or
  the task pack. It exists only in `run.js`.
- The skills pack currently has exactly one recorded live proving success.
  No artifact exists that confirms whether that run was produced with the
  bypass flag set or unset.

### Steps

1. Git-archaeology, no device needed. Search for any written trace of the
   successful proving run command and environment:
   ```
   git -C ../clawperator-skills log --all -p -- skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js | head -400
   git -C ../clawperator log --all --grep "proving\|orchestrated\|W2b\|Solax" --oneline
   git -C ../clawperator log --all -p -- tasks/recording/agent-driven-skills/ | head -400
   ```
   If the historical run is provably bypass-free (e.g. the commit message or
   a task-pack note says so), record that in the probe artifact anyway; it
   does not replace the live probe, but it weakens the "might be load-bearing"
   concern.
2. Capture the codex baseline on the proving host:
   ```
   codex --version
   codex exec --help 2>&1 | grep -iE "sandbox|approval|ask|dangerously"
   ```
   Save the output into the probe directory. This is how the probe outcome
   will be interpretable six months from now when codex defaults have moved.
3. Establish the same clean baseline starting state C3 will use (see C3
   Step 1 for the fields that must match). Record device serial, Android
   version, SolaX Cloud app version, operator package
   (`com.clawperator.operator.dev`), pre-run app state, and the initial
   discharge-to-limit slider value.
4. Run the current, unchanged orchestrated skill once against the physical
   Samsung target with the bypass explicitly unset and the Clawperator
   branch-local build:
   ```
   unset CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS
   CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
   node apps/node/dist/cli/index.js skills run \
     com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --output json -- 40 \
     2> probe.stderr > probe.json
   ```
   Capture `probe.json`, `probe.stderr`, the exact shell command used,
   start time, and end time.
5. Classify the outcome into exactly one of the three predetermined buckets.
   Do not invent a fourth.

   | Bucket | Observation | Action |
   | --- | --- | --- |
   | A: bypass-independent success | `probe.json` contains a `status: "success"` SkillResult and `terminalVerification.status: "verified"` | Delete `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` from `scripts/run.js` in C2 Step 4 with no promotion. The probe run itself may count as `run-00` for C3. |
   | B: sandbox/approval-cited failure | `probe.stderr` cites codex sandbox, approval, "denied", "read-only", "cannot write", subprocess-blocked, or codex refuses to spawn the Clawperator child | Stop. Do not delete the flag. Open the declared-contract conversation: propose a field on `skill.json.agent` (e.g. `approvalMode: "bypass"` or `sandboxMode: "workspace-write"`), add runtime support in `apps/node/src/domain/skills/skillManifest.ts` and `runSkill.ts`, document it in `docs/skills/authoring.md`, and only then continue C2. The probe stderr is the PR justification for the contract change. |
   | C: inconclusive failure | Failure is real but unrelated to sandbox/approval policy (flake, timeout, app state, layout drift). Stderr contains no sandbox/approval signal. | Retry the probe up to 2 more times from the same clean baseline. If all three attempts fail without citing sandbox/approval, treat this as bypass-independent unreliability: proceed with C2 Step 4 deletion *and* flag the instability as a risk for C3. All three probe attempts must be committed. |
6. Commit the probe artifacts and the classification decision in a single
   commit before touching `run.js`:
   ```
   docs(reliability): probe codex sandbox dependency for Solax orchestrated skill
   ```
   Required artifacts under
   `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`:
   - `README.md` (bucket, classification reasoning, codex version, baseline
     fields, exact command used, decision for C2)
   - `probe.json` (or `probe-attempt-1.json`, `probe-attempt-2.json`,
     `probe-attempt-3.json` for bucket C)
   - `probe.stderr` (same pattern)
   - `codex-version.txt`
   - `codex-sandbox-flags.txt`
7. If bucket B was hit, open a small sibling task (or extend C2 Step 4) for
   the `skill.json.agent` contract extension work. Do not start C2 Step 1-3
   until the contract shape is decided.

### Acceptance Criteria

- the probe directory exists and contains the required artifacts
- the probe `README.md` names exactly one of buckets A, B, or C
- the decision path for C2 Step 4 is pinned in writing (delete, promote, or
  delete-with-reliability-risk-flag)
- if bucket B was hit, a declared-contract design note exists before C2
  Step 1 begins
- no edit to `scripts/run.js` has been made yet at the end of this phase

## Phase C2: Thin The Solax Orchestrated Harness

### Goal

Turn the Solax orchestrated skill into a truthful codex-based W2b v1 reference.
Codex-specific invocation shape is allowed; Solax-specific runtime logic is
not.

### Current Reality To Verify Before Editing Code

- `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js`
  is currently 637 lines. It contains:
  - a hardcoded `CHECKPOINT_IDS` array
  - `parseFinalSkillResultFrame` re-implementing the `SkillResult` contract
    parser that `runSkill` already enforces
  - `buildPrompt` constructing a Solax-specific codex prompt including the
    Samsung-specific tap coordinates `860,1399` and `875,1548`
  - `clawperatorRepoRoot = resolve(skillsRepoRoot, "../clawperator")` and a
    `clawperatorBinCommand` fallback pointing at
    `apps/node/dist/cli/index.js`, which couples the harness to the author's
    sibling-repo workstation layout
  - `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` conditionally inserting
    `--dangerously-bypass-approvals-and-sandbox` into the codex argv
  - a `SAFE_ENV_KEYS` allowlist including `OPENAI_API_KEY`, `OPENAI_API_BASE`
    etc that the harness forwards
- `SKILL.md` already contains the full runtime program, including the
  checkpoint schema, navigation policy, recovery branch, terminal verification
  rule, and the reference success JSON. The thinning work is primarily a
  deletion job, not new authoring.
- `skill.json` declares `{ "cli": "codex", "timeoutMs": 300000 }`. It does
  not declare `cliPath`, an approval-mode field, or anything else.

### Steps

1. Move or delete Solax-specific logic from `scripts/run.js`:
   - remove the hardcoded `CHECKPOINT_IDS` array
   - remove `parseFinalSkillResultFrame` and all duplicated contract checks;
     trust `runSkill` to validate the final frame
   - remove the Samsung-specific coordinate hints from the prompt builder;
     if any of those hints are genuinely required for reliability, move them
     into `SKILL.md` as part of the runtime program and cite the recorded
     source, not as harness code
   - remove the `percent`-specific validation path from the harness; argv
     parsing that belongs to the skill's semantics belongs in the agent's
     reasoning over `CLAWPERATOR_SKILL_INPUTS`, not in the harness
2. Reduce `scripts/run.js` to codex-oriented harness duties only:
   - read the required env vars (`CLAWPERATOR_SKILL_AGENT_CLI_PATH`,
     `CLAWPERATOR_SKILL_PROGRAM`, `CLAWPERATOR_SKILL_INPUTS`,
     `CLAWPERATOR_DEVICE_ID`, `CLAWPERATOR_BIN`)
   - resolve the codex runtime invocation shape (`exec --skip-git-repo-check
     --ephemeral ... -o <outputPath> -`) as the declared v1 runtime path
   - spawn codex on `SKILL.md` via stdin, read the final frame from
     `<outputPath>`, forward stderr, and write the final framed result to
     this harness's own stdout
   - forward `SIGTERM` / `SIGINT` as a process-group signal
   - preserve the final framed result exactly as codex produced it and let
     `runSkill` validate it
   - target a materially smaller line count. Aim for "reads like the test
     fixture `apps/node/src/test/fixtures/skills/com.test.agent-skill-result/scripts/run.js`
     plus the codex-specific spawn shape". The intent is a deliberate order
     of magnitude reduction; the author should be able to defend any line
     that remains.
3. Remove sibling-repo and branch-local build assumptions:
   - delete `clawperatorRepoRoot` and the `../clawperator` resolution
   - do not synthesise `clawperatorBinCommand` from
     `apps/node/dist/cli/index.js`; trust `CLAWPERATOR_BIN` supplied by the
     parent `cmdSkillsRun` and fail cleanly if it is missing
   - do not pass `--add-dir <clawperatorRepoRoot>` to codex; if codex needs
     filesystem visibility at all, limit it to the skills repo directory that
     the harness already knows about
4. Remove the hidden sandbox/approval bypass knob, using the C2.0 probe
   result as the single source of truth for which path to take:
   - if C2.0 hit bucket A (bypass-independent success) or bucket C
     (inconclusive failure, no sandbox/approval signal), delete
     `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` and the conditional
     `--dangerously-bypass-approvals-and-sandbox` insertion from
     `scripts/run.js`
   - if C2.0 hit bucket B (sandbox/approval-cited failure), do not delete
     the behavior. Instead, the bypass must be promoted into the public
     `skill.json.agent` contract as a declared field, added to
     `apps/node/src/contracts/skills.ts`, parsed in
     `apps/node/src/domain/skills/skillManifest.ts`, threaded through
     `runSkill.ts` into the harness env as a new public env var, and
     documented in `docs/skills/authoring.md` and
     `docs/skills/overview.md`. Only after that contract work is merged
     may `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` be removed from
     `scripts/run.js` and replaced with a read of the new declared field.
   - under no circumstances may the bypass path continue to exist as a
     private, undocumented env var in `scripts/run.js`
5. Harden `SKILL.md` with strict-agentic discipline rules. Motivation:
   public OpenClaw documentation and field reports describe a lazy-mode
   pattern in which GPT-5-family runs (which codex uses at runtime) emit
   plan-only turns instead of calling tools, and then treat the plan as
   progress. W2b v1 is codex-only, so this pattern is directly applicable.
   SKILL.md is the single surface where this discipline lives for W2b v1;
   the runtime does not yet enforce it.

   Add (or reconcile against existing wording) at least these rules to
   `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md`:
   - "Planning in prose is not progress. Never emit a final SkillResult
     frame unless you have actually called the Clawperator CLI to produce
     evidence for every checkpoint you mark `status: ok`."
   - "Never emit `status: "success"` unless the post-save UI was read
     through a Clawperator `read` call and contained the exact text
     `Discharge to <percent>%`. A success frame without that evidence is a
     lazy-mode failure and must be reported as `failed`, not as success."
   - "If you find yourself describing what you would do instead of doing
     it, stop the run, mark the current checkpoint `status: skipped`, and
     emit a `failed` SkillResult with a truthful note."
   - "Indeterminate is not an escape hatch for laziness. Use
     `indeterminate` only when the run reached a real ambiguity in the
     observed UI state, not when the agent chose to stop acting."
   - "Every checkpoint marked `status: ok` must include a `note` that
     references the concrete Clawperator command and the observed
     evidence (e.g. the tapped selector or the read text)."
   The exact phrasing may be tightened; the rules are the non-negotiable
   content.
6. Update the skill and public docs so the codex-only W2b v1 limitation is
   explicit:
   - add a short note at the top of
     `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md`
     stating that W2b v1 runs this skill under codex and that other agent CLIs
     are not supported yet
   - add an equivalent line to `docs/skills/overview.md` and/or
     `docs/skills/authoring.md` on the Clawperator side near the existing
     orchestrated-skill guidance, so public docs reflect the current codex-only
     reality
   - do not claim portability the code does not deliver
7. Re-run validation for both skills after editing:
   - `skills validate com.solaxcloud.starter.set-discharge-to-limit-orchestrated`
   - `skills validate com.solaxcloud.starter.set-discharge-to-limit-replay`
   - one live proving invocation of the orchestrated skill on the physical
     Samsung device, plus one replay invocation, both with `--output json`

### Acceptance Criteria

- `SKILL.md` is the clear authority on Solax skill behavior
- `SKILL.md` encodes the strict-agentic discipline rules listed in Step 5
  (no prose-only planning, evidence-backed `ok` checkpoints, truthful
  `failed` on laziness, no indeterminate-as-escape-hatch, per-checkpoint
  notes citing the concrete Clawperator command used)
- `scripts/run.js` no longer contains the duplicated SkillResult contract
  parser, the hardcoded checkpoint IDs, the Solax-specific prompt, or the
  Samsung coordinate hints
- `scripts/run.js` no longer references `../clawperator` or
  `apps/node/dist/cli/index.js`
- `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` is removed from the repository
  (or promoted to declared contract per the C2.0 bucket-B path)
- the codex-only W2b v1 limitation is documented in the skill itself and on
  the public Clawperator skills docs
- the replay sibling still runs end-to-end without regression
- both `skills validate` calls return success

## Phase C3: Complete Reliability Evidence

### Goal

Run and record the required live-device reliability pass for the Solax proving
skill under the thinned harness from C2.

### Steps

1. Define and document the clean baseline starting state used before each run.
   At minimum the baseline must specify:
   - device serial and model
   - Android version and SolaX Cloud app version
   - operator package (`com.clawperator.operator.dev`)
   - whether the SolaX app was force-stopped before the run
   - whether the device was at a known pre-run screen or home
   - the expected starting value of the discharge-to-limit slider
2. Run the orchestrated skill 10 times against the physical Samsung target
   with input `40`. Use the branch-local Clawperator CLI build, not the
   globally installed binary. Use the `.dev` operator package.
3. For each run, capture:
   - the full structured JSON output from `clawperator skills run`
   - the stderr transcript
   - the final framed `SkillResult`
   - run index, start time, and end time
   - whether the run hit the recovery branch
   - the count of distinct Clawperator CLI invocations observed in stderr
     during the run (e.g. `open`, `click`, `type`, `read`, `press`,
     `snapshot`, `scroll`, `wait`). This number is the lazy-mode detector
     for Step 6 below.
4. Save the captured artifacts under
   `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/`
   with one subdirectory per run (e.g. `run-01/`, `run-02/`, ...). Do not
   collapse runs into a single combined log; individual run artifacts must be
   inspectable.
5. Include at least one deliberate forced-failure run (e.g. start from a
   wrong tab, or wrong initial value) and record it alongside the nominal
   runs. The forced-failure run must produce a truthful `failed` or
   `indeterminate` `SkillResult` without leaving the runtime in a
   `runtime_poisoned` state.
6. Run a lazy-success detection pass over every captured run. Motivation:
   the documented GPT-5-family lazy-mode pattern means a run can produce a
   well-formed `status: success` SkillResult while the runtime agent never
   actually touched the device. Lazy successes must be excluded from the
   threshold count, not counted. Classification rule for each run:
   - a run with `status: success` and fewer than 5 distinct Clawperator CLI
     invocations in stderr is classified `lazy-success` and does not count
     toward the threshold
   - a run with `status: success` whose stderr does not show a Clawperator
     `read` call targeting `Discharge to <percent>%` (or equivalent terminal
     verification read) is classified `lazy-success` regardless of
     invocation count
   - a run with `status: success` whose checkpoint notes do not cite the
     concrete Clawperator commands used is classified `lazy-success`
   - any other `status: success` run is classified `evidence-backed success`
     and counts toward the threshold
   - the threshold count for this protocol is the number of
     `evidence-backed success` runs, not the raw count of `status: success`
     frames
7. Write a `summary.md` in the reliability directory capturing:
   - raw `status: success` count
   - evidence-backed success count (this is the number compared against the
     ≥8/10 threshold)
   - per-run lazy-mode classification table, with the reasoning for each
     lazy-success exclusion
   - failure modes observed
   - whether any `runtime_poisoned` state occurred
   - time-to-terminal-state per run
   - the forced-failure run outcome
   - whether the ≥8/10 evidence-backed threshold was met and the
     zero-`runtime_poisoned` requirement held
8. Cross-check that the replay sibling still passes on the same device
   during the reliability window, as a control for device/app health. Record
   the replay control run outcome in `summary.md`.
9. Only after the evidence exists, update both the closeout pack and the
   original `agent-driven-skills/` pack status tables to reflect the true
   state. Do not update pre-emptively. If the threshold is not met, mark P4
   as `not met` and leave W2b open; do not soften the plan language.

### Acceptance Criteria

- at least 10 orchestrated runs are recorded as individual run artifacts
- at least one forced-failure run is recorded and produced a truthful
  non-poisoned result
- the baseline starting state is documented alongside the runs
- every captured run has a lazy-mode classification (`lazy-success`,
  `evidence-backed success`, `failed`, `indeterminate`, or
  `runtime_poisoned`)
- `summary.md` explicitly distinguishes raw `status: success` count from
  evidence-backed success count and states whether the ≥8/10
  evidence-backed threshold was met and whether any `runtime_poisoned`
  state occurred
- no `lazy-success` run is counted toward the threshold
- the replay control run is captured alongside the orchestrated runs
- PR readiness for the skills repo is based on committed evidence, not
  recollection
- the status tables in both this pack and `agent-driven-skills/` match the
  recorded evidence

## Expected Commit Shape

Recommended local commit grouping. Each commit should be narrow and
independently reviewable.

1. `docs(tasks): add W2b closeout follow-up pack`
2. `fix(skills): reject malformed orchestrated agent metadata`
3. `docs(skills): list SKILL_AGENT_CLI_UNAVAILABLE and orchestrated env vars`
4. `docs(reliability): probe codex sandbox dependency for Solax orchestrated skill`
5. (only if C2.0 hit bucket B) `feat(skills): declare agent approval-mode field on skill.json.agent`
6. `refactor(solax): thin orchestrated codex harness`
7. `docs(solax): document codex-only W2b v1 limitation`
8. `docs(reliability): record Solax orchestrated 10-run validation`
9. `docs(tasks): update W2b closeout and agent-driven-skills status`

Commits 1-3 belong to the Clawperator repo PR.
Commit 4 also belongs to the Clawperator repo PR: probe evidence lives
under `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`
in the Clawperator repo (the reliability evidence surface is Clawperator-side
by existing convention), not in the skills pack.
Commit 5 is conditional and, if present, spans both repos: the contract
shape lands in Clawperator (`apps/node/src/contracts/skills.ts`,
`skillManifest.ts`, `runSkill.ts`, docs) and the consuming `skill.json.agent`
edit lands in the skills repo.
Commits 6-7 belong to the skills repo PR.
Commit 8 belongs to the Clawperator repo PR (reliability evidence lives in
the Clawperator reliability dir for the same reason as commit 4).
Commit 9 may span both repos as small status-file edits.

Because the reliability artifacts live in Clawperator but the skills repo PR
depends on the reliability threshold being met, the skills repo PR is
practically gated on merging the Clawperator PR (or at least on the
reliability commits landing in the Clawperator branch) before it is marked
ready. This ordering is expected and should not be worked around.

The Clawperator repo PR may be considered ready as soon as C1 is complete and
its validation is green. The skills repo PR is not ready until C2 and C3 are
both complete and the reliability threshold is met.
