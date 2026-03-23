# Device and Package Model

This page explains how Clawperator targets Android devices and how the
operator-package concept fits into execution dispatch.

Use it when you need to understand:

- what a `deviceId` really is
- when an explicit device flag is required
- what `--operator-package` targets
- how release and debug Operator APK variants differ

## `deviceId` means ADB serial

Clawperator uses the Android Debug Bridge device serial as the `deviceId`.

Examples:

- physical device serials such as `<device_serial>`
- emulator serials such as `emulator-5554`

List visible devices with:

```bash
clawperator devices --output json
```

## Device resolution rules

When you run a command without `--device`, Clawperator resolves the target
using the currently connected ADB devices. The parser also accepts `--device-id`
as a silent alias for `--device`.

Current behavior:

- if exactly one connected device is in `device` state, Clawperator uses it
- if no connected devices are available, the command fails with `NO_DEVICES`
- if more than one connected device is available, the command fails with
  `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`

When multiple devices are connected, always pass an explicit device flag:

```bash
--device <device_id>
```

(`--device-id` is accepted as an alias.)

## Commands that should pass `--device`

In multi-device environments, keep `--device` explicit on:

- `exec` (`execute` is a synonym)
- `snapshot`
- `screenshot`
- flat device interaction commands (`click`, `type`, `read`, `wait`, `open`, `press`, `back`, `scroll`, and related synonyms)
- `doctor`
- `version --check-compat`
- `operator setup`
- `grant-device-permissions`
- `skills run`

## Multi-device recovery after install

The installer can complete host-side setup even when more than one Android
device is connected, but it will not guess which target should receive the APK.

Use the printed recovery command, or run:

```bash
clawperator operator setup \
  --apk ~/.clawperator/downloads/operator.apk \
  --device <device_id>
```

Then verify with:

```bash
clawperator doctor --device <device_id> --json
```

## Operator package model

The Operator package is the installed Android Operator APK that receives the
broadcast command.

Current defaults:

- release package: `com.clawperator.operator`
- local debug package: `com.clawperator.operator.dev`

Most public docs assume the release package by default.

## When to pass `--operator-package`

Pass `--operator-package` when:

- you are using a local debug APK
- both release and debug variants are installed
- your automation or local workflow is intentionally targeting a non-default
  Operator variant

Example:

```bash
clawperator snapshot \
  --device <device_id> \
  --operator-package com.clawperator.operator.dev \
  --json
```

## Device and package targeting are separate

These two flags solve different problems:

- `--device` picks the Android device
- `--operator-package` picks which Operator APK on that device receives the
  command

You sometimes need both, especially during local development.

## Execution isolation

Clawperator enforces single-flight per target device. Do not assume a second
execution can overlap safely on the same device.

A practical pattern for multiple devices is:

- run one serialized work queue per device
- keep `--device` explicit in every command
- keep the Operator package consistent per queue

## Quick checks

Use these commands when you are unsure what Clawperator is targeting:

```bash
clawperator devices --json
clawperator doctor --device <device_id> --json
clawperator version --check-compat --device <device_id> --json
```
