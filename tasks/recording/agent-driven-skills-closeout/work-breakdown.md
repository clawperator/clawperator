# W2b Closeout (Agent-Driven Skills Follow-Up) Work Breakdown

Parent plan: `tasks/recording/agent-driven-skills-closeout/plan.md`

## Executive Summary

Four phases (C1, C2.0, C2, C3) ship across two PRs. The Clawperator PR carries
C1 (runtime strictness, docs gaps), C2.0 (bypass-dependency probe evidence),
and C3 (10-run reliability evidence). The skills PR carries C2 (thin the Solax
orchestrated harness, harden `SKILL.md` with strict-agentic rules, document the
codex-only v1 limitation). C1 is next. C2 cannot start until C2.0 is complete.
Reliability evidence remains committed in the Clawperator repo under
`docs/internal/design/reliability/`.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | C1, C2.0, C2 |
| Remaining | C3 |
| Current / Next | C3 reliability evidence |
| Blockers | codex-path live runs still lose the Samsung device inside the orchestrated runtime path, and the replay control still times out after save |

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
  closeout work. It is the control surface for reliability testing.
- Do not reintroduce Solax-specific logic into `scripts/run.js`. Solax runtime
  behavior lives in `SKILL.md`.
- Do not gate this pack on generic multi-CLI runtime portability. W2b v1 is
  allowed to be codex-specific at runtime.
- Use the C2.0 probe bucket as the single source of truth for the C2 Step 4
  delete-vs-promote decision. Do not re-interpret.
- Use the C3 lazy-mode classification table verbatim. Do not relax thresholds.
- Apply the Conventional Commits convention. No em dashes. No AI attribution
  trailers in commit messages.
- Plan deviations discovered during execution must be logged at the top of
  the affected phase in this file and escalated to the user before continuing.
  Do not silently re-scope a phase.

## Required Reading

