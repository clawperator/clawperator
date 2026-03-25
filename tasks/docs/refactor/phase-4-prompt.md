## Prompt for PR-4: Cleanup + Finalization

```
You are implementing PR-4 of the Clawperator docs refactor. This is the final PR. PRs 1-3 built the pipeline, wrote all content pages, and filled all placeholders. PR-4 is mechanical cleanup: delete old files, move internal docs, update repo metadata, and finalize artifacts. Read this prompt fully before starting any work.

## What This PR Does

PR-4 has 6 tasks. They are mostly independent and mechanical, but you must follow the dependency order.

1. Finalize llms artifacts (review llms.txt and llms-full.txt)
2. Move internal docs to `docs/internal/`
3. Delete old source files that have been absorbed into the new structure
4. Update skills repo with pointer docs
5. Update repo metadata (CLAUDE.md, agent skill files)
6. Delete refactor artifacts (tasks/docs/refactor/)

## Required Reading Before You Start

1. Read `tasks/docs/refactor/work-breakdown.md` - scroll to "PR-4: Cleanup + Finalization" section (Tasks 4.1-4.6). This defines every task.
2. Read `tasks/docs/refactor/finalization-items.md` - these are known items intentionally deferred beyond PR-4. Do NOT try to fix them in this PR.
3. Skim `CLAUDE.md` - you will update it in Task 4.5. Understand what it currently says about docs.

## Branch

Work on a new branch `docs-refactor-phase-4` created from `main` after PR-3 merged at ae4192d.

## Commit Discipline

This project uses Conventional Commits (`docs:`, `feat:`, `fix:`, `chore:`, `refactor:`).

PR-4 is mechanical cleanup, not content authoring. But still commit after each task, not in one giant batch. The workflow:

1. Complete one task
2. Run `./scripts/docs_build.sh` to verify nothing broke
3. Commit with a conventional commit message citing the task number
4. Move to the next task

Expected commits: at least 6 (one per task). Some tasks may need 2 commits if they have independent substeps.

## Task-by-Task Instructions

---

### Task 4.1: Finalize llms artifacts

**Goal:** Verify `llms.txt` and `llms-full.txt` are correct and complete after all content PRs.

**Steps:**

1. Review `sites/docs/static/llms.txt`. Verify:
   - All 22 page URLs are listed and point to valid pages
   - URLs use the correct domain: `https://docs.clawperator.com/`
   - No old page URLs remain (e.g., no `/reference/` paths, no `/ai-agents/` paths)
   - The "Guidance for agents" section is accurate

2. Review `sites/landing/public/llms.txt`. Verify:
   - All page URLs are listed
   - URLs use `https://docs.clawperator.com/` for docs pages (not `https://clawperator.com/`)
   - The landing llms.txt may also have landing-site-specific entries; leave those
   - Check that `llms-full.txt` link points to the correct URL

3. Run `./scripts/docs_build.sh` to regenerate `llms-full.txt`

4. Verify `llms-full.txt` was written to all three locations:
   - `sites/docs/static/llms-full.txt`
   - `sites/docs/site/llms-full.txt`
   - `sites/landing/public/llms-full.txt`

5. Spot-check `llms-full.txt`: confirm it contains content from all 22 nav pages in order

**What to look for specifically:**

The current `sites/landing/public/llms.txt` references `clawperator provision emulator` - verify this command exists in `apps/node/src/cli/registry.ts`. If it does not exist, remove that line. Do not document commands that do not exist.

**Commit:** `docs: finalize llms artifacts - verify all 22 pages present`

**Depends on:** Nothing

---

### Task 4.2: Move internal docs

**Goal:** Move non-public docs to `docs/internal/` so they are excluded from the public site build.

**Steps:**

1. Create `docs/internal/` directory
2. Move these files into `docs/internal/`:
   - `docs/conformance-apk.md`
   - `docs/release-procedure.md`
   - `docs/release-reference.md`
   - `docs/site-hosting.md`
