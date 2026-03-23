# Multi-Device Workflows for Agents

Use this page when more than one Android target is connected and you need
deterministic per-device behavior.

This is the practical companion to
[Device and Package Model](../reference/device-and-package-model.md).

## Core rule

When more than one Android target is visible in adb, always pass:

```bash
--device <device_id>
```

(`--device-id` is accepted as an alias.) Do not rely on auto-resolution in
multi-device environments. Clawperator will fail with
`MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` instead of guessing.

## What counts as a separate target

A target is any adb-connected Android runtime in `device` state, including:

- a physical Android phone
- a physical Android tablet
- an emulator such as `emulator-5554`

`deviceId` is just the adb serial.

Examples:

- `<device_serial>`
- `emulator-5554`

List the currently visible targets with:

```bash
clawperator devices --json
```

## Recommended cold-start loop

For each target device:

1. identify the serial with `clawperator devices --json`
2. run `clawperator doctor --device <device_id> --json`
3. run `clawperator version --check-compat --device <device_id> --json`
4. keep using that same `--device` on every later command

This is the safest default after:

- emulator provisioning
- USB reconnects
- installer runs with multiple devices attached
- any local setup where both release testing and debug testing happen at once

## Commands that should stay explicit

In multi-device environments, keep `--device` explicit on:

- `operator setup`
- `doctor`
- `version --check-compat`
- `execute`
- `snapshot`
- `screenshot`
- flat device interaction commands (`click`, `type`, `open`, and related synonyms)
- `grant-device-permissions`
- `skills run`

Example:

```bash
clawperator snapshot --device <device_id> --json
clawperator execute --device <device_id> --execution /path/to/execution.json --json
clawperator skills run com.android.settings.capture-overview --device <device_id>
```

## Per-device work queues

Clawperator enforces single-flight execution per target device. Treat each
device as its own serialized queue.

Practical guidance:

- keep one work queue per device
- never overlap two executions on the same device
- it is fine to run different queues against different devices
- keep `--operator-package` consistent within the same device queue

If you see `EXECUTION_CONFLICT_IN_FLIGHT`, do not immediately retry in
parallel. Wait for the earlier execution to finish or explicitly serialize the
queue.

## Receiver package still matters

`--device` and `--operator-package` solve different problems:

- `--device` selects the Android runtime
- `--operator-package` selects which Operator APK on that runtime receives the
  command

Examples:

- release package: `com.clawperator.operator`
- debug package: `com.clawperator.operator.dev`

On a local workstation it is common to have:

- one physical device running the release APK
- one emulator running the debug APK

In that case, keep both flags explicit:

```bash
clawperator doctor \
  --device emulator-5554 \
  --operator-package com.clawperator.operator.dev \
  --json
```

## Recovery after installer or setup runs

If `install.sh` ran while multiple devices were connected, host-side setup can
still complete successfully. When any connected device is not ready, the
installer keeps the host-side setup moving and Android setup must be finished
per device.

Use:

```bash
clawperator operator setup \
  --apk ~/.clawperator/downloads/operator.apk \
  --device <device_id>
```

Then confirm readiness:

```bash
clawperator doctor --device <device_id> --json
```

## Emulator plus physical device

This is the most common ambiguous setup.

Typical pattern:

1. provision or start the emulator
2. run `clawperator devices --json`
3. choose the emulator serial for emulator work
4. choose the physical-device serial for phone work
5. keep those serials explicit in every later command

Do not assume the emulator will remain the only device after provisioning.

## Suggested shell pattern

A practical shell setup is to bind one environment variable per active target:

```bash
export CLAWPERATOR_PHONE_ID="<device_serial>"
export CLAWPERATOR_EMULATOR_ID="emulator-5554"
```

Then run:

```bash
clawperator doctor --device "$CLAWPERATOR_PHONE_ID" --json
clawperator doctor --device "$CLAWPERATOR_EMULATOR_ID" --json
```

This keeps command history readable and avoids copy-paste mistakes.

## Artifact and screenshot hygiene

When the same agent operates multiple devices, keep outputs separated by device
ID.

Good pattern:

- one output directory per device
- include the device ID in filenames
- do not reuse a single screenshot path across different targets

Example:

```bash
clawperator screenshot \
  --device <device_id> \
  --path "/tmp/clawperator-<device_id>-settings.png" \
  --json
```

## Failure triage

If a command fails in a multi-device environment:

1. run `clawperator devices --json`
2. confirm the intended target is still present in `device` state
3. rerun with explicit `--device <device_id>`
4. rerun `clawperator doctor --device <device_id> --json` if the
   device state changed

Most common multi-device errors:

- `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`
- `NO_DEVICES`
- `DEVICE_NOT_FOUND`
- `DEVICE_UNAUTHORIZED`

For broader recovery guidance, see
[Error Handling Guide](../reference/error-handling.md) and
[Clawperator Doctor](../reference/node-api-doctor.md).
