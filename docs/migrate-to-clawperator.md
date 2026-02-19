# Migration Plan: ActionTask -> Clawperator

## Purpose
This document defines the implementation plan to migrate the previous `ActionTask` codebase into the new `Clawperator` repository with a narrower mission:

- Android-first, single-activity shell app
- App behavior driven by OpenClaw (external controller)
- Remove non-critical legacy subsystems (rendering/pixel UI, Firebase backend integration, user/account features, and other non-operator concerns)
- Land changes incrementally with compile + device verification + commit at every step

## Current Inputs and Observations

- Source history is available locally at `<local_user>/src/ActionTask`.
- Target repo is `<local_user>/src/clawperator` (currently initialized, no working tree files committed yet).
- The current ActionTask includes significant KMP/module surface area that is likely unnecessary for Clawperator's near-term scope.
- Existing operator architecture and recipes live mainly in:
  - `shared/data/operator`
  - `shared/data/task`
  - `shared/data/workflow`
  - Android wiring in `androidApp`
- Pivot commits for context are available locally; focus range is `ffcf95a..b67cf43` (last 24 hours of pivot work).

## Non-Negotiable Execution Loop
For every migration slice (no exceptions):

1. Apply a focused set of code changes.
2. Verify compile:
   - `./gradlew :app:assembleDebug`
3. Run unit tests currently in place:
   - `./gradlew testDebug` (or equivalent module-scoped unit test task after module moves)
4. Verify deploy + launch on connected Android device:
   - `./gradlew :app:installDebug`
   - `adb shell am start -n <applicationId>/<mainActivity>` (or project run task)
5. Run a smoke behavior check relevant to the slice.
6. Commit progress with clear conventional commit message.
7. Proceed to next slice.

If a slice fails compile, unit tests, or device smoke, fix before moving on.

## Migration Principles

- Keep changes small and reversible.
- Prefer removing entire modules/dependencies over partial dead-code retention.
- Preserve operator control path first; delete surrounding legacy surfaces second.
- Delay broad renaming until architecture and module boundaries stabilize.
- Keep app runnable at all times on Android device.

## Phase Plan

## Phase 0: Baseline and Guardrails
Goal: Establish a reproducible starting point and migration branch strategy.

Tasks:
- Create migration branch in `clawperator` (prefix `codex/`).
- Copy baseline project from `<local_user>/src/ActionTask` into `<local_user>/src/clawperator`.
- Ensure local env prerequisites (SDK path, Gradle, ADB) are valid.
- Run initial build/install/launch smoke test.
- Record baseline commands and expected outputs in docs.

Acceptance:
- Clawperator repo contains full imported baseline and compiles/runs on device.
- First baseline commit exists.

Baseline test status (captured during import):
- `./gradlew testDebug` currently fails in both `<local_user>/src/ActionTask` and `<local_user>/src/clawperator` due pre-existing unit-test compile issues.
- Initial known failing areas include:
  - `:shared:core:common:compileDebugUnitTestKotlinAndroid`
  - `:shared:core:devicepackage:compileDebugUnitTestKotlinAndroid`
- Additional failures also appear in source baseline under `:shared:data:toolkit` and `:shared:core:toolkit`.
- Migration slices must continue running unit tests; failures are treated as baseline debt until the owning modules are removed or fixed.

## Phase 1: Product Definition Docs (before heavy refactor)
Goal: Lock the new mission and repo conventions before code pruning.

Tasks:
- Rewrite `AGENTS.md` for Clawperator mission and migration workflow.
- Replace README with Clawperator-focused overview:
  - single-activity Android app
  - OpenClaw-controlled action execution role
  - explicit non-goals (launcher UI, Firebase/web backend, account system)
- Add/update docs:
  - architecture target (`docs/architecture.md`)
  - migration tracker/checklist (`docs/migration-tracker.md`)

Acceptance:
- Docs accurately define end-state and sequencing.
- Commit created after compile/deploy smoke to ensure docs match runnable baseline.

## Phase 2: Copy + Stabilize in Target Repo
Goal: Ensure imported code runs from `clawperator` repo without functional change.

Tasks:
- Validate Gradle wrapper and settings function unchanged post-copy.
- Confirm Android package install/launch from target repo path.
- Resolve any path/script assumptions still pointing at `ActionTask` root.

