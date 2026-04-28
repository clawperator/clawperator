# Fix OpenClaw Bundled Skill Discovery Work Breakdown

Parent plan: `tasks/skills/fix-openclaw-bundled-skill-discovery/plan.md`

## Executive Summary

1 PR, 4 phases. Phase 1 verifies the issue live and selects one fix approach; all
subsequent phases depend on that choice. Phase 2 implements the fix in Node plus
tests. Phase 3 updates docs and bundled skill content if needed. Phase 4 validates
on the live host. The implementing agent must not write code in Phase 2 until
Phase 1 is complete and `findings.md` records the chosen solution with evidence.

| PR | Purpose | Phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Verify, implement, docs, validate | 1, 2, 3, 4 | thinking, default, default, default | none |

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do not write any implementation code until `findings.md` records the chosen solution
  with evidence from live commands and code inspection. Phase 1 is not complete without
  a committed `findings.md`.
- Do not change `claudeSkillsDir` or `codexSkillsDir` behavior unless Phase 1
  investigation finds a reason. Those surfaces already work. Scope the change to the
  agents-discovery surface only unless there is explicit evidence to do otherwise.
- Do not add symlink or copy logic to `install.sh`. It delegates to
  `clawperator install`, which calls the Node CLI. Keep that boundary intact.
- Unit tests are the primary verification gate for Node behavior. Do not treat live
  OpenClaw verification as a substitute for updated tests.
- Put the updated tests in the same commit as the code change they cover. Do not
  defer test updates to a later phase.
- One commit per logical step. Do not batch solution selection, implementation, test
  updates, and docs into one large commit.
- When changing `copyBundledSkills.ts`, preserve the existing non-Clawperator-entry
  guard that prevents overwriting user-managed entries. Do not remove or weaken it.
- If the fix replaces symlinks with real directories in `~/.agents/skills`, ensure
  the update path (`clawperator bundled-skills update`) replaces existing managed
  symlinks cleanly before creating the new directory entries.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/skills/fix-openclaw-bundled-skill-discovery/plan.md` | Stable contract, scope boundaries, and decision rules |
| `tasks/skills/broken-openclaw-symlink/problem-summary.md` | Prior analysis of the issue and candidate fix directions |
| `apps/node/src/domain/skills/copyBundledSkills.ts` | Full authoritative install behavior; read before deciding what to change |
| `apps/node/src/test/unit/bundledSkills.test.ts` | Existing test coverage; determines what assertion updates are needed |
| `apps/node/src/cli/commands/bundledSkills.ts` | CLI command that wraps `copyBundledSkills` |
| `apps/node/src/cli/registry.ts` | Help text for bundled-skills commands |
| `docs/skills/authoring.md` | Install-model table that may need updating |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Upgrade skill workflow; may need a recovery note |
| `sites/landing/public/install.sh` | Post-bootstrap delegation path; read to confirm it does not need changes |

## Phase 1: Verify Diagnosis and Select Solution

### Agent Tier

thinking

### Goal

Confirm the OpenClaw rejection of Clawperator bundled-skill symlinks on the live host.
Investigate whether OpenClaw has a supported extra-skill-source config path. Choose one
fix strategy with evidence. Write findings to `findings.md`.

### Files or Surfaces To Change

- `tasks/skills/fix-openclaw-bundled-skill-discovery/findings.md` (create)

Do not touch any source or test files in this phase.

### Steps

1. Run the following commands and capture their full output in `findings.md`:

   ```bash
   ls -la ~/.agents/skills/
   ls -la ~/.clawperator/bundled-skills/
   openclaw skills list --eligible --json 2>&1 | head -40
   openclaw skills info clawperator-agent-orientation 2>&1
   openclaw skills info clawperator-upgrade 2>&1
   ```

2. Confirm that the four bundled-skill entries in `~/.agents/skills` are symlinks
   and that OpenClaw emits `reason=symlink-escape` for each one. Record the
   exact warning lines in `findings.md`. If the warnings are not present, stop
   and document what you observe instead - the prior diagnosis may be stale.

3. Investigate whether OpenClaw has a supported config path for adding extra skill
   source directories (for example, a mechanism to register
   `~/.clawperator/bundled-skills` as an additional source). Check:

   ```bash
   openclaw --help 2>&1 | head -30
   openclaw skills --help 2>&1 | head -40
   openclaw config --help 2>&1 | head -40
   ```

   Also check:
   ```bash
   openclaw config show 2>&1 | head -60
   ```

   Record what you find in `findings.md`. A viable OpenClaw config path means:
   Clawperator's install CLI can set it unilaterally, it persists across OpenClaw
   sessions, and it does not require forking or patching OpenClaw.

4. Read `apps/node/src/domain/skills/copyBundledSkills.ts` end-to-end. Note the
   exact function that creates the agents-dir entries and whether the same
   `ensureManagedSymlink` path is used for all three discovery dirs. Record this
   in `findings.md`.

5. Read `apps/node/src/test/unit/bundledSkills.test.ts` and note which tests
   assert on the agents-dir entries specifically (by checking
   `agentsSkillsDir`). List those test cases and their assertions in `findings.md`.

6. Evaluate the candidate fix options against the evidence. Use the decision rule
   table in `plan.md` as the first-match lookup:

   | Option | Apply when |
   | --- | --- |
   | Register `~/.clawperator/bundled-skills` as an OpenClaw skill source via config | Phase 1 confirms OpenClaw has a stable, Clawperator-controllable config path for extra skill sources |
   | Copy real directories to `~/.agents/skills` instead of symlinking | OpenClaw has no supported extra-source config, or that config cannot be set by `clawperator install` without forking OpenClaw |
   | Hybrid: symlinks for claude/codex, copies for agents | Copy option applies and the code change is cleanest as a per-dir strategy branch |

   Do not implement multiple options. Choose one.

7. Write the chosen solution and the evidence for that choice in `findings.md`
   under "## Chosen Solution". Include:
   - Which option was chosen.
   - What evidence ruled out the alternatives.
   - Which files in `apps/node/` need to change.
   - Whether `bundledSkills.test.ts` agents-dir assertions need to change to
     `stat().isDirectory()` instead of `readlink()`.
   - Whether `clawperator-upgrade/SKILL.md` needs a recovery note.
   - Whether `docs/skills/authoring.md` install-model table needs a row change.

### Required `findings.md` Structure

Create `tasks/skills/fix-openclaw-bundled-skill-discovery/findings.md` with these
sections in order:

```markdown
# Findings: Fix OpenClaw Bundled Skill Discovery

