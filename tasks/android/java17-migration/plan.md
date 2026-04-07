# Android Build Toolchain Migration: Java 11 to Java 17

Created: 2026-04-07

## Executive Summary

Migrate all Android Gradle build files from `JavaVersion.VERSION_11` /
`jvmTarget = "11"` to `VERSION_17` / `"17"` across the root build file and
all 16 module-level `.gradle.kts` files. This is a purely mechanical change
with no behavioral impact on the shipped APK.

This is a single PR, single phase.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | 0 |
| Remaining | 1 |
| Current / Next | phase-1 |
| Blockers | none |

## Goal

Make the Android build configuration consistent with the actual host JDK
requirement. AGP 8.x requires Java 17+ to run the Gradle build, but all
module `.gradle.kts` files currently declare `VERSION_11`, creating a
misleading discrepancy. Aligning them to `VERSION_17` removes the confusion
and accurately reflects what the build system already requires.

## Why Now

Companion to `tasks/install/java/` (the host Java provisioning task). Both
were identified together during an audit of the installer gap. Separated
because the Gradle migration touches 17 files and is a distinct concern from
the installer behavior.

## In Scope

- `build.gradle.kts` (root): `sourceCompatibility`, `targetCompatibility`,
  `languageVersion`, and `jvmTarget` in the detekt configuration.
- All 16 module-level `.gradle.kts` files under `apps/android/`: their
  `sourceCompatibility`, `targetCompatibility`, and `jvmTarget` settings.

## Out of Scope

- Do not change `minSdk`, `targetSdk`, `compileSdk`, or any Android API level.
- Do not change the `install.sh` installer or any other non-Gradle file.
- Do not add `gradle/gradle-daemon-jvm.properties`.
- Do not add or remove any Gradle plugin or dependency.

## Existing Artifact Scope

All 17 files exist and are in scope to edit. Only the Java version number
changes. All other content in each file is preserved as-is.

## Surfaces and Ownership

| Surface | Owned files |
| --- | --- |
| Root build | `build.gradle.kts` |
| App module | `apps/android/app-conformance/app-conformance.gradle.kts` |
| Shared app | `apps/android/shared/app/app-adapter/app-adapter.gradle.kts` |
| Shared app | `apps/android/shared/app/di/di.gradle.kts` |
| Shared core | `apps/android/shared/core/common/common.gradle.kts` |
| Shared core | `apps/android/shared/core/devicepackage/devicepackage.gradle.kts` |
| Shared core | `apps/android/shared/core/toolkit/toolkit.gradle.kts` |
| Shared data | `apps/android/shared/data/content-model/content-model.gradle.kts` |
| Shared data | `apps/android/shared/data/content/content.gradle.kts` |
| Shared data | `apps/android/shared/data/operator/operator.gradle.kts` |
| Shared data | `apps/android/shared/data/resources/resources.gradle.kts` |
| Shared data | `apps/android/shared/data/task/task.gradle.kts` |
| Shared data | `apps/android/shared/data/toolkit/toolkit.gradle.kts` |
| Shared data | `apps/android/shared/data/trigger/trigger.gradle.kts` |
| Shared data | `apps/android/shared/data/uitree/uitree.gradle.kts` |
| Shared data | `apps/android/shared/data/workflow/workflow.gradle.kts` |
| Shared test | `apps/android/shared/test/test.gradle.kts` |

## Source Of Truth

| Claim | Verify against |
| --- | --- |
| Files with Java 11 settings | `grep -rn "VERSION_11\|jvmTarget.*\"11\"\|languageVersion.*of(11)" apps/android build.gradle.kts --include="*.gradle.kts"` |
| Debug build passes | `./gradlew :app:assembleDebug` |
| Unit tests pass | `./gradlew testDebugUnitTest` |
| Release build passes | `./gradlew :app:assembleRelease` (no signing secrets needed locally - falls back to debug keystore) |
| How CI builds the release APK | `.github/workflows/release-apk.yml` - uses `./gradlew :app:assembleRelease` with Temurin 17 |

## Deterministic Versus Judgment

This task is entirely deterministic. Every occurrence of the following
patterns is changed:

| Find | Replace |
| --- | --- |
| `JavaVersion.VERSION_11` | `JavaVersion.VERSION_17` |
| `jvmTarget = "11"` | `jvmTarget = "17"` |
| `JavaLanguageVersion.of(11)` | `JavaLanguageVersion.of(17)` |

No judgment is required. Do not skip any file. Do not change any other value.

## Failure Modes To Prevent

- Changing only `build.gradle.kts` and missing the 16 module files - the
  module settings override root settings and the build surface remains split.
- Changing `minSdk`, `targetSdk`, `compileSdk`, or other numeric constants
  that happen to be `11` or `17` in a different context.
- Editing generated output or any file outside the 17 listed above.

## Output Contract

After the change:
- `grep -rn "VERSION_11\|jvmTarget.*\"11\"\|languageVersion.*of(11)" apps/android build.gradle.kts --include="*.gradle.kts"` returns zero results.
- `./gradlew :app:assembleDebug` succeeds.
- `./gradlew testDebugUnitTest` passes.
- `./gradlew :app:assembleRelease` succeeds locally without signing env vars
  (falls back to `scripts/debug.keystore`). The release build exercises R8
  minification, which the debug build skips. Both variants must pass.

## Idempotency

Re-running the grep verification after the change always returns zero results.
Re-running the build always succeeds if the host JDK is 17 or 21.

## Durable Follow-Up

None. The change is self-contained and fully captured in the committed
`.gradle.kts` files.