Read these files IN THIS ORDER before writing any code, docs, or commits. Do
not skip. Governing documents first, then authoritative code, then exemplars,
then existing artifact state.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/recording/agent-driven-skills-closeout/plan.md` | Stable contract, decision tables, source-of-truth map, scope fences |
| 2 | `CLAUDE.md` | Repo conventions: device selection, validation loop, commit discipline, no em dashes, no Claw shortening, device `.dev` operator package preference |
| 3 | `tasks/recording/plan.md` | Recording program principles (brain-hand model, reliability expectations) |
| 4 | `tasks/recording/agent-driven-skills/plan.md` and `work-breakdown.md` | W2b runtime-shape reference. This pack does not replace it. |
| 5 | `.agents/skills/task-author/SKILL.md` | Quality bar this pack must honor (context only, no edits) |
| 6 | `.agents/skills/docs-author/SKILL.md` | Required for any public-docs edit in C1 Step 3, C1 Step 4, C2 Step 6 |
| 7 | `.agents/skills/docs-build/SKILL.md` | Required to regenerate `sites/docs/.build/` after docs edits |
| 8 | `apps/node/src/domain/skills/runSkill.ts` | The silent-downgrade site (C1 Step 1) and the orchestrated spawn shape (informs C2) |
| 9 | `apps/node/src/domain/skills/skillManifest.ts` | Manifest parse contract and the `ok: false` return path C1 Step 1 must check |
| 10 | `apps/node/src/domain/skills/validateSkill.ts` | Validation-time manifest rejection (confirms the runtime gap C1 closes) |
| 11 | `apps/node/src/contracts/skills.ts` | Error codes and contract types; the bucket-B contract extension (if any) lands here |
| 12 | `apps/node/src/contracts/result.ts` | SkillResult frame shape; the C2 harness must not re-implement this |
| 13 | `apps/node/src/test/unit/skills.test.ts` | Existing malformed-agent permissive regression coverage (C1 Step 2) |
| 14 | `apps/node/src/test/fixtures/skills/com.test.agent-skill-result/scripts/run.js` | Thin-harness exemplar for C2 |
| 15 | `docs/skills/overview.md` | Error Codes table (C1 Step 3) and orchestrated-skill guidance (C2 Step 6) |
| 16 | `docs/skills/authoring.md` | Orchestrated authoring surface; cross-reference destination for C1 Step 4 and C2 Step 5 |
| 17 | `docs/api/environment.md` | Env-var reference surface for C1 Step 4 |
| 18 | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md` | Existing Solax runtime program. C2 Step 5 appends to this without disturbing existing content. |
| 19 | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js` | Current harness. The deletion target for C2 Steps 1-4. |
| 20 | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json` | Current `agent` manifest. May gain a declared field on bucket B. |
| 21 | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/` (listing only) | Control surface for reliability testing. Confirm untouched before and after C2. |

## PR / Phase Plan

| PR | Repo | Purpose | Included phases | Default agent tier |
| --- | --- | --- | --- | --- |
| PR-clawperator | clawperator | Runtime strictness, public docs gaps, probe evidence, 10-run reliability evidence | C1, C2.0, C3 | default |
| PR-skills | clawperator-skills | Thin the orchestrated harness, harden `SKILL.md`, document codex-only v1 | C2 | thinking |

Do not start C2 before C2.0 is complete. Do not mark the skills-side PR ready
before C3 is complete and the ≥8/10 evidence-backed threshold either held or
the PR was re-scoped to reflect the true outcome.

## Phase C1: Close Clawperator Runtime And Docs Gaps

### Agent Tier

default

### Goal

Finish the remaining Clawperator-side branch deltas so the runtime repo is
honestly PR-ready: malformed `skill.json.agent` is a hard runtime error in
every path, the public Error Codes table lists `SKILL_AGENT_CLI_UNAVAILABLE`,
and the orchestrated env-var contract is documented.

### Files Or Surfaces To Change

- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `docs/skills/overview.md`
- `docs/api/environment.md`
- `docs/skills/authoring.md` (cross-reference only)
- `sites/docs/.build/` (regenerated, not hand-edited)

### Steps

1. Reject malformed `skill.json.agent` as a typed runtime error in
   `runSkill` for every path (framed or not). Concretely: if
   `readSkillManifestMetadata` returns `ok: false`, `runSkill` must return a
   `SkillRunError` with a descriptive `message` and the existing
   `SKILL_VALIDATION_FAILED` error code before attempting to spawn anything.
   Do not silently fall through to scripted execution. Do not invent a new
   error code.
2. Update the malformed-agent regression coverage so permissive behavior only
   applies when `skill.json.agent` is absent. Add a new positive-assert test
   that runs `runSkill` directly (bypassing CLI validation, mirroring the
   serve API path) with a malformed `skill.json.agent` and asserts a typed
   error is returned even when the script emits no frame. Replace the current
   permissive malformed-agent assertion in the same phase commit as the
   `runSkill` change; do not defer.
3. Add `SKILL_AGENT_CLI_UNAVAILABLE` as a new row to the Error Codes table in
   `docs/skills/overview.md` with a short meaning line (e.g. "orchestrated
   skill declared `agent.cli` but the configured agent CLI could not be
   resolved"). Use `.agents/skills/docs-author/SKILL.md` to author this
   edit; do not restate its workflow here.
4. Document the orchestrated runtime env-var contract in
   `docs/api/environment.md`. The required entries are exactly:
   - `CLAWPERATOR_SKILL_AGENT_CLI` (configured CLI name, override capable)
   - `CLAWPERATOR_SKILL_AGENT_CLI_PATH` (resolved executable path)
   - `CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS` (effective timeout)
   - `CLAWPERATOR_SKILL_PROGRAM` (absolute path to SKILL.md)
   - `CLAWPERATOR_SKILL_INPUTS` (JSON-serialized args array)
   - `CLAWPERATOR_SKILL_ID`
   - `CLAWPERATOR_DEVICE_ID` (selected device, skill-scoped consumption)
   Add a cross-reference link from `docs/skills/authoring.md` to the new
   section. Do not add or omit entries.
5. Regenerate docs outputs using the `.agents/skills/docs-build/SKILL.md`
   workflow and verify `./scripts/docs_build.sh` succeeds end to end.
6. Run the full Clawperator iteration loop: `npm --prefix apps/node run build`
   then `npm --prefix apps/node run test`. Build before test. Do not run them
   in parallel.

### Acceptance Criteria

Mechanical:

- `rg "readSkillManifestMetadata" apps/node/src/domain/skills/runSkill.ts`
  shows the `ok: false` path returns a typed error, not `undefined`.
- The new regression test in `apps/node/src/test/unit/skills.test.ts`
  asserts a typed error on a malformed agent manifest with a non-framed
  script, and passes.
- The former permissive malformed-agent assertion applies only when `agent`
  is absent.
- `rg "SKILL_AGENT_CLI_UNAVAILABLE" docs/skills/overview.md` matches at
  least one Error Codes table row.
- `rg "CLAWPERATOR_SKILL_AGENT_CLI_PATH" docs/api/environment.md` matches
  and all seven env vars above appear in the new section.
- `npm --prefix apps/node run build` succeeds.
- `npm --prefix apps/node run test` is green.
- `./scripts/docs_build.sh` succeeds.

Human review:

- Output accuracy: the docs-table row describes the real error condition.
- Scope completeness: no other `runSkill` paths still silently fall through.
- Evidence grounding: the env-var list matches what `runSkill` actually
  injects into the child process.
- Format compliance: no em dashes, no AI-attribution trailers, authored
  docs under `docs/` not under `sites/docs/.build/`.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Expected Commits

Two Conventional Commits for C1, in order:

```text
fix(skills): reject malformed orchestrated agent metadata
```

```text
docs(skills): list SKILL_AGENT_CLI_UNAVAILABLE and orchestrated env vars
```

## Phase C2.0: Bypass Dependency Probe (hard gate for C2)

### Agent Tier

default. Escalate to thinking if the probe hits bucket B and a declared
contract extension must be designed.

### Goal

Produce committed evidence for the `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS`
delete-vs-promote fork before any edit to `scripts/run.js`. Close the caveat
that nobody currently knows whether the one successful proving run depended
on `--dangerously-bypass-approvals-and-sandbox`.

This phase is a hard gate. C2 cannot begin until C2.0 is complete and its
evidence is committed.

### Files Or Surfaces To Change

- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/README.md`
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe.json` (or `probe-attempt-{1,2,3}.json`)
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe.stderr` (or `probe-attempt-{1,2,3}.stderr`)
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/codex-version.txt`
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/codex-sandbox-flags.txt`
- (Bucket B only) design note or inline README entry describing the
  proposed declared `skill.json.agent` field.

