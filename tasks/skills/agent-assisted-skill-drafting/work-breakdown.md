# Agent-Assisted Skill Drafting Work Breakdown

Parent plan: `tasks/skills/agent-assisted-skill-drafting/plan.md`

## Executive Summary

1 PR, 5 phases, all in `clawperator`. The pack stays blocked until
`tasks/skills/skill-creation-guidance/` PR-2 lands, because Pack A assumes the
skills authoring surface, scaffold helper, and validator baseline are already
repaired. Once unblocked, the execution order is:

- Phase 1: define the eval red baseline in `/evals` and helper skills
- Phase 2: create the new discovery-first authoring skill and lock the
  discovery artifact contract
- Phase 3: wire install and packaged-skill discovery surfaces
- Phase 4: update host and authoring docs for the zero-results route
- Phase 5: run the dual-device emulator-plus-Samsung eval proof and capture
  findings

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 1 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | `tasks/skills/skill-creation-guidance/` PR-2 must merge or be finalized locally first |

## Hard Rules

- Do not start this pack until `tasks/skills/skill-creation-guidance/` PR-2 is
  merged or finalized locally.
- Use the hybrid model exactly as written in the plan: discovery routes,
  recording proves.
- Name the new packaged skill `skill-author-by-agent-discovery`. Do not rename
  it during execution.
- The discovery skill must require every field listed in the plan's discovery
  artifact contract. Missing required fields block handoff.
- The discovery skill must not author a durable runtime skill directly.
- Do not add new Node runtime contracts or new general-purpose CLI probes in
  this pack.
- Discoverability is part of the shipped surface. Do not assume host agents
  will find the new route from deep docs alone.
- Prefer strengthening existing help and bridge surfaces before adding new CLI
  nouns.
- Do not add a `skills create` alias by default. `skills new` remains the
  low-level manual scaffold unless evidence in `findings.md` proves a stronger
  alias is still required after the help and bridge work lands.
- Use `/evals` as the proving surface for cross-device confidence. Do not leave
  eval integration as a note in `findings.md` only.
- Start with the existing `android-version` benchmark. Do not invent a new eval
  id unless the current benchmark cannot express the authored-skill flow.
- Make the Pack A eval explicit before implementing the new workflow. The eval
  is the red/green spec for this pack, not a final polish pass.
- The acceptance matrix is one AOSP emulator and one Samsung physical device.
  Pass `--device <serial>` explicitly on every eval run.
- The Pack A eval must exercise `skill-author-by-agent-discovery`, not only the
  older temp skill-emission path.
- Each target-specific authored skill must emit a valid `SkillResult` on its
  originating device. Do not treat a plain answer line alone as enough.
- Use the branch-local Node build for any CLI validation. Do not rely on a
  globally installed `clawperator` binary.
- Use `.agents/skills/docs-author/SKILL.md` for the docs phase instead of
  re-deriving the docs workflow.
- Create `tasks/skills/agent-assisted-skill-drafting/findings.md` during
  Phase 1 and append to it as validation progresses.
- One commit per phase. Do not batch the new skill, install wiring, docs, and
  eval work into one opaque commit.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| # | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/skills/agent-assisted-skill-drafting/plan.md` | Stable contract, dependency, and route decisions |
