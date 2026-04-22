# install.sh Cleanup and CLI Migration

## Executive Summary

Reduce `sites/landing/public/install.sh` from a product-logic script into a
thin bootstrap entrypoint by moving post-bootstrap install behavior into the
Node CLI. This is cross-surface work spanning the landing-site installer, Node
CLI commands, doctor behavior, install validation, public docs, and the shipped
`clawperator-upgrade` bundled skill.

This task ships in **4 PRs across 5 phases**. **PR-1** extracts host artifact
generation into a CLI-owned surface. **PR-2** moves operator APK acquisition
and verification into the CLI. **PR-3** moves doctor-driven remediation and
multi-device install policy into the CLI. **PR-4** finishes the installer
thinning, updates docs and validations, and changes the upgrade skill so
`install.sh` becomes a recovery path rather than the normal upgrade path.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 4 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships:

- `install.sh` remains the stable public bootstrap entrypoint
- post-bootstrap install behavior lives in the Node CLI, not in embedded shell
  policy and heredoc Node snippets
- APK download and checksum verification are reusable CLI behavior
- multi-device install remediation and doctor-driven policy are owned by the
  CLI rather than re-parsed from `doctor --json` in shell
- shell RC mutation for `CLAWPERATOR_SKILLS_REGISTRY` is removed or made
  explicitly non-default
- `apps/node/bundled-skills/clawperator-upgrade` uses a CLI-first upgrade path
  once the needed CLI surfaces exist, with `install.sh` retained as
  environment-recovery fallback only

## Why Now

`tasks/install/cleanup/findings.md` already establishes that the installer is
large because it mixes four responsibilities:

1. bootstrap prerequisites that belong in shell
2. product logic that belongs in the CLI
3. JSON parsing that should not exist outside the CLI
4. host artifact generation implemented as embedded Node code inside bash

That split now leaks into validation burden, upgrade behavior, and maintenance
cost. The task exists to remove the second product-logic layer outside the CLI
before more install and upgrade work builds on it.

## In Scope

- add a CLI-owned host-artifact materialization surface for:
  - install state
  - MCP config snippet
  - local `~/.clawperator/AGENTS.md`
  - shared-agent bridge updates
- replace shell-side artifact heredocs in `install.sh` with that CLI surface
- add a CLI-owned operator APK download or fetch surface covering metadata,
  download, and checksum verification
- move doctor-driven APK remediation and multi-device setup policy into the CLI
- reduce `install.sh` to bootstrap plus CLI orchestration
- remove or opt-in-gate shell RC mutation for `CLAWPERATOR_SKILLS_REGISTRY`
- update install validation to prove the new ownership boundaries
- update authored docs for the new install and upgrade behavior
- update `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` and its
  `agents/openai.yaml` prompt metadata to match the CLI-first upgrade path

## Out of Scope

- replacing `install.sh` entirely with Python or Node in this task
- changing Java, Node, adb, git, curl, or npm bootstrap semantics beyond what
  is required to keep the existing shell bootstrap working
- redesigning the Operator APK install phases already owned by
  `clawperator operator setup`
- changing Android runtime behavior
- changing sibling `../clawperator-skills`
- redesigning unrelated bundled skills beyond `clawperator-upgrade`

## Existing Artifact Scope

- `tasks/install/cleanup/findings.md`: authoritative research input for this
  task pack; preserve existing content as-is. If execution finds a material
  contradiction, append a dated `## Execution Notes` section at the end rather
  than rewriting the findings sections.
- `sites/landing/public/install.sh`: in scope for installer thinning and
  delegation changes only. Preserve the public one-liner bootstrap contract.
- `validation/install/`: in scope for replacing shell-behavior coverage with
  CLI or integration coverage in the same phase as the behavior move. Do not
  leave behavior unproven between phases.
- `apps/node/bundled-skills/clawperator-upgrade/`: in scope only in the final
  phase once the CLI surfaces it depends on actually exist.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `sites/landing/public/install.sh` | Thin bootstrapper plus CLI orchestration; removal of embedded artifact writers, APK fetch logic, and doctor-policy parsing | PR-1 / Phase 2, PR-2 / Phase 3, PR-3 / Phase 4, PR-4 / Phase 5 |
