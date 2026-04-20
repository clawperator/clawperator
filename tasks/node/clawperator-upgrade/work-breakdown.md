# Clawperator Upgrade Agent-Skill Work Breakdown

Parent plan: `tasks/node/clawperator-upgrade/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 adds the new packaged `agent-skill` and updates the
Node-side packaged-skill inventory, help text, and unit tests to recognize a
fourth first-party helper. PR-2 updates `install.sh`, installer harnesses, and
authored docs so the new skill is installed and discoverable through the normal
Clawperator install path. This pack intentionally does not add a top-level
`clawperator upgrade` CLI command.

## Status

| Item | Value |
| --- | --- |
| State | completed on branch |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | 1, 2, 3, 4 |
| Remaining | none |
| Current / Next | done |
| Blockers | no task-specific blockers; the umbrella `./validation/install/test_install.sh` entrypoint still exposes unrelated pre-existing failures outside this pack |

## Hard Rules

- Do not replace the canonical upgrade path with `npm install -g clawperator@latest`.
  The packaged skill must route through
  `curl -fsSL https://clawperator.com/install.sh | bash`.
- Do not add a top-level CLI command in this pack.
- Keep `clawperator-upgrade` as an `agent-skill`. Do not place it under runtime
  `clawperator skills ...`.
- Keep the skill thin. It may orchestrate canonical commands, but it must not
  re-implement installer logic or APK management inside the skill body.
- Update every hardcoded first-party `agent-skill` inventory in the same review
  window. Do not leave tests, CLI help, or installer text assuming only three
  first-party skills.
- Phase 1 and Phase 2 must ship their own unit coverage. Do not defer packaged
  `agent-skill` inventory tests to the installer phase.
- Any `install.sh` behavior or guide-text change must be proven through the
  install harnesses in `validation/install/`. `bash -n` is not sufficient by
  itself.
- Use `.agents/skills/docs-author/SKILL.md` for the docs phase. Do not hand-edit
  generated docs surfaces.
- If landing machine-facing guidance must change, update the source-owned file
  in `sites/landing/public/`; do not assume docs-site generation will cover it.
- One commit per logical step. Do not batch skill authoring, Node help updates,
  installer changes, and docs edits into one commit.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/clawperator-upgrade/plan.md` | Stable contract and scope boundaries |
| `.agents/skills/clawperator-agent-orientation/SKILL.md` | Exemplar for a thin first-party host-agent router skill |
| `apps/node/src/domain/skills/copyAgentSkills.ts` | Authoritative packaged `agent-skills` install behavior |
| `apps/node/scripts/agentSkillsPack.mjs` | npm pack/unpack behavior for symlinked packaged skills |
| `apps/node/src/cli/commands/agentSkills.ts` | Installed-skill inventory messaging |
| `apps/node/src/cli/registry.ts` | `agent-skills` help text and top-level guidance |
| `apps/node/src/test/unit/agentSkills.test.ts` | Existing unit coverage for packaged-skill install and list behavior |
| `apps/node/src/test/unit/agentSkillsPack.test.ts` | Existing coverage for npm packaging of symlinked skills |
| `sites/landing/public/install.sh` | Installer-written local guide and packaged `agent-skills` setup flow |
| `apps/node/src/test/integration/installScript.test.ts` | Existing installer-facing Node integration test that must stay green when `install.sh` changes |
| `validation/install/README.md` | Contract for when install harnesses must be updated and how `test_install.sh` is expected to be used |
| `validation/install/test_agent_skills.sh` | Authoritative installer harness for `agent-skills` setup and guide text |
| `docs/host-agents.md` | Public host-agent route documentation |
| `docs/skills/authoring.md` | Current packaged first-party `agent-skills` inventory docs |
| `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 4 |
| `.agents/skills/docs-build/SKILL.md` | Required build workflow for regenerating `llms-full.txt` and validating the docs pipeline |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Add and bundle `clawperator-upgrade` in the packaged `agent-skills` set | 1, 2 | thinking, default | none |
| PR-2 | Install, guide, and document the new packaged skill | 3, 4 | default, default | PR-1 merged |

Current branch status:

- PR-1 scope completed in `0809aef feat(node): add packaged clawperator-upgrade agent-skill`
- PR-2 scope completed in `39e179d docs: wire clawperator-upgrade through install and host guidance`

## Testing Model

| Phase | Primary proof | What it must prove | Not sufficient by itself |
| --- | --- | --- | --- |
| 1 | `apps/node/src/test/unit/agentSkillsPack.test.ts` plus packaged-skill unit coverage | the new symlinked skill is included in the packaged set and survives the npm pack script flow | manually checking the new folder exists |
| 2 | `apps/node/src/test/unit/agentSkills.test.ts`, `cliHelp.test.ts`, and any adjacent doctor or inventory test | Node-side inventory/help/messages all reflect four first-party skills | only updating string literals without regression tests |
| 3 | `validation/install/test_agent_skills.sh`, `validation/install/test_main.sh`, `validation/install/test_install.sh`, and installer-facing Node tests | installer setup, guide text, local summary surfaces, and the four-skill completeness gate mention `clawperator-upgrade` correctly and idempotently | `bash -n`, stdout inspection, or one-off local runs |
| 4 | docs build plus installer harness reruns | authored docs match the shipped installer/help behavior and generated `llms-full.txt` is refreshed from source | docs edits without build, build without rereading the content against code, or hand-editing generated artifacts |

