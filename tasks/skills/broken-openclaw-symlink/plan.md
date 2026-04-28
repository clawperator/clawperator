# Fix OpenClaw Bundled Skill Discovery

## Executive Summary

Clawperator currently installs first-party bundled host-agent skills into `~/.agents/skills` as symlinks to the canonical `~/.clawperator/bundled-skills` store. OpenClaw rejects those symlinks as `symlink-escape`, so OpenClaw cannot discover `clawperator-agent-orientation`, `clawperator-upgrade`, `clawperator-skill-author-by-agent-discovery`, or `clawperator-skill-author-by-recording`.

This is a one-PR, three-phase task. The primary fix belongs in the Node bundled-skills install/update path, because `install.sh` delegates post-bootstrap setup to `clawperator install`, and `clawperator install` delegates bundled-skill wiring to `copyBundledSkills`.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | 0 |
| Remaining | 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After a fresh install, upgrade, or `clawperator bundled-skills update`, OpenClaw must discover the packaged Clawperator bundled host-agent skills through its `~/.agents/skills` scan without `symlink-escape` warnings.

## Why Now

OpenClaw is a supported host-agent surface for using Clawperator. The current Clawperator install model makes the generic agents discovery entries symlinks, while OpenClaw intentionally rejects symlink targets outside the configured `~/.agents/skills` root. That leaves first-party Clawperator orientation, upgrade, discovery, and recording skills invisible to OpenClaw even though they are installed correctly in the canonical Clawperator store.

## In Scope

- Verify the OpenClaw discovery failure before changing code.
- Change Clawperator's bundled-skills install/update behavior so `~/.agents/skills/<skill>` becomes an OpenClaw-discoverable real directory for Clawperator-managed bundled skills.
- Preserve the canonical store at `~/.clawperator/bundled-skills`.
- Preserve Claude Code and Codex discovery behavior unless code evidence proves their symlink model is also incompatible.
- Update `clawperator install`, `clawperator bundled-skills install`, and `clawperator bundled-skills update` behavior through their shared `copyBundledSkills` implementation.
- Update doctor staleness checks so the generic agents discovery directory is validated as a managed copy, not as a managed symlink.
- Update tests that currently assert symlinks under `~/.agents/skills`.
- Update public and internal docs that describe the install model.
- Check whether `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` needs any wording change because it names `clawperator install` as the canonical upgrade route.

## Out of Scope

- Changing OpenClaw's symlink security policy.
- Adding a new OpenClaw config source for `~/.clawperator/bundled-skills`.
- Mirroring runtime skills from `~/.clawperator/skills` into shared agent skill directories.
- Changing the packaged bundled skill set or the behavior of the orientation, discovery, or recording workflows except for documentation needed to keep upgrade guidance accurate.
- Rewriting `install.sh` to duplicate bundled-skills installation logic.

## Existing Artifact Scope

This task edits an existing installation contract and existing task folder:

| Artifact | Scope |
| --- | --- |
| `tasks/skills/broken-openclaw-symlink/problem-summary.md` | Preserve as the observed-problem record. Update only if later verification disproves a stated fact. |
| `apps/node/src/domain/skills/copyBundledSkills.ts` | In scope for changing generic agents discovery wiring and managed-entry detection. |
| `apps/node/src/domain/doctor/checks/hostChecks.ts` | In scope for changing staleness validation to match the new managed-copy contract. |
| `sites/landing/public/install.sh` | Inspect and validate. Change only if it no longer delegates correctly to `clawperator install` or its output needs repair. |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Inspect and update only if the upgrade route or next-step language becomes inaccurate. |
| `docs/` and `docs/internal/design/` | Update authored source docs that describe bundled-skill install surfaces. Do not edit generated docs directly. |

## Surfaces and Ownership

| Surface | Owner | Expected change |
| --- | --- | --- |
| Node bundled-skills installer | `apps/node/src/domain/skills/copyBundledSkills.ts` | Primary behavior change. Install managed real directories into generic agents discovery while keeping the canonical store. |
| Node CLI install flow | `apps/node/src/cli/commands/install.ts` | Usually no direct behavior change. Validate that `clawperator install` still calls `copyBundledSkills`. |
| Doctor staleness check | `apps/node/src/domain/doctor/checks/hostChecks.ts` | Validate symlinks for Claude and Codex, but validate managed copies for generic agents. |
| Public installer | `sites/landing/public/install.sh` | Should remain bootstrap-only and delegate to `clawperator install`. Update only if validation proves a gap. |
| Upgrade skill | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Ensure it still routes upgrades through `npm install -g clawperator@latest`, `clawperator install`, and `clawperator doctor`. |
| Public docs | `docs/skills/authoring.md`, `docs/skills/overview.md`, `docs/setup.md`, `docs/host-agents.md`, `docs/api/doctor.md` | Update wording from "generic agents symlinks" to the shipped behavior. |
| Internal docs | `docs/internal/design/agent-host-integration.md`, `docs/internal/design/installer-architecture.md` | Keep durable installer and host-agent integration guidance aligned. |

## Source Of Truth