| `validation/install/` | Replace shell-specific coverage with CLI or integration coverage in lockstep with each migration step | PR-1 / Phase 2, PR-2 / Phase 3, PR-3 / Phase 4, PR-4 / Phase 5 |
| `apps/node/src/cli/` | New host-artifact and operator-download surfaces; expanded install remediation command flow | PR-1 / Phases 1-2, PR-2 / Phase 3, PR-3 / Phase 4 |
| `apps/node/src/domain/doctor/` | CLI-owned remediation policy and multi-device handling | PR-3 / Phase 4 |
| `apps/node/src/domain/device/` | Reuse existing operator setup behavior; only additive helper work if required | PR-2 / Phase 3, PR-3 / Phase 4 |
| `apps/node/src/test/` | Unit or integration coverage for each new CLI surface | PR-1 / Phases 1-2, PR-2 / Phase 3, PR-3 / Phase 4 |
| `docs/` | Authored docs for install flow and upgrade guidance | PR-4 / Phase 5 |
| `apps/node/bundled-skills/clawperator-upgrade/` | CLI-first upgrade flow, fallback to `install.sh` only for environment recovery | PR-4 / Phase 5 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Installer findings and migration rationale | `tasks/install/cleanup/findings.md` |
| Current installer behavior | `sites/landing/public/install.sh` |
| Installer validation maintenance rule | `validation/install/README.md` |
| CLI commands, help text, and aliases | `apps/node/src/cli/registry.ts` |
| Current `doctor` command behavior | `apps/node/src/cli/commands/doctor.ts`, `apps/node/src/domain/doctor/DoctorService.ts` |
| Current operator setup behavior | `apps/node/src/cli/commands/operatorSetup.ts`, `apps/node/src/domain/device/setupOperator.ts` |
| Current bundled-skills install behavior | `apps/node/src/cli/commands/bundledSkills.ts` |
| Current runtime-skills registry fallback behavior | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Current upgrade skill | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`, `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` |
| Docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Keep `install.sh` as the public bootstrap entrypoint. This task does not
  replace it.
- Bootstrap prerequisite logic stays in shell:
  - OS validation
  - Java provisioning
  - Node provisioning
  - adb, git, curl checks
  - `npm install -g clawperator@latest`
- Post-bootstrap product logic moves into the CLI in this order:
  1. host artifact generation
  2. operator APK download and checksum verification
  3. doctor-driven remediation and multi-device policy
  4. shell RC mutation cleanup and upgrade-skill follow-through
- Each phase that removes shell logic must add the replacement CLI or
  integration coverage in the same phase. Do not defer tests.
- `clawperator-upgrade` must not switch to a CLI-first path until the CLI
  surfaces it needs actually exist. Before that point, keep it unchanged.
- The final upgrade decision tree is:
  1. check whether the CLI is reachable
  2. if reachable, use the CLI-first upgrade sequence
  3. if not reachable, use `install.sh` as recovery
- Do not mutate shell RC files by default for
  `CLAWPERATOR_SKILLS_REGISTRY` once the CLI-installed-home fallback remains
  the canonical behavior.

**Judgment required:**

- Exact CLI nouning for the new surfaces, as long as they remain consistent
  with the findings and existing CLI structure
- Whether shell RC mutation is deleted outright or retained behind an explicit
  opt-in flag or env var
- The smallest authored docs set needed in Phase 5 to keep install and upgrade
  guidance truthful without sprawling docs IA changes

## Decision Rules

| Question | Rule |
| --- | --- |
| Should host artifact writers move before remediation policy? | Yes. Phase 1 and Phase 2 go first because they are high leverage and lower risk than policy migration. |
| Should APK download move before doctor-policy migration? | Yes. The reusable `operator download` surface must exist before Phase 4 wires it as a `kind: "shell"` fix step. |
| Should multi-device remediation stay in shell once CLI-owned? | No. Phase 4 moves the policy into the CLI and removes the shell-side second policy engine. |
| What is the multi-device remediation CLI surface shape? | Add a new `clawperator install remediate` command (or equivalent under `install` group) that enumerates connected devices and applies per-device `operator download` + `doctor --fix --device <id>`. Do not extend `doctor --fix` for multi-device; `doctor` is single-device by contract. |
| What does `doctor --fix` do today? | `DoctorService.finalize()` runs `kind: "shell"` fix steps when `autoFix` is true. For `readiness.apk.presence` fail, there is one `kind: "shell"` step (`operator setup`) but the preceding download step is `kind: "manual"` and is not executed. Phase 3 adds `operator download` and Phase 4 changes the download step to `kind: "shell"` so `--fix` can complete APK setup without manual intervention. |
| What happens to `validation/install/` when behavior moves? | Replace shell-branch coverage with CLI or integration coverage in the same phase. Do not leave a gap. |
| When should `clawperator-upgrade` change? | Only in Phase 5 after the CLI-first upgrade sequence is real. Do one coordinated update in Phase 5 rather than partial updates after each prior phase, to avoid agents mixing old and new guidance. |
| What should the upgrade skill do after this task? | Use CLI-first upgrade when the CLI is reachable; fall back to `install.sh` only for environment repair. |
| How should docs be updated? | Use `.agents/skills/docs-author/SKILL.md` in Phase 5. Do not edit generated docs directly. |
| What happens if findings and implementation reality diverge? | Append a dated `## Execution Notes` section to `tasks/install/cleanup/findings.md` before the phase commit. |
| Should shell RC mutation for `CLAWPERATOR_SKILLS_REGISTRY` be removed? | Yes, but only after confirming `docs/setup.md` documents the installed-home fallback path (`~/.clawperator/skills/skills/skills-registry.json`) as the supported default. Fix docs first if they still say to set the env var. |