Acceptance:
- `clawperator` builds and installs identically to source baseline.
- Commit created.

## Phase 3: Prune by Vertical Slices (Iterative)
Goal: Remove non-critical code in safe, verifiable increments.

### Slice 3.1: Remove Firebase/remote backend surfaces (mandatory early slice)
Targets:
- `firebase/`
- Firebase/FCM ingestion, token registration, and status reporting paths
- related Gradle dependencies and manifest services/receivers not needed

Exception:
- Keep Firebase Crashlytics integration enabled for crash tracking. Accessibility permission is revoked by Android after app crashes, so crash visibility is mandatory.

Acceptance:
- App still builds/installs/launches.
- Operator control path for local/debug command ingress still functional.
- Commit created.

### Slice 3.2: Remove user/account/content/chatbot style data domains
Likely targets:
- non-operator modules under `shared/data/*`, `shared/domain/*`, `shared/presentation/*` not required for operator mission

Method:
- Remove module from `settings.gradle.kts`
- Remove dependency edges
- Fix compile and DI wiring
- Repeat until clean

Acceptance:
- Remaining module graph is materially smaller and operator-focused.
- Commit created.

### Slice 3.3: Remove rendering/pixel/theme/UI launcher concerns
Likely targets:
- pixel/resource-heavy presentation stacks
- home/launcher style UI flows

Target:
- single activity remains as thin shell for operator runtime and status visibility

Acceptance:
- App launches into minimal shell activity.
- Operator service/receiver pathways remain intact.
- Commit created.

### Slice 3.4: Simplify workflow/routine surfaces to essential action engine
Likely targets:
- legacy routines not required for near-term OpenClaw control
- hardcoded app flows beyond immediate mission

Acceptance:
- Core action execution path remains stable.
- Compile + smoke pass.
- Commit created.

## Phase 4: Move Android App to `/apps/android`
Goal: Align repo layout with future multi-app structure where Android-specific build code lives under `/apps/android` and generic project files remain at root.

### Current Structure (Pre-Move)
```
clawperator/
├── app/           # Android application module
├── shared/               # Shared KMP modules
│   ├── app/
│   ├── core/
│   ├── data/
│   ├── di/
│   └── system/
├── gradle/               # Gradle version catalogs
├── tooling/              # Custom Gradle plugins
├── build.gradle.kts      # Root build script
├── settings.gradle.kts   # Root settings
├── gradle.properties     # Root properties
└── ...
```

### Target Structure (Post-Move)
```
clawperator/
├── apps/
│   └── android/          # Android app workspace (self-contained)
│       ├── app/   # Android application module
│       ├── shared/       # Shared modules (still KMP for now)
│       │   ├── app/
│       │   ├── core/
│       │   ├── data/
│       │   ├── di/
│       │   └── system/
│       ├── gradle/       # Gradle version catalog (Android-specific)
│       │   └── libs.versions.toml
│       ├── tooling/      # Custom Gradle plugins for Android build
│       ├── build.gradle.kts      # Android app build script
│       ├── settings.gradle.kts   # Android app settings
│       └── gradle.properties     # Android app properties
├── scripts/              # Project-wide scripts
├── docs/                 # Documentation
├── ui-trees/             # UI tree documentation
├── .cursor/              # Editor config
├── .github/              # CI/CD workflows
├── README.md
└── AGENTS.md
```

### Tasks:

1. **Create `/apps/android` directory structure**
   ```bash
   mkdir -p apps/android
   ```

2. **Move Android-specific modules**
   - Move `app/` → `apps/android/app/`
   - Move `shared/` → `apps/android/shared/`

3. **Move Gradle build infrastructure to `apps/android/`**
   - Move `gradle/libs.versions.toml` → `apps/android/gradle/libs.versions.toml`
   - Move `tooling/` → `apps/android/tooling/`
   - Move `build.gradle.kts` → `apps/android/build.gradle.kts`
   - Move `settings.gradle.kts` → `apps/android/settings.gradle.kts`
   - Move `gradle.properties` → `apps/android/gradle.properties`
   - Move `gradlew` and `gradlew.bat` → `apps/android/`
   - Move `gradle/wrapper/` → `apps/android/gradle/wrapper/`