| Claim | Verify against |
| --- | --- |
| `install.sh` owns bootstrap and delegates post-bootstrap setup | `sites/landing/public/install.sh` |
| `clawperator install` sequences bundled-skills install | `apps/node/src/cli/commands/install.ts` |
| Bundled-skills source, install, discovery wiring, and cleanup behavior | `apps/node/src/domain/skills/copyBundledSkills.ts` |
| Bundled-skills CLI help and command names | `apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/bundledSkills.ts` |
| Doctor staleness semantics | `apps/node/src/domain/doctor/checks/hostChecks.ts` |
| Existing unit coverage | `apps/node/src/test/unit/bundledSkills.test.ts`, `apps/node/src/test/unit/doctor/hostChecks.test.ts`, `apps/node/src/test/unit/installCommand.test.ts`, `apps/node/src/test/unit/cliHelp.test.ts` |
| Packaged bundled skill content | `apps/node/bundled-skills/` |
| Authored public docs | `docs/` |
| Authored internal docs | `docs/internal/design/` |
| Current OpenClaw failure | live `openclaw skills info <skill>` commands on a host with the broken state |

## Deterministic Versus Judgment

| Area | Type | Rule |
| --- | --- | --- |
| Owning surface | deterministic | Fix Clawperator's installer contract. Do not require an OpenClaw code change for this task. |
| Fresh install path | deterministic | `install.sh` delegates to `clawperator install`; `clawperator install` calls `copyBundledSkills`; therefore the shared installer function must carry the fix. |
| Generic agents discovery target | deterministic | `~/.agents/skills/<skill>` must be a real directory after the fix, because OpenClaw rejects symlink targets outside `~/.agents/skills`. |
| Claude and Codex targets | deterministic unless disproved | Keep managed symlinks unless tests or runtime evidence show incompatibility. |
| Conflict handling | deterministic | Never overwrite a non-Clawperator user-managed skill entry. Only replace entries positively identified as Clawperator-managed symlinks or Clawperator-managed copies. |
| Upgrade-skill wording | judgment | Update only if the existing text becomes inaccurate after code changes. |
| Docs wording | judgment | Keep concise, present-state, and aligned with code. |

## Decision Rules

Use this first-match-wins table when implementing:

| Condition | Required action |
| --- | --- |
| Existing `~/.agents/skills/<skill>` is a Clawperator-managed symlink to the canonical store | Replace it with a real directory copy from the canonical installed skill. |
| Existing `~/.agents/skills/<skill>` is a Clawperator-managed directory copy | Refresh it from the current packaged bundled skill. |
| Existing `~/.agents/skills/<skill>` is missing | Create a real directory copy. |
| Existing `~/.agents/skills/<skill>` is a non-Clawperator file, directory, or symlink | Fail the bundled-skills install/update with a conflict, preserving the user entry. |
| Existing Claude or Codex discovery entry is a Clawperator-managed symlink | Refresh it as a symlink to the canonical store. |
| Existing Claude or Codex discovery entry is non-Clawperator-managed | Fail the bundled-skills install/update with a conflict, preserving the user entry. |
| Packaged bundled skill was removed from the source set | Remove only stale Clawperator-managed entries from the canonical store and discovery dirs. Preserve unrelated user entries. |

## Failure Modes To Prevent

- OpenClaw still logs `reason=symlink-escape` for Clawperator bundled skills after install or update.
- `clawperator install` succeeds but leaves OpenClaw unable to discover the bundled skills.
- The fix duplicates installer logic in `install.sh` instead of keeping the CLI-owned post-bootstrap contract.
- The generic agents copy drifts from the canonical bundled-skill store on update.
- A user-managed skill in `~/.agents/skills` is overwritten because it happens to share a bundled skill name.
- Doctor reports stale or healthy state using the old symlink-only contract.
- Docs continue to say that `~/.agents/skills` receives symlinks after the behavior changes.
- Tests only assert filesystem shape and do not prove the stale symlink repair path.

## Output Contract

After implementation, the following must be true:

- `clawperator bundled-skills install` and `clawperator bundled-skills update` create or refresh canonical bundled skills in `~/.clawperator/bundled-skills`.
- Claude and Codex discovery entries keep their managed symlink behavior unless explicitly changed with evidence.
- Generic agents discovery entries under `~/.agents/skills` are real directories containing the packaged skill content.
- Existing managed symlink entries under `~/.agents/skills` are repaired into real directories on rerun.
- Doctor treats the new generic agents managed-copy state as healthy.
- OpenClaw can resolve the four packaged bundled skills by name through `openclaw skills info`.

## Idempotency

Rerunning `clawperator install`, `clawperator bundled-skills install`, or `clawperator bundled-skills update` must:

- leave the canonical bundled-skills store aligned with packaged source
- refresh Clawperator-managed generic agents copies in place
- preserve unrelated user entries in shared discovery dirs
- remove stale Clawperator-managed entries for packaged skills that no longer exist
- return the same installed skill list and discovery-dir metadata for repeated runs with the same inputs

## Durable Follow-Up

When the task is complete, durable knowledge must live in these authored sources:

- `docs/skills/authoring.md` for bundled-skill installation and repair behavior
- `docs/skills/overview.md` for the high-level distinction between runtime skills and bundled host-agent skills
- `docs/setup.md` for post-install user-visible setup behavior
- `docs/host-agents.md` for host-agent front-door guidance
- `docs/api/doctor.md` for `host.bundled-skills.staleness`
- `docs/internal/design/agent-host-integration.md` and `docs/internal/design/installer-architecture.md` for engineering ownership boundaries

The task folder remains temporary. Do not treat it as final documentation.
