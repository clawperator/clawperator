# Java Host Provisioning for Install Flow

Created: 2026-04-07

## Executive Summary

Add host Java provisioning to Clawperator's one-command install path so a
fresh macOS or Linux machine can reach a build-ready state without the user
manually sourcing a JDK first.

This is a single PR with two phases:

1. implement the installer behavior
2. update the public docs and validate the generated site output

The existing `doctor` command stays diagnostic. It should continue to report
Java requirements, not mutate the host.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | 0 |
| Remaining | 2 |
| Current / Next | phase-1 |
| Blockers | none |

## Goal

Make the Clawperator install experience cover the full host prerequisite set
for local development and full Android build checks, including Java, while
preserving deterministic behavior and clear diagnostics.

## Why Now

The public installer already provisions Node, adb, git, the CLI, the Operator
APK, and device setup, but it still leaves Java to the user. That is a gap for
the common "install and build" workflow because `doctor --full` and source
builds require a host JDK.

## In Scope

- Add Java detection and provisioning to `sites/landing/public/install.sh`.
- Keep the existing installer flow deterministic and idempotent.
- Update setup docs to reflect the new installer capability and the remaining
  prerequisites.
- Validate the landing-site and docs-site generated outputs after the source edits land.

## Out of Scope

- Do not teach `clawperator doctor` to install Java.
- Do not add or depend on `gradle/gradle-daemon-jvm.properties`.
- Do not make Java 21 a hard requirement for the repo.
- Do not change any Gradle build files (`build.gradle.kts` or module-level
  `.gradle.kts` files). The Android build toolchain migration from Java 11 to
  Java 17 is a separate task: `tasks/android/java17-migration/`.

## Existing Artifact Scope

`N/A - existing artifacts only`

## Surfaces and Ownership

| Surface | Owned files | Notes |
| --- | --- | --- |
| Landing site install flow | `sites/landing/public/install.sh` | Primary implementation surface |
| Doctor check unit tests | `apps/node/src/test/unit/doctor/buildChecks.test.ts` | Create - locks down the version-string patterns used by both the doctor and the installer |
| Setup documentation | `docs/setup.md` | Must explain the new installer behavior |
| Doctor documentation | `docs/api/doctor.md` | Update only if wording needs to stay aligned with the installer flow |

## Source Of Truth

| Claim | Source of truth |
| --- | --- |
| Installer responsibilities | `sites/landing/public/install.sh` |
| Accepted Java versions and exact version-string match patterns | `apps/node/src/domain/doctor/checks/buildChecks.ts` (line 11) |
| Doctor sequencing and `--full` behavior | `apps/node/src/domain/doctor/DoctorService.ts` |
| User-facing setup instructions | `docs/setup.md` |
| Doctor contract text | `docs/api/doctor.md` |

### Why Java 17, not Java 11

The Android module `.gradle.kts` files set `sourceCompatibility = JavaVersion.VERSION_11`.
This is the **bytecode compatibility target** for the compiled Android app, not
the host JDK requirement. AGP 8.x requires Java 17+ as the host JDK to run the
Gradle build, and the doctor check correctly enforces this by accepting only
Java 17 or 21.

The installer must provision Java 17, not Java 11. The bytecode target migration
is tracked separately in `tasks/android/java17-migration/`.

### Exact accepted patterns from `buildChecks.ts`

```
version "17   (e.g. openjdk version "17.0.x")
version "21   (e.g. openjdk version "21.0.x")
openjdk 17    (alternate output format)
openjdk 21    (alternate output format)
```

Any `java -version` output that does not contain at least one of the above strings
is an incompatible install. The installer's version check must use these same
patterns - not a numeric comparison, not a ">=17" check, not just checking that
`java` resolves on PATH.

## Deterministic Versus Judgment

Deterministic:

- script plumbing
- environment detection
- version-string matching (must mirror `buildChecks.ts` exactly)
- distribution choice (Temurin - see Decision Rules)
- docs wording that reflects implemented behavior
- site generation and build validation

Judgment:

- how much remediation output to print when Java is already installed

## Decision Rules

