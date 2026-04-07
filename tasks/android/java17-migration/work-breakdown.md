# Android Build Toolchain Migration: Java 11 to Java 17 Work Breakdown

Parent plan: `tasks/android/java17-migration/plan.md`

## Executive Summary

One PR, one phase. Mechanical search-replace of Java 11 version constants
across 17 `.gradle.kts` files. Build and test validation confirms nothing
broke.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | 0 |
| Remaining | 1 |
| Current / Next | phase-1 |
| Blockers | none |

## Hard Rules

- Change every occurrence of the three patterns in all 17 files. Do not stop
  at `build.gradle.kts` alone.
- Do not change `minSdk`, `targetSdk`, `compileSdk`, or any integer constant
  that is not a Java language version setting.
- Do not add or remove any dependency, plugin, or configuration block.
- Do not edit any file outside the 17 listed in the plan.
- Run the verification grep before committing. Zero results required.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/android/java17-migration/plan.md` | Complete file list, substitution table, and acceptance target |
| `build.gradle.kts` | Root file - contains the toolchain block, two `compileOptions` blocks, and two detekt `jvmTarget` lines |

The 16 module files follow a consistent pattern (each has `sourceCompatibility`,
`targetCompatibility`, and `jvmTarget`). Reading one module file is sufficient
to confirm the pattern before editing the rest.

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Migrate all Android build files from Java 11 to Java 17 | phase-1 | fast | debug build, unit tests, and release build all pass |

## Phase 1: Migrate All Files

### Agent Tier

fast

### Goal

Replace every `VERSION_11`, `jvmTarget = "11"`, and `JavaLanguageVersion.of(11)`
with their Java 17 equivalents across all 17 `.gradle.kts` files.

### Files To Change

All 17 files listed in the plan's Surfaces and Ownership table.

### Steps

1. Run the verification grep to confirm the current state and count of matches:
   ```bash
   find apps/android build.gradle.kts -name "*.gradle.kts" | \
     xargs grep -rnE 'VERSION_11|jvmTarget.*"11"|languageVersion.*of\(11\)'
   ```
2. Apply the substitution table from the plan to every file:

   | Find | Replace |
   | --- | --- |
   | `JavaVersion.VERSION_11` | `JavaVersion.VERSION_17` |
   | `jvmTarget = "11"` | `jvmTarget = "17"` |
   | `JavaLanguageVersion.of(11)` | `JavaLanguageVersion.of(17)` |

3. Run the verification grep again. Confirm zero results before continuing.
4. Run the debug build and unit tests:
   ```bash
   ./gradlew :app:assembleDebug
   ./gradlew testDebugUnitTest
   ```
5. Run the release build locally using the debug keystore fallback. No signing
   secrets are needed - `app.gradle.kts` falls back to `scripts/debug.keystore`
   when the signing env vars are absent. This mirrors what CI does in
   `.github/workflows/release-apk.yml` (`./gradlew :app:assembleRelease`) and
   exercises R8 minification, which only runs in the release variant:
   ```bash
   ./gradlew :app:assembleRelease
   ```
6. Confirm the release APK was produced:
   ```bash
   ls apps/android/app/build/outputs/apk/release/app-release.apk
   ```
7. Commit.

### Acceptance Criteria

**Mechanical:**
- `find apps/android build.gradle.kts -name "*.gradle.kts" | xargs grep -rnE 'VERSION_11|jvmTarget.*"11"|languageVersion.*of\(11\)'` returns zero results.
- `./gradlew :app:assembleDebug` exits 0.
- `./gradlew testDebugUnitTest` exits 0.
- `./gradlew :app:assembleRelease` exits 0 (no signing env vars required locally).
- `apps/android/app/build/outputs/apk/release/app-release.apk` exists.

**Human review:**
- Only version number values changed. No other content in any file was touched.
- All 17 files were updated, not just `build.gradle.kts`.

### Phase 1 Validation

```bash
find apps/android build.gradle.kts -name "*.gradle.kts" | \
  xargs grep -rnE 'VERSION_11|jvmTarget.*"11"|languageVersion.*of\(11\)'
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
./gradlew :app:assembleRelease
ls apps/android/app/build/outputs/apk/release/app-release.apk
```

### Expected Commit

```text
chore(android): migrate build toolchain from Java 11 to Java 17
```
