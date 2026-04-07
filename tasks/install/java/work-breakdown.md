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
- Do not make Java 21 the required install target unless the code forces that
  decision.
- Preserve the current installer responsibilities for Node, adb, git, CLI,
  APK download, and device setup.
- Update docs only after the behavior exists in source.
- Do not overwrite user-owned Java configuration if a valid JDK is already on
  the host.

## Required Reading

- `sites/landing/public/install.sh`
- `docs/setup.md`
- `docs/api/doctor.md`
- `apps/node/src/domain/doctor/checks/buildChecks.ts`
- `apps/node/src/domain/doctor/DoctorService.ts`

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Close the host Java provisioning gap in the install flow and align docs | phase-1, phase-2 | thinking for phase-1, default for phase-2 | all validation commands pass |

## Phase 1: Add Java Provisioning to the Installer

### Agent Tier

thinking

### Goal

Teach `sites/landing/public/install.sh` to detect an acceptable Java install
and provision one when needed before the rest of the install flow depends on it.

### Required Steps

1. Read the current installer flow end to end, especially the `main()` path
   and the `run_doctor_and_fix()` helper.
2. Add a Java detection helper that distinguishes "Java present" from
   "Java missing" without clobbering the host.
3. Add OS-specific provisioning for supported hosts using the existing
   installer style of explicit package-manager branching.
4. Choose the Java major version once, use it consistently, and keep the
   choice aligned with the repo's documented build requirements.
5. Make the installer output clear about whether Java was found, installed, or
   skipped.
6. Keep the rest of the install sequence working after Java provisioning.
7. Verify the shell syntax and do a realistic local smoke pass on a disposable
   host or environment.

### Implementation Notes

- Prefer the smallest change that makes the installer self-sufficient for Java
  on the supported macOS and Linux paths.
- If the implementation needs a helper function, keep it inside the installer
  script unless a shared helper is genuinely warranted.
- Do not thread Java installation through `doctor`; the installer owns the
  remediation.

### Phase 1 Validation

- `bash -n sites/landing/public/install.sh`
- One local install smoke run in a disposable environment or against a safe
  test host

## Phase 2: Update Docs and Validate Site Outputs

### Agent Tier

default

### Goal

Update the public setup docs so they accurately describe the installer's new
Java provisioning behavior and then validate the generated docs and landing
site outputs.

### Required Steps

1. Update `docs/setup.md` to state that the installer now handles Java for the
   supported host setup path.
2. Update `docs/api/doctor.md` only if its wording needs to stay aligned with
   the new installer behavior.
3. Rebuild the docs site and landing site from source, not by editing generated
   output.
4. Confirm that the generated outputs reflect the source changes and that no
   stale text remains.

### Phase 2 Validation

- `./scripts/site_build.sh`
- `./scripts/docs_build.sh`

## Completion Criteria

- The installer provisions Java on supported hosts when needed.
- Existing hosts with Java already installed are left alone.
- The docs say exactly what the installer now does.
- Both public site builds succeed from source.

## Notes for the Implementer

- If the installer behavior ends up depending on a new helper or test harness,
  add only the minimum new file(s) needed to keep the flow deterministic.
- If a later review shows the Java package choice should change, capture that
  as a separate follow-up rather than expanding this task silently.
