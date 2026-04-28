# Fix OpenClaw Discovery of Clawperator Bundled Host-Agent Skills

## Executive Summary

Clawperator installs first-party bundled host-agent skills by placing symlinks in
`~/.agents/skills` that point to `~/.clawperator/bundled-skills`. OpenClaw rejects these
symlinks because they resolve outside the `~/.agents/skills` root (symlink-escape policy).
All four bundled skills - `clawperator-agent-orientation`, `clawperator-upgrade`,
`clawperator-skill-author-by-agent-discovery`, and `clawperator-skill-author-by-recording` -
are currently invisible to OpenClaw agents. This is 1 PR, 4 phases. The implementing agent
must verify the issue, investigate available fix vectors, and select one before writing any
code.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships, running `openclaw skills list --eligible` on a machine with
Clawperator installed should discover all four bundled host-agent skills without
`reason=symlink-escape` warnings. Each skill should be visible to `openclaw skills info`
and callable as an AgentSkill. The fix must hold after a fresh install and after an upgrade
via `clawperator bundled-skills update`.

## Why Now

The bundled skills are the intended first-party guided workflows for OpenClaw agents using
Clawperator. The docs and CLI help text direct OpenClaw agents to start with these skills for
orientation, upgrade, and discovery routing. That guidance is broken because OpenClaw cannot
see the installed skills.

## In Scope

- Determine the best fix for OpenClaw discovery of Clawperator bundled skills.
- Implement the fix in `apps/node/src/domain/skills/copyBundledSkills.ts` and related
  Node surfaces.
- Update `apps/node/src/test/unit/bundledSkills.test.ts` to assert the new install
  behavior.
- Update `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` if the upgrade
  skill's workflow needs to handle any post-fix recovery state.
- Update `docs/skills/authoring.md` install-model table if the `~/.agents/skills`
  install strategy changes.
- Regenerate `sites/docs/.build/` and run `./scripts/docs_build.sh` when authored
  docs change.
- Validate on a real host that has Clawperator installed and OpenClaw reachable.

## Out of Scope

- Changes to OpenClaw's symlink policy or source code (unless investigation confirms
  OpenClaw has a supported, stable config path for adding extra skill source dirs that
  Clawperator's install can wire up without forking OpenClaw).
- Changes to how Claude Code or Codex discover bundled skills. Both already work via
  symlinks.
- Removing or replacing the `~/.clawperator/bundled-skills` canonical install store.
- Runtime Clawperator skills under `~/.clawperator/skills/` (separate surface).
- New bundled skills not already in `apps/node/bundled-skills/`.

## Existing Artifact Scope

- `apps/node/src/domain/skills/copyBundledSkills.ts`: in scope for the agent-discovery
  dir install strategy; preserve existing logic for `claudeSkillsDir` and `codexSkillsDir`.
- `apps/node/src/test/unit/bundledSkills.test.ts`: in scope for updating assertions that
  reflect the new agents-discovery-dir behavior; preserve existing Claude/Codex symlink
  assertions unless the fix changes those surfaces too.
- `docs/skills/authoring.md`: in scope only for the install-model table row describing
  `~/.agents/skills`; do not rewrite the whole doc.
- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`: in scope only if the upgrade
  workflow needs to explicitly handle users who have the old broken symlink state.

## Surfaces and Ownership

| Surface | What may change | Why |
| --- | --- | --- |
| `apps/node/src/domain/skills/copyBundledSkills.ts` | agents-dir install strategy | Core fix: change how the `~/.agents/skills` entries are created |
| `apps/node/src/test/unit/bundledSkills.test.ts` | assertions for agents dir behavior | Tests must reflect actual new behavior |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | upgrade workflow notes | May need recovery step if existing symlinks must be replaced |
| `docs/skills/authoring.md` | install-model table | If `~/.agents/skills` row description changes |
| `sites/landing/public/install.sh` | no change expected | Delegates to `clawperator install`; no direct symlink logic |

## Source Of Truth

Read code, not docs, for authoritative behavior. If anything conflicts, the code is correct.

| Topic | Verify against |
| --- | --- |
| Current bundled-skills install logic | `apps/node/src/domain/skills/copyBundledSkills.ts` |
| Current test coverage for install | `apps/node/src/test/unit/bundledSkills.test.ts` |
| CLI command registry and help text | `apps/node/src/cli/registry.ts` |
| Bundled-skills CLI command | `apps/node/src/cli/commands/bundledSkills.ts` |
| Current install.sh flow | `sites/landing/public/install.sh` |
| Observed OpenClaw error messages | Phase 1 live commands (not docs) |
| OpenClaw skill source config | `openclaw config --help`, `openclaw skills --help`, OpenClaw docs |
| Authored public docs on install model | `docs/skills/authoring.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- The canonical bundled-skills store remains `~/.clawperator/bundled-skills`. Do not
  change this.
