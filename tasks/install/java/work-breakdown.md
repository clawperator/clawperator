# Java Host Provisioning for Install Flow Work Breakdown

Parent plan: `tasks/install/java/plan.md`

## Executive Summary

One PR, two phases. Phase 1 implements Java provisioning in the installer
flow. Phase 2 updates docs and validates the generated site outputs.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | 0 |
| Remaining | 2 |
| Current / Next | phase-1 |
| Blockers | none |

## Hard Rules

- Keep `doctor` read-only for Java. Do not add Java installation logic there.
- Do not add or depend on `gradle/gradle-daemon-jvm.properties`.
- Upgrade `build.gradle.kts` from Java 11 to Java 17 for the toolchain,
  sourceCompatibility, targetCompatibility, and detekt jvmTarget. Do not
  change minSdk, targetSdk, compileSdk, or any other settings.
- The install target is Java 17 LTS. Do not provision Java 21 unless Java 17 is
  unavailable on the target platform.
- The version check in the installer must match the exact string-match logic in
  `buildChecks.ts` (lines 11-12): accepted strings are `version "17`, `version "21`,
  `openjdk 17`, `openjdk 21`. Do not use a numeric comparison or a ">=17" check.
- Three-state detection is required - see plan Decision Rule 4. Do not implement
  a two-state "present vs missing" check.
- When Java is present but incompatible, warn the user and attempt to install
  Java 17 via the package manager without destructively removing the existing
  install. If the package manager would require removing the existing JDK, stop
  and print a clear manual remediation message instead.
- Do not mutate `JAVA_HOME` when a valid Java already exists on the host.
- Preserve the current installer responsibilities for Node, adb, git, CLI,
  APK download, and device setup.
- Update docs only after the behavior exists in source.
- Do not overwrite user-owned Java configuration if a valid JDK is already on
  the host.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/install/java/plan.md` | Stable contract, decision rules, version check patterns, and AGP rationale |
| `apps/node/src/domain/doctor/checks/buildChecks.ts` | The exact string patterns that determine whether a Java install is valid (`version "17`, `version "21`, `openjdk 17`, `openjdk 21`). The installer must mirror this check exactly. |
| `build.gradle.kts` | Contains `sourceCompatibility = JavaVersion.VERSION_11` - this is a bytecode target, not a host JDK requirement. Do not treat it as evidence that Java 11 is acceptable. |
| `gradle/libs.versions.toml` | AGP version (8.13.2). AGP 8.x requires Java 17+ host JDK. |
| `gradle/wrapper/gradle-wrapper.properties` | Gradle 8.13. Confirms build tool versions in use. |
| `sites/landing/public/install.sh` | Current installer flow. Read the `main()` function and all `check_*` helpers to understand the pattern to follow. |
| `docs/setup.md` | User-facing setup instructions - update in phase 2. |
| `docs/api/doctor.md` | Doctor contract text - update only if wording needs alignment. |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Close the host Java provisioning gap in the install flow and align docs | phase-1, phase-2 | thinking for phase-1, default for phase-2 | all validation commands pass |

## Phase 1: Upgrade Gradle Toolchain and Add Java Provisioning to the Installer

### Agent Tier

thinking

### Goal

1. Upgrade the Gradle build toolchain from Java 11 to Java 17 in `build.gradle.kts`.
2. Teach `sites/landing/public/install.sh` to detect an acceptable Java install
   and provision one when needed before the rest of the install flow depends on it.

### Files or Surfaces To Change

- `build.gradle.kts` - toolchain and sourceCompatibility/targetCompatibility upgrade
- `sites/landing/public/install.sh` - Java detection and provisioning helper

### Required Steps

1. Read all required reading files in the order listed. Pay particular attention
   to the version-check patterns in `buildChecks.ts` and the `check_*` helper
   pattern in `install.sh`.
2. **Upgrade `build.gradle.kts`:**
   - Change `sourceCompatibility = JavaVersion.VERSION_11` to `JavaVersion.VERSION_17`
     in both `JavaPluginExtension` and `BaseExtension.compileOptions` blocks.
   - Change `targetCompatibility = JavaVersion.VERSION_11` to `JavaVersion.VERSION_17`
     in both blocks.
   - Change `toolchain { languageVersion.set(JavaLanguageVersion.of(11)) }` to `of(17)`.
   - Change `jvmTarget = "11"` in the detekt task configuration to `"17"`.
   - Do not change minSdk, targetSdk, compileSdk, or any other settings.
3. **Add a three-state Java detection helper to `install.sh`:**
   - The helper must distinguish these states using the exact version-string
     patterns from `buildChecks.ts`:
     - `version "17` or `openjdk 17` in `java -version` output - **valid**, skip
     - `version "21` or `openjdk 21` in `java -version` output - **valid**, skip
     - `java` not found on PATH - **missing**, provision Java 17
     - `java` found but none of the above patterns match - **incompatible**,
       warn the user, then proceed to provision Java 17 via package manager
       without overwriting the existing install or `JAVA_HOME`
   - Do not use a numeric comparison or a ">=17" test. Use substring matching
     that mirrors the exact patterns in `buildChecks.ts`.