## Phase 1: Add the Packaged Skill Artifact

### Agent Tier

thinking

### Goal

Create the new first-party `clawperator-upgrade` skill and bundle it into the
Node-distributed `agent-skills` set.

### Files or Surfaces To Change

- `.agents/skills/clawperator-upgrade/SKILL.md`
- `.agents/skills/clawperator-upgrade/agents/openai.yaml`
- `apps/node/agent-skills/clawperator-upgrade`
- `apps/node/src/test/unit/agentSkillsPack.test.ts`
- `apps/node/src/test/unit/agentSkills.test.ts` if the packaged list assertion
  is the closest proof

### Steps

1. Author `.agents/skills/clawperator-upgrade/SKILL.md` using
   `clawperator-agent-orientation` as the style and scope exemplar: thin,
   route-oriented, and grounded in canonical product surfaces.
2. Make the skill instruct the agent to:
   - use `curl -fsSL https://clawperator.com/install.sh | bash` as the primary
     upgrade path
   - run `clawperator doctor --json` afterward
   - summarize whether the install is ready or which existing repair command
     the user should run next
3. Do not make direct `npm install -g clawperator@latest`,
   `clawperator skills update`, or `clawperator agent-skills update` the
   primary path in the skill body.
4. Add aligned UI metadata in `agents/openai.yaml`.
5. Create the packaged symlink under `apps/node/agent-skills/`.
6. Update packaged-skill tests so the new skill is part of the expected
   pack/unpack inventory.

### Acceptance Criteria

- `clawperator-upgrade` exists as a first-party repo-local skill with aligned
  metadata.
- The npm-packaged `agent-skills` tree includes the new skill.
- Tests prove the packaged set now includes four first-party skills.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test -- --test-name-pattern="agentSkillsPack|agentSkills"
```

Status:
- completed
- validated with `npm --prefix apps/node run build`
- validated with `node --test apps/node/dist/test/unit/agentSkillsPack.test.js apps/node/dist/test/unit/agentSkills.test.js apps/node/dist/test/unit/cliHelp.test.js`

### Expected Commits

```text
feat(skill): add clawperator-upgrade agent-skill
```

```text
test(node): cover clawperator-upgrade packaged skill
```

Actual checkpoint:

```text
0809aef feat(node): add packaged clawperator-upgrade agent-skill
```

## Phase 2: Update Node-Side Inventory and Help

### Agent Tier

default

### Goal

Make every Node-side first-party `agent-skill` surface acknowledge
`clawperator-upgrade` as part of the packaged set.

### Files or Surfaces To Change

- `apps/node/src/cli/commands/agentSkills.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/agentSkills.test.ts`
- `apps/node/src/test/unit/cliHelp.test.ts`
- `apps/node/src/test/unit/doctor/hostChecks.test.ts` if any first-party set
  assumptions need to change

### Steps

1. Update all install/list/help strings that currently enumerate exactly three
   first-party `agent-skills`.
2. Keep the route boundaries clear:
   - `clawperator-agent-orientation` remains the unfamiliar-host router
   - `clawperator-upgrade` becomes the whole-product upgrade route
   - `skill-author-by-agent-discovery` remains the zero-results front door
   - `skill-author-by-recording` remains the proving workflow
3. Update unit tests so the expected installed skill list contains all four
   first-party skills.
4. Update help-text tests so the new skill appears anywhere the existing
   first-party set is named.
5. If any test fixture seeds installed skill directories manually, add the
   fourth skill there as well instead of weakening the assertion.

### Acceptance Criteria

- `agent-skills list`, install messaging, and help text all acknowledge
  `clawperator-upgrade`.
- Unit tests lock the first-party packaged inventory to the new four-skill set.
- No Node-side surface still hardcodes the older three-skill inventory.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test -- --test-name-pattern="agentSkills|cli help|doctor"
```

Status:
- completed
- covered by the same targeted Node validation run used for Phase 1

### Expected Commits

```text
feat(node): add clawperator-upgrade to agent-skills help
```

```text
test(node): update first-party agent-skills inventory coverage
```

Actual checkpoint:

```text
0809aef feat(node): add packaged clawperator-upgrade agent-skill
```

## Phase 3: Install Script and Installer Harness Integration

### Agent Tier

default

### Goal

