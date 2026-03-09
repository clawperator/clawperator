# Android Emulator Support Implementation Plan

## Purpose

Add first-class Android emulator provisioning support to Clawperator while keeping bootstrap installation small and focused.

This work introduces emulator discovery, creation, lifecycle management, and provisioning in the Node API and CLI. It provides a supported alternative runtime to the physical Android device workflow.

This document is intended to be self-contained. An implementing agent should be able to read only this file and complete the feature without needing the original request.

## Product Goals

Clawperator currently assumes a connected Android device reachable through `adb`. This feature expands the supported runtime model so that Clawperator can:

- discover configured Android Virtual Devices (AVDs)
- discover running Android emulators
- identify which emulator configurations are supported by Clawperator
- reuse a compatible running emulator when available
- start a compatible existing AVD when available
- create a new compatible AVD when needed
- boot the emulator and wait until Android is ready
- return a usable ADB serial for subsequent Clawperator operations

The implementation must preserve Clawperator's current architecture:

- `install.sh` remains minimal and does not own emulator lifecycle logic
- Node CLI and Node HTTP API remain the canonical agent-facing interfaces
- emulator management remains deterministic and contract-driven
- Clawperator remains an actuator, not a planner

## Non-Goals

The following are intentionally out of scope for this work:

- snapshot management
- advanced emulator GPU tuning
- browser-based emulator access
- multi-user or multi-tenant emulator hosting
- arbitrary AVD configuration editing UI
- generalized Android SDK installation bootstrap
- moving emulator logic into `install.sh`

## Assumptions

The implementation may assume:

- Clawperator is already installed
- the Android SDK is already installed on the host
- `adb`, `emulator`, `sdkmanager`, and `avdmanager` are available in `PATH`
- the Node runtime and Clawperator CLI already exist
- the Operator APK installation workflow remains separate from emulator provisioning

## Architectural Rules

### Separation of Responsibilities

`scripts/install.sh` is responsible only for:

- installing the Clawperator CLI
- installing Node dependencies
- downloading and installing the Operator APK
- basic environment bootstrap

`install.sh` must not:

- create AVDs
- inspect emulator compatibility
- start or stop emulators
- orchestrate emulator provisioning

All emulator lifecycle behavior belongs in the Node API and CLI.

### Runtime Model

Clawperator already treats devices as ADB targets. Emulator support should preserve this model:

- emulator provisioning returns an ADB serial
- once provisioned, the emulator should be usable anywhere a physical device serial is usable
- existing execution, observe, package, version, and permission flows should continue working with the returned serial

### Determinism

The emulator subsystem must avoid hidden heuristics. Compatibility decisions and reuse decisions should be explainable and machine-readable.

Required properties:

- deterministic compatibility checks
- explicit supported vs unsupported labeling
- explicit reuse order
- bounded timeouts during boot and provisioning
- structured outputs for both CLI and HTTP API

## High-Level User Experience

### Primary Provisioning Command

Canonical command:

```bash
clawperator provision emulator
```

Required alias:

```bash
clawperator emulator provision
```

These commands must behave identically.

### Additional Emulator Commands

The CLI must add:

```bash
clawperator emulator list
clawperator emulator inspect <name>
clawperator emulator create
clawperator emulator start <name>
clawperator emulator stop <name>
clawperator emulator delete <name>
clawperator emulator status
```

### HTTP API Endpoints

The Node HTTP server started by `clawperator serve` must add:

```text
GET    /android/emulators
GET    /android/emulators/:name
GET    /android/emulators/running

POST   /android/emulators/create
POST   /android/emulators/:name/start
POST   /android/emulators/:name/stop
DELETE /android/emulators/:name

POST   /android/provision/emulator
```

## Reuse Policy

Provisioning must prefer reuse in this order:

1. running supported emulator
2. stopped supported AVD
3. create new supported AVD

Provisioning must not create duplicate compatible AVDs unnecessarily.

Unsupported AVDs may exist on the host. They must be visible in listing and status output, but provisioning must not automatically choose them.

## Compatibility Policy

Clawperator must define an explicit support policy for emulator selection.

### Supported Characteristics

A supported AVD must satisfy all required characteristics:

- Google Play enabled system image
- supported Android API level
- supported ABI
- supported device profile

### Default Supported Configuration for Creation

Newly created AVDs should default to a profile equivalent to:

- device profile: Pixel 7
- Google Play image
- Android API level 35
- supported ABI

The initial requested package example is:

```text
system-images;android-35;google_apis_playstore;arm64-v8a
```

### ABI Selection Guidance

Do not blindly hardcode one ABI everywhere if the host cannot support it well.

Implementation requirement:

- centralize compatibility rules in code
- define the default desired package in one place
- keep room for host-aware ABI selection if required

If a single ABI is selected for v1, document that choice clearly and ensure all compatibility checks align with it.

### Default v1 Values

Unless implementation discovers a hard blocker, v1 should standardize on:

- default AVD name: `clawperator-pixel`
- default device profile: `pixel_7`
- supported Android API level: `35`
- Google Play system image package derived from the supported API level and chosen ABI

Avoid dynamically generated AVD names in v1. A stable default name simplifies reuse and duplicate-avoidance logic.

### Unsupported AVD Labeling

AVDs that fail compatibility checks must still be reported by `list` and the API. They should include:

- `supported: false`
- stable reason codes or reason strings explaining why they are unsupported

Examples:

- `missing_play_store`
- `unsupported_api_level`
- `unsupported_abi`
- `unsupported_device_profile`

## Required Domain Model

The emulator subsystem should expose explicit models rather than raw command output.

### Configured AVD Model

Suggested shape:

```json
{
  "name": "clawperator-pixel",
  "exists": true,
  "apiLevel": 35,
  "playStore": true,
  "abi": "arm64-v8a",
  "deviceProfile": "pixel_7",
  "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
  "running": false,
  "supported": true,
  "unsupportedReasons": []
}
```

### Running Emulator Model

Suggested shape:

```json
{
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true,
  "supported": true,
  "unsupportedReasons": []
}
```

### Provision Result Model

Suggested shape:

```json
{
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true,
  "created": false,
  "started": true,
  "reused": true
}
```

The exact field names may vary, but the result must clearly indicate:

- the AVD name
- the ADB serial
- whether the device is booted
- whether it was reused or newly created

## Current Codebase Constraints

The current Node implementation has a few important properties that shape this work:

- CLI parsing is centralized in `apps/node/src/cli/index.ts`
- HTTP routes for `clawperator serve` live in `apps/node/src/cli/commands/serve.ts`
- device discovery is currently based only on `adb devices`
- `resolveDevice()` currently assumes the target is just a connected ADB device
- host tool wrappers exist for `adb`, but not yet for `emulator`, `sdkmanager`, or `avdmanager`

This means emulator support should be added as a new host-side subsystem rather than being spread across unrelated files.

## Proposed Implementation Structure

### New Domain Area

Create a dedicated emulator domain, for example:

```text
apps/node/src/domain/android-emulators/
```

Suggested responsibilities:

- configured AVD discovery
- running emulator discovery
- compatibility evaluation
- creation orchestration
- start and stop lifecycle
- boot waiting
- provisioning orchestration

### New Host Tool Adapters

Add wrappers for Android host tools similar to the current `adb` wrapper. These should avoid shell interpolation and keep command execution explicit.

Suggested adapter responsibilities:

- run `emulator`
- run `sdkmanager`
- run `avdmanager`
- optionally extend runtime configuration with binary paths for these tools

### Existing Areas to Extend

- `apps/node/src/cli/index.ts`
  - add new CLI command routing
  - add help text and alias handling
- `apps/node/src/cli/commands/serve.ts`
  - add emulator and provisioning HTTP endpoints
- `docs/node-api-for-agents.md`
  - update CLI and API reference
- `docs/first-time-setup.md`
  - add emulator path as an alternative setup mode
- `docs/troubleshooting.md`
  - add emulator provisioning and boot issues
- `docs/architecture.md`
  - document emulator support in the Node layer

## Implementation Phases

## Phase 1: Host Tooling and Core Models

### Goals

Create the foundation needed for all later phases.

### Tasks

1. Extend runtime configuration to support host Android tool binaries.
2. Add typed wrappers for:
   - `emulator`
   - `sdkmanager`
   - `avdmanager`
3. Define core types for:
   - configured AVDs
   - running emulators
   - compatibility results
   - provision results
4. Centralize emulator constants in one place:
   - default AVD name
   - supported API level(s)
   - supported device profile(s)
   - supported ABI(s)
   - system image channel / package identifier
   - boot timeout
   - polling intervals
5. Add explicit timeout constants, at minimum:
   - `EMULATOR_BOOT_TIMEOUT_MS = 180_000`
   - `ADB_REGISTRATION_TIMEOUT_MS = 60_000`
   - `BOOT_POLL_INTERVAL_MS = 2_000`