### Steps

1. Git-archaeology, no device needed. Search for any written trace of the
   earlier successful proving-run command and environment:
   ```bash
   git -C ../clawperator-skills log --all -p -- skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js | head -400
   git -C ../clawperator log --all --grep "proving\|orchestrated\|W2b\|Solax" --oneline
   git -C ../clawperator log --all -p -- tasks/recording/agent-driven-skills/ | head -400
   ```
   If the historical run is provably bypass-free (e.g. the commit message or
   a task-pack note says so), record that in the probe `README.md` anyway.
   It does not replace the live probe, but it weakens the
   "might be load-bearing" concern.
2. Capture the codex baseline on the proving host and save to the probe dir:
   ```bash
   codex --version > docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/codex-version.txt
   codex exec --help 2>&1 | grep -iE "sandbox|approval|ask|dangerously" \
     > docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/codex-sandbox-flags.txt
   ```
   This is how the probe outcome will be interpretable six months from now
   when codex defaults have moved.
3. Establish the same clean baseline starting state C3 will use (see C3
   Step 1 fields). Record device serial, Android version, SolaX Cloud app
   version, operator package (`com.clawperator.operator.dev`), pre-run app
   state, and the initial discharge-to-limit slider value. Inline the
   baseline fields into the probe `README.md`.