## Live Observation

### Symlink state
<output of ls -la ~/.agents/skills/>

### OpenClaw skills list (first 40 lines)
<output>

### OpenClaw skills info (each of the four skills)
<output>

## OpenClaw Config Investigation

<what openclaw config show and help returned; whether a stable extra-source path exists>

## copyBundledSkills.ts Analysis

<which function creates agents-dir entries; whether all three dirs use the same path>

## Existing Test Coverage for Agents Dir

<list of test cases and assertions that reference agentsSkillsDir>

## Chosen Solution

### Decision
<which option was chosen>

### Evidence ruling out alternatives
<brief bullets>

### Files to change
<explicit list>

### Test assertion changes needed
<whether readlink assertions become stat/isDirectory assertions>

### docs/skills/authoring.md change needed
<yes/no and which row>

### clawperator-upgrade/SKILL.md change needed
<yes/no and why>
```

Do not proceed to Phase 2 until `findings.md` contains all required sections and
the "Chosen Solution" section is complete.

### Acceptance Criteria

- `findings.md` exists with all required sections filled in.
- The live OpenClaw commands either confirm the issue or document the actual current
  state clearly enough for Phase 2 to proceed.
- The chosen solution is named explicitly and traced to specific files.

### Validation

```bash
# Confirm findings.md exists and has all required section headers
grep -c "^## " tasks/skills/fix-openclaw-bundled-skill-discovery/findings.md
# Expected: 6 (Live Observation, OpenClaw Config Investigation, copyBundledSkills.ts Analysis,
#            Existing Test Coverage for Agents Dir, Chosen Solution, and their subsections)
```

### Expected Commit

```text
docs(tasks): record diagnosis and chosen solution for openclaw bundled-skill discovery
```

## Phase 2: Implement the Fix in Node

### Agent Tier

default

### Goal

Implement the chosen fix from `findings.md` in `copyBundledSkills.ts` and update
`bundledSkills.test.ts` to assert the new agents-dir behavior.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/copyBundledSkills.ts`
- `apps/node/src/test/unit/bundledSkills.test.ts`
- Possibly `apps/node/src/cli/commands/bundledSkills.ts` if the command output shape
  changes (e.g., if `agentDiscoveryDirs` metadata needs updating).

### Steps

1. Re-read `findings.md` "Chosen Solution" before touching any code.