6. Add explicit host tool presence checks for:
   - `adb`
   - `emulator`
   - `sdkmanager`
   - `avdmanager`
7. Return a stable `ANDROID_SDK_TOOL_MISSING` style error before any provisioning work if a required tool is unavailable.

### Deliverables

- shared host tool execution helpers
- emulator constants and type definitions
- no CLI or API behavior yet

### Notes

Prefer explicit functions like `runEmulatorTool`, `runSdkManager`, and `runAvdManager` over generic shell strings.

## Phase 2: Configured AVD Discovery and Compatibility Evaluation

### Goals

Be able to inspect configured AVDs and label them as supported or unsupported.

### Tasks

1. Implement configured AVD listing using:
   - `emulator -list-avds`
2. For each AVD, gather enough metadata to evaluate compatibility.
3. Parse the AVD config deterministically.
   - likely from AVD config files and metadata rather than only command output
4. Resolve AVD metadata from the canonical AVD files:

```text
~/.android/avd/<name>.avd/config.ini
~/.android/avd/<name>.ini
```

5. Treat the following fields as the primary compatibility inputs:

```text
PlayStore.enabled
abi.type
image.sysdir.1
hw.device.name
```

Example values:

```text
PlayStore.enabled=true
abi.type=arm64-v8a
image.sysdir.1=system-images/android-35/google_apis_playstore/arm64-v8a/
hw.device.name=pixel_7
```

6. Use these fields as the reliable source of truth for:
   - Play Store support
   - ABI
   - system image family and API level
   - device profile
7. Normalize the resulting data into the configured AVD model.
8. Implement compatibility evaluation:
   - check Google Play support
   - check API level
   - check ABI
   - check device profile
9. Mark each AVD with:
   - `supported`
   - `unsupportedReasons`

### Deliverables

- function to list configured AVDs
- function to inspect a configured AVD by name
- function to evaluate compatibility
- machine-readable unsupported reasons

### Notes

The support rules must live in one place. The same evaluator should be used by `list`, `status`, `create`, and `provision`.

`inspect` should return the full normalized view for one AVD so callers do not need to inspect raw config files manually.

## Phase 3: Running Emulator Discovery and Name-to-Serial Resolution

### Goals

Be able to identify currently running emulators and map serials back to AVD names.

### Tasks

1. Implement running emulator discovery from `adb devices`.
2. Filter emulator serials from physical devices.
3. For each emulator serial, resolve:
   - AVD name
   - boot completion state
4. Resolve serial to AVD name using the emulator console command:

```bash
adb -s <serial> emu avd name
```

Example output:

```text
OK
clawperator-pixel
```

5. Do not attempt to infer AVD names from process lists.
6. Implement boot detection using:

```bash
adb -s <serial> shell getprop sys.boot_completed
```

7. Strengthen boot detection by checking both:
   - `sys.boot_completed=1`
   - `dev.bootcomplete=1`
8. Reuse compatibility evaluation for running emulators by connecting running serials back to configured AVD metadata where possible.
9. Build a deterministic name-to-serial mapping for lifecycle commands.

### Deliverables

- function to list running emulators
- function to resolve a running emulator by AVD name
- function to check booted state

### Notes

This phase is essential because `stop <name>` is specified by name, but `adb emu kill` operates by serial.

## Phase 4: Emulator Lifecycle Primitives

### Goals

Implement the low-level lifecycle operations needed by both CLI and provisioning.

### Tasks

1. Implement system image presence check.
2. Before system image installation, accept SDK licenses non-interactively:

```bash
yes | sdkmanager --licenses
```

3. Implement system image install if missing using `sdkmanager`.
4. Implement AVD creation using `avdmanager`.
5. Implement AVD start using deterministic flags:

```bash
emulator @<name> -no-snapshot-load -no-boot-anim
```

`-no-snapshot-load` is required for deterministic provisioning. Avoid restoring stale snapshots.

6. Launch the emulator as a detached background process from Node.
7. The process spawn should be equivalent to:
   - detached process
   - ignored stdio
   - parent process does not wait for emulator lifetime

Example Node behavior:

```ts
spawn(emulatorBinary, args, { detached: true, stdio: "ignore" })
```

8. Ensure start is non-blocking from the CLI perspective.
9. Wait for the emulator to appear in `adb devices`.
10. Wait for Android boot completion.
11. Implement emulator stop using:

```bash
adb -s <serial> emu kill
```

12. Implement AVD deletion using `avdmanager delete avd`.

