# Fix OpenClaw Bundled Skill Discovery Work Breakdown

Parent plan: `tasks/skills/broken-openclaw-symlink/plan.md`

## Executive Summary

One PR with three phases:

- Phase 1, `thinking`: verify the failure and lock the implementation contract.
- Phase 2, `default`: implement the Node bundled-skills installer, doctor, and tests.
- Phase 3, `default`: update docs, validate installer and OpenClaw behavior, and commit final cleanup.

The current state is planning. Do not start implementation until Phase 1 records live verification and confirms the code path.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | 0 |
| Remaining | 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Read the required files in order before editing code.
- Treat code as the source of truth. Do not rely on existing docs when code disagrees.
- Do not change OpenClaw in this task.
- Do not duplicate bundled-skills install logic in `install.sh`; keep post-bootstrap setup owned by `clawperator install`.
- Do not overwrite non-Clawperator entries in `~/.agents/skills`, `~/.claude/skills`, or the Codex skills dir.
- Do not remove Claude or Codex symlink behavior unless Phase 1 produces evidence that it is broken.
- Do not mirror runtime skills from `~/.clawperator/skills` into shared agent discovery dirs.
- Do not edit generated docs directly.
- If docs change, edit authored docs under `docs/` or `docs/internal/design/` and run the docs build.
- If installer behavior changes, add or update tests in the same phase as the code change.
- JSON is already the Clawperator CLI default. Do not add explicit JSON-output flags to Clawperator command snippets.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/skills/broken-openclaw-symlink/problem-summary.md` | Observed failure and affected skills. Verify it, do not assume it. |
| `tasks/skills/broken-openclaw-symlink/plan.md` | Stable contract, scope, and decision rules for this task. |
| `sites/landing/public/install.sh` | Proves whether the public installer delegates post-bootstrap setup to the CLI. |
| `apps/node/src/cli/commands/install.ts` | Shows that `clawperator install` calls the bundled-skills install function. |
| `apps/node/src/domain/skills/copyBundledSkills.ts` | Primary implementation surface for bundled-skill copying, symlink wiring, conflict handling, and stale cleanup. |
| `apps/node/src/domain/doctor/checks/hostChecks.ts` | Doctor currently validates discovery entries as symlinks and must align with the new contract. |
| `apps/node/src/cli/registry.ts` | CLI help text that may mention symlinks or install behavior. |
| `apps/node/src/test/unit/bundledSkills.test.ts` | Existing tests that assert `~/.agents/skills` symlink behavior. |
| `apps/node/src/test/unit/doctor/hostChecks.test.ts` | Existing tests for bundled-skills staleness checks. |
| `apps/node/src/test/unit/installCommand.test.ts` | Confirms `clawperator install` sequencing and output shape. |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Upgrade skill that tells agents how to refresh the whole product. |
| `docs/skills/authoring.md` | Public authored docs for bundled-skill install behavior. |
| `docs/internal/design/agent-host-integration.md` | Durable engineering guidance for host-agent discovery. |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Make Clawperator bundled skills discoverable to OpenClaw through the generic agents discovery dir | Phases 1, 2, 3 | thinking, default, default | none |

## Phase 1: Verify And Finalize Contract

### Agent Tier

thinking

### Goal

Confirm the OpenClaw failure and the Clawperator ownership boundary before implementation.

### Files or Surfaces To Change

- `tasks/skills/broken-openclaw-symlink/problem-summary.md` only if verification disproves or sharpens existing facts.
- No product code in this phase unless the task pack is found to be impossible to execute.

### Steps

1. Run live OpenClaw checks on the current host:

   ```bash
   openclaw skills info clawperator-agent-orientation
   openclaw skills info clawperator-upgrade
   openclaw skills info clawperator-skill-author-by-agent-discovery
   openclaw skills info clawperator-skill-author-by-recording
   openclaw skills info home-garage-door-control
   ```

2. Inspect the relevant `~/.agents/skills` entries without committing personal paths:

   ```bash
   ls -l ~/.agents/skills | rg 'clawperator-(agent-orientation|skill-author|upgrade)'
   ```

3. Confirm from code that `install.sh` delegates to `clawperator install` and that `clawperator install` calls `copyBundledSkills`.
4. Confirm from `copyBundledSkills.ts` that the shared install/update path currently creates symlinks for Claude, Codex, and generic agents.
5. Confirm from `hostChecks.ts` that doctor currently validates discovery entries through `inspectManagedBundledSkillLink`.
6. Record any correction in `problem-summary.md` if the live behavior differs from the current summary.
7. Stop and ask for direction only if the live issue no longer exists or if code shows OpenClaw already has a supported Clawperator-specific skill source that should be preferred.

### Acceptance Criteria

- The task has direct live evidence of OpenClaw failing to resolve the affected bundled skills, or an explicit note that the issue no longer reproduces.
- The task identifies `copyBundledSkills.ts` as the primary code owner if the issue still reproduces.
- The task does not propose changes to OpenClaw or duplicate install logic in `install.sh`.

### Validation

```bash
git diff -- tasks/skills/broken-openclaw-symlink
```

### Expected Commit

```text
docs: verify OpenClaw bundled skill discovery failure
```

Skip this commit if Phase 1 only confirms the existing `problem-summary.md` without file edits.

## Phase 2: Implement Installer And Doctor Contract

### Agent Tier

default

### Goal

Change Clawperator's bundled-skills install/update contract so generic agents discovery entries are OpenClaw-discoverable real directories, while preserving the canonical store and existing Claude/Codex symlink behavior.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/copyBundledSkills.ts`
- `apps/node/src/domain/doctor/checks/hostChecks.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/bundledSkills.test.ts`
- `apps/node/src/test/unit/doctor/hostChecks.test.ts`
- `apps/node/src/test/unit/installCommand.test.ts` only if install result metadata or sequencing changes
- `apps/node/src/test/unit/cliHelp.test.ts` if CLI help wording changes

