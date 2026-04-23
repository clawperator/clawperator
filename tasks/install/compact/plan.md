# Install Compaction and Final Shell Collapse

## Executive Summary

Follow-on to the first installer-cleanup wave that landed on `main`. That work
successfully moved major product behavior into the Node CLI, but it did not
finish the job of shrinking `sites/landing/public/install.sh` and the
shell-heavy install validation harness down to a minimal bootstrap-and-delegate
shape.

This task ships in **2 PRs across 4 phases**. **PR-1** removes dead shell
installer code, moves the remaining shared-bridge warning policy fully into
Node output, and adds a new CLI-owned post-bootstrap install surface.
**PR-2** rewrites `install.sh` to delegate to that new CLI surface, deletes the
remaining shell-side JSON parsers and post-bootstrap state machine, then
realigns docs, validation guidance, and `clawperator-upgrade` to the new
compact installer model.

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

After this task ships:

- `install.sh` retains only the irreducible bootstrap work plus minimal
  delegation to a CLI-owned post-bootstrap install flow
- the canonical post-bootstrap orchestration surface is a top-level
  `clawperator install` command rather than shell sequencing of multiple
  commands
- shell-side JSON parsers, post-bootstrap arrays, and shell-owned installer
  summary logic are removed
- `validation/install/test*` proves only shell-owned bootstrap and delegation
  behavior, while Node tests own the detailed behavior that now lives in the
  CLI
- public docs and `clawperator-upgrade` describe the compact installer
  truthfully

## Why Now

The first-wave cleanup solved the right ownership problem but left the shell
too large. `install.sh` is still about 1431 lines, and the heavy shell test
harnesses remain large because the shell is still acting as a middleware layer
that parses JSON, threads state between CLI commands, and decides final
installer messaging.

This follow-on task exists to enforce the intended end state explicitly:
minimal shell, minimal shell tests, and CLI ownership of nearly all
post-bootstrap install behavior.

## In Scope

- remove dead post-bootstrap shell code that no longer participates in the real
  install path
- move the remaining shared-agent-bridge non-fatal warning semantics fully into
  Node-owned host-setup output
- add a CLI-owned post-bootstrap install surface at top-level
  `clawperator install`
- repurpose the existing `clawperator install` tombstone in
  `apps/node/src/cli/registry.ts` into the new command
- move post-bootstrap sequencing, result-state threading, and installer summary
  semantics into Node
- rewrite `sites/landing/public/install.sh` to delegate to the CLI-owned
  install surface after `install_cli`
- remove shell-side JSON parsing helpers and post-bootstrap shell state models
- shrink `validation/install/test*` so shell tests cover bootstrap and
  delegation only
- update authored docs and `apps/node/bundled-skills/clawperator-upgrade/` to
  the new canonical `clawperator install` flow

## Out of Scope

- replacing `install.sh` entirely with Python or another language
- changing bootstrap prerequisite ownership for OS, Java, Node, adb, git, or
  curl setup
- redesigning `operator download`, `operator remediate`, `host setup`,
  `skills install`, or `bundled-skills install` beyond what is required to let
  the new install surface orchestrate them
- changing Android runtime behavior
- changing sibling `../clawperator-skills`
- redesigning unrelated bundled skills beyond `clawperator-upgrade`

## Existing Artifact Scope

- `tasks/install/compact/recommendations.md`: authoritative input for this task
  pack. Preserve the current findings and recommendations as-is. If execution
  uncovers a material contradiction, append a dated `## Execution Notes`
  section to that file before the phase commit rather than rewriting its main
  sections.
- `sites/landing/public/install.sh`: in scope for post-bootstrap collapse only.
  Preserve the public bootstrap contract and irreducible prerequisite logic.
- `validation/install/`: in scope for deleting parser- and glue-focused shell
  coverage as the corresponding shell logic is removed. Do not leave behavior
  unproven between phases.
- `apps/node/bundled-skills/clawperator-upgrade/`: in scope only in the final
  phase once `clawperator install` exists and is the truthful canonical
  post-bootstrap route.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `sites/landing/public/install.sh` | Remove dead post-bootstrap code in PR-1 / Phase 1; collapse to bootstrap + `clawperator install` delegation in PR-2 / Phase 3 | Cross-surface task, shell wrapper |