3. Move the entire `docs/design/` directory to `docs/internal/design/`:
   - `docs/design/generative-engine-optimization.md`
   - `docs/design/node-api-design-guiding-principles.md`
   - `docs/design/node-api-design.md`
   - `docs/design/operator-llm-playbook.md`
   - `docs/design/skill-design.md`
4. After moving, verify no broken references:
   - Grep `CLAUDE.md` for `docs/design/` - it currently references `docs/design/` as the location for internal design guidance. Update to `docs/internal/design/`.
   - Grep all `docs/` authored pages for links to moved files. Update any found.
   - Check `sites/docs/mkdocs.yml` - these files should NOT be in the nav (they are internal). Verify they are not listed.

**IMPORTANT:** The assembly script in `.agents/skills/docs-generate/scripts/assemble.py` has logic to skip `docs/internal/`. Verify this is the case by reading the script. If it skips `internal/`, the move is safe. If it does not, you need to add the exclusion.

To verify, read `assemble.py` and look for how it handles `docs/internal/` or any exclusion logic for subdirectories.

**Commit:** `chore: move internal docs to docs/internal/`

**Depends on:** Nothing (can be done in parallel with 4.1)

---

### Task 4.3: Delete old source files

**Goal:** Remove all authored source files that have been absorbed into the new structure during PRs 1-3.

**CRITICAL:** Before deleting anything, verify that each file's content has actually been absorbed. For each file below, confirm the replacement page exists and has real content (not a placeholder). Run `./scripts/docs_build.sh` after deletion to prove nothing broke.

**Files to delete:**

These are the old top-level docs that were replaced by the new page structure:

```
docs/agent-quickstart.md          -> replaced by docs/setup.md
docs/android-operator-apk.md      -> replaced by docs/setup.md + docs/troubleshooting/operator.md
docs/architecture.md              -> replaced by docs/api/overview.md
docs/compatibility.md             -> replaced by docs/troubleshooting/compatibility.md
docs/crash-logs.md                -> replaced by docs/troubleshooting/operator.md
docs/first-time-setup.md          -> replaced by docs/setup.md
docs/known-issues.md              -> replaced by docs/troubleshooting/known-issues.md
docs/multi-device-workflows.md    -> replaced by docs/api/devices.md
docs/navigation-patterns.md       -> replaced by docs/api/navigation.md
docs/node-api-for-agents.md       -> replaced by docs/api/overview.md + docs/api/actions.md + docs/api/selectors.md
docs/openclaw-first-run.md        -> replaced by docs/setup.md
docs/project-overview.md          -> replaced by docs/api/overview.md
docs/running-clawperator-on-android.md -> replaced by docs/setup.md
docs/snapshot-format.md           -> replaced by docs/api/snapshot.md
docs/terminology.md               -> replaced by docs/api/overview.md (terminology is inline now)
docs/troubleshooting.md           -> replaced by docs/troubleshooting/operator.md
```

These are the old reference subdirectory docs:

```
docs/reference/action-types.md          -> replaced by docs/api/actions.md
docs/reference/device-and-package-model.md -> replaced by docs/api/devices.md
docs/reference/environment-variables.md -> replaced by docs/api/environment.md
docs/reference/error-handling.md        -> replaced by docs/api/errors.md
docs/reference/execution-model.md       -> replaced by docs/api/overview.md
docs/reference/node-api-doctor.md       -> replaced by docs/api/doctor.md
docs/reference/timeout-budgeting.md     -> replaced by docs/api/timeouts.md
```

Delete the `docs/reference/` directory entirely after removing its contents.

This old directory also needs deletion:

```
docs/ai-agents/android-recording.md -> replaced by docs/api/recording.md
```

Delete the `docs/ai-agents/` directory entirely.

**After deletion, verify:**
1. `./scripts/docs_build.sh` still passes
2. No broken links in remaining docs (the build validator checks this)
3. `CLAUDE.md` does not reference any deleted files by name. If it does, update the reference or remove it.