### Steps

1. In `copyBundledSkills.ts`, separate discovery targets by behavior:
   - Claude: managed symlink to the canonical store.
   - Codex: managed symlink to the canonical store.
   - Generic agents: managed directory copy under `~/.agents/skills/<skill>`.
2. Add helper logic for generic agents managed copies. Before writing any code,
   decide the managed-copy detection mechanism and record the choice in the
   commit message. Do not leave this implicit.

   Two viable options:

   | Option | How it works | Tradeoff |
   | --- | --- | --- |
   | Sentinel file | Write a `.clawperator-managed` file inside every managed copy directory during install/update. Detection reads that file. | Simple; survives across function calls. Adds one file per skill dir. |
   | Canonical path match | Derive the expected directory content from the canonical store path and skill name; treat a directory as managed only if it contains a `SKILL.md` whose content matches the installed skill. | No extra file. Slower and fragile if content diverges. |

   Use the sentinel file option unless code inspection reveals a strong reason to
   prefer content matching. The `isManagedBundledSkillSymlink` function uses target
   path resolution for symlinks - do not try to adapt it to directories. Write a
   new `isManagedBundledSkillDirectory` counterpart that checks for the sentinel
   file.

   With the chosen mechanism in place:
   - Refresh managed copies from the canonical installed skill after the canonical
     store is refreshed.
   - Treat existing Clawperator-managed symlinks in `~/.agents/skills` as
     repairable legacy state and replace them with managed directory copies.
   - Refuse to overwrite non-Clawperator entries (no sentinel file, not a
     Clawperator-managed symlink).
3. Keep stale cleanup narrow:
   - Remove stale canonical bundled skill directories only when they contain `SKILL.md` and are no longer packaged.
   - Remove stale Claude/Codex entries only when they are Clawperator-managed symlinks.
   - Remove stale generic agents entries only when they are Clawperator-managed symlinks or Clawperator-managed copies.
4. Update `CopyBundledSkillsSuccess.agentDiscoveryDirs` only if needed. Preserve current output shape if possible.
5. Update doctor in `hostChecks.ts`:
   - Keep symlink validation for Claude and Codex.
   - Validate generic agents entries as managed copies.
   - Treat legacy managed symlinks under generic agents as stale or repairable, not healthy.
   - Keep the fix command as `clawperator bundled-skills update`.