4. Run the current, unchanged orchestrated skill once against the physical
   Samsung target with the bypass explicitly unset and the branch-local
   Clawperator build:
   ```bash
   unset CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS
   CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
   node apps/node/dist/cli/index.js skills run \
     com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --output json -- 40 \
     2> docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe.stderr \
      > docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe.json
   ```
   Capture the exact shell command used, start time, and end time in the
   probe `README.md`.
5. Classify the outcome into exactly one of the three predetermined buckets
   from `plan.md` "Decision Rules > C2.0 Probe Outcome Buckets". Do not
   invent a fourth bucket.

   | Bucket | Observation | C2 Step 4 action |
   | --- | --- | --- |
| A: bypass-independent success | `probe.json` contains `status: "success"` and `terminalVerification.status: "verified"` | Delete `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` in C2 Step 4 with no contract change. The probe run may be retained as supplemental evidence but does not replace the required C3 run set. |
   | B: sandbox/approval-cited failure | `probe.stderr` cites codex sandbox, approval, "denied", "read-only", "cannot write", subprocess-blocked, or codex refuses to spawn the Clawperator child | Stop. Do not delete. Escalate to declared-contract design (new field on `skill.json.agent`, runtime support in `apps/node/src/contracts/skills.ts`, `skillManifest.ts`, `runSkill.ts`, docs in `docs/skills/authoring.md` and `docs/skills/overview.md`). Only after that lands may `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` be removed from `scripts/run.js` and replaced with a read of the new declared field. |
   | C: inconclusive failure | Failure real but unrelated to sandbox/approval (flake, timeout, layout drift, app state). Stderr shows no sandbox/approval signal. | Retry the probe up to 2 more times from the same clean baseline. If all 3 attempts fail without citing sandbox/approval, treat as bypass-independent unreliability: proceed with C2 Step 4 deletion AND flag reliability as at-risk in the probe `README.md`. All three probe attempts must be committed. |

6. Commit the probe artifacts and the classification decision in a single
   commit before touching `run.js`. Required artifacts under
   `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`:
   - `README.md` (bucket, classification reasoning, codex version, baseline
     fields, exact command used, start/end time, decision for C2)
   - `probe.json` (or `probe-attempt-{1,2,3}.json` for bucket C)
   - `probe.stderr` (or `probe-attempt-{1,2,3}.stderr`)
   - `codex-version.txt`
   - `codex-sandbox-flags.txt`
7. If bucket B was hit, escalate to the user and extend the task pack with
   a short sibling note describing the proposed declared field shape
   (field name, type, default, doc placement). Do not start C2 Step 1-3
   until the contract shape is decided.

### Acceptance Criteria

Mechanical:

- The probe directory exists with the required artifacts above.
- `rg "^Bucket: [ABC]$" docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/README.md`
  matches exactly one line.
- The C2 Step 4 decision is pinned in writing in the probe `README.md`.
- `git status -- ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js`
  shows no modification at the end of this phase.

Human review:

- Output accuracy: the bucket reasoning cites concrete stderr lines, not
  memory.
- Scope completeness: the baseline fields in the probe README cover
  everything C3 Step 1 will need.
- Evidence grounding: codex version and sandbox-flag output are captured
  from the actual proving host.
- Format compliance: probe files live under the Clawperator reliability
  dir, not in the skills repo.

### Validation

```bash
ls docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/
rg "^Bucket: [ABC]$" docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/README.md
```

### Expected Commit

```text
docs(reliability): probe codex sandbox dependency for Solax orchestrated skill
```

On bucket B only, an additional commit precedes C2 Step 4:

```text
feat(skills): declare agent approval-mode field on skill.json.agent
```

This conditional commit spans both repos: the contract shape lands in
Clawperator (`apps/node/src/contracts/skills.ts`, `skillManifest.ts`,
`runSkill.ts`, `docs/skills/authoring.md`, `docs/skills/overview.md`) and
the consuming `skill.json.agent` edit lands in the skills repo.

