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
- Validate the landing-site and docs-site generated outputs after the source
  edits land.

## Out of Scope

- Do not teach `clawperator doctor` to install Java.
- Do not change the Android app's runtime target or bytecode target.
- Do not add or depend on `gradle/gradle-daemon-jvm.properties`.
- Do not make Java 21 a hard requirement for the repo.

## Existing Artifact Scope

`N/A - existing artifacts only`

## Surfaces and Ownership

| Surface | Owned files | Notes |
| --- | --- | --- |
| Landing site install flow | `sites/landing/public/install.sh` | Primary implementation surface |
| Setup documentation | `docs/setup.md` | Must explain the new installer behavior |
| Doctor documentation | `docs/api/doctor.md` | Update only if wording needs to stay aligned with the installer flow |

## Source Of Truth

| Claim | Source of truth |
| --- | --- |
| Installer responsibilities | `sites/landing/public/install.sh` |
| Java build requirement | `apps/node/src/domain/doctor/checks/buildChecks.ts` |
| Doctor sequencing and `--full` behavior | `apps/node/src/domain/doctor/DoctorService.ts` |
| User-facing setup instructions | `docs/setup.md` |
| Doctor contract text | `docs/api/doctor.md` |

## Deterministic Versus Judgment

Deterministic:

- script plumbing
- environment detection
- docs wording that reflects implemented behavior
- site generation and build validation

Judgment:

- which package manager path to use on each supported OS
- which Java distribution and major version to provision
- how much remediation output to print when Java is already installed

## Decision Rules

1. Prefer Java 17 LTS as the host JDK to provision unless code-level evidence
   shows a different version is required.
2. Treat a preexisting valid Java install as sufficient and skip provisioning.
3. Preserve any existing `JAVA_HOME` or user-managed JDK install.
4. Keep host Java provisioning in the installer flow, not in `doctor`.
5. Never introduce a new dependency on a Gradle daemon criteria file to solve
   this task.

## Failure Modes To Prevent

- Accidentally turning the install flow into a JDK 21 requirement.
- Clobbering an existing Java install or overriding user-owned environment
  settings.
- Updating docs before the installer behavior exists.
- Letting `doctor` become a host mutator instead of a diagnostic command.
- Shipping a macOS-only or Linux-only path that breaks the installer contract.

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