### Deliverables

- `createAvd(...)`
- `startAvd(...)`
- `stopAvd(...)`
- `deleteAvd(...)`
- `waitForEmulatorRegistration(...)`
- `waitForBootCompletion(...)`

### Notes

The lifecycle primitives should return structured results and never rely on parsing human-oriented CLI text later in the call chain.

## Phase 5: Provisioning Orchestrator

### Goals

Implement the end-to-end provisioning algorithm used by the primary command and HTTP endpoint.

### Required Algorithm

Provisioning must:

1. list running emulators
2. if a supported emulator is already running, return it immediately
3. list configured AVDs
4. if a supported AVD exists but is stopped, start it
5. if no supported AVD exists, create a new one
6. wait for ADB registration
7. wait for Android boot completion
8. return the provision result with AVD name and serial

### Tasks

1. Implement a top-level `provisionEmulator()` service.
2. Ensure it uses the same compatibility evaluator as `list`.
3. Distinguish outcomes:
   - reused running emulator
   - started existing AVD
   - created and started new AVD
4. Produce a unified machine-readable result model.
5. Ensure duplicate compatible AVD creation does not occur.

### Deliverables

- `provisionEmulator()` service
- clear structured return payload

## Phase 6: CLI Surface

### Goals

Expose the emulator subsystem through the Clawperator CLI.

### Tasks

1. Update top-level CLI help.
2. Add help topics for emulator commands.
3. Add command routing in `apps/node/src/cli/index.ts`.
4. Implement:
   - `clawperator emulator list`
   - `clawperator emulator inspect <name>`
   - `clawperator emulator create`
   - `clawperator emulator start <name>`
   - `clawperator emulator stop <name>`
   - `clawperator emulator delete <name>`
   - `clawperator emulator status`
   - `clawperator emulator provision`
   - `clawperator provision emulator`
5. Ensure `clawperator provision emulator` and `clawperator emulator provision` share the same implementation.
6. Support JSON output as the canonical output format.
7. Add useful pretty output that describes:
   - discovery steps
   - reuse decisions
   - boot waiting
   - final AVD name and serial
8. Ensure `inspect` exposes the full normalized AVD view for diagnosis.

### Deliverables

- complete CLI command tree
- alias support
- help output

### Notes

Preserve existing output conventions:

- JSON by default
- pretty output only as a formatting layer over the same structured result

### `inspect` Command Contract

Purpose:

- explain compatibility decisions
- explain why an AVD is unsupported
- verify what provisioning is likely to reuse
- allow agents to reason without scraping `list`

Example:

```bash
clawperator emulator inspect clawperator-pixel --output json
```

Example output:

```json
{
  "name": "clawperator-pixel",
  "exists": true,
  "running": false,
  "supported": true,
  "apiLevel": 35,
  "abi": "arm64-v8a",
  "playStore": true,
  "deviceProfile": "pixel_7",
  "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
  "unsupportedReasons": []
}
```

`list` is the overview surface. `inspect` is the diagnostic surface.

## Phase 7: HTTP API Surface

### Goals

Expose emulator management through `clawperator serve`.

### Tasks

1. Add `GET /android/emulators`
2. Add `GET /android/emulators/:name`
3. Add `GET /android/emulators/running`
4. Add `POST /android/emulators/create`
5. Add `POST /android/emulators/:name/start`
6. Add `POST /android/emulators/:name/stop`
7. Add `DELETE /android/emulators/:name`
8. Add `POST /android/provision/emulator`
9. Validate request bodies explicitly and return structured errors on invalid input.
10. Map common failures to appropriate HTTP status codes.

### Suggested Endpoint Contracts

#### `GET /android/emulators`

Returns configured AVDs:

```json
{
  "avds": [
    {
      "name": "clawperator-pixel",
      "apiLevel": 35,
      "playStore": true,
      "abi": "arm64-v8a",
      "deviceProfile": "pixel_7",
      "running": false,
      "supported": true,
      "unsupportedReasons": []
    }
  ]
}
```

#### `GET /android/emulators/:name`

Returns the full normalized view of a single AVD:

```json
{
  "name": "clawperator-pixel",
  "exists": true,
  "running": false,
  "supported": true,
  "apiLevel": 35,
  "abi": "arm64-v8a",
  "playStore": true,
  "deviceProfile": "pixel_7",
  "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
  "unsupportedReasons": []
}
```

#### `GET /android/emulators/running`

Returns running emulators:

```json
{
  "devices": [
    {
      "type": "emulator",
      "avdName": "clawperator-pixel",
      "serial": "emulator-5554",
      "booted": true,
      "supported": true,
      "unsupportedReasons": []
    }
  ]
}
```

#### `POST /android/emulators/create`

Body fields:

- `name`
- `apiLevel`
- `deviceProfile`
- `abi`
- `playStore`

Behavior:

- ensure system image is installed
- create the AVD
- return created AVD metadata

#### `POST /android/emulators/:name/start`

Behavior:

- start emulator process
- wait for ADB registration
- optionally wait for full boot if the endpoint is defined as "start and ready"
- return serial and boot state

#### `POST /android/emulators/:name/stop`

Behavior:

- resolve running emulator serial for `:name`
- issue `adb -s <serial> emu kill`
- return confirmation

#### `DELETE /android/emulators/:name`

Behavior:

- delete AVD from host
- fail if deletion is unsafe or the AVD is currently running, unless an explicit stop occurs first

#### `POST /android/provision/emulator`

Behavior:

- run the full provisioning orchestration
- return final serial and AVD metadata

### Deliverables

- all required HTTP routes
- input validation
- status code mapping

## Phase 8: Integration with Existing Device Flows

### Goals

Ensure the resulting emulator serial works across existing Clawperator flows.

### Tasks

1. Confirm the provisioned serial works with:
   - `clawperator devices`
   - `clawperator packages list --device-id <serial>`
   - `clawperator grant-device-permissions --device-id <serial>`
   - `clawperator version --check-compat --device-id <serial>`
   - `clawperator observe snapshot --device-id <serial>`
2. Confirm existing `resolveDevice()` semantics still behave correctly when multiple devices are connected.
3. Decide whether to change global device-selection semantics.

### Recommended Behavior for v1

Do not broadly change the existing device-selection policy in this feature unless necessary.

Instead:

- provisioning returns the chosen emulator serial explicitly
- callers pass `--device-id <serial>` into downstream commands when multiple targets exist

This keeps the feature scoped and reduces regression risk.

### Deliverables

- verified interoperability with current ADB-targeted features

## Phase 9: Error Model and Diagnostics

### Goals

Provide stable machine-readable errors and helpful diagnostics.

### Tasks

1. Add emulator-specific errors where needed.
2. Ensure errors include clear failure context.
3. Keep error handling deterministic and agent-friendly.

### Candidate Error Codes

Add only the codes that are truly needed, but likely candidates include:

- `EMULATOR_NOT_FOUND`
- `EMULATOR_ALREADY_RUNNING`
- `EMULATOR_NOT_RUNNING`
- `EMULATOR_UNSUPPORTED`
- `EMULATOR_CREATE_FAILED`
- `EMULATOR_START_FAILED`
- `EMULATOR_STOP_FAILED`
- `EMULATOR_DELETE_FAILED`
- `EMULATOR_BOOT_TIMEOUT`
- `ANDROID_SDK_TOOL_MISSING`
- `ANDROID_SYSTEM_IMAGE_INSTALL_FAILED`
- `ANDROID_AVD_CREATE_FAILED`

### Diagnostic Expectations

Errors should include useful details such as:

- avd name
- serial if known
- expected vs actual compatibility characteristics
- timeout duration
- failing tool name
- stderr summary

### Deliverables

- stable error taxonomy additions
- structured diagnostics

## Phase 10: Documentation

### Goals

Make emulator support discoverable and usable without tribal knowledge.

### Tasks

1. Update `docs/node-api-for-agents.md`
   - new CLI commands
   - new HTTP endpoints
   - example provisioning responses
2. Update `docs/first-time-setup.md`
   - add emulator provisioning as an alternative to physical device setup
3. Update `docs/troubleshooting.md`
   - SDK tool missing
   - system image install failure
   - boot timeout
   - unsupported existing AVD
   - multiple devices ambiguity after provisioning
4. Update `docs/architecture.md`
   - emulator lifecycle is managed by Node layer
5. If public docs generation is required, regenerate docs output from source after authored docs are updated.

### Deliverables

- authored documentation aligned with shipped behavior
- regenerated docs output if required by repo workflow

## Phase 11: Test Coverage

### Goals

Add sufficient confidence for both unit behavior and HTTP / CLI surfaces.

### Unit Tests

Add tests for:

- parsing `emulator -list-avds`
- configured AVD metadata parsing
- compatibility evaluation
- running emulator discovery
- boot-completion polling
- name-to-serial resolution
- provisioning reuse order
- duplicate-avoidance behavior
- stop by name resolution
- CLI alias behavior

