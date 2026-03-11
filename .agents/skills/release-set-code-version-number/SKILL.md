---
name: release-set-code-version-number
description: Updates the unreleased Clawperator code version on code-facing surfaces only, then runs local validation and creates the required version bump commit.
---

Use this skill to bump the repo's next unreleased code version without changing public release-facing docs or website content.

**Source of Truth:** The canonical code version is defined in `apps/node/package.json`. The Android APK derives its `versionName` and `versionCode` automatically from this file during the Gradle build process.

Run:

```bash
cd "$(git rev-parse --show-toplevel)"
.agents/skills/release-set-code-version-number/scripts/set_code_version.py <old_version> <new_version>
```

Example:

```bash
.agents/skills/release-set-code-version-number/scripts/set_code_version.py 0.2.4 0.2.5
```

This skill updates code-facing surfaces only:
- `apps/node/package.json`
- `apps/node/package-lock.json`
- code/tests that should know about the new unreleased version
- internal repo-maintenance skill docs

It intentionally does **not** update public release-facing docs or website content such as:
- `docs/android-operator-apk.md`
- `docs/compatibility.md`
- `docs/release-procedure.md`
- `sites/docs/**`
- `sites/landing/public/**`
- `scripts/install.sh`

## Mandatory Manual Audit

Review every modified file before accepting the bump. Be especially careful with:
- `apps/node/src/test/unit/versionCompatibility.test.ts`
- `scripts/fake_adb.sh`
- skill docs that contain command examples

Confirm the bump only touched code-facing surfaces and did not leak into public docs.

## Required Validation

After the script runs, verify:
1. `npm --prefix apps/node run build`
2. `npm --prefix apps/node run test`

Never ignore a failing test. If it fails locally, the bump is incomplete.

## Commit Requirement

After validation succeeds, create a dedicated commit with this exact subject:

```bash
git commit -m "chore(version): set to <new_version>"
```

Example:

```bash
git commit -m "chore(version): set to 0.2.5"
```

Do not fold unrelated changes into this commit.
