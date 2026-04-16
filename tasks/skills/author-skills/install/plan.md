# Authoring Skills Install and Discovery

## Executive Summary

Ships install, distribution, discovery, and lifecycle management for first-party
Clawperator authoring skills. Two PRs, five phases. PR-1 delivers the Node
foundation: SKILL.md portability fix plus npm package scaffolding (Phase 1) and
the Node CLI implementation with unit tests (Phase 2). PR-2 delivers the product
wiring: install.sh integration (Phase 3), doctor staleness check (Phase 4), and
public docs updates (Phase 5). All five phases are complete.

## Status

| Item | Value |
| --- | --- |
| State | Complete |
| Total PRs | 2 |
| Total phases | 5 |
| Completed | 1, 2, 3, 4, 5 |
| Remaining | none |
| Current / Next | complete |
| Blockers | none |

## Goal

After this task ships, a user who runs `curl -fsSL https://clawperator.com/install.sh | bash`
gets first-party Clawperator authoring skills wired into Claude Code and Codex
discovery locations automatically - no separate manual install step required.

## Why Now

`skill-author-by-recording` is live and documented as the preferred front door
for recording-driven skill authoring, but `install.sh` does not install or wire
it. The skill only works today when an agent session runs from inside the
clawperator repo. This task closes that gap.

See `tasks/skills/author-skills/install/problem-summary.md` for full background.

## In Scope

- Fix `skill-author-by-recording/SKILL.md` to replace repo-local "Required Reading"
  paths with portable published URLs (prerequisite for global install)
- Create `apps/node/authoring-skills/` symlink directory for npm packaging
- Add `"authoring-skills/"` to `apps/node/package.json` files array
- Add `DEFAULT_AUTHORING_SKILLS_DIR` constant to `skillsConfig.ts`
- New `apps/node/src/domain/skills/copyAuthoringSkills.ts` module
- New `apps/node/src/cli/commands/authoringSkills.ts` with `install`, `update`,
  `list` subcommands
- Register `authoring-skills` command group in `registry.ts`
- Unit tests for the new domain module and CLI command
- Add `setup_authoring_skills_via_cli()` to `sites/landing/public/install.sh`
- Update the `~/.clawperator/AGENTS.md` template in `install.sh`
- Add a doctor check for authoring-skills staleness in `DoctorService`
- Update `docs/skills/authoring.md` with an install section
- Update `docs/skills/overview.md` to clarify runtime vs authoring skills
- Regenerate `sites/docs/.build/` and validate with `./scripts/docs_build.sh`

## Out of Scope

- Automatic npm post-install hook that triggers `authoring-skills update` on
  CLI upgrade (deferred per problem-summary.md)
- Adding a second authoring skill (only `skill-author-by-recording` exists)
- Publishing new docs pages for `.ts` contract files (use GitHub URLs)
- Any runtime skills changes

## Existing Artifact Scope

- `SKILL.md`: "Required Reading" section rewritten with portable URLs; all other
  content preserved as-is
- `skillsConfig.ts`: one constant appended; no existing code changed
- `registry.ts`: one command group registered; existing registrations unchanged
- `DoctorService.ts`: one check added to the host checks block; existing checks
  unchanged
- `install.sh`: one function added after `setup_skills_via_cli()`; AGENTS.md
  template section added; final summary updated; no existing logic removed
- `docs/skills/authoring.md`: "Authoring Skills Install" section added; existing
  content preserved