## Phase C2: Thin The Solax Orchestrated Harness

### Agent Tier

thinking

Rationale: the deletion diff looks mechanical but the line-by-line decisions
are judgment calls (what to delete, what to move into `SKILL.md`, what to
leave untouched). The strict-agentic `SKILL.md` hardening is synthesis-heavy
against a specific failure mode. Mistakes here cascade into C3.

### Goal

Turn the Solax orchestrated skill into a truthful codex-based W2b v1
reference. Codex-specific invocation shape is allowed; Solax-specific runtime
logic is not. Harden `SKILL.md` so GPT-5-family lazy-mode behavior produces a
truthful `failed` frame instead of a false-positive `success`.

### Files Or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json` (only on bucket B)
- `docs/skills/overview.md` (codex-only note)
- `docs/skills/authoring.md` (codex-only note, cross-reference)
- `sites/docs/.build/` (regenerated, not hand-edited)

Do not touch:

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/` (any file)

### Steps

1. Move or delete Solax-specific logic from `scripts/run.js`. After this
   step, the harness must no longer be the authority on:
   - checkpoint schema or checkpoint ordering
   - final `SkillResult` contract validation
   - Solax navigation policy or recovery policy
   - device-layout-specific coordinates or taps
   - skill-semantic input validation beyond minimal harness safety checks
   If any of that logic remains necessary, it belongs in `SKILL.md` as part
   of the runtime program, not in the harness.
2. Reduce `scripts/run.js` to codex-oriented harness duties only:
   - read the required env vars (`CLAWPERATOR_SKILL_AGENT_CLI_PATH`,
     `CLAWPERATOR_SKILL_PROGRAM`, `CLAWPERATOR_SKILL_INPUTS`,
     `CLAWPERATOR_DEVICE_ID`, `CLAWPERATOR_BIN`)
   - resolve the codex runtime invocation shape
     (`exec --skip-git-repo-check --ephemeral ... -o <outputPath> -`) as
     the declared v1 runtime path
   - spawn codex on `SKILL.md` via stdin, read the final frame from
     `<outputPath>`, forward stderr, and write the final framed result to
     this harness's own stdout
   - forward `SIGTERM` / `SIGINT` as a process-group signal
   - preserve the final framed result exactly as codex produced it and
     let `runSkill` validate it
   - target a materially smaller implementation that reads like the thin-
     harness test fixture plus the minimal codex-specific spawn shape. The
     author should be able to defend any line that remains.
3. Remove sibling-repo and branch-local build assumptions:
   - delete `clawperatorRepoRoot` and the `../clawperator` resolution
   - do not synthesise `clawperatorBinCommand` from
     `apps/node/dist/cli/index.js`; trust `CLAWPERATOR_BIN` supplied by
     the parent `cmdSkillsRun` and fail cleanly if it is missing
   - do not pass `--add-dir <clawperatorRepoRoot>` to codex; if codex
     needs filesystem visibility at all, limit it to the skills repo
     directory the harness already knows about
   - remove `SAFE_ENV_KEYS` allowlisting of `OPENAI_API_KEY`,
     `OPENAI_API_BASE`, etc. The harness should forward only what codex
     strictly needs and should not leak host credentials
4. Remove the hidden sandbox/approval bypass knob, using the C2.0 probe
   bucket as the single source of truth:
   - Bucket A or C: delete `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` and the
     conditional `--dangerously-bypass-approvals-and-sandbox` insertion
     from `scripts/run.js`.
   - Bucket B: do not delete. The bypass must have been promoted into the
     public `skill.json.agent` contract as a declared field in a prior
     commit (see C2.0 conditional commit). In this step, replace the
     hidden env read with a read of the new declared field and remove
     `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` from `scripts/run.js`.
   - Under no circumstances may the bypass path continue to exist as a
     private, undocumented env var in `scripts/run.js`.
5. Harden `SKILL.md` with strict-agentic discipline rules. Motivation:
   codex/GPT-5-family runs can produce plan-heavy turns that overstate
   progress. For W2b v1 this is a skills-side operational risk, not a new
   Clawperator runtime contract. The discipline therefore lives in `SKILL.md`
   and in C3 evidence review, not in `runSkill`.

   Add (or reconcile against existing wording) exactly these five rules
   to
   `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md`.
   Meaning is fixed; exact phrasing may be tightened; dilution is not
   permitted.

   1. "Planning in prose is not progress. Never emit a final SkillResult
      frame unless you have actually called the Clawperator CLI to
      produce evidence for every checkpoint you mark `status: ok`."
   2. "Never emit `status: \"success\"` unless the post-save UI was read
      through a Clawperator `read` call and contained the exact text
      `Discharge to <percent>%`. A success frame without that evidence is
      a lazy-mode failure and must be reported as `failed`, not as
      success."
   3. "If you find yourself describing what you would do instead of doing
      it, stop the run, mark the current checkpoint `status: skipped`,
      and emit a `failed` SkillResult with a truthful note."
   4. "Indeterminate is not an escape hatch for laziness. Use
      `indeterminate` only when the run reached a real ambiguity in the
      observed UI state, not when the agent chose to stop acting."
   5. "Every checkpoint marked `status: ok` must include a `note` that
      references the concrete Clawperator command and the observed
      evidence (e.g. the tapped selector or the read text)."

   Preserve the existing `SKILL.md` content (runtime contract,
   operational playbook, navigation policy, recovery branch, terminal
   verification, reference success JSON, recording note) unchanged. The
   strict-agentic rules are additive.

