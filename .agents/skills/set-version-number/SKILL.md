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
.agents/skills/set-version-number/scripts/set_version.py 0.2.1 0.2.2
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
1. Re-run `npm run build && npm run test` in `apps/node`.
2. Re-run `clawperator-generate-docs` to ensure your manual source fixes are propagated to `sites/docs/docs/`.
3. Run `./scripts/docs_build.sh` to update `llms-full.txt` and other generated artifacts.

**Validation is mandatory.** Do not consider the task complete until the tests pass and the documentation correctly reflects both the new version and its relationship to historical versions.

Prerequisites:
- Must be run from within the `clawperator` git repository.
- Node.js, Python, and Git must be available.
