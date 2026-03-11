# Task: Canonical Operator Install Command

## Goal

Introduce a single canonical Node CLI command that installs the Clawperator
Operator Android APK and brings it to a ready state in one operation.

This task exists to eliminate an invalid setup path that currently appears in
multiple places: installing the APK via raw `adb install` without immediately
granting required permissions.

The intended end state is:

1. agent-facing docs treat direct `adb install` as a low-level debugging tool,
   not the normal setup flow
2. the Node CLI exposes one canonical command for Operator installation and
   readiness
3. permission granting remains available as a remediation command, but is no
   longer the primary setup entrypoint

## Problem statement

Today the Operator can be installed without being made usable. That violates
the repo's deterministic runtime model.

`adb install` only copies the APK onto the device. It does not guarantee:

- accessibility service enabled
- notification posting permission granted where applicable
- notification listener enabled
- post-install verification that the runtime is actually ready

This leaves the device in a partial state where Clawperator appears installed
but is not actually operable.

The docs should explicitly state that agents should not use raw `adb install`
for normal setup. The CLI should offer a higher-level command that owns the
full workflow.

## Proposed command shape

Preferred command:

```bash
clawperator operator install --apk <path-or-url> [--device-id <id>] [--receiver-package <package>]
```

Why this name:

- `operator` scopes the command to the Android Operator artifact
- `install` is clear and conventional
- it avoids overloading the top-level `install` verb for unrelated future
  surfaces such as host setup or skills setup
- it is more precise than `provision`, which already has environment-oriented
  meaning in this repo

Alternative names considered but not preferred:

- `clawperator install`
  - too broad and likely to age poorly
  - still likely to be guessed by users and agents, so the CLI should handle it
    intentionally as a guidance path
- `clawperator install-operator`
  - workable, but less extensible than a scoped subcommand
- `clawperator operator provision`
  - sounds closer to environment preparation than APK installation

## Required command contract

`clawperator operator install` should:

1. resolve the target APK from a required `--apk` argument
2. install or upgrade the APK on the target device
3. determine the correct receiver package or validate an explicit one
4. grant required permissions by calling the same domain logic behind
   `grant-device-permissions`
5. run readiness verification after install and grant
6. fail the overall command if any required step fails

Required output expectations:

- canonical JSON output for agent callers
- explicit phase reporting in the result payload:
  - install
  - permission grant
  - verification
- stable failure semantics so agents know whether to retry, remediate, or stop

## Scope boundaries

This command should own only the Operator install-and-ready workflow.

It should not:

- replace emulator provisioning
- replace full `doctor`
- absorb unrelated host bootstrap concerns
- hide failures behind best-effort success messaging
- promote `clawperator install` to the canonical public command name

`grant-device-permissions` should remain available, but its documented purpose
should become recovery and remediation after install drift.

## Implementation plan

### 1. Add a scoped `operator` command family

Update the Node CLI parser and help text to support:

- `clawperator operator install`

If more Operator lifecycle actions are expected later, this gives them a stable
home without growing the top-level command namespace.

The parser should also handle likely mistaken invocations explicitly:

- `clawperator install`
- `clawperator install --help`

Recommended behavior:

- do not implement top-level `install` as the real setup command
- return a structured usage error or guidance message that points the caller to
  `clawperator operator install`
- keep this guidance deterministic and machine-readable in JSON mode so agent
  callers can recover cleanly

This is preferable to silently aliasing `clawperator install`, because it keeps
the CLI taxonomy explicit while still helping users and agents recover from the
most obvious guessed command.

Related files:

- `apps/node/src/cli/index.ts`
- `apps/node/src/cli/commands/`

### 2. Add APK install domain logic

Create a dedicated install path in Node that wraps the actual adb install call.

Requirements:

- accept a local filesystem path first
- define whether URL support is in scope for v1 or deferred
- return structured install results rather than raw shell text
- distinguish install failure from grant failure from verification failure

Likely files:

- new command module under `apps/node/src/cli/commands/`
- new device or install domain module under `apps/node/src/domain/`

### 3. Reuse existing permission grant logic

Do not duplicate permission-grant behavior. The new install command should call
the same domain path currently used by:

- `clawperator grant-device-permissions`
- `scripts/clawperator_grant_android_permissions.sh`

If needed, refactor the existing domain code so install and remediation
commands both consume one shared implementation.

### 4. Add post-install verification

The new command should verify more than "adb install exited 0".

Minimum expectation:

- package installed
- required permissions granted successfully

Preferred expectation:

- package installed
- required permissions granted successfully
- readiness verification run using existing doctor/readiness checks where
  practical without invoking unrelated full-environment diagnostics

This may require extracting a lighter-weight readiness check from the existing
doctor flow.

### 5. Define migration path for existing flows

Once `operator install` exists:

- docs should recommend it as the only normal install path
- `grant-device-permissions` should be reframed as remediation
- direct `adb install` examples should be removed or explicitly labeled as
  low-level debugging-only
- any installer or setup scripts that currently separate install and permission
  grant should be updated to prefer the new command where feasible

Areas to audit:

- `docs/android-operator-apk.md`
- `docs/first-time-setup.md`
- `docs/running-clawperator-on-android.md`
- `docs/node-api-for-agents.md`
- `docs/openclaw-first-run.md`
- `docs/troubleshooting.md`
- `sites/landing/public/install.sh`
- `scripts/install.sh`
- any Android gradle or helper scripts that mention direct APK install

### 6. Regenerate docs output

Any authored docs changes must be propagated into `sites/docs/docs/` using the
repo-local docs generation workflow.

Do not hand-edit generated docs pages.

## Documentation requirements

The public docs should make these points explicit:

1. installing the APK without granting permissions is an invalid setup state
2. agents should not use raw `adb install` as the standard setup flow
3. the canonical setup command is `clawperator operator install`
4. `grant-device-permissions` is for remediation and recovery
5. `clawperator install` is not the canonical command and should redirect the
   caller to `clawperator operator install`

The docs should also explain why this matters:

- deterministic automation requires the Operator to be both installed and
  granted the required device permissions
- a partially installed Operator is not ready for agent use

## Open design questions

These should be resolved before implementation begins:

1. Should `--apk` support local paths only in v1, or both local paths and URLs?
2. Should the command auto-detect the receiver package after install, or require
   `--receiver-package` when the APK variant is ambiguous?
3. How much verification should be built into the command itself vs delegated to
   extracted readiness checks?
4. Should the command support reinstall / downgrade flags, or keep v1 narrow?
5. Should there be a companion `clawperator operator status` command in the same
   task, or is that a separate follow-up?

## Validation plan

Before merge, validate at least:

1. Node build and tests:
   - `npm --prefix apps/node run build`
   - `npm --prefix apps/node run test`
2. CLI help and command-shape verification:
   - `clawperator operator install --help` or equivalent repo-local invocation
3. Device-level install flow:
   - install release APK
   - install debug APK
   - verify permissions granted automatically
   - verify failure behavior when permission grant fails
4. Relevant docs generation and build:
   - docs regeneration per repo skill
   - `./scripts/docs_build.sh`
5. Guidance-path verification:
   - `clawperator install`
   - `clawperator install --help`
   - confirm both point callers to `clawperator operator install` without
     silently introducing a second canonical command

## Non-goals for v1

- replacing every existing setup command with a new lifecycle framework
- redesigning `doctor`
- adding autonomous APK download/discovery if a simple `--apk` path contract is
  sufficient for the first version