- `docs/skills/overview.md`: clarification paragraph added to the skills category
  distinction; existing content preserved

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `.agents/skills/skill-author-by-recording/SKILL.md` | Required Reading paths | Phase 1 |
| `apps/node/authoring-skills/` | New symlink directory | Phase 1 |
| `apps/node/package.json` | Add `"authoring-skills/"` to files | Phase 1 |
| `apps/node/src/domain/skills/skillsConfig.ts` | Add `DEFAULT_AUTHORING_SKILLS_DIR` | Phase 2 |
| `apps/node/src/domain/skills/copyAuthoringSkills.ts` | New module | Phase 2 |
| `apps/node/src/cli/commands/authoringSkills.ts` | New CLI command | Phase 2 |
| `apps/node/src/cli/registry.ts` | Register command group | Phase 2 |
| `apps/node/src/test/unit/` | New unit tests | Phase 2, 4 |
| `sites/landing/public/install.sh` | Add authoring-skills step | Phase 3 |
| `apps/node/src/domain/doctor/` | Staleness check | Phase 4 |
| `docs/skills/authoring.md` | Install section | Phase 5 |
| `docs/skills/overview.md` | Category clarification | Phase 5 |
| `sites/docs/.build/` | Regenerated output | Phase 5 |

## Source of Truth

| Topic | Verify against |
| --- | --- |
| CLI command registration pattern | `apps/node/src/cli/registry.ts` |
| Existing skills config constants | `apps/node/src/domain/skills/skillsConfig.ts` |
| Doctor check result shape | `apps/node/src/contracts/doctor.ts` |
| Doctor check registration | `apps/node/src/domain/doctor/DoctorService.ts` |
| Doctor check pattern | `apps/node/src/domain/doctor/checks/hostChecks.ts` |
| Doctor docs URLs | `apps/node/src/domain/doctor/docsUrls.ts` |
| CLI command pattern | `apps/node/src/cli/commands/skills.ts` |
| Test patterns | `apps/node/src/test/unit/skills.test.ts` |
| npm files field | `apps/node/package.json` |
| install.sh function pattern | `sites/landing/public/install.sh` |
| Published docs URL structure | `sites/docs/mkdocs.yml` |
| Docs authored source | `docs/skills/authoring.md`, `docs/skills/overview.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- The two-layer model: copies to `~/.clawperator/authoring-skills/`, symlinks to
  agent dirs. This is decided. Use it exactly.
- Copies (not symlinks) from npm package to `~/.clawperator/authoring-skills/`.
  Reason: nvm version switches change npm global prefix, breaking symlinks.
- Symlinks (not copies) from agent dirs into `~/.clawperator/authoring-skills/`.
  Reason: `authoring-skills update` only needs to refresh the canonical store.
- Agent discovery paths: `~/.claude/skills/` for Claude Code, `$CODEX_HOME/skills`
  (default `~/.codex/skills/`) for Codex.
- Unconditional directory creation: create `~/.claude/skills/` and
  `$CODEX_HOME/skills` (if `CODEX_HOME` is set) else `~/.codex/skills/`, even if
  the agent is not installed. Reason: agent-install ordering edge case - user
  installs Clawperator before the agent.
- Skill discovery from npm package: scan for subdirectories containing `SKILL.md`.
  No manifest file is needed.
- `version.txt` written alongside installed skills; content is the CLI version
  string.
- `install.sh` calls `clawperator authoring-skills install` and delegates all
  logic. It does not duplicate directory creation or symlink logic.

**Judgment required:**

- Exact URL strings for docs pages: verify against `sites/docs/mkdocs.yml` before
  writing them into `SKILL.md`.
- Where to place the doctor check in `DoctorService.ts`: after host checks, before
  device checks. Verify against current check ordering in `DoctorService.ts`.
- Whether `docs/internal/design/skill-design.md` is published to the docs site:
  check `sites/docs/mkdocs.yml`. If not published, use a GitHub main-branch URL.

## Decision Rules

**URL replacement table for SKILL.md Required Reading:**

| Current path | Replacement approach |
| --- | --- |
| `docs/api/recording.md` | `https://docs.clawperator.com/...` - verify nav key in `sites/docs/mkdocs.yml` |
| `docs/skills/authoring.md` | `https://docs.clawperator.com/...` - verify nav key in `sites/docs/mkdocs.yml` |
| `docs/skills/overview.md` | `https://docs.clawperator.com/...` - verify nav key in `sites/docs/mkdocs.yml` |
| `docs/internal/design/skill-design.md` | Check `sites/docs/mkdocs.yml`. If not in nav, use `https://github.com/clawperator/clawperator/blob/main/docs/internal/design/skill-design.md` |
| `apps/node/src/contracts/skillResult.ts` | `https://github.com/clawperator/clawperator/blob/main/apps/node/src/contracts/skillResult.ts` |
| `apps/node/src/domain/skills/runSkill.ts` | `https://github.com/clawperator/clawperator/blob/main/apps/node/src/domain/skills/runSkill.ts` |