4. **Create minimal root placeholder files (if needed for IDE)**
   - Root `settings.gradle.kts` can be empty or contain just:
     ```kotlin
     // All Android build logic moved to apps/android/
     // Run builds from that directory
     ```

5. **Update all relative paths in moved modules**
   - Update any scripts referencing `rootProject` or relative paths
   - Update `scripts/` folder paths if they invoke Gradle

6. **Verify build from new location**
   ```bash
   cd apps/android
   ./gradlew :app:assembleDebug
   ```

### Path Updates Required:

**In `apps/android/settings.gradle.kts`:**
```kotlin
// New file - mirrors root settings but with corrected paths
include(
    ":app",
    ":shared:app:app-adapter",
    ":shared:core:common",
    // ... all shared modules
)
```

**In root `settings.gradle.kts`:**
```kotlin
// Option A: includeBuild (composite build)
includeBuild("apps/android")

// Option B: direct include with path mapping
include(":app")
project(":app").projectDir = file("apps/android/androidApp")
// ... map all modules
```

### Acceptance:
- `apps/android/` contains all Android app code AND build infrastructure
- Root directory contains only generic project files (docs, scripts, .github, .cursor)
- Build works from `apps/android/`: `cd apps/android && ./gradlew :app:assembleDebug`
- Install works from `apps/android/`: `cd apps/android && ./gradlew :app:installDebug`
- No Gradle build files remain at root (no root `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`)
- Commit created.

### Scope guard:
- Do not implement `/apps/node` in this migration.
- Generic files (docs, scripts, .cursor, .github) stay at root.
- Only Android app code and its supporting modules move to `/apps/android`.

---

## Phase 5: Remove KMP Complexity (Android-Only Conversion)
Goal: Convert KMP modules to Android-only modules, removing Kotlin Multiplatform complexity while preserving functionality.

### Rationale
Clawperator is Android-only for the foreseeable future. KMP adds build complexity (expect/actual, source sets, KMP plugins) without providing value.

### Module Migration Order (one module per commit)

Migrate in dependency order (leaves first, then consumers):

1. `apps/android/shared/core/common`
2. `apps/android/shared/core/devicepackage`
3. `apps/android/shared/core/toolkit`
4. `apps/android/shared/app/app-adapter`
5. `apps/android/shared/data/content`
6. `apps/android/shared/data/content-model`
7. `apps/android/shared/data/operator`
8. `apps/android/shared/data/resources`
9. `apps/android/shared/data/task`
10. `apps/android/shared/data/toolkit`
11. `apps/android/shared/data/trigger`
12. `apps/android/shared/data/uitree`
13. `apps/android/shared/data/workflow`
14. `apps/android/shared/di/di-base`
15. `apps/android/shared/test`

### Per-Module Migration Steps

For each module, follow this exact process:

1. **Update the module's `.gradle.kts` file**

   Change from:
   ```kotlin
   plugins {
       id("action.kmm.library")  // KMP plugin
   }
   
   kotlin {
       androidTarget()
       sourceSets {
           val commonMain by getting { ... }
           val androidMain by getting { ... }
           val commonTest by getting { ... }
           val androidUnitTest by getting { ... }
       }
   }
   ```
   
   To:
   ```kotlin
   plugins {
       id("com.android.library")  // Standard Android library
       id("org.jetbrains.kotlin.android")
   }
   
   android {
       namespace = "..."
       compileSdk = libs.versions.compileSdk.get()
       
       defaultConfig {
           minSdk = libs.versions.minSdk.get()
           testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
       }
       
       compileOptions {
           sourceCompatibility = JavaVersion.VERSION_17
           targetCompatibility = JavaVersion.VERSION_17
       }
       
       kotlinOptions {
           jvmTarget = "17"
       }
   }
   
   dependencies {
       // Move commonMain dependencies here
       // Move androidMain dependencies here
   }
   ```

2. **Restructure source directories**

   From KMP structure:
   ```
   src/
   ├── commonMain/kotlin/...
   ├── androidMain/kotlin/...
   ├── commonTest/kotlin/...
   └── androidUnitTest/kotlin/...
   ```
   
   To Android structure:
   ```
   src/
   ├── main/kotlin/...       (was commonMain + androidMain)
   ├── test/kotlin/...       (was commonTest + androidUnitTest)
   └── androidTest/kotlin/... (instrumented tests)
   ```