2. If the chosen fix is **copy real directories** (the expected path if OpenClaw has
   no supported extra-source config):

   a. Modify `copyBundledSkills.ts` so the agents-dir entries are created as real
      copied directories rather than symlinks. The canonical bundled-skills store
      (`~/.clawperator/bundled-skills`) remains unchanged - it still receives full
      copies of the packaged skills. Only the agents-dir entries change from symlinks
      to copied directories.

   b. Handle the transition case: if an existing `~/.agents/skills/<skill>` entry is
      a Clawperator-managed symlink (detected by the same `isManagedBundledSkillSymlink`
      logic), remove it before creating the directory. Do not fail if the entry is a
      symlink to the expected target - replace it cleanly.

   c. Keep the existing non-Clawperator-entry guard intact. If `~/.agents/skills/<skill>`
      is not a Clawperator-managed entry, refuse to overwrite it.

   d. For stale cleanup: the `removeStaleBundledSkillSymlinks` function currently only
      removes symlinks. If the agents dir now receives real directories, either extend
      the cleanup to also remove stale Clawperator-managed directories, or document why
      the existing cleanup is sufficient.

3. If the chosen fix is **OpenClaw extra-source config**:

   a. Add a step in `copyBundledSkills.ts` (or a new `wireOpenClawSkillSource()`
      function) that configures OpenClaw to include `~/.clawperator/bundled-skills`
      as an additional skill source directory.

   b. This step must be idempotent - re-running it must not add a duplicate entry.

   c. Add appropriate error handling if OpenClaw config is not reachable.

4. Update `apps/node/src/test/unit/bundledSkills.test.ts`:

   - If the fix uses copies: update tests that assert `readlink(agentsSkillsDir/...)`
     to assert `stat(agentsSkillsDir/...).isDirectory() === true` and verify
     `readFile(agentsSkillsDir/.../SKILL.md)` returns the expected content.
   - Keep existing tests for Claude and Codex symlinks intact.
   - Add a test covering the transition: if an `~/.agents/skills/<skill>` entry
     is a Clawperator-managed symlink from a previous install, running
     `copyBundledSkills` replaces it with a real directory without error.

   Required test cases for the fix (copy approach):
   - `~/.agents/skills/<skill>` is a real directory after `copyBundledSkills`
   - `~/.agents/skills/<skill>/SKILL.md` is readable and contains the expected content
   - A pre-existing Clawperator-managed symlink at `~/.agents/skills/<skill>` is
     replaced cleanly with a real directory
   - A pre-existing non-Clawperator directory at `~/.agents/skills/<skill>` causes
     `copyBundledSkills` to return `BUNDLED_SKILLS_INSTALL_FAILED` (guard still works)
   - Running `copyBundledSkills` twice produces the same result (idempotency)

5. Run build and tests before committing:

   ```bash
   npm --prefix apps/node run build
   npm --prefix apps/node run test
   ```

### Acceptance Criteria

- `npm --prefix apps/node run build` exits 0.
- `npm --prefix apps/node run test` exits 0.
- No test that previously passed now fails for an unrelated reason.
- The agents-dir assertions in the test file reflect the new install behavior, not
  the old symlink behavior.
- The Claude and Codex symlink assertions are still present and still pass.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commits

```text
fix(node): install bundled skills as real dirs in ~/.agents/skills for openclaw compat
```

```text
test(node): update agents-dir assertions for openclaw-compatible bundled skill install
```

## Phase 3: Update Docs and Bundled Skill Content

### Agent Tier

default

### Goal

Update `docs/skills/authoring.md` and `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
as directed by `findings.md`. Regenerate `sites/docs/.build/` and validate the docs build.

If `findings.md` says no changes are needed for either file, skip the file update but
still run and confirm the docs build.

### Files or Surfaces To Change

- `docs/skills/authoring.md` (if findings.md says yes)
- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` (if findings.md says yes)
- `sites/docs/.build/` (regenerate via `.agents/skills/docs-build/`)
- `sites/docs/site/` (regenerate via `./scripts/docs_build.sh`)

Do not hand-edit `sites/docs/.build/` or `sites/docs/site/`. These are generated.

### Steps

1. Re-read `findings.md` "Chosen Solution" sections for docs and upgrade skill changes.