**Doctor check result mapping:**

| State | Status | Fix suggestion |
| --- | --- | --- |
| `~/.clawperator/authoring-skills/` does not exist | `pass` (first install, not an error) | n/a |
| `version.txt` absent but skills dir present | `warn` | run `clawperator authoring-skills update` |
| `version.txt` matches CLI version | `pass` | n/a |
| `version.txt` differs from CLI version | `warn` | run `clawperator authoring-skills update` |

**Symlink placement:**

| Agent | Discovery path | Env var | Default |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills/<skill-name>/` | none | `~/.claude/skills/` |
| Codex | `$CODEX_HOME/skills/<skill-name>/` | `CODEX_HOME` | `~/.codex/skills/` |

## Failure Modes to Prevent

- **Repo-local paths in globally installed SKILL.md.** The SKILL.md portability
  fix must be in Phase 1, before any wiring ships. Do not split it to a later
  phase.
- **Symlinks in wrong direction at canonical layer.** The npm package layer must
  use symlinks from `apps/node/authoring-skills/` back to `.agents/skills/`.
  The canonical store (`~/.clawperator/authoring-skills/`) must use copies, not
  symlinks, because nvm breaks npm-global-prefix symlinks.
- **install.sh duplicating wiring logic.** All logic lives in
  `clawperator authoring-skills install`. install.sh calls that command. Nothing
  else.
- **Conditional directory creation.** `~/.claude/skills/` and `$CODEX_HOME/skills`
  (if `CODEX_HOME` is set, else `~/.codex/skills/`) must be created
  unconditionally. Do not gate on agent presence.
- **Tests deferred past the phase that introduces behavior.** Phase 2 ships
  `copyAuthoringSkills.ts` and `authoringSkills.ts`; their tests ship in Phase 2.
  Phase 4 ships the doctor check; its tests ship in Phase 4.
- **Starting PR-2 before PR-1 merges.** install.sh calls `clawperator
  authoring-skills install`; that subcommand must exist in the published npm
  package before install.sh lands.

## Output Contract

After `install.sh` completes:

- `~/.clawperator/authoring-skills/skill-author-by-recording/` - skill files
  copied from npm package
- `~/.clawperator/authoring-skills/version.txt` - contains CLI version string
- `~/.claude/skills/skill-author-by-recording` - symlink to the canonical store
- `$CODEX_HOME/skills/skill-author-by-recording` (default `~/.codex/skills/skill-author-by-recording`) - symlink to the canonical store
- `~/.clawperator/AGENTS.md` - includes a section naming installed authoring
  skills and their paths

After `clawperator authoring-skills list`:

- Prints installed authoring skill names and their `SKILL.md` paths

After `clawperator doctor`:

- Reports `warn` if authoring skills are stale, with fix command
- Reports `pass` if up to date or not yet installed

## Idempotency

- `clawperator authoring-skills install` and `authoring-skills update` are safe
  to run multiple times. Re-running overwrites the canonical store and recreates
  symlinks.
- Running `install.sh` a second time is idempotent: the authoring-skills step
  calls the CLI command, which is idempotent.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Install model (two layers, canonical store + agent wiring) | `docs/skills/authoring.md` (Phase 5) |
| `clawperator authoring-skills` commands | `docs/skills/authoring.md` (Phase 5) |
| Runtime vs authoring skill distinction | `docs/skills/overview.md` (Phase 5) |
| Doctor check behavior | existing doctor docs surface (Phase 4 + 5) |

Delete `tasks/skills/author-skills/install/` after all five phases are complete
and both PRs are merged. Durable knowledge must be in `docs/` before deletion.