1. **Distribution:** use the following per-platform targets when Java must be
   installed. Temurin is the macOS target (TCK-verified, no Oracle license
   friction, one-command Homebrew install). On Linux, distro-packaged OpenJDK 17
   is used instead - adding the Adoptium apt repo just to get Temurin adds GPG
   key and source-list setup complexity for no functional benefit, since OpenJDK
   17 also passes the doctor check.

   | Platform | Command | Notes |
   | --- | --- | --- |
   | macOS (Homebrew present) | `brew install --cask temurin@17` | Preferred |
   | macOS (no Homebrew) | print error + point to `https://adoptium.net/temurin/releases/` + return 1 | Same pattern as adb on macOS without Homebrew |
   | Linux/apt | `sudo apt-get install -y openjdk-17-jdk` | In default Ubuntu/Debian repos; no extra repo setup needed |
   | Linux/pacman | `sudo pacman -S --noconfirm jdk17-openjdk` | In default Arch repos |

   **Do not install anything when any valid Java is already present.** A valid
   install is any distribution whose `java -version` output matches the accepted
   patterns (see Rule 3). The existing distribution is irrelevant.

2. The accepted Java versions are exactly **17 and 21**. This is the check in
   `apps/node/src/domain/doctor/checks/buildChecks.ts` via string matching on
   `version "17`, `version "21`, `openjdk 17`, `openjdk 21`. Java 11, 18, 19,
   20, 22, or any other major version fails the doctor check.

3. A "valid" existing install is one that passes the doctor check: `java -version`
   output contains `version "17`, `version "21`, `openjdk 17`, or `openjdk 21`.
   Match this exactly - do not use a numeric comparison or a ">=17" check.
   Note: `checkJavaVersion` currently returns the summary `"Java 17+ is installed."`
   on success, which implies 18+ is accepted when it is not. User-facing messaging
   in the installer and in `buildChecks.ts` should say "Java 17 or 21" - not
   "Java 17+". Do not silently perpetuate this wording in new installer output.

4. Three-state detection is required. The installer must distinguish:
   - **missing**: `java` not on PATH - provision per Rule 1.
   - **valid**: present and passes the doctor version check - skip provisioning,
     report version found.
   - **incompatible**: present but does not pass the doctor version check (e.g.,
     Java 11, 22, 23) - warn the user, then provision per Rule 1 without
     overwriting the existing installation or overriding `JAVA_HOME`. After
     install, confirm the new JDK is resolvable on PATH. If the package manager
     would require destructively removing the existing JDK, stop, print a clear
     error pointing to `https://adoptium.net/temurin/releases/`, and return 1.

5. Preserve any existing `JAVA_HOME` or user-managed JDK install when a valid
   Java is present. Do not mutate `JAVA_HOME` when a valid Java already exists.

6. Keep host Java provisioning in the installer flow, not in `doctor`.

7. Never introduce a new dependency on a Gradle daemon criteria file to solve
   this task.

## Failure Modes To Prevent

- Using a two-state detection ("present" vs "missing") that silently skips
  provisioning when a user has Java 11 or Java 22 - the doctor will still fail
  and the user gets no useful error.
- Using a looser version check in the installer (e.g., `java -version` succeeds
  and any output is treated as valid) that diverges from the exact string-match
  logic in `buildChecks.ts`.
- Accidentally turning the install flow into a JDK 21 requirement.
- Installing Java 17 alongside Java 22 but having the PATH still resolve to Java
  22 after install, so the doctor check still fails.
- Clobbering an existing Java install or overriding user-owned environment
  settings.
- Updating docs before the installer behavior exists.
- Letting `doctor` become a host mutator instead of a diagnostic command.
- Shipping a macOS-only or Linux-only path that breaks the installer contract.
- Treating the existing `JAVA_HOME` as the final answer without running the
  version check - `JAVA_HOME` may point to an incompatible version.

## Output Contract

- `install.sh` provisions Java when it is missing, then continues with the
  existing setup flow.
- If Java is already present, the script reports that fact and moves on.
- The docs describe the installer as handling Java for supported hosts.
- `doctor --full` continues to report Java requirements for manual or source
  build paths.

## Idempotency

- Re-running the installer on a host with a valid JDK should not reinstall or
  reconfigure Java.
- Re-running the docs build should not change source files.
- The installer should preserve user-owned environment state outside the
  Clawperator-specific paths it already manages.

## Durable Follow-Up

If the Java install implementation ends up requiring a large OS-specific
matrix, capture that in permanent docs rather than leaving it only in the task
pack. Otherwise no durable follow-up is expected from this task.