6. Update the skill and public docs so the codex-only W2b v1 limitation
   is explicit:
   - add a short note at the top of Solax `SKILL.md` stating that W2b v1
     runs this skill under codex and that other agent CLIs are not
     supported yet
   - add an equivalent line to `docs/skills/overview.md` and/or
     `docs/skills/authoring.md` near the existing orchestrated-skill
     guidance, using `.agents/skills/docs-author/SKILL.md`
   - do not claim portability the code does not deliver
7. Re-run validation for both skills after editing:
   - `clawperator skills validate com.solaxcloud.starter.set-discharge-to-limit-orchestrated`
   - `clawperator skills validate com.solaxcloud.starter.set-discharge-to-limit-replay`
   - one live proving invocation of the orchestrated skill on the
     physical Samsung device, plus one replay invocation, both with
     `--output json`. The orchestrated live invocation here is a
     pre-C3 smoke check; it does not count toward the C3 10-run
     protocol.

### Acceptance Criteria

Mechanical:

- `scripts/run.js` is materially smaller and the remaining content is codex
  spawn shape only.
- `rg "CHECKPOINT_IDS|parseFinalSkillResultFrame|\\.\\./clawperator|apps/node/dist/cli/index\\.js|CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS|SAFE_ENV_KEYS|OPENAI_API_KEY" ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js`
  returns zero matches.
- `rg "Planning in prose is not progress" ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md`
  matches (all five rule keywords match on separate greps).
- `rg "codex-only|codex only" ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md docs/skills/overview.md`
  matches in both files.
- `git diff --stat -- ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`
  shows zero files changed.
- Both `skills validate` calls return success.
- The pre-C3 live orchestrated run and the replay run both produce framed
  results without any `runtime_poisoned` state.
- `./scripts/docs_build.sh` succeeds.

Human review:

- Output accuracy: `SKILL.md` still describes the runtime program it
  did before, with strict-agentic rules added, not rewritten.
- Scope completeness: every deletion target above is gone; no Solax
  logic has merely been relocated inside `scripts/run.js`.
- Evidence grounding: the harness reads only declared env vars, not
  sibling-repo layout guesses.
- Format compliance: no em dashes in `SKILL.md` or docs; no
  AI-attribution trailers.

### Validation

