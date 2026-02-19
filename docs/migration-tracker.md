# Migration Tracker

## Status
- Branch: `codex/migrate-baseline-import`
- Plan: `docs/migrate-to-clawperator.md`

## Completed
- [x] Create migration plan doc
- [x] Import baseline ActionTask code into `clawperator`
- [x] Baseline compile check: `:app:assembleDebug`
- [x] Baseline install check: `:app:installDebug`
- [x] Baseline launch check on device
- [x] Baseline import commit
- [x] Rewrite project docs and agent instructions for Clawperator mission
- [x] Remove Firebase/FCM subsystem and dependencies
- [x] Re-run compile/tests/install/launch after Firebase removal
- [x] Restore Crashlytics after Firebase/FCM removal regression (Crashlytics retained by design)

## Baseline Validation Snapshot
Date: 2026-02-17

- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (inherited from source ActionTask baseline)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

Known inherited unit-test failures include:
- `:shared:core:common:compileDebugUnitTestKotlinAndroid`
- `:shared:core:devicepackage:compileDebugUnitTestKotlinAndroid`
- Source baseline (`<local_user>/src/ActionTask`) also shows additional failing areas under `:shared:data:toolkit` and `:shared:core:toolkit`.

## Next Slices
- [ ] Continue pruning non-operator modules iteratively
- [ ] Rename identifiers to `com.clawperator.operator` once structure stabilizes

## Slice 3.1 Validation Snapshot
Date: 2026-02-17

- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited failures; no new Firebase-related test failures introduced)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.1b Validation Snapshot (Crashlytics Restoration)
Date: 2026-02-17

- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited failures; no new failures introduced)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.2 Validation Snapshot (Prune Unused Presentation Graph)
Date: 2026-02-17

- Removed unused build-graph surfaces from active migration path:
  - dropped `:shared` dependency from `androidApp`
  - removed `:shared:presentation:compose-toolbox`, `:shared:presentation:image-ui`, `:shared:presentation:theme-ui` includes
  - removed stale references to removed modules from `shared/shared.gradle.kts`
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.3 Validation Snapshot (Remove Unused Google Auth Dependency)
Date: 2026-02-17

- Removed `libs.gms.play.services.auth` from:
  - `app/androidApp.gradle.kts`
  - `shared/app/app-adapter/app-adapter.gradle.kts`
  - `shared/di/di-base/di-base.gradle.kts`
  - `shared/test/test.gradle.kts`
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.4 Validation Snapshot (Trim Redundant app Module Edges)
Date: 2026-02-17

- Removed direct `androidApp` dependency edges for:
  - `:shared:data:task`
  - `:shared:data:uitree`
  - `:shared:data:workflow`
  - `:shared:domain:content-state`
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.5 Validation Snapshot (Remove Legacy Ad/Backup Metadata)
Date: 2026-02-17

- Removed unused legacy metadata and resource:
  - removed `com.google.android.backup.api_key` manifest meta-data
  - removed `app/src/main/res/values/strings_non_translatable.xml` (AdMob test id)
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.6 Validation Snapshot (Remove `shared/presentation` Tree)
Date: 2026-02-17

- Removed entire `<local_user>/src/clawperator/shared/presentation` source tree from repo.
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.7 Validation Snapshot (Remove `desktop*` and `ios*` Directories)
Date: 2026-02-17

- Removed all directories matching `desktop*` and `ios*` across repository source sets.
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.8 Validation Snapshot (Remove KMP desktop/iOS Gradle Wiring)
Date: 2026-02-17

- Removed remaining desktop/iOS Gradle wiring:
  - removed `desktop()` and `iOS()` target declarations/imports from module Gradle files
  - removed `desktopMain`/`desktopTest` and `ios*` source-set `getting` entries (including stale comments)
  - simplified `configureAllSourceSets` API to Android-only behavior and removed `configureDesktop`/`configureIos` arguments entirely
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (same inherited multi-module unit-test failures)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS

## Slice 3.9 Validation Snapshot (Strip Pixel Rendering Surface)
Date: 2026-02-17

- Removed rendering-focused files from `:shared:core:pixel` while retaining pixel data contracts used by operator/content flows:
  - removed compose helper package (`action.pixel.compose.*`)
  - removed render composition surface (`action.pixel.render.Render`, `RenderExtensions.compose`)
  - removed compose-only renderer adapters (`ViewRendererCompose`, `ViewRendererExtensions.compose`)
  - removed compose-only utility and shape-extension files
  - removed pixel window-frame extension files in `action.pixel.system.window.*`
- Kept the `:shared:core:pixel` module in place and preserved non-render model/types to avoid broad architecture churn.
- `./gradlew :app:assembleDebug` -> PASS
- `./gradlew testDebug` -> FAIL (inherited unit-test failures remain; no new pixel-related test task failures introduced)
- `./gradlew :app:installDebug` -> PASS
- `adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity` -> PASS
