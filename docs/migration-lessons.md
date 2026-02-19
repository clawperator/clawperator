# Migration Lessons: KMP to Android-Only

This document captures lessons learned during the `ActionTask` to `Clawperator` migration to streamline future efforts.

## 1. Repository Structure (Phase 4)
- **Relative Path Fragility**: When moving modules deep into a new structure (e.g., `apps/android/shared/...`), relative paths in `build.gradle.kts` (like `file("../scripts/...")`) will break. 
- **Lesson**: Use `project.rootDir` or absolute paths during the transition, then normalize once the structure is stable.
- **Keystores & Scripts**: Ensure shared assets like `.android/debug.keystore` and utility shell scripts are accessible from the new module depths.

## 2. KMP Flattening (Phase 5)
- **The "Missing Module" Trap**: In KMP, logic is often highly fragmented (e.g., `core:math`, `core:unit`, `core:common`). When converting to a single Android library, you may need to merge multiple KMP modules into one to resolve circular or missing dependencies.
- **Lesson**: If a symbol is missing in `shared:core:common`, grep the *original* source repository to find which specific KMP module it lived in.

- **Expect/Actual Merging**:
    - **Lesson**: Always prefer the `androidMain` implementation. 
    - **Step**: Copy `actual` code into the `common` file, remove the `expect` declaration, and delete the `.android.kt` file.
    - **Step**: Remove the `actual` keyword from functions and classes.

- **Resource Namespace Changes**:
    - **Lesson**: Android `R` classes are tied to the `namespace` defined in `build.gradle.kts`. 
    - **Fix**: When moving code, update imports from `import action.common.R` to the correct generated resource package (e.g., `import actionlauncher.resources.R as ResourcesR`).

## 3. Build & Environment
- **Sandbox Restrictions**: Gradle builds require network (to download dependencies) and full filesystem access (to set executable permissions on `gradlew`).
- **Lesson**: Always run initial migration builds with `required_permissions: ["all"]`.

## 4. Troubleshooting Loops
- **Lesson**: If `grep` fails to find a symbol you *know* exists, check if you are using relative paths in a shell that has changed directory. Use absolute paths for `grep` and `ls` during complex migrations.