3. **Merge source files**
   - Copy all files from `commonMain/kotlin/` to `main/kotlin/`
   - Copy all files from `androidMain/kotlin/` to `main/kotlin/` (merge conflicts are rare)
   - Copy test files similarly
   - Delete empty KMP source directories

4. **Update imports in merged files**
   - Files moved from commonMain may need Android-specific imports
   - Remove `expect`/`actual` keywords (convert to regular classes/functions)
   - If expect/actual pattern was used, keep the Android implementation

5. **Update dependencies**
   - Convert `implementation(project(...))` paths if module names changed
   - Replace KMP-specific dependencies with Android equivalents
   - Example: `kotlinx-coroutines-core` → `kotlinx-coroutines-android`

6. **Verify build**
   ```bash
   ./gradlew :apps:android:shared:core:common:assembleDebug
   ./gradlew :apps:android:shared:core:common:testDebugUnitTest
   ```

7. **Commit**
   ```
   refactor(android): convert shared:core:common to Android-only
   
   - Removed KMP plugin
   - Merged commonMain and androidMain into main
   - Restructured source directories
   ```

### Common Conversion Patterns

**Pattern 1: Simple expect/actual**
```kotlin
// BEFORE (commonMain)
expect class PlatformHelper {
    fun getPlatformName(): String
}

// BEFORE (androidMain)
actual class PlatformHelper {
    actual fun getPlatformName() = "Android"
}

// AFTER (main)
class PlatformHelper {
    fun getPlatformName() = "Android"
}
```

**Pattern 2: Interface with platform implementations**
```kotlin
// BEFORE (commonMain)
interface DateFormatter {
    fun format(instant: Instant): String
}
expect fun createDateFormatter(): DateFormatter

// BEFORE (androidMain)
actual fun createDateFormatter() = AndroidDateFormatter()

// AFTER (main)
interface DateFormatter {
    fun format(instant: Instant): String
}
fun createDateFormatter() = AndroidDateFormatter()  // Direct creation
```

**Pattern 3: File path changes**
```kotlin
// build.gradle.kts changes:
// Remove: kotlin { sourceSets { ... } }
// Add: standard android { sourceSets { main { kotlin.srcDirs(...) } } }
```

### Dependencies to Update

Replace KMP dependencies with Android variants:
- `kotlinx-coroutines-core` → `kotlinx-coroutines-android`
- Keep: `kotlinx-serialization-json` (works on Android)
- Remove: KMP-specific testing dependencies if not needed

### Acceptance:
- All modules under `apps/android/shared/` are Android-only (no KMP)
- Build works from `apps/android/`: `cd apps/android && ./gradlew :app:assembleDebug`
- Tests work from `apps/android/`: `cd apps/android && ./gradlew testDebug`
- No `kotlin { }` blocks remain in any modules
- No `commonMain`, `androidMain` source sets remain
- All source is under `src/main/kotlin/` (Android structure)

---

## Phase 6: Rename ActionTask Identifiers -> Clawperator
Goal: Complete naming migration after structural churn settles.

### Rename Scope