| 2 | `tasks/skills/authorship/findings-compiled.md` | Problem statement, route taxonomy, and required discovery fields |
| 3 | `tasks/skills/skill-creation-guidance/plan.md` | Dependency pack that must land first |
| 4 | `docs/internal/design/evals.md` | Eval boundary and current skill-score model |
| 5 | `evals/README.md` | Operational eval-harness usage and current benchmark constraints |
| 6 | `evals/specs/android-version/spec.json` | Existing Settings/About benchmark contract |
| 7 | `evals/specs/android-version/prompt-skill.md` | Current skill-generation route that Pack A must update |
| 8 | `.agents/skills/evals-run/SKILL.md` | Emulator-facing eval helper workflow |
| 9 | `.agents/skills/evals-live-run/SKILL.md` | Physical-device eval helper workflow |
| 10 | `.agents/skills/skill-author-by-recording/SKILL.md` | Existing proving workflow and wording conventions |
| 11 | `docs/skills/authoring.md` | Current public authoring front door |
| 12 | `docs/host-agents.md` | Current host-agent discovery route |
| 13 | `docs/internal/design/agent-host-integration.md` | Durable host-agent assumptions |
| 14 | `apps/node/src/cli/registry.ts` | Current CLI help route and discoverability wording |
| 15 | `apps/node/src/test/unit/cliHelp.test.ts` | Existing help-surface regression coverage |
| 16 | `apps/node/src/domain/skills/copyAuthoringSkills.ts` | Packaged authoring-skill install and discovery wiring |
| 17 | `apps/node/src/cli/commands/authoringSkills.ts` | Install, update, and list CLI behavior |
| 18 | `apps/node/src/test/unit/authoringSkills.test.ts` | Packaging and install regression coverage |
| 19 | `apps/node/src/test/unit/authoringSkillsPack.test.ts` | Packaged authoring-skills tree expectations |
| 20 | `sites/landing/public/install.sh` | Installer-written local guide at `~/.clawperator/AGENTS.md` plus the shared `~/.agents/AGENTS.md` bridge |
| 21 | `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 4 |

## PR / Phase Plan

| PR | Repo | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `clawperator` | Define the Pack A eval first, then implement the discovery workflow, docs, and dual-device proof until the same benchmark passes | 1, 2, 3, 4, 5 | thinking, thinking, default, thinking, thinking | `tasks/skills/skill-creation-guidance/` PR-2 merged or finalized locally |

## Findings File Requirement

Create `tasks/skills/agent-assisted-skill-drafting/findings.md` during Phase 1
with these sections:

- Goal
- Dependency state
- Anchor scenario
- Eval design decision
- Device matrix
- Discovery artifact produced
- Commands run
- Eval run ids
- Installed authoring-skill checks
- Discoverability surfaces checked
- Authored skills and `SkillResult` validity
- Observations
- Problems encountered
- Fixes attempted
- Final route result
- Deferred follow-up

This file is execution-time evidence. Do not pre-author it before validation.

## Phase 1: Eval Red Baseline For Discovery-Authored Skills

### Agent Tier

thinking

### Goal

Make `/evals` the explicit red baseline for Pack A before implementing the new
workflow, so the rest of the pack is forced to satisfy one concrete benchmark
instead of a hand-wavy “should work” target.

### Files or Surfaces To Change

- `.agents/skills/evals-run/SKILL.md`
- `.agents/skills/evals-run/references/evals-run.md`
- `.agents/skills/evals-run/scripts/run_android_version_eval.sh` only if the
  helper needs additive Pack A flags
- `.agents/skills/evals-live-run/SKILL.md`
- `.agents/skills/evals-live-run/references/evals-live-run.md`
- `evals/README.md`
- `docs/internal/design/evals.md`
- `evals/specs/android-version/spec.json`
- `evals/specs/android-version/prompt-skill.md`
- `evals/specs/android-version/prompt-full-repo.md` only if the full-repo
  prompt needs a matching route note
- `evals/run_eval.py` and `evals/harness/` only if additive skill-score
  recording or replay handling is required
- `tasks/skills/agent-assisted-skill-drafting/findings.md`

### Steps

1. Create `findings.md` with the required sections before the first validation
   command and record the initial Pack A red baseline there.
2. Start from the existing `android-version` benchmark. Only introduce a new
   eval id if the current benchmark cannot truthfully express the authored-skill
   flow.
3. Update the skill-generation prompt path so the benchmark explicitly routes
   through `skill-author-by-agent-discovery` to draft a target-specific
   Settings/About skill.
4. Keep the benchmark’s required scored field on Android version unless a
   truthful richer scorer for security patch or Google Play system update lands
   cheaply within the same PR.
5. Update `evals/README.md`, `docs/internal/design/evals.md`, and the two
   repo-local eval helper skills so future agents know how this Pack A benchmark
   works on emulator and live-device surfaces.
6. If the harness needs additive scoring or artifact capture to verify authored
   `SkillResult` validity, make that change here and add or update focused
   harness tests.
7. Run one representative Pack A canary eval and record the current red outcome
   in `findings.md`.

### Acceptance Criteria

- the Pack A benchmark lives in `/evals`, not only in a manual findings note
- the updated benchmark explicitly exercises `skill-author-by-agent-discovery`
- `evals-run` and `evals-live-run` both describe how to run the Pack A
  benchmark on their respective device classes
- any harness change needed for authored-skill proof is covered by focused
  tests
- `findings.md` records a truthful red baseline before later phases implement
  the workflow

### Validation

```bash
uv run --project evals --extra dev pytest evals/harness -q
uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device <aosp_emulator_serial> --label pack-a-red-baseline
```

### Expected Commit

```text
test(evals): define red baseline for discovery-authored settings eval
```

## Phase 2: Discovery Skill Contract And Boundary

### Agent Tier

thinking

### Goal

Create `skill-author-by-agent-discovery` as the new packaged discovery-first
authoring skill and lock the boundary between discovery and proving so weaker
agents do not improvise a second authoring workflow.

### Files or Surfaces To Change

- `.agents/skills/skill-author-by-agent-discovery/SKILL.md`
- `.agents/skills/skill-author-by-agent-discovery/agents/openai.yaml`
- `.agents/skills/skill-author-by-recording/SKILL.md`

### Steps

1. Create the new skill directory under `.agents/skills/` and author
   `SKILL.md`.
2. In the new skill, define the discovery workflow in a way that explicitly:
   - checks for an existing installed runtime skill first
   - produces the required discovery artifact
   - routes to exactly one next step
   - forbids direct durable skill authoring inside discovery
3. Add `agents/openai.yaml` metadata for the new skill so agent discovery
   surfaces stay aligned with the actual workflow.
4. Update `skill-author-by-recording` only enough to say:
   - discovery now exists as a sibling front door
   - recording remains the proving step after a discovery result of
     `proceed_to_recording`
5. Make the anchor scenario explicit in at least one example inside the new
   skill prompt.

### Acceptance Criteria

- `.agents/skills/skill-author-by-agent-discovery/` exists with both
  `SKILL.md` and `agents/openai.yaml`
- the new skill requires every discovery artifact field from the plan
- `skill-author-by-recording` describes itself as the proving workflow after
  discovery, not the zero-results router
- the new skill prompt explicitly supports the anchor scenario

### Validation

```bash
test -f .agents/skills/skill-author-by-agent-discovery/SKILL.md
test -f .agents/skills/skill-author-by-agent-discovery/agents/openai.yaml
rg -n "recommended_next_step|existing_skill_verdict|route_confidence|mutation_risk|handoff_target" .agents/skills/skill-author-by-agent-discovery/SKILL.md
rg -n "discovery|proving|skill-author-by-agent-discovery" .agents/skills/skill-author-by-recording/SKILL.md
```

### Expected Commit

```text
feat(authoring): add discovery-first skill drafting front door
```

## Phase 3: Install Wiring And Packaged Discovery

### Agent Tier

default

### Goal

Make the new discovery skill behave like a real packaged first-party authoring
skill: installed, listed, and rediscovered through the existing authoring-skill
machinery.

### Files or Surfaces To Change

- `apps/node/authoring-skills/skill-author-by-agent-discovery`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/cliHelp.test.ts`
- `apps/node/src/domain/skills/copyAuthoringSkills.ts` if additive handling is required
- `apps/node/src/test/unit/authoringSkills.test.ts`
- `apps/node/src/test/unit/authoringSkillsPack.test.ts`
- `sites/landing/public/install.sh`
- generated `~/.clawperator/AGENTS.md` and `~/.agents/AGENTS.md` for
  validation only after reinstall