4. **Add OS-specific Java 17 provisioning:**
   - Follow the existing `check_adb` / `check_git` helper style: explicit
     package-manager branching with colored output and clear success/failure messages.
   - macOS with Homebrew: `brew install --cask temurin@17`. After install, set
     `JAVA_HOME` to the Homebrew Caskroom path for temurin@17 if and only if no
     valid `JAVA_HOME` was already present.
   - macOS without Homebrew: print an error pointing to
     `https://adoptium.net/temurin/releases/` and return 1. Same pattern as
     `check_adb` on macOS without Homebrew.
   - Linux/apt: `sudo apt-get install -y openjdk-17-jdk`. This package is in the
     default Ubuntu/Debian repos and requires no extra repo setup. Do not add the
     Adoptium apt repo.
   - Linux/pacman: `sudo pacman -S --noconfirm jdk17-openjdk`
   - After provisioning, re-run the version check. If it still does not produce
     a valid result, print a clear error message and return 1.
   - For the incompatible-version case: if provisioning via package manager would
     require removing the existing JDK (detected when the package manager reports
     a conflict), stop, print a clear manual remediation message pointing to
     `https://adoptium.net/temurin/releases/`, and return 1.
5. **Wire the Java check into `main()`** in the correct position: after `validate_os`
   and before `check_node`. Java is a build prerequisite; it should be resolved early.
6. Make the installer output clear about which state was detected and what action
   was taken (found valid, installed, warned+installed, or failed).
7. Keep the rest of the install sequence working after Java provisioning.

### Implementation Notes

- The Java detection helper must use the same substring match patterns as
  `buildChecks.ts`. Do not re-derive the acceptance rule.
- Keep the helper inside `install.sh`. Do not create a separate script.
- Do not thread Java installation through `doctor`.

### Acceptance Criteria

**Mechanical:**
- `bash -n sites/landing/public/install.sh` exits 0.
- `./gradlew :app:assembleDebug` succeeds on a host with Java 17.
- `./gradlew testDebugUnitTest` passes.
- `grep -n "JavaVersion.VERSION_17" build.gradle.kts` returns at least 2 matches
  (both the `JavaPluginExtension` and `BaseExtension.compileOptions` blocks).
- `grep "languageVersion.set(JavaLanguageVersion.of(17))" build.gradle.kts`
  returns a match.
- `grep 'jvmTarget = "17"' build.gradle.kts` returns at least 2 matches.

**Human review:**
- The Java detection helper uses the exact substring patterns from `buildChecks.ts`,
  not a looser check.
- The incompatible-version case produces a clear user-facing warning before attempting
  provisioning.
- No existing installer helper behavior is broken. The `check_node`, `check_adb`,
  `check_git` flow is unchanged.
- The `build.gradle.kts` changes affect only the toolchain/jvmTarget lines; no
  other configuration was touched.

### Phase 1 Validation

```bash
bash -n sites/landing/public/install.sh
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
```

One local install smoke run in a disposable environment or against a safe test host.

### Expected Commit

```text
feat(install): upgrade Gradle toolchain to Java 17 and add Java provisioning to installer
```

## Phase 2: Update Docs and Validate Site Outputs

### Agent Tier

default

### Goal

Update the public setup docs so they accurately describe the installer's new
Java provisioning behavior and the Gradle Java 17 requirement, then validate
the generated docs and landing site outputs.

### Files or Surfaces To Change

- `docs/setup.md` - primary authored content to update
- `docs/api/doctor.md` - update only if wording needs alignment
- `sites/docs/.build/` - regenerate from source using the docs-build skill; do not hand-edit

### Required Steps

1. Use `.agents/skills/docs-author/SKILL.md` for this phase. Do not re-specify
   the docs workflow from scratch.
2. Update `docs/setup.md`:
   - State that the installer now handles Java 17 provisioning for supported host paths.
   - State that Java 17 or 21 is required as the host JDK (the Gradle build and
     doctor check require it; Java 11 is not sufficient even though the Android
     app bytecode targets Java 11 for minSdk compatibility).
   - Remove or correct any text that suggests Java 11 is an acceptable host JDK.
3. Update `docs/api/doctor.md` only if its Java wording needs alignment with the
   new installer behavior or the Java 17 requirement.
4. Rebuild the docs site and landing site from source only. Do not edit
   `sites/docs/.build/` directly.
5. Confirm that the generated outputs reflect the source changes and no stale
   text remains.

### Acceptance Criteria

**Mechanical:**
- `./scripts/site_build.sh` exits 0.
- `./scripts/docs_build.sh` exits 0.
- `grep -r "Java 11" docs/setup.md` returns no matches that imply Java 11 is
  an acceptable host JDK (mentions explaining the bytecode target vs host JDK
  distinction are acceptable).

**Human review:**
- `docs/setup.md` accurately describes what the installer now handles.
- No claim in the docs exceeds the implemented installer behavior.
- The distinction between "Java 11 bytecode target" and "Java 17 host JDK
  requirement" is clear if both are mentioned.

### Phase 2 Validation

```bash
./scripts/site_build.sh
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(setup): update Java requirements and installer behavior after Java 17 provisioning
```

## Completion Criteria

- `build.gradle.kts` uses Java 17 for the toolchain, sourceCompatibility,
  targetCompatibility, and detekt jvmTarget.
- `./gradlew :app:assembleDebug` and `./gradlew testDebugUnitTest` pass.
- The installer provisions Java 17 on supported hosts when no valid JDK is found.
- Hosts with Java 17 or 21 already installed are left alone.
- Hosts with an incompatible Java version get a clear warning and a Java 17
  install attempt without clobbering the existing install.
- The docs accurately describe the Java 17 host JDK requirement and what the
  installer now handles.
- Both public site builds succeed from source.

## Notes for the Implementer

- If the installer behavior ends up depending on a new helper or test harness,
  add only the minimum new file(s) needed to keep the flow deterministic.
- If a later review shows the Java package choice should change, capture that
  as a separate follow-up rather than expanding this task silently.
