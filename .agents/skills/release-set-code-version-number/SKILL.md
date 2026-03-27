---
name: release-set-code-version-number
description: Updates the unreleased Clawperator code version on code-facing surfaces only, runs local validation, and auto-commits the change.
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
.agents/skills/release-set-code-version-number/scripts/set_code_version.py 0.4.0 0.4.1
```

This skill updates code-facing surfaces only:
- `apps/node/package.json`
- `apps/node/package-lock.json`
- `docs/index.md` (the "Current code version" badge on the docs home page, linked to CHANGELOG.md)
- code/tests that should know about the new unreleased version
- internal repo-maintenance skill docs

It intentionally does **not** update public release-facing docs and release-maintenance docs such as:
- `docs/troubleshooting/compatibility.md`
- `docs/internal/release-procedure.md`
- `sites/docs/**`
- `sites/landing/public/**`
- `sites/landing/public/install.sh`

## Mandatory Manual Audit

Review every modified file before accepting the bump. Be especially careful with:
- `apps/node/src/test/unit/versionCompatibility.test.ts`
- `scripts/fake_adb.sh`
- skill docs that contain command examples

Doctor release download copy in tests should follow production: build expected strings with `getCliVersion()`, `getOperatorApkDownloadUrl()`, and `getOperatorApkSha256Url()` from `apps/node/src/domain/version/compatibility.ts` instead of hard-coding versioned download URLs. That keeps `release-set-code-version-number` from failing on `DoctorService` tests after each bump.

Confirm the bump only touched code-facing surfaces and did not leak into public docs.

## Required Validation

After the script runs, verify:
1. `npm --prefix apps/node run build`
2. `npm --prefix apps/node run test`

Never ignore a failing test. If it fails locally, the bump is incomplete.

## Commit Behavior

After validation succeeds, the script creates a dedicated commit automatically with this exact subject:

```bash
git commit -m "chore(build): set code version to <new_version>"
```

Example:

```bash
git commit -m "chore(build): set code version to 0.4.1"
```

Do not fold unrelated changes into this commit. Start from a clean working tree.