### Steps

1. Add the packaged authoring-skill symlink entry under
   `apps/node/authoring-skills/`.
2. Inspect the existing packaging logic and update it only if the new skill
   reveals a hard-coded single-skill assumption.
3. Update the authoring-skills unit tests so they expect both packaged skills
   and continue to verify install, update, and discovery symlink behavior.
4. Update the CLI help surfaces so a cold-start host agent can find the
   zero-results route from:
   - `clawperator --help`
   - `clawperator skills --help`
   - `clawperator authoring-skills --help`
   - `clawperator skills new --help` only as the manual-scaffold boundary
5. Update `write_agent_guide()` in `install.sh` so the installer-written
   `~/.clawperator/AGENTS.md`:
   - names both packaged first-party authoring skills
   - treats `skill-author-by-agent-discovery` as the zero-results front door
   - explains that `skill-author-by-recording` remains the proving step after a
     `proceed_to_recording` route
6. Update `write_shared_agent_bridge()` in `install.sh` so the installer-owned
   block in `~/.agents/AGENTS.md` points agents back to
   `~/.clawperator/AGENTS.md` and the runtime-skill CLI discovery commands
   without pretending shared agent skill directories contain Clawperator
   runtime skills.
7. Verify that the new packaged skill is discoverable via the branch-local CLI
   and that the help surfaces route no-match users toward authoring-skill
   discovery instead of a dead end.
8. Re-run authoring-skills install with the branch-local CLI and inspect the
   generated `~/.clawperator/AGENTS.md` and `~/.agents/AGENTS.md` surfaces so
   the task proves the installed host guidance, not only the repo source.

### Acceptance Criteria

- `apps/node/authoring-skills/skill-author-by-agent-discovery` points at the
  new repo-local skill directory
- authoring-skills tests pass with both packaged skills present
- branch-local help surfaces expose the zero-results route and distinguish
  runtime skills from authoring skills truthfully
- the installer-written `~/.clawperator/AGENTS.md` mentions both
  `skill-author-by-agent-discovery` and `skill-author-by-recording` by name
- the installer-written `~/.clawperator/AGENTS.md` explains that discovery is
  the no-match front door and recording is the proving follow-up
- the installer-owned bridge block in `~/.agents/AGENTS.md` points agents to
  `~/.clawperator/AGENTS.md` and does not hide the authoring-skills route