**Commit:** `chore: delete old doc sources absorbed into new structure`

**Depends on:** PR-3 merged (which it is)

---

### Task 4.4: Update skills repo

**Goal:** Replace `../clawperator-skills/docs/` with lightweight pointer docs that redirect to the canonical docs site.

**Current state of `../clawperator-skills/docs/`:**
```
blocked-terms-policy.md
device-prep-and-runtime-tips.md
skill-authoring-guidelines.md
skill-development-workflow.md
skill-from-recording.md
usage-model.md
```

**What to do:**

Replace each file's content with a short pointer. For example:

```markdown
# Skill Authoring Guidelines

This content has moved to the canonical docs site.

See: https://docs.clawperator.com/skills/authoring/
```

The mapping:
```
blocked-terms-policy.md        -> https://docs.clawperator.com/skills/authoring/ (blocked terms section)
device-prep-and-runtime-tips.md -> https://docs.clawperator.com/skills/runtime/
skill-authoring-guidelines.md  -> https://docs.clawperator.com/skills/authoring/
skill-development-workflow.md  -> https://docs.clawperator.com/skills/development/
skill-from-recording.md        -> https://docs.clawperator.com/skills/authoring/ (recording section)
usage-model.md                 -> https://docs.clawperator.com/skills/overview/
```

**IMPORTANT:** The skills repo is a sibling directory at `../clawperator-skills/`. You must verify it exists before making changes. If it does not exist, skip this task and note it in your commit message.

**Commit in the skills repo:** `docs: replace content with pointers to canonical docs site`

**Commit in this repo (if any reference updates needed):** `chore: update skills repo references`

**Depends on:** Task 3.2 (skills pages exist - already merged in PR-3)

---

### Task 4.5: Update repo metadata

**Goal:** Update `CLAUDE.md` and agent skill files to reflect the new docs structure.

**CLAUDE.md changes needed:**

1. The "Key Docs" section currently lists:
   ```
   - `docs/node-api-for-agents.md` - API contract, CLI reference, error codes
   - `docs/first-time-setup.md` - Device setup and APK installation
   - `docs/architecture.md` - System design
   - `docs/troubleshooting.md` - Common issues
   - `docs/design/` - Internal design documents
   ```

   Update to reflect the new structure:
   ```
   - `docs/setup.md` - Device setup and APK installation
   - `docs/api/overview.md` - API contract and execution model
   - `docs/api/actions.md` - Action types and parameter semantics
   - `docs/api/errors.md` - Error codes and recovery patterns
   - `docs/internal/design/` - Internal design documents
   ```

2. The "Documentation Discipline" section references `docs/design/` - update to `docs/internal/design/`.

3. The line that says:
   ```
   - `docs/design/` when internal design guidance, engineering expectations, or skill-authoring guidance changed in a durable way
   ```
   Update to reference `docs/internal/design/`.

4. Search CLAUDE.md for any other references to deleted files. Common ones to check:
   - `docs/node-api-for-agents.md` (deleted in 4.3)
   - `docs/first-time-setup.md` (deleted in 4.3)
   - `docs/architecture.md` (deleted in 4.3)
   - `docs/troubleshooting.md` (deleted in 4.3)
   - `docs/design/` without `internal/` prefix

5. The "Skills" section in CLAUDE.md says skills docs are in `../clawperator-skills/docs/`. After Task 4.4, those are just pointers. Update to note that canonical skills docs are in `docs/skills/` in this repo.

**Agent skill file updates:**

1. `.agents/skills/docs-generate/SKILL.md` - verify it correctly describes the current pipeline. It should already be accurate from PR-1 updates, but confirm after the file deletions.

2. `.agents/skills/docs-validate/SKILL.md` - same verification.

**After all CLAUDE.md changes, verify:**
- No references to deleted files remain
- No references to `docs/design/` without the `internal/` prefix
- `./scripts/docs_build.sh` still passes

