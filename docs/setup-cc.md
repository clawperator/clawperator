# Setup

## Purpose

Get from zero to a working Clawperator environment: CLI installed, Android device connected, Operator APK running, and first command verified.

## Prerequisites

| Requirement | Minimum | Check |
|-------------|---------|-------|
| Node.js | v22+ | `node -v` |
| ADB (Android Debug Bridge) | Any | `adb version` |
| curl | Any | `curl --version` |
| git | Any | `git --version` |
| Android device or emulator | USB debugging enabled, connected via ADB | `adb devices` |

## One-command install

The installer handles all steps below automatically:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The installer:

1. Installs Node.js 22 via nvm if missing or outdated
2. Installs ADB if missing (Homebrew on macOS, apt/pacman on Linux)
3. Installs the Clawperator CLI globally via `npm install -g clawperator@latest`
4. Downloads the latest Operator APK to `~/.clawperator/downloads/operator.apk`
5. Verifies APK checksum (SHA-256)
6. Installs the APK on a connected device (if exactly one is connected)
7. Grants permissions via `clawperator operator setup`
8. Installs skills via `clawperator skills install`
9. Runs `clawperator doctor` to verify everything

If the installer succeeds, skip to [Verify with doctor](#step-4-verify-with-doctor).

For manual setup or when the installer cannot run (CI, containers, custom environments), follow the steps below.

## Step 1: Install the CLI

Option A - npm (requires Node.js 22+):

```bash
npm install -g clawperator@latest
```

Option B - installer script:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

Verify installation:

```bash
clawperator version
```

Exit code 0 means the CLI is installed. Non-zero means it is not on PATH.

## Step 2: Prepare the Android device

The device must have USB debugging enabled and be authorized for ADB.

**Physical device:**

1. Enable Developer Options: Settings > About phone > tap Build Number 7 times
2. Enable USB debugging: Settings > Developer Options > USB debugging
3. Connect via USB cable
4. Accept the RSA key prompt on the device screen

**Emulator:**

1. Create and start an emulator via Android Studio or `clawperator emulator create`
2. USB debugging is enabled by default on emulators

Verify the device is visible:

```bash
adb devices
```

Expected output: one line with a serial number and state `device`. If the state is `unauthorized`, unlock the device and accept the debugging prompt. If the state is `offline`, reconnect the cable or restart ADB:

```bash
adb kill-server && adb start-server
```

## Step 3: Install the Operator APK

The Operator APK is the Android app that executes actions on the device. Install it with:

```bash
clawperator operator setup --apk <path-to-apk>
```

This command does three things in sequence:

1. Installs the APK on the device via ADB
2. Grants accessibility and notification permissions
3. Verifies the package is visible to the package manager

If the installer script ran, the APK is at `~/.clawperator/downloads/operator.apk`:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk
```

### Operator package variants

| Variant | Package name | When to use |
|---------|-------------|-------------|
| Release | `com.clawperator.operator` | Production use, installed by the installer |
| Debug | `com.clawperator.operator.dev` | Local development, built from source |

The CLI auto-detects which variant is installed when exactly one is present. If both are installed, pass `--operator-package` explicitly:

```bash
clawperator operator setup --apk <path> --operator-package com.clawperator.operator.dev
```

### Multiple devices

When multiple devices are connected, pass `--device`:

```bash
clawperator operator setup --apk <path> --device <serial>
```

List connected devices with:

```bash
clawperator devices
```

Do not use raw `adb install` for setup. It leaves the device in a partial state without required permissions.

## Step 4: Verify with doctor

`clawperator doctor` runs a sequence of checks to verify the entire environment is ready:

```bash
clawperator doctor
```

### Doctor checks

| Check ID | What it verifies |
|----------|-----------------|
| `host.node.version` | Node.js >= 22 |
| `host.adb.presence` | ADB is installed and on PATH |
| `host.adb.server` | ADB server starts successfully |
| `device.discovery` | At least one device is connected and reachable |
| `device.capability` | Device shell is available (SDK version, screen size) |
| `readiness.apk.presence` | Operator APK is installed on the device |
| `readiness.settings.dev_options` | Developer options enabled |
| `readiness.settings.usb_debugging` | USB debugging enabled |
| `readiness.version.compatibility` | CLI version is compatible with installed APK version |
| `readiness.handshake` | Node can dispatch a command and receive a result envelope from the Operator |
| `readiness.smoke` | End-to-end test: open Settings, capture UI snapshot |

### JSON output

```bash
clawperator doctor --json
```

Returns a `DoctorReport` object:

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "<serial>",
  "operatorPackage": "com.clawperator.operator",
  "checks": [
    {
      "id": "host.node.version",
      "status": "pass",
      "summary": "Node version v22.x.x is compatible."
    }
  ]
}
```

- `ok: true` means all checks passed
- `criticalOk: true` means all critical checks passed (some warnings may exist)
- Each check has `status`: `"pass"`, `"warn"`, or `"fail"`
- Failed checks include `code` (error code), `detail`, and optionally `fix` with remediation steps

Exit code 0 means `criticalOk` is true. Non-zero means at least one critical check failed.

### Doctor with device targeting

```bash
clawperator doctor --device <serial> --operator-package <package>
```

## Step 5: First command

Capture the current UI state:

```bash
clawperator snapshot --json
```

If this returns a JSON result with `status: "success"` and a `stepResults` array containing snapshot data, the environment is fully working.

## Agent and OpenClaw integration

Clawperator is the "hand" for an LLM "brain." The agent (brain) calls Clawperator commands to interact with the device. Clawperator executes the actions and returns structured results. It does not plan, reason, or decide what to do next.

### Programmatic setup sequence

An agent performing first-time setup should execute this sequence:

```
1. clawperator version --json
   Success: exit code 0
   Failure: CLI not installed - run the install script

2. clawperator doctor --json
   Success: .ok == true or .criticalOk == true
   Failure: inspect .checks[] for failed items, apply .fix.steps

3. clawperator snapshot --json
   Success: .status == "success"
   Failure: check doctor output for readiness issues
```

### Checking doctor results programmatically

Parse the JSON output and inspect the `checks` array:

```
For each check where status == "fail":
  - Read check.code for the error code
  - Read check.fix.steps[] for remediation commands
  - Execute remediation steps with kind == "shell" directly
  - Steps with kind == "manual" require human intervention
```

### Common first-run failures

| Symptom | Doctor check | Error code | Recovery |
|---------|-------------|------------|----------|
| No device found | `device.discovery` | `NO_DEVICES` | Connect device, enable USB debugging, run `adb devices` |
| Device unauthorized | `device.discovery` | `DEVICE_UNAUTHORIZED` | Accept RSA key prompt on device screen |
| Device offline | `device.discovery` | `DEVICE_OFFLINE` | `adb kill-server && adb start-server` |
| Operator not installed | `readiness.apk.presence` | `OPERATOR_NOT_INSTALLED` | `clawperator operator setup --apk <path>` |
| Wrong Operator variant | `readiness.apk.presence` | `OPERATOR_VARIANT_MISMATCH` | Pass `--operator-package <correct-variant>` |
| Handshake timeout | `readiness.handshake` | `RESULT_ENVELOPE_TIMEOUT` | `clawperator grant-device-permissions --device <serial>` |
| Accessibility not running | `readiness.handshake` | `DEVICE_ACCESSIBILITY_NOT_RUNNING` | `clawperator grant-device-permissions --device <serial>` |
| Version incompatible | `readiness.version.compatibility` | `VERSION_INCOMPATIBLE` | Align CLI and APK versions (reinstall one or both) |
| Multiple devices | `device.discovery` | `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` | Pass `--device <serial>` to all commands |

### When to pass `--device` and `--operator-package`

- `--device <serial>`: required when more than one Android device is connected. Use `clawperator devices` to list serials.
- `--operator-package <package>`: required when both release and debug Operator variants are installed on the same device. Otherwise auto-detected.

For deterministic automation, always pass both flags explicitly.
