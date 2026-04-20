# Clawperator Upgrade Agent-Skill

## Executive Summary

Add a first-party packaged `agent-skill` named `clawperator-upgrade` that
brings an installed Clawperator environment up to date by routing through the
canonical installer at `https://clawperator.com/install.sh`, then verifying the
resulting setup. This is a Node-led cross-surface task pack: 2 PRs, 4 phases.
PR-1 adds the packaged skill plus the Node-side inventory/help/test updates for
the fourth first-party `agent-skill`. PR-2 updates `install.sh`, host-agent
guidance, and public docs so the new skill is actually installed, described,
and discoverable after a normal install.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships, Clawperator should include a packaged `clawperator-upgrade`
`agent-skill` alongside the existing first-party helpers, install it through
the normal `agent-skills` flow and `install.sh`, and document it as the
truthful whole-product upgrade path for the CLI, Operator APK, runtime skills,
and packaged `agent-skills`.

## Why Now

`agent-skills` now exist as the right surface for host-agent helpers around
Clawperator itself. Upgrade and repair work belongs there much more cleanly
than in runtime `skills` or as an in-process self-updating CLI command. The
current first-party set has orientation and authoring routes, but no packaged
path for “bring this Clawperator install current end to end.”

## In Scope

- Add `.agents/skills/clawperator-upgrade/` with a real `SKILL.md` and aligned
  `agents/openai.yaml`
- Bundle the skill into the Node-distributed `agent-skills` set under
  `apps/node/agent-skills/`
- Update Node-side `agent-skills` inventory/help/messages/tests to treat
  `clawperator-upgrade` as a fourth first-party skill
- Update `install.sh` and installer harnesses so the skill is installed and
  mentioned in the local host-agent guidance
- Update public authored docs that enumerate or route through the installed
  first-party `agent-skills`
- Define the skill’s upgrade workflow and verification contract

## Out of Scope

- A new top-level CLI command such as `clawperator upgrade`
- In-process self-upgrade logic that runs `npm install -g clawperator@latest`
  from the currently running CLI
- Changes to runtime `clawperator skills ...` behavior
- New Operator APK compatibility logic beyond using the shipped install and
  doctor flows that already exist
- Release-process changes or npm publication workflow changes outside the
  packaged `agent-skills` set

## Existing Artifact Scope

- `apps/node/src/cli/commands/agentSkills.ts` and
  `apps/node/src/cli/registry.ts`: in scope to update hardcoded first-party
  `agent-skill` lists, install/list messaging, and help text; preserve the
  existing `agent-skills install|update|list` command model
- `sites/landing/public/install.sh`: in scope for additive local-guide and
  install-flow references to the new skill; preserve the canonical installer
  sequencing and existing install behavior
- `docs/host-agents.md` and `docs/skills/authoring.md`: in scope to add the new
  upgrade route and fourth packaged skill; preserve existing orientation and
  zero-results routing semantics
- `validation/install/` and `apps/node/src/test/unit/`: in scope for coverage
  updates that prove the fourth-skill inventory and installer guidance

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `.agents/skills/clawperator-upgrade/` | New first-party packaged skill content and UI metadata | PR-1 / Phase 1 |
| `apps/node/agent-skills/clawperator-upgrade` | New packaged symlink entry for npm distribution | PR-1 / Phase 1 |
| `apps/node/scripts/agentSkillsPack.mjs` | No behavior change expected; verify existing pack script handles the new symlinked skill | PR-1 / Phase 1 verification |
| `apps/node/src/cli/commands/agentSkills.ts` | Installed-skill inventory messaging | PR-1 / Phase 2 |
| `apps/node/src/cli/registry.ts` | Help text and first-party `agent-skill` descriptions | PR-1 / Phase 2 |
| `apps/node/src/test/unit/agentSkills*.test.ts`, `cliHelp.test.ts`, `doctor/hostChecks.test.ts` | Regression coverage for the fourth skill and packaged inventory | PR-1 / Phases 1-2 |
| `sites/landing/public/install.sh` | Installer-written local guide and install references to `clawperator-upgrade` | PR-2 / Phase 3 |
| `validation/install/test_agent_skills.sh`, `validation/install/test_main.sh` | Installer-harness assertions for the fourth skill and new guide text | PR-2 / Phase 3 |
| `docs/host-agents.md`, `docs/skills/authoring.md`, `docs/internal/design/agent-host-integration.md` | Public and internal durable guidance for the new skill | PR-2 / Phase 4 |
| `sites/landing/public/llms-full.txt` | Landing machine-facing guidance if the authored docs or installer text change its listed first-party skill set | PR-2 / Phase 4 if needed by the final doc diff |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Packaged `agent-skills` source dir and install semantics | `apps/node/src/domain/skills/copyAgentSkills.ts` |
| Pack script behavior for npm packaging | `apps/node/scripts/agentSkillsPack.mjs` |
| `agent-skills` CLI commands and help text | `apps/node/src/cli/commands/agentSkills.ts`, `apps/node/src/cli/registry.ts` |
| Current first-party host-agent route docs | `docs/host-agents.md`, `docs/skills/authoring.md` |
| Installer-written host guide behavior | `sites/landing/public/install.sh` |
| Installer validation harnesses | `validation/install/test_agent_skills.sh`, `validation/install/test_main.sh`, `validation/install/test_install.sh` |
| Existing unit-test patterns for packaged `agent-skills` | `apps/node/src/test/unit/agentSkills.test.ts`, `apps/node/src/test/unit/agentSkillsPack.test.ts`, `apps/node/src/test/unit/cliHelp.test.ts` |
| Readiness verification contract | `apps/node/src/cli/commands/doctor.ts`, `docs/api/doctor.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- This is an `agent-skill`, not a runtime skill and not a new top-level CLI
  command.
- The skill name is exactly `clawperator-upgrade`.
- The skill’s primary upgrade action is the canonical installer:
  `curl -fsSL https://clawperator.com/install.sh | bash`.