**Commit:** `chore: update CLAUDE.md and skill files for new docs structure`

**Depends on:** Tasks 4.2 and 4.3 (file moves/deletes must land first so paths are accurate)

---

### Task 4.6: Delete refactor artifacts

**Goal:** Remove the task tracking files used during the refactor. The refactor is complete.

**Steps:**

1. Delete `tasks/docs/refactor/reference/` - the entire reference snapshot directory
2. Delete `tasks/docs/refactor/plan.md`
3. Delete `tasks/docs/refactor/work-breakdown.md`
4. Delete `tasks/docs/refactor/phase-1-prompt.md`
5. Delete `tasks/docs/refactor/phase-2-prompt.md`
6. Delete `tasks/docs/refactor/phase-3-prompt.md`
7. Delete `tasks/docs/refactor/phase-4-prompt.md` (yes, this file - delete it too)
8. Delete `tasks/docs/refactor/documentation-drafting-north-star.md`
9. Delete `tasks/docs/refactor/finalization-items.md`
10. Delete any other files in `tasks/docs/refactor/` (check for stray review files or agent notes)
11. Remove the `tasks/docs/refactor/` directory itself

**IMPORTANT:** Before deleting the north star, confirm that any durable guidance it contains has been captured in `CLAUDE.md`. The north star has a "How to Verify Against Code" section with a file-by-file mapping - verify that CLAUDE.md's verification reference table covers the same ground. If not, add the missing entries to CLAUDE.md before deleting.

**After deletion:**
- `./scripts/docs_build.sh` still passes (these task files were never part of the docs build, but verify anyway)
- `tasks/docs/refactor/` directory no longer exists

**Commit:** `chore: delete docs refactor task artifacts`

**Depends on:** All of PR-4 (4.1-4.5) complete

---

## Validation Checklist (before opening PR)

Run all of these after all tasks are complete:

```bash
# 1. Full docs build
./scripts/docs_build.sh

# 2. Verify no old doc files remain outside docs/internal/
ls docs/agent-quickstart.md docs/first-time-setup.md docs/architecture.md docs/troubleshooting.md docs/node-api-for-agents.md 2>&1
# All should say "No such file or directory"

# 3. Verify no reference directory
ls docs/reference/ 2>&1
# Should say "No such file or directory"

# 4. Verify no ai-agents directory
ls docs/ai-agents/ 2>&1
# Should say "No such file or directory"

# 5. Verify internal docs moved
ls docs/internal/conformance-apk.md docs/internal/release-procedure.md docs/internal/design/node-api-design.md 2>&1
# All should exist

# 6. Verify refactor artifacts deleted
ls tasks/docs/refactor/plan.md tasks/docs/refactor/reference/ 2>&1
# All should say "No such file or directory"

# 7. Verify CLAUDE.md has no stale references
grep -n "node-api-for-agents\|first-time-setup\|architecture\.md\|docs/design/" CLAUDE.md
# Should return zero results (or only docs/internal/design/ references)

# 8. Verify llms-full.txt has all 22 pages
grep -c "^# " sites/docs/static/llms-full.txt
# Should be >= 22

# 9. Verify llms.txt has correct URLs
grep -c "docs.clawperator.com" sites/docs/static/llms.txt
# Should be >= 22

# 10. Skills repo has pointer docs (if accessible)
head -3 ../clawperator-skills/docs/usage-model.md 2>&1
# Should show pointer text, not full content
```

## What Done Looks Like

- Zero old doc files outside `docs/internal/`
- `docs/internal/` contains moved internal docs
- `docs/reference/`, `docs/ai-agents/` deleted
- `tasks/docs/refactor/` deleted entirely
- `CLAUDE.md` references new paths, not old ones
- `llms.txt` and `llms-full.txt` verified with all 22 pages
- Skills repo has pointer docs
- `./scripts/docs_build.sh` passes
- No broken links
```