```bash
wc -l ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js
rg "CHECKPOINT_IDS|parseFinalSkillResultFrame|860,1399|875,1548|\\.\\./clawperator|CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS" ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js
git -C ../clawperator-skills diff --stat -- skills/com.solaxcloud.starter.set-discharge-to-limit-replay/
clawperator skills validate com.solaxcloud.starter.set-discharge-to-limit-orchestrated
clawperator skills validate com.solaxcloud.starter.set-discharge-to-limit-replay
clawperator skills run com.solaxcloud.starter.set-discharge-to-limit-orchestrated --device <device_serial> --operator-package com.clawperator.operator.dev --output json -- 40
clawperator skills run com.solaxcloud.starter.set-discharge-to-limit-replay --device <device_serial> --operator-package com.clawperator.operator.dev --output json -- 40
./scripts/docs_build.sh
```

### Expected Commits

Two Conventional Commits for C2, in order:

```text
refactor(solax): thin orchestrated codex harness
```

```text
docs(solax): document codex-only W2b v1 limitation
```

If bucket B was hit, the conditional
`feat(skills): declare agent approval-mode field on skill.json.agent`
commit from C2.0 precedes these.

## Phase C3: Complete Reliability Evidence

### Agent Tier

default. Escalate to thinking if the lazy-mode classification pass is
contested (e.g. a run's status is ambiguous between `weak-evidence success` and
`evidence-backed success`).

### Goal

Run and record the required live-device reliability pass for the Solax
proving skill under the thinned harness from C2, with explicit lazy-mode
detection so false-positive `status: success` frames cannot game the
threshold.

### Files Or Surfaces To Change

- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/baseline.md`
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/run-01/` through `run-10/` (each with `result.json`, `stderr.txt`, `frame.json`, `metadata.json`)
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/run-forced-failure/` (at least one)
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/summary.md`
- `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/replay-control.md`
- `tasks/recording/agent-driven-skills-closeout/plan.md` (Status row only)
- `tasks/recording/agent-driven-skills-closeout/work-breakdown.md` (Status row only)
- `tasks/recording/agent-driven-skills/plan.md` (P4 status row only)
- `tasks/recording/agent-driven-skills/work-breakdown.md` (P4 status row only)

### Steps

1. Define and document the clean baseline starting state in
   `baseline.md`. Required fields:
   - device serial and model
   - Android version and SolaX Cloud app version
   - operator package (`com.clawperator.operator.dev`)
   - whether the SolaX app was force-stopped before the run
   - whether the device was at a known pre-run screen or home
   - the expected starting value of the discharge-to-limit slider
   This baseline must match the C2.0 probe baseline exactly. If it cannot
   (device upgraded, app version moved, etc.), re-run C2.0 before C3.
2. Run the orchestrated skill 10 times against the physical Samsung
   target with input `40`. Use the branch-local Clawperator CLI build
   (`node apps/node/dist/cli/index.js` or `./bin/clawperator` depending
   on repo state), not the globally installed binary. Use the `.dev`
   operator package.
3. For each run, capture into `run-NN/`:
   - `result.json`: the full structured JSON output from
     `clawperator skills run`
   - `stderr.txt`: the stderr transcript
   - `frame.json`: the final framed `SkillResult`
   - `metadata.json`: run index, start time, end time, whether the run
     hit the recovery branch, and the count of distinct Clawperator CLI
     invocations observed in stderr (e.g. `open`, `click`, `type`,
     `read`, `press`, `snapshot`, `scroll`, `wait`). The invocation
     count is the lazy-mode detector input for Step 6.
4. Save the captured artifacts under
   `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/`
   with one subdirectory per run. Do not collapse runs into a single
   combined log; individual run artifacts must be inspectable.
5. Include at least one deliberate forced-failure run (e.g. start from a
   wrong tab, or wrong initial value) under `run-forced-failure/` and
   record it alongside the nominal runs. The forced-failure run must
   produce a truthful `failed` or `indeterminate` `SkillResult` without
   leaving the runtime in a `runtime_poisoned` state.