- Do not make `npm install -g clawperator@latest` the primary path inside this
  skill. The purpose here is whole-product upgrade, including the Operator APK,
  runtime skills, and packaged `agent-skills`, which `install.sh` already owns.
- The skill should stay thin like `clawperator-agent-orientation`: delegate to
  canonical product surfaces instead of re-implementing install logic inside
  the skill body.
- The shipped first-party `agent-skill` inventory after this task is:
  `clawperator-agent-orientation`, `clawperator-upgrade`,
  `skill-author-by-agent-discovery`, and `skill-author-by-recording`.
  Update every hardcoded list and test fixture that currently assumes only
  three packaged skills.
- Post-upgrade verification must use the real Clawperator readiness surface.
  The minimum verification command is `clawperator doctor --json`. Do not
  invent a separate upgrade-health checker.

**Judgment required:**

- Exact wording and pacing of the new skill instructions
- Whether the skill should tell the agent to inspect `clawperator devices`
  before or after the installer run when follow-up verification needs an
  explicit device
- Exact local-guide and docs wording that keeps orientation, upgrade, and
  authoring routes clearly separated without turning `agent-skills` help into a
  taxonomy dump

## Decision Rules

| Question | Rule |
| --- | --- |
| What does `clawperator-upgrade` actually do? | Route through `https://clawperator.com/install.sh`, then verify with `clawperator doctor --json`, then summarize success or the next blocking repair step. |
| Should the skill call `npm install -g clawperator@latest` directly? | No. Keep `install.sh` as the canonical product upgrade path because it also upgrades the CLI prerequisites, Operator APK path, runtime skills, and packaged `agent-skills`. |
| Should the skill run `clawperator agent-skills update` or `clawperator skills update` as its primary action? | No. Those are component-level helpers. The whole-product path is `install.sh`. |
| What if `doctor --json` still reports failure after the installer completes? | Report the failing doctor outcome and route to the existing repair guidance instead of inventing a second in-skill remediation tree. |
| Where must the new skill be discoverable? | Packaged source tree, npm-packed `apps/node/agent-skills/`, `agent-skills list`, CLI help text, installer-written local guide, and the public host-agent docs. |
| What tests must move in lockstep with the new skill? | Packaged-skill unit tests, help-text tests, installer harnesses, and any hardcoded first-party inventory assertions in docs or tests. |

## Failure Modes To Prevent

- The new skill exists only in `.agents/skills/` and is not bundled into the
  npm-shipped `agent-skills` set.
- The skill’s instructions tell agents to use `npm install -g clawperator@latest`
  and therefore skip Operator APK, runtime-skill, or packaged `agent-skill`
  updates.
- `install.sh` still writes local guidance that assumes only three first-party
  `agent-skills`.
- Unit tests and installer harnesses continue to hardcode a three-skill
  inventory and silently miss packaging drift.
- Public docs mention the old first-party set or fail to introduce the upgrade
  route at all.
- The skill grows into a bespoke installer implementation instead of staying a
  thin router to canonical product surfaces.

## Output Contract

After PR-1:

- `.agents/skills/clawperator-upgrade/` exists with a real `SKILL.md` and
  aligned `agents/openai.yaml`
- `apps/node/agent-skills/clawperator-upgrade` exists and is included by the
  existing pack/install flow
- Node-side help, inventory messaging, and packaged-skill unit tests treat
  `clawperator-upgrade` as a first-party packaged `agent-skill`

After PR-2:

- `install.sh` installs and locally documents `clawperator-upgrade` alongside
  the other first-party `agent-skills`
- installer harnesses prove the fourth-skill inventory and guide text
- public docs describe `clawperator-upgrade` as the packaged whole-product
  upgrade route and keep it separate from orientation and authoring routes

## Idempotency

- Re-running `agent-skills install` or `agent-skills update` after this task
  must leave exactly one installed `clawperator-upgrade` entry with the same
  managed symlink or copied package contents as the other first-party skills.
- Re-running `install.sh` must not duplicate the new skill in the local
  `~/.clawperator/AGENTS.md` guidance or installer-produced summaries.
- Re-running the skill’s documented flow remains safe because the underlying
  `install.sh` path is already designed as a repeatable install or upgrade
  command.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Packaged whole-product upgrade route for agents | `.agents/skills/clawperator-upgrade/SKILL.md` |
| First-party `agent-skills` inventory and install/list help | `apps/node/src/cli/commands/agentSkills.ts`, `apps/node/src/cli/registry.ts` |
| Installer-written local guide for the upgrade route | `sites/landing/public/install.sh` |
| Public host-agent documentation for the upgrade route | `docs/host-agents.md`, `docs/skills/authoring.md` |
| Internal rationale that upgrade belongs in `agent-skills` | `docs/internal/design/agent-host-integration.md` |