- the branch-local CLI lists both installed authoring skills after install

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js --help
node apps/node/dist/cli/index.js skills --help
node apps/node/dist/cli/index.js authoring-skills --help
node apps/node/dist/cli/index.js skills new --help
node apps/node/dist/cli/index.js authoring-skills install --format json
node apps/node/dist/cli/index.js authoring-skills list --format json
rg -n "skill-author-by-agent-discovery|skill-author-by-recording|authoring-skills|AGENTS.md" ~/.clawperator/AGENTS.md ~/.agents/AGENTS.md
```

### Expected Commit

```text
feat(authoring): wire packaged discovery skill install flow
```

## Phase 4: Host-Agent Route And Discovery-To-Proving Docs

### Agent Tier

thinking

### Goal

Document the zero-results host-agent route and the new discovery-to-proving
higher-level workflow so agents and humans stop treating "no skill found" as an
implicit instruction to improvise.

### Files or Surfaces To Change

- `docs/host-agents.md`
- `docs/skills/authoring.md`
- `docs/internal/design/agent-host-integration.md` only if a matching durable
  internal rule is needed

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the docs workflow.
2. In `docs/host-agents.md`, add the explicit zero-results route:
   - check existing runtime skills
   - run `skill-author-by-agent-discovery` when no skill exists
   - follow the discovery route result instead of guessing
3. In `docs/skills/authoring.md`, document the hybrid model:
   - discovery-first for unfamiliar routes
   - recording-first for proving reusable skills after discovery
4. If needed, add one small durable note in
   `docs/internal/design/agent-host-integration.md` so the public docs and
   internal design assumptions stay aligned.
5. Keep the docs scoped to the workflow. Do not broaden into general task
   planning or Pack B guidance.

### Acceptance Criteria

- `docs/host-agents.md` explicitly describes the zero-results route
- `docs/skills/authoring.md` explains the discovery-to-proving handoff
- any internal-design note is additive and consistent with the public docs
- docs build succeeds

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(authoring): document discovery-to-proving workflow
```

## Phase 5: Dual-Device Eval Matrix And Findings

### Agent Tier

thinking

### Goal

Prove that the new front door works on the anchor scenario and under the eval
matrix: one AOSP emulator plus one Samsung physical device, both on the
Settings/About surface rooted at `com.android.settings`.

### Files or Surfaces To Change

- `tasks/skills/agent-assisted-skill-drafting/findings.md`

### Steps

1. Continue updating `findings.md` from Phase 1 and append after each
   meaningful validation step.
2. Rebuild the branch-local Node CLI and reinstall authoring skills using the
   branch-local build.
3. Verify that the installed authoring-skills list includes:
   - `skill-author-by-agent-discovery`
   - `skill-author-by-recording`
4. Verify that the installer-written discoverability surfaces mention the new
   front door:
   - `~/.clawperator/AGENTS.md` names both authoring skills and explains the
     discovery-before-recording rule
   - `~/.agents/AGENTS.md` points readers back to `~/.clawperator/AGENTS.md`
     and the runtime-skill discovery commands
5. Run the new discovery skill against the anchor scenario in a Codex or local
   host-agent execution context and capture the produced discovery artifact in
   `findings.md`.
6. Verify that the produced artifact contains every required field and that its
   selected route is explicit and singular.
7. Run the updated Pack A eval twice in `full-repo` mode with explicit devices:
   - once on an AOSP emulator
   - once on a Samsung physical device
8. For each eval run, verify all of the following:
   - the route actually used `skill-author-by-agent-discovery`
   - the run produced a target-specific authored skill rather than a single
     over-generalized Settings skill
   - the authored skill emitted a valid `SkillResult`
   - the required Android-version answer remained correct on that device
9. Record the run ids, sanitized device labels, authored-skill identities, and
   any follow-up gaps in `findings.md`. Do not silently widen the pack.

### Acceptance Criteria

- `findings.md` exists and records the install checks, anchor-scenario run, and
  dual-device eval matrix
- both authoring skills are discoverable through the installed branch-local CLI
- the installed `~/.clawperator/AGENTS.md` and `~/.agents/AGENTS.md` surfaces
  were inspected and recorded in `findings.md`
- the anchor-scenario discovery artifact contains every required field
- one AOSP emulator run id and one Samsung run id are recorded
- each target-specific authored skill emits a valid `SkillResult` on its
  originating device

### Validation

```bash
npm --prefix apps/node run build
node apps/node/dist/cli/index.js authoring-skills install --format json
node apps/node/dist/cli/index.js authoring-skills list --format json
rg -n "skill-author-by-agent-discovery|skill-author-by-recording|authoring-skills|AGENTS.md" ~/.clawperator/AGENTS.md ~/.agents/AGENTS.md
uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device <aosp_emulator_serial> --label pack-a-aosp
uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device <samsung_device_serial> --label pack-a-samsung
./scripts/docs_build.sh
```

### Expected Commit

```text
test(authoring): prove discovery-first workflow across settings eval matrix
```
