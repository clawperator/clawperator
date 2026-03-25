# Devices

## Purpose

Define how Clawperator chooses a target device and Operator package so execution remains deterministic.

## Device Identity

- `deviceId` is the adb serial.
- `clawperator devices` returns `devices[]` objects with `serial` and `state`.
- Only targets in adb state `device` count as connected execution targets. `unauthorized` and `offline` do not.

Example:

```bash
clawperator devices
```

Expected JSON shape:

```json
{"devices":[{"serial":"<device_serial>","state":"device"}]}
```

## `--device`

Primary flag: `--device <serial>`

Accepted legacy alias: `--device-id <serial>`

Use `--device` when:

- More than one connected target is in adb state `device`
- You want deterministic routing even if another emulator or physical device appears later
- You are scripting setup or serve calls and do not want auto-selection

## Resolution Rules

`apps/node/src/domain/devices/resolveDevice.ts` applies these rules:

| Connected targets in state `device` | `--device` provided | Result |
| --- | --- | --- |
| `0` | no | `NO_DEVICES` |
| `1` | no | Auto-select the only connected serial |
| `>1` | no | `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` |
| any | yes, serial exists in state `device` | Use that serial |
| any | yes, serial missing or not in state `device` | `DEVICE_NOT_FOUND` |

## Operator Package Selection

Primary flag: `--operator-package <package>`

Default package:

```text
com.clawperator.operator
```

Debug package for local development:

```text
com.clawperator.operator.dev
```

Use `--operator-package com.clawperator.operator.dev` when:

- The installed APK is a local debug build
- `doctor` reports `OPERATOR_VARIANT_MISMATCH`
- You are validating repo-local CLI changes against the debug Operator app

## Multi-Device Patterns

- Always pair `--device` with `--operator-package` when you are working against a debug package on one target but not another.
- Prefer explicit targeting in agent loops even when only one device is currently connected.
- Physical devices and emulators are both valid targets. The contract cares about the adb serial, not the hardware class.

## Example Commands

```bash
clawperator doctor --json --device <device_serial>
```

```bash
clawperator snapshot --json --device <device_serial> --operator-package com.clawperator.operator.dev
```

```bash
clawperator exec payload.json --device <device_serial>
```

## Related Pages

- [Setup](../setup.md)
- [Doctor](doctor.md)
- [Errors](errors.md)