2. If `docs/skills/authoring.md` needs updating:

   Use `.agents/skills/docs-author/SKILL.md` for the authoring workflow. Do not
   invent documentation from memory. Read the current file first, then update only
   the install-model table row for the generic agents discovery dir (`~/.agents/skills`).
   Change the description to match what the fix actually does (e.g., "real copied
   directories" instead of "symlinks into the canonical store" if the fix uses copies).
   Do not change other rows or sections without evidence.

3. If `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` needs a recovery note:

   Add a brief note under the upgrade workflow explaining that users with an older
   install may have symlinks in `~/.agents/skills` from a pre-fix install. Running
   `clawperator bundled-skills update` replaces them. Do not rewrite the whole skill -
   only add what is needed for upgrade recovery.

4. Regenerate the docs site staging output using the `docs-build` skill:

   ```bash
   # Use the repo-local docs-build skill to regenerate sites/docs/.build/
   # See .agents/skills/docs-build/ for the workflow
   ```

5. Validate the full docs build:

   ```bash
   ./scripts/docs_build.sh
   ```

   This must exit 0 before the phase is considered done.

### Acceptance Criteria

- `./scripts/docs_build.sh` exits 0.
- If `docs/skills/authoring.md` was changed: the install-model table row for
  `~/.agents/skills` now accurately describes what the fix produces.
- If `docs/skills/authoring.md` was not changed: confirm no inconsistency exists
  between the docs and the new install behavior.
- `sites/docs/.build/` is regenerated from source, not hand-edited.

### Validation

```bash
./scripts/docs_build.sh
```

```bash
# If authoring.md changed, check the relevant section:
grep -A 5 "Generic agents" docs/skills/authoring.md
```

### Expected Commits

```text
docs(skills): update agents-dir install model for openclaw-compatible bundled skills
```

```text
docs(bundled-skills): note upgrade path from old symlink state in clawperator-upgrade
```

(Omit either commit if findings.md determined that file needed no change.)

## Phase 4: Full Validation on Live Host

### Agent Tier

default

### Goal

Confirm that the fix works on the live installed environment. This phase requires a
host with Clawperator installed and OpenClaw reachable.

This phase is a supplemental live check. Unit tests (Phase 2) are the primary gate.
If the live host does not have OpenClaw installed, document that and skip live
OpenClaw commands. The unit tests still constitute the primary pass signal.

### Steps

1. Rebuild and reinstall the CLI from the branch:

   ```bash
   npm --prefix apps/node run build
   ```

2. Run `clawperator bundled-skills update` using the branch-local build to apply
   the fix to the live install state:

   ```bash
   # Use the branch-local build, not the globally installed binary:
   node apps/node/dist/cli/index.js bundled-skills update
   ```

3. Inspect the agents dir to confirm the fix applied:

   ```bash
   ls -la ~/.agents/skills/ | grep clawperator
   ```

   For the copy approach: each `clawperator-*` entry should be a real directory,
   not a symlink.

4. Run OpenClaw discovery commands:

   ```bash
   openclaw skills list --eligible --json 2>&1 | grep -E "(clawperator|symlink-escape)"
   openclaw skills info clawperator-agent-orientation 2>&1
   openclaw skills info clawperator-upgrade 2>&1
   openclaw skills info clawperator-skill-author-by-agent-discovery 2>&1
   openclaw skills info clawperator-skill-author-by-recording 2>&1
   ```

   Expected: no `reason=symlink-escape` lines; each `skills info` command reports
   the skill as found. Record the output.

5. Confirm `clawperator bundled-skills list` and `clawperator doctor` still work:

   ```bash
   node apps/node/dist/cli/index.js bundled-skills list
   node apps/node/dist/cli/index.js doctor
   ```

6. Run the update a second time to confirm idempotency:

   ```bash
   node apps/node/dist/cli/index.js bundled-skills update
   ```

   No error; output matches the first run.

### Live Test Preconditions

This live path requires:
- `openclaw` is installed and reachable in the current shell.
- The live `~/.agents/skills` directory is writable.

If `openclaw` is not installed, document that fact in the PR description. The unit
tests are sufficient for CI. OpenClaw visibility is a manual-verification item when
the host has OpenClaw available.

### Acceptance Criteria

**Primary gate (must pass before PR):**
- `npm --prefix apps/node run build` exits 0.
- `npm --prefix apps/node run test` exits 0.
- `./scripts/docs_build.sh` exits 0.

**Supplemental live check (when OpenClaw is available):**
- `openclaw skills list --eligible --json` produces no `reason=symlink-escape` lines
  for any of the four bundled skills.
- `openclaw skills info <skill>` returns each skill as found for all four bundled skills.
- `clawperator bundled-skills list` returns all four skills with correct `skillPath` values.
- `clawperator doctor` passes `host.bundled-skills.staleness` without warnings.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

```bash
# Supplemental live check (requires openclaw installed):
node apps/node/dist/cli/index.js bundled-skills update
openclaw skills list --eligible --json 2>&1 | grep -E "(clawperator|symlink-escape)"
openclaw skills info clawperator-agent-orientation 2>&1
openclaw skills info clawperator-upgrade 2>&1
node apps/node/dist/cli/index.js bundled-skills list
node apps/node/dist/cli/index.js doctor
```

### Expected Commit

No commit expected from this phase. Phase 4 is verification only.

If validation reveals a defect, fix it in a new commit rather than amending Phase 2
or Phase 3 commits:

```text
fix(node): correct openclaw-compatible bundled skill install edge case
```