- Claude Code and Codex discovery dirs continue to receive symlinks unless the
  investigation in Phase 1 proves a reason to change them. Do not change them without
  evidence.
- All four bundled skills must be discoverable by OpenClaw after the fix. Partial
  discovery is not acceptable.
- Unit tests are the primary verification gate. Live OpenClaw verification is a
  supplemental check that requires a working OpenClaw install on the host.
- One solution must be chosen before any code is written. Do not implement multiple
  solutions in parallel and pick later.
- `install.sh` delegates post-bootstrap setup to `clawperator install`. Do not add
  direct symlink or copy logic to `install.sh`.

**Judgment required:**

- Which fix vector to use - copying vs. OpenClaw config vs. another approach - based on
  Phase 1 investigation evidence.
- Whether the agents-dir strategy should use a single unified approach or whether the
  code should explicitly branch between per-runtime strategies (e.g., symlinks for Claude
  and Codex, copies for generic agents).
- Whether `clawperator-upgrade/SKILL.md` needs a recovery path for existing users whose
  `~/.agents/skills` entries are currently broken symlinks.

## Decision Rules

| Question | Rule |
| --- | --- |
| Does OpenClaw support a configurable extra skill source dir? | Check Phase 1 findings. If yes and stable, prefer that over changing Clawperator's install strategy. If no, use the copy approach. |
| Should the agents dir use copies or symlinks? | Use copies if the chosen fix is "change Clawperator install strategy." Do not use symlinks for `~/.agents/skills` entries if the investigation confirms they are the root cause of OpenClaw rejection. |
| What should happen to existing broken symlinks in `~/.agents/skills`? | `copyBundledSkills` already handles replacing managed symlinks. If the fix replaces symlinks with real directories, add explicit handling to remove stale symlinks and replace with directories. |
| Should the fix require OpenClaw changes? | Only if Phase 1 reveals a stable, Clawperator-controlled config path (e.g., `openclaw skills add-source ~/.clawperator/bundled-skills`). Do not depend on changes to OpenClaw that Clawperator cannot ship unilaterally. |
| Do upgrade users need a recovery step? | Yes if the existing `~/.agents/skills` entries are symlinks that need to be replaced with directories. `copyBundledSkills` runs on `clawperator bundled-skills update`; ensure the update path handles the transition. |

## Failure Modes To Prevent

- Fix is implemented only in one direction (e.g., code changed but tests still assert
  old symlink behavior) causing false-green test runs.
- Fix is validated only with live OpenClaw commands and not with unit tests; the fix
  then silently regresses when the Node build changes.
- OpenClaw config path is wired into `install.sh` directly, bypassing the CLI.
- The fix changes `claudeSkillsDir` or `codexSkillsDir` behavior when those surfaces
  already work correctly.
- `docs/skills/authoring.md` install-model table still describes `~/.agents/skills`
  as receiving symlinks when the fix switches to copies.
- Existing broken symlinks in `~/.agents/skills` are not cleaned up by
  `bundled-skills update`, leaving upgrade users in a partially broken state.
- The fix relies on `~/.agents/skills` being writable without verifying that case.
  The `copyBundledSkills` function already guards against overwriting non-Clawperator
  entries; keep that guard in place.

## Output Contract

After this task:

- `openclaw skills list --eligible --json 2>&1` produces no `reason=symlink-escape`
  lines for any of the four Clawperator bundled skills.
- `openclaw skills info clawperator-agent-orientation` returns the skill as found
  and ready (or reports only real missing-tool readiness issues, not a not-found error).
- `openclaw skills info clawperator-upgrade` same as above.
- `openclaw skills info clawperator-skill-author-by-agent-discovery` same as above.
- `openclaw skills info clawperator-skill-author-by-recording` same as above.
- `clawperator bundled-skills list` still returns all four skills.
- `clawperator doctor` still passes `host.bundled-skills.staleness` without warnings.
- `npm --prefix apps/node run build && npm --prefix apps/node run test` passes.
- `./scripts/docs_build.sh` passes.

## Idempotency

- Running `clawperator bundled-skills install` or `clawperator bundled-skills update`
  a second time on an already-fixed host must produce the same result as the first run.
- If the fix uses real directories in `~/.agents/skills`, the update path must cleanly
  remove any old managed-symlink entries before placing the new directory entries.
- The `copyBundledSkills` function's existing non-Clawperator-entry guard must continue
  to prevent overwriting user-managed entries in `~/.agents/skills`.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Install model for `~/.agents/skills` | `docs/skills/authoring.md` install-model table |
| OpenClaw compatibility note (if applicable) | `docs/skills/authoring.md` or `docs/internal/design/` |
| Node install behavior contract | `apps/node/src/domain/skills/copyBundledSkills.ts` and its tests |
| Upgrade recovery path (if applicable) | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` |