**Package names:**
- `actiontask.*` → `clawperator.*`
- Keep `action.*` prefix (it's generic enough)

**Application identifier:**
- Current: `app.actiontask.operator` (or similar)
- Target: `com.clawperator.operator`

**Manifest actions and authorities:**
- `app.actiontask.operator.*` → `app.clawperator.operator.*`
- Update all `AndroidManifest.xml` entries

**Code strings and constants:**
- ActionTask mentions in logs, comments, user-facing strings
- File paths containing `actiontask`

### Staged Rename Passes

Do NOT rename everything at once. Use staged passes:

#### Pass 6.1: Core Domain Packages
Rename core operator packages that are stable:

```kotlin
// BEFORE
package actiontask.operator.command
package actiontask.operator.runtime
package actiontask.operator.accessibilityservice

// AFTER  
package clawperator.operator.command
package clawperator.operator.runtime
package clawperator.operator.accessibilityservice
```

Steps:
1. Rename directories: `mkdir -p clawperator/operator; mv actiontask/operator/* clawperator/operator/`
2. Update package declarations in all moved files
3. Update imports in all files referencing these packages
4. Update DI modules to reference new package names

#### Pass 6.2: Data Layer Packages
```kotlin
// BEFORE
package actiontask.data.model
package actiontask.data.repository

// AFTER
package clawperator.data.model
package clawperator.data.repository
```

#### Pass 6.3: Application ID and Manifest
Update `apps/android/app/androidApp.gradle.kts` (or build.gradle.kts):
```kotlin
android {
    defaultConfig {
        applicationId = "com.clawperator.operator"
        // ...
    }
}
```

Update `AndroidManifest.xml`:
```xml
<!-- BEFORE -->
<manifest package="com.actiontask.operator">
    <action android:name="app.actiontask.operator.ACTION_RUN_TASK" />

<!-- AFTER -->
<manifest package="com.clawperator.operator">
    <action android:name="app.clawperator.operator.ACTION_RUN_TASK" />
```

#### Pass 6.4: String Constants and Log Tags
```kotlin
// BEFORE
const val TAG = "[ActionTask-Operator]"
val ACTION = "app.actiontask.operator.ACTION"

// AFTER
const val TAG = "[Clawperator]"
val ACTION = "app.clawperator.operator.ACTION"
```

### Renaming Strategy Per File Type

**Kotlin/Java files:**
- Update `package` declaration
- Update all `import` statements
- Update fully-qualified class references

**Gradle files:**
- Update `namespace` in `android { }` block
- Application ID in `defaultConfig`

**Manifest files:**
- Update `package` attribute
- Update all `android:name` action strings
- Update authorities in providers

**Resource files (XML):**
- Update string resources mentioning ActionTask
- Keep generic strings (not brand-specific)

**Scripts:**
- Update package names in shell scripts
- Update ADB commands referencing old package

### Acceptance:
- No `actiontask` package prefixes remain in production code
- Application installs with `com.clawperator.operator` ID
- All manifest actions use `app.clawperator.operator` prefix
- Logs show `Clawperator` not `ActionTask`
- Commit created.

---

## Phase 7: Hardening and Definition of Done
Goal: Confirm final migrated state is coherent, minimal, and runnable.

Tasks:
- Final module/dependency audit for dead code.
- Verify key commands for OpenClaw-driven control path.
- Update docs with final architecture and runbook.

Definition of Done:
- Clawperator is a dumb single-activity Android shell.
- Core value is remote control from OpenClaw, not local feature/UI complexity.
- Non-critical ActionTask legacy systems are removed.
- Code compiles, installs, and launches on device.
- Migration history is cleanly committed in logical slices.

## Suggested Commit Rhythm
Examples:
- `chore(migration): import ActionTask baseline into clawperator`
- `docs: define clawperator mission and migration constraints`
- `refactor(migration): remove firebase subsystem`
- `refactor(migration): prune non-operator shared modules`
- `refactor(android): move android app to apps/android`
- `refactor(android): convert shared:core:common to Android-only`
- `chore(rename): rename actiontask.operator packages to clawperator.operator`

## Risks and Mitigations

- Risk: Removing modules breaks DI/build graph broadly.
  - Mitigation: prune one vertical slice at a time with mandatory compile/deploy/commit loop.
- Risk: Early renaming increases churn and conflicts.
  - Mitigation: rename late (Phase 6) after structural pruning.
- Risk: Operator path regresses while deleting surrounding code.
  - Mitigation: keep smoke tests for command ingress/action execution at each slice.
- Risk: KMP simplification becomes a large detour.
  - Mitigation: convert one module at a time, verify build after each.
- Risk: App relocation breaks relative paths.
  - Mitigation: test all build commands from new paths immediately after move.

## Operator Smoke Checklist (run each slice)
- Build debug APK.
- Run existing unit tests.
- Install on connected device.
- Launch app activity.
- Confirm accessibility service/runtime wiring still initializes.
- Trigger at least one operator debug/agent command path and verify logs/result.

## Locked Decisions (confirmed)
1. Remove Firebase/FCM and user/account-oriented remote control surfaces early in migration.
   - Keep Firebase Crashlytics only; remove Firestore/FCM and related user/account backend surfaces.
2. Do not implement `/apps/node` in this migration.
3. Final Android package/application identifier target is `com.clawperator.operator`.
4. Android-only conversion (Phase 5) is approved and required.
5. Pivot context commits in the ActinTask project to review are the last 24 hours, anchored by `ffcf95a` through `b67cf43`.