## Failure Modes To Prevent

- moving shell logic into the CLI without replacing the validation that proved
  it
- leaving two policy engines in place, with shell still parsing internal doctor
  check ids after the CLI migration
- introducing CLI upgrade guidance before the new CLI surfaces exist
- deleting shell RC mutation without confirming the installed-home registry
  fallback remains the documented and tested default
- editing generated docs rather than authored sources
- turning this task into a Python rewrite instead of a shell-thinning migration
- changing bootstrap prerequisite behavior when the goal is to move
  post-bootstrap product logic

## Output Contract

After PR-1:

- a CLI-owned host-artifact surface exists
- `install.sh` delegates artifact generation to the CLI
- artifact-writing logic no longer lives in large embedded Node heredocs inside
  `install.sh`

After PR-2:

- a CLI-owned operator APK download or fetch surface exists
- `install.sh` no longer owns metadata parsing and checksum verification

After PR-3:

- a new `clawperator install remediate` command (or equivalent) owns
  multi-device install policy; `install.sh` calls it instead of looping
- `readiness.apk.presence` `kind: "shell"` fix steps include `operator download`
  so `doctor --fix --device <id>` completes APK setup end-to-end
- `readiness.handshake` fail includes a `kind: "shell"` fix step for
  `grant-device-permissions` so `doctor --fix` handles permission recovery
- `install.sh` no longer re-parses `doctor --json` check ids to make product
  decisions

After PR-4:

- shell RC mutation for `CLAWPERATOR_SKILLS_REGISTRY` is removed or clearly
  opt-in only
- public docs describe the CLI-first install and upgrade behavior truthfully
- `clawperator-upgrade` uses the CLI-first sequence when the CLI is reachable
  and treats `install.sh` as recovery-only

## Idempotency

- re-running the new host-artifact command is safe and updates files in place
  without duplicate marker blocks
- re-running operator download is safe and leaves a verified local artifact
  state
- re-running remediation is safe and reports the current device state without
  duplicating setup side effects beyond the existing idempotent operator setup
  semantics
- re-running the installer after the migration remains safe because the shell
  bootstrap delegates to idempotent CLI surfaces

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Installer bootstrap vs CLI ownership split | `sites/landing/public/install.sh`, `validation/install/README.md`, authored install docs in `docs/` |
| Host artifact generation contract | `apps/node/src/cli/` plus source-owned helpers in `apps/node/src/domain/` |
| Operator artifact download contract | `apps/node/src/cli/` and related domain helpers |
| Upgrade path and recovery path | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`, its `agents/openai.yaml`, and authored install or upgrade docs in `docs/` |