| `validation/install/` | Remove parser- and glue-focused shell harnesses; keep only bootstrap/delegation proof | PR-1 / Phase 1, PR-2 / Phase 3, PR-2 / Phase 4 |
| `apps/node/src/cli/registry.ts` | Replace `install` tombstone with real CLI surface and update only the help or guidance text that becomes stale because of the new `clawperator install` route | PR-1 / Phase 2, PR-2 / Phase 4 |
| `apps/node/src/cli/commands/` | Add new post-bootstrap install command and supporting output contract | PR-1 / Phase 2 |
| `apps/node/src/domain/host/` | Move remaining shared-bridge warning semantics fully into Node-owned output | PR-1 / Phase 1, PR-1 / Phase 2 |
| `apps/node/src/test/` | Add unit or integration coverage for new install surface and moved summary logic | PR-1 / Phase 1, PR-1 / Phase 2, PR-2 / Phase 3 |
| `docs/` | Update only the authored install, host-agent, and upgrade-skill pages that still encode the superseded post-bootstrap or upgrade route once `clawperator install` lands | PR-2 / Phase 4 |
| `apps/node/bundled-skills/clawperator-upgrade/` | Update canonical upgrade sequence to call `clawperator install` | PR-2 / Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Canonical compaction recommendations | `tasks/install/compact/recommendations.md` |
| Current installer behavior | `sites/landing/public/install.sh` |
| Install validation maintenance rule | `validation/install/README.md` |
| Current CLI command structure and the `install` tombstone | `apps/node/src/cli/registry.ts` |
| Current CLI help and upgrade guidance text | `apps/node/src/cli/registry.ts` |
| Current host-setup behavior and non-fatal artifact semantics | `apps/node/src/domain/host/hostSetup.ts`, `apps/node/src/cli/commands/host.ts` |
| Current operator remediation flow | `apps/node/src/cli/commands/operatorRemediate.ts` |
| Current skills and bundled-skills install contracts | `apps/node/src/cli/commands/skills.ts`, `apps/node/src/cli/commands/bundledSkills.ts` |
| Current upgrade skill | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`, `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` |
| Authored docs that already describe the upgrade route | `docs/setup.md`, `docs/host-agents.md`, `docs/skills/authoring.md` |
| Docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Keep bootstrap prerequisite logic in shell. This task does not move OS,
  Java, Node, adb, git, curl, or npm-global-install ownership into Node.
- The canonical post-bootstrap route after `install_cli` becomes
  `clawperator install`.
- Repurpose the existing top-level `install` tombstone in `registry.ts`; do not
  create a second parallel installer namespace for the same role.
- Remove the dead `download_operator_apk_via_cli` path and its shell test
  coverage in the first PR.
- By the end of the task, shell-side JSON parsers for post-bootstrap CLI
  results should be gone from `install.sh`.
- By the end of the task, post-bootstrap shell arrays and branch-heavy summary
  logic should be gone from `install.sh`.
- `validation/install/test*` should prove only shell-owned bootstrap and
  delegation behavior after the compaction work lands. Detailed behavior proof
  belongs in Node tests.
- Public docs and `clawperator-upgrade` change only after `clawperator install`
  is real and is the truthful canonical post-bootstrap route.

**Judgment required:**

- The exact internal Node surface split for the new `clawperator install`
  implementation as long as the public contract stays stable
- Whether `clawperator install` should expose only a canonical command shape or
  also keep compatibility aliases for older installer-call patterns
- The smallest authored docs set required in the final phase to keep public
  guidance truthful without sprawling docs IA changes

## Decision Rules

| Question | Rule |
| --- | --- |
| What is the canonical post-bootstrap command after this task? | `clawperator install`. Shell should call this after `install_cli` instead of sequencing `operator remediate`, `skills install`, `bundled-skills install`, and `host setup` itself. |
| What should happen to `COMMANDS["install"]` in `registry.ts`? | Repurpose it from the current tombstone into the real post-bootstrap install command. Do not leave the tombstone in place and add a parallel command elsewhere. |
| What CLI help text is in scope to update? | Only help and guidance text in `registry.ts` that becomes stale because `clawperator install` replaces the old tombstone or old canonical post-bootstrap or upgrade route. Do not broaden this into unrelated CLI-help rewrites. |
| What should happen to the dead operator-download shell path? | Delete it in PR-1 / Phase 1 along with its parser helper and shell-only test coverage. |
| Where does shared-agent-bridge non-fatal policy live after this task? | In Node-owned host-setup output semantics. The shell should trust the CLI's exit status and pretty output rather than re-detecting the case. |
| What remains in shell permanently? | Bootstrap checks and provisioning, npm global install, minimal wrapper logic, top-level error handling, and shell-specific source hinting. |
| What shell parsers may survive at task end? | None for post-bootstrap CLI result interpretation. If a parser remains, append an Execution Note explaining why the CLI contract could not absorb it. |
| What is the target final shell budget? | `install.sh` should end the task close to the irreducible bootstrap core and should land at or below **700 lines**. If implementation cannot get below that threshold without leaving meaningful post-bootstrap logic in shell, stop and append an Execution Note before proceeding. |
| What is the target shell-heavy validation budget? | `validation/install/test_agent_skills.sh`, `test_main.sh`, and `test_multidevice.sh` should collectively shrink well below their current combined size and should no longer unit-test parser helpers or removed shell glue. |
| When do docs and upgrade skill change? | Only in PR-2 / Phase 4 after `clawperator install` exists and `install.sh` delegates to it. |
| What authored docs are in scope to update? | Only authored pages that, at execution time, still teach `install.sh` rerun, the old multi-command post-bootstrap route, or the superseded upgrade sequence. Start with `docs/setup.md`, `docs/host-agents.md`, and `docs/skills/authoring.md`, then include additional authored pages only if they actually encode that stale guidance. |

## Failure Modes To Prevent

- adding a new CLI install surface while leaving `install.sh` as a multi-step
  orchestrator
- keeping shell-side JSON parsers after the new install surface exists
- leaving dead operator-download shell code and tests in place
- shipping `clawperator install` while `registry.ts` help text still points
  users at the old tombstone or the old multi-command upgrade sequence
- moving bootstrap prerequisite logic into Node
- keeping both Node-owned and shell-owned versions of the shared-bridge warning
  policy
- shrinking `install.sh` but leaving shell tests large because they still prove
  removed parser/glue behavior
- updating only part of the authored docs surface while
  `docs/skills/authoring.md` or another published page still describes
  `clawperator-upgrade` as an `install.sh` rerun or spells out the superseded
  post-bootstrap sequence
- updating docs or `clawperator-upgrade` before `clawperator install` is the
  truthful canonical route
- landing this task with `install.sh` still materially above the stated shell
  budget without recording why

## Output Contract

After PR-1:

- dead `download_operator_apk_via_cli` shell code and its shell-only tests are
  removed
- shared-agent-bridge non-fatal warning semantics are fully Node-owned
- a real top-level `clawperator install` command exists and owns post-bootstrap
  sequencing and installer-facing result semantics
- Node tests prove the new install surface and moved summary logic

After PR-2:

- `install.sh` delegates post-bootstrap behavior to `clawperator install`
- post-bootstrap JSON parsers, shell state arrays, and branch-heavy summary
  logic are removed from `install.sh`
- `install.sh` lands at or below the target shell budget, or a dated
  Execution Note explains the exact justified residue
- shell validation harnesses prove bootstrap and delegation only
- public docs and `clawperator-upgrade` align to the `clawperator install`
  route

## Idempotency

- rerunning `clawperator install` is safe and reuses the underlying idempotent
  post-bootstrap surfaces (`operator remediate`, `skills install`,
  `bundled-skills install`, `host setup`)
- rerunning `install.sh` remains safe because the shell bootstrap delegates to
  idempotent CLI behavior
- rerunning reduced shell validation should not depend on parser-helper
  internals that no longer exist

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Canonical post-bootstrap install route | `apps/node/src/cli/registry.ts`, installer command implementation, `docs/setup.md` |
| Compact shell bootstrap expectations | `sites/landing/public/install.sh`, `validation/install/README.md` |
| Upgrade path and recovery path | `apps/node/src/cli/registry.ts`, `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`, its `agents/openai.yaml`, and authored install docs in `docs/` including `docs/skills/authoring.md` |
| Host-setup non-fatal artifact semantics | `apps/node/src/domain/host/hostSetup.ts` and adjacent Node tests |