6. Run a strict-agentic evidence review over every captured run using the
   classification table from `plan.md` "Decision Rules > C3 Per-Run
   Strict-Agentic Evidence Classification". Reproduced here for implementer
   convenience; the plan.md version is authoritative. First-match-wins.

   | Observed in the run | Classification | Counts toward ≥8/10 threshold? |
   | --- | --- | --- |
   | `status: success` AND ≥5 distinct Clawperator invocations AND a `read` call of `Discharge to <percent>%` AND checkpoint notes cite concrete commands | evidence-backed success | Yes |
   | `status: success` AND fewer than 5 distinct Clawperator invocations | weak-evidence success | No |
   | `status: success` AND no terminal `read` of `Discharge to <percent>%` | weak-evidence success | No |
   | `status: success` AND checkpoint notes do not cite the concrete commands used | weak-evidence success | No |
   | `status: failed` | failed | No |
   | `status: indeterminate` | indeterminate | No |
   | Frame parse failure, `SKILL_RESULT_PARSE_FAILED`, or any `runtime_poisoned` state | runtime_poisoned | No. Blocks ship. |

   Any `runtime_poisoned` classification blocks ship regardless of the
   other 9 runs.
7. Write `summary.md` capturing:
   - raw `status: success` count
   - evidence-backed success count (this is the number compared against
     the ≥8/10 threshold)
   - per-run strict-agentic evidence classification table, with the reasoning
     for each `weak-evidence success` exclusion (quote the specific stderr or frame
     evidence)
   - failure modes observed
   - whether any `runtime_poisoned` state occurred
   - time-to-terminal-state per run
   - the forced-failure run outcome
   - whether the ≥8/10 evidence-backed threshold was met and the
     zero-`runtime_poisoned` requirement held
8. Cross-check that the replay sibling still passes on the same device
   during the reliability window, as a control for device/app health.
   Record the replay control run outcome in `replay-control.md`.
9. Only after the evidence exists, update the Status tables in both
   `tasks/recording/agent-driven-skills-closeout/plan.md` and
   `work-breakdown.md`, and the P4 row in
   `tasks/recording/agent-driven-skills/plan.md` and `work-breakdown.md`,
   to reflect the true measured state. Do not update pre-emptively. If
   the threshold is not met, mark P4 as `not met` and leave W2b open; do
   not soften the plan language.

### Acceptance Criteria

Mechanical:

- At least 10 `run-NN/` directories exist, each containing
  `result.json`, `stderr.txt`, `frame.json`, `metadata.json`.
- At least one `run-forced-failure/` directory exists.
- `baseline.md` exists and covers the required fields.
- `summary.md` exists and explicitly distinguishes raw `status: success`
  count from evidence-backed success count.
- `summary.md` states whether the ≥8/10 evidence-backed threshold was
  met and whether any `runtime_poisoned` state occurred.
- No run classified as `weak-evidence success` is counted toward the threshold.
- `replay-control.md` exists and records a passing replay run from the
  same device.
- `rg "Completed" tasks/recording/agent-driven-skills-closeout/plan.md
  tasks/recording/agent-driven-skills-closeout/work-breakdown.md`
  reflects the measured state, not an aspirational state.

Human review:

- Output accuracy: every classification in `summary.md` is traceable to
  a concrete stderr line or frame field.
- Scope completeness: all 10 runs came from the same baseline; any
  baseline drift would have been a re-probe trigger.
- Evidence grounding: the replay control is from the same device and
  the same reliability window.
- Format compliance: status-table updates are idempotent with the
  committed evidence and do not soften plan language.

### Validation

```bash
ls docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/
ls docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/run-01/
rg "evidence-backed success count" docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/summary.md
rg "runtime_poisoned" docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/summary.md
```

### Expected Commits

Two Conventional Commits for C3, in order:

```text
docs(reliability): record Solax orchestrated 10-run validation
```

```text
docs(tasks): update W2b closeout and agent-driven-skills status
```

The second commit may span both repos as small status-file edits.

## Expected Commit Shape (All Phases)

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
Commit 4 also belongs to the Clawperator repo PR: probe evidence lives under
`docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`
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