Make `install.sh` install and locally document `clawperator-upgrade` as part of
the normal first-party `agent-skills` setup.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`
- `validation/install/test_agent_skills.sh`
- `validation/install/test_main.sh`
- `apps/node/src/test/integration/installScript.test.ts` only if an `install.sh`
  behavior change requires a matching installer-facing Node test update
- `validation/install/test_install.sh` if the changed behavior belongs in the
  umbrella harness as well

### Steps

1. Update `install.sh` guide-writing logic and any hardcoded inventory sections
   that currently name only the existing three packaged skills.
2. Update the installer guide writer's completeness gate so the "recommended
   first-run flow" branch requires all four first-party skills, not just the
   pre-existing three-skill set.
3. Keep the skill’s stated purpose aligned with the plan:
   `clawperator-upgrade` is the packaged route for whole-product upgrade via
   `install.sh`, not a component-level repair command.
4. Update any mock `agent-skills install --output json` payloads or seeded
   installed-skill directories in the installer harnesses so they include the
   fourth skill.
5. Add harness assertions for the new guide text and inventory. If the local
   guide enumerates the installed skill names, make the harness fail when the
   fourth skill is missing.
6. Keep the installer changes additive. Do not redesign `install.sh`’s core
   sequencing in this phase.
7. Run the full install validation entrypoint before closing the phase so the
   unchanged installer-facing Node tests continue to pass as well.

### Acceptance Criteria

- `install.sh` local guide and summaries mention `clawperator-upgrade`.
- The installer guide's "complete" branch only triggers when all four packaged
  first-party skills are present.
- Installer harnesses prove the fourth-skill setup path and guide text.
- Re-running the installer remains idempotent with respect to the new guide
  text.

### Validation

```bash
bash -n sites/landing/public/install.sh
npm --prefix apps/node run test -- --test-name-pattern="landing install.sh Node upgrade path"
./validation/install/test_agent_skills.sh
./validation/install/test_main.sh
./validation/install/test_install.sh
```

Status:
- completed for task-owned installer surfaces
- validated with `./validation/install/test_agent_skills.sh`
- validated with `./validation/install/test_main.sh`
- `./validation/install/test_install.sh` still fails for unrelated pre-existing
  repo issues outside this pack after passing the task-owned shell harnesses

### Expected Commits

```text
feat(install): add clawperator-upgrade to local agent guide
```

```text
test(install): cover clawperator-upgrade installer guidance
```

Actual checkpoint:

```text
39e179d docs: wire clawperator-upgrade through install and host guidance
```

## Phase 4: Public Docs and Durable Guidance

### Agent Tier

default

### Goal

Document the new upgrade route anywhere Clawperator publicly enumerates or
routes through the first-party `agent-skills` set.

### Files or Surfaces To Change

- `docs/host-agents.md`
- `docs/skills/authoring.md`
- `docs/internal/design/agent-host-integration.md`
- `sites/landing/public/llms-full.txt` only as generated output from
  `./scripts/docs_build.sh`, never as a hand-edited authored page

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for doc edits and
   `.agents/skills/docs-build/SKILL.md` for regeneration and validation.
2. Update the public host-agent docs so `clawperator-upgrade` is introduced as
   the packaged whole-product upgrade route and is kept distinct from
   orientation and authoring.
3. Update any packaged first-party `agent-skill` inventory tables or checks in
   `docs/skills/authoring.md` to include the new fourth skill.
4. Update the internal host-agent integration design doc if it enumerates the
   packaged first-party set.
5. Regenerate `sites/landing/public/llms-full.txt` via `./scripts/docs_build.sh`
   if the authored docs change the listed first-party `agent-skills` or route
   wording. Do not hand-edit the generated artifact.
6. Re-read the edited docs against the code and installer text before final
   validation. Do not let the docs promise a different upgrade path than the
   new skill actually instructs.

### Acceptance Criteria

- `docs/host-agents.md`, `docs/skills/authoring.md`, and
  `docs/internal/design/agent-host-integration.md` describe
  `clawperator-upgrade` as the packaged whole-product upgrade route
- generated `llms-full.txt` artifacts are refreshed through the docs build
- docs wording stays aligned with the shipped installer guide and packaged
  first-party inventory

### Validation

```bash
./scripts/docs_build.sh
```

Status:
- completed
- validated with `./scripts/docs_build.sh`

### Actual Checkpoint

```text
39e179d docs: wire clawperator-upgrade through install and host guidance
```

### Acceptance Criteria

- Public docs name `clawperator-upgrade` in the right route tables or inventory
  lists.
- The documented upgrade path stays grounded in `install.sh`, not direct npm
  self-upgrade.
- Internal design notes that enumerate first-party `agent-skills` stay aligned
  with the shipped set.
- `sites/landing/public/llms-full.txt` matches the newly built docs output
  rather than stale pre-change content.

### Validation

```bash
./scripts/docs_build.sh
./validation/install/test_agent_skills.sh
./validation/install/test_main.sh
```

### Expected Commits

```text
docs(agent-skills): add clawperator-upgrade guidance
```

## Finalization

- Do not delete this task pack until both PRs merge and the docs, installer,
  and packaged-skill inventories all agree on the four-skill first-party set.