6. Update CLI help in `registry.ts` so it no longer says every discovery dir receives symlinks if generic agents now receive real directories.
7. Add or update tests in the same commit:
   - Fresh install creates symlinks for Claude and Codex.
   - Fresh install creates real directories for generic agents.
   - Rerun is idempotent.
   - Legacy generic agents symlink is replaced with a real directory.
   - Non-Clawperator generic agents entry is not overwritten.
   - Stale Clawperator-managed generic agents copy is removed when the packaged source no longer includes that skill.
   - Doctor passes with healthy generic agents managed copies.
   - Doctor warns when generic agents copy is missing, conflicting, stale, or unmarked.
   - Doctor warns on legacy generic agents symlink so update repairs the OpenClaw-invisible state.
8. Build before tests because Node tests execute `dist`.

### Acceptance Criteria

- `~/.agents/skills/<skill>` is asserted as a directory, not a symlink, in unit tests.
- Tests prove legacy symlink repair for the current broken installed state.
- Tests prove user-managed entries are preserved.
- Doctor tests match the new contract and no longer assume generic agents symlinks are healthy.
- CLI help no longer over-promises symlinks for all discovery dirs.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test:unit
```

### Expected Commit

```text
fix: make bundled skills discoverable to OpenClaw
```

## Phase 3: Docs And End-To-End Validation

### Agent Tier

default

### Goal

Align authored docs and the upgrade skill with the shipped behavior, then validate the public installer path and live OpenClaw discovery.

### Files or Surfaces To Change

- `docs/skills/authoring.md`
- `docs/skills/overview.md`
- `docs/setup.md`
- `docs/host-agents.md`
- `docs/api/doctor.md`
- `docs/internal/design/agent-host-integration.md`
- `docs/internal/design/installer-architecture.md`
- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` if needed
- `sites/landing/public/install.sh` only if validation shows delegation is incomplete or misleading
- `validation/install/` only if `install.sh` changes

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for public-doc authoring discipline.
2. Update docs that currently say generic agents discovery entries are symlinks.
3. Make docs state the current behavior:
   - Canonical bundled-skill store is `~/.clawperator/bundled-skills`.
   - Claude and Codex discovery entries are managed symlinks unless implementation changed otherwise.
   - Generic agents discovery entries are managed real directories so OpenClaw can scan them without symlink escape.
   - Runtime skills are not mirrored into shared agent discovery dirs.
4. Inspect `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`.
   - If it remains accurate because `clawperator install` performs the repaired install/update behavior, leave it unchanged.
   - If it mentions symlink-only behavior or misses a needed `clawperator install` or `doctor` check, update it.
5. Inspect `sites/landing/public/install.sh`.
   - If it still delegates to `clawperator install`, do not duplicate logic there.
   - If any installer output or validation needs a matching update, make that focused change and add or update `validation/install/` coverage in the same commit.
6. Run docs validation after authored docs are updated.
7. Run live validation on a host where OpenClaw is installed:

   ```bash
   clawperator bundled-skills update
   openclaw skills info clawperator-agent-orientation
   openclaw skills info clawperator-upgrade
   openclaw skills info clawperator-skill-author-by-agent-discovery
   openclaw skills info clawperator-skill-author-by-recording
   ```

8. Confirm no `reason=symlink-escape` warning appears for the Clawperator bundled skills.
9. If live OpenClaw validation cannot be run, document the exact host-state blocker in the final message and rely on Phase 2 unit coverage as the primary gate.

### Acceptance Criteria

- Authored docs match the implemented filesystem contract.
- `clawperator-upgrade` remains accurate or is updated.
- `install.sh` remains a bootstrap delegator unless evidence requires a focused change.
- Live OpenClaw discovery succeeds for all four packaged bundled skills, or a precise blocker is recorded.
- No generated docs were edited by hand.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

If `sites/landing/public/install.sh` changes, also run:

```bash
./validation/install/test_install.sh
```

Live host validation when OpenClaw is available:

```bash
clawperator bundled-skills update
openclaw skills info clawperator-agent-orientation
openclaw skills info clawperator-upgrade
openclaw skills info clawperator-skill-author-by-agent-discovery
openclaw skills info clawperator-skill-author-by-recording
```

### Expected Commit

```text
docs: align bundled skill discovery guidance
```