### HTTP API Tests

Add tests for:

- `GET /android/emulators`
- `GET /android/emulators/:name`
- `GET /android/emulators/running`
- `POST /android/emulators/create`
- `POST /android/emulators/:name/start`
- `POST /android/emulators/:name/stop`
- `DELETE /android/emulators/:name`
- `POST /android/provision/emulator`

### CLI Tests

Add tests for:

- top-level help text
- emulator help topics
- `provision emulator` alias parity
- `emulator inspect <name>` output shape
- usage errors for missing required args
- explicit `--output json` and `--output pretty` behavior on emulator commands

### Test Infrastructure Work

Current fakes are primarily `adb`-centric. Extend test infrastructure to fake:

- `emulator`
- `sdkmanager`
- `avdmanager`

Prefer using the existing fake process runner pattern rather than full shell integration when unit testing.

### Deliverables

- broad unit coverage for emulator domain
- API and CLI surface tests

## Phase 12: Validation and Required Iteration Loop

This repository requires a full validation loop for non-trivial changes.

Before commit, run:

```bash
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew :app:installDebug
adb shell am start -n <applicationId>/<mainActivity>
```

Also run smoke and verification scripts relevant to the change. For this feature, likely relevant commands include:

```bash
./scripts/clawperator_smoke_core.sh
./scripts/clawperator_validate_receiver.sh
```

If an emulator is available locally, additionally validate:

```bash
clawperator provision emulator --output pretty
clawperator grant-device-permissions --device-id <serial>
clawperator observe snapshot --device-id <serial>
```

## Functional Acceptance Criteria

The feature is complete when all of the following are true:

1. `clawperator provision emulator` exists and works.
2. `clawperator emulator provision` behaves identically.
3. `clawperator emulator list` shows configured AVDs and labels unsupported ones.
4. `clawperator emulator inspect <name>` returns a full normalized view for diagnosis.
5. `clawperator emulator status` shows running emulators and boot state.
6. `clawperator emulator create` creates a supported AVD and installs its system image if needed.
7. `clawperator emulator start <name>` starts a named AVD and returns a usable serial.
8. `clawperator emulator stop <name>` stops a named running emulator.
9. `clawperator emulator delete <name>` deletes a named AVD.
10. `POST /android/provision/emulator` provisions according to the required reuse order.
11. Provisioning prefers:
    - running supported emulator
    - then stopped supported AVD
    - then new AVD creation
12. Provisioning does not auto-select unsupported AVDs.
13. Provisioning waits for both `sys.boot_completed=1` and `dev.bootcomplete=1` when determining readiness.
14. The returned emulator serial works with existing Clawperator device-targeted commands.
15. Documentation reflects the new CLI and HTTP surfaces.
16. Node build and tests pass.

## Recommended Implementation Order

For lowest risk, implement in this order:

1. Phase 1: Host tooling and models
2. Phase 2: Configured AVD discovery and compatibility
3. Phase 3: Running emulator discovery
4. Phase 4: Lifecycle primitives
5. Phase 5: Provisioning orchestrator
6. Phase 6: CLI commands
7. Phase 7: HTTP endpoints
8. Phase 11: Tests
9. Phase 10: Documentation
10. Phase 12: Full validation loop

## Practical Implementation Notes

### Avoid Scope Creep

Do not redesign the whole device-selection model during this feature unless forced by a concrete blocker.

### Keep Compatibility Rules Centralized

Do not duplicate support checks across CLI, HTTP, and provisioning paths. Use one evaluator.

### Keep `install.sh` Minimal

If documentation references emulator provisioning during setup, it should instruct the user to run the Node CLI command after installation. Do not move emulator behavior into shell bootstrap.

### Preserve Existing Contracts

Existing execution and observation routes should continue to work unchanged. Emulator support should compose with the current architecture, not replace it.

### Prefer Explicit Output Control in Examples

When documenting or testing agent-facing flows, prefer examples that show:

```bash
--output json
```

Use `--output pretty` for human-oriented examples only.

## Open Decisions to Resolve During Implementation

These decisions should be made explicitly in code and docs:

1. exact supported device profile list beyond the default `pixel_7`
2. whether `start` waits only for ADB registration or full boot
3. whether `delete` requires the AVD to be stopped first
4. whether v1 uses a single ABI or host-aware ABI selection

Choose clear defaults, document them in code comments where needed, and keep behavior deterministic.
