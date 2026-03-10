---
name: set-version-number
description: Updates the version number across the entire Clawperator project, running necessary builds and tests to verify the change.
---

Use this skill to increase or set the project version number everywhere in the repository (package.json, docs, scripts, tests, etc.). 

**Source of Truth:** The canonical version number for the entire Clawperator project is defined in `apps/node/package.json`. The Android APK derives its `versionName` and `versionCode` automatically from this file during the Gradle build process. 

It takes the old version and the new version as arguments.

Run:

```bash
cd "$(git rev-parse --show-toplevel)"
.agents/skills/set-version-number/scripts/set_version.py <old_version> <new_version>
```

Example:

```bash
.agents/skills/set-version-number/scripts/set_version.py 0.2.1 0.2.4
```

The script will:
1. Search all git-tracked text files for occurrences of `<old_version>` and replace them with `<new_version>`.
2. Run the Node API build and unit tests to ensure nothing was broken.
3. Rebuild the MkDocs documentation site.

## Mandatory Manual Audit and Refinement

The automated script performs a naive find-and-replace. **It is NOT sufficient for a complete version bump.** After running the script, you MUST perform a manual pass to identify errors, such as overwritten tests or broken documentation logic.

### 1. Inspect the Changes
Review every file modified by the script. Be especially careful with:
- **Test files:** The script often overwrites "incompatibility" tests (e.g., checking that 0.1.4 is incompatible with the old version). You MUST restore the original version in those tests and ADD a new test case for the new version.
- **Documentation logic:** Files like `docs/compatibility.md` and `docs/android-operator-apk.md` often contain lists of compatible/incompatible versions or historical download links. Ensure the new version is ADDED to these lists and that existing examples are not corrupted.
- **Comments and placeholders:** Some files (like `UiNodeId.kt`) use version strings as static examples in comments. Revert these if they were intended to be permanent placeholders rather than project versions.

### 2. Expected Files to Modify
A successful upgrade typically involves manual refinement in these files:
- `apps/node/package.json` (The source of truth)
- `apps/node/package-lock.json` (Run `npm install` in `apps/node` to sync)
- `apps/node/src/test/unit/versionCompatibility.test.ts` (Update incompatibility checks)
- `apps/node/src/test/unit/doctor/DoctorService.test.ts` (Verify version mismatch tests)
- `docs/compatibility.md` (Add new compatibility examples)
- `docs/android-operator-apk.md` (Update historical download links)

### 3. Verify and Regenerate
After making manual corrections:
1. **Rigorously verify local tests:** Run `npm run build && npm run test` in `apps/node`. 
    - **CRITICAL:** NEVER ignore a test failure. Even if a failure seems "environmental" or "local-only", it MUST be resolved. If it fails for you, it will fail in CI.
    - **SYNC DIST:** Ensure you run the `build` command before `test` so that your TypeScript changes are reflected in the executed JavaScript.
2. **Regenerate docs:** Re-run `clawperator-generate-docs` to ensure your manual source fixes are propagated to `sites/docs/docs/`.
3. **Rebuild artifacts:** Run `./scripts/docs_build.sh` to update `llms-full.txt` and other generated artifacts.

## Release Tagging Mandate

Do NOT tag a release until:
1. Every single unit test passes locally.
2. You have manually verified that documentation logic (examples, links) is correct for the new version.
3. You have confirmed the version in `apps/node/package.json` matches your target.

**Validation is the only path to finality.** If tests fail, the version bump is incomplete. Fix the tests before proceeding.

## Commit Requirement

After the manual audit and all required validation steps succeed, create a dedicated commit for the version bump with this exact subject:

```bash
git commit -m "chore(version): set to <new_version>"
```

Example:

```bash
git commit -m "chore(version): set to 0.2.4"
```

Do not fold unrelated changes into this commit.

Prerequisites:
- Must be run from within the `clawperator` git repository.
- Node.js, Python, and Git must be available.
