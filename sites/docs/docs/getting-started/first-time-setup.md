# First-Time Setup

Clawperator requires an Android device to operate.

This device may be:

* a physical Android phone
* an Android emulator

In both cases, the device must be configured with the apps and any account
state required by the automation.

Clawperator operates the UI on that device. It does not decide what inputs are
appropriate to enter. The external brain agent decides the workflow, and
Clawperator provides the interaction primitives to carry it out.

For an overview of the actuator model and user responsibilities, see [Running Clawperator on Android](running-clawperator-on-android.md).

---

## Step 1 - Install CLI

The simplest path is to run the installer:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The installer installs the CLI, downloads the latest stable [Clawperator Operator Android app](android-operator-apk.md) package locally, and runs `clawperator doctor` to detect missing setup.

Historical versions and release notes remain available on [GitHub Releases](https://github.com/clawperator/clawperator/releases).

Installer notes:

- the installer uses `clawperator doctor --format json` internally for
  machine-readable checks
- it finishes with `clawperator doctor --output pretty` for the final human
  summary
- `clawperator doctor --json` is also supported as a shorthand for
  `--output json`
- `CLAWPERATOR_INSTALL_APK` can be set before running the installer to control
  the APK-install prompt in non-interactive environments

Example:

```bash
CLAWPERATOR_INSTALL_APK=Y curl -fsSL https://clawperator.com/install.sh | bash
```

---

## Step 2 - Choose Android Environment

### Option A: Physical Device

Requirements: USB cable, any Android 5.0+ device.

1. **Enable Developer Options:** On the device, open **Settings**, go to **About Phone**, and tap **Build Number** 7 times until you see "You are now a developer". Go back to **Settings** - a **Developer Options** entry will appear.
2. **Enable USB Debugging:** In **Developer Options**, enable it (toggle at the top), then enable **USB Debugging**.
3. **Connect via USB:** Connect the device to your machine. On the device, a dialog will appear: **"Allow USB debugging?"** Tap **Allow** (optionally check "Always allow from this computer").

Verify the connection:

```bash
adb devices
```

You should see your device listed as `device` (not `unauthorized`).

### Option B: Android Emulator

Clawperator manages the Android emulator lifecycle. No manual AVD setup is required.

Requirements: `adb`, `emulator`, `sdkmanager`, `avdmanager` in `PATH`.

Provision the emulator:

```bash
clawperator provision emulator --output json
```

This command reuses a running supported emulator, starts a stopped supported AVD, or creates a new AVD with the default profile.

The default supported emulator profile is:

- Android API level `35`
- Google Play system image
- ABI `arm64-v8a`
- device profile `pixel_7`
- AVD name `clawperator-pixel`

You can inspect configured AVDs at any time:

```bash
clawperator emulator list --output json
clawperator emulator inspect clawperator-pixel --output json
```

If both a physical device and an emulator are connected, you will need to pass `--device-id <serial>` to later commands.

If multiple devices are connected during install, the installer does not guess
which device should receive the APK. It leaves the downloaded APK in
`~/.clawperator/downloads/operator.apk`, completes the host-side CLI setup, and
prints the manual completion command for each connected device.

---

## Step 3 - Install the Clawperator Operator Android app

Use the canonical install command to install the [Clawperator Operator Android app](android-operator-apk.md) and grant required permissions in one step:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk
```

If you have multiple devices connected, specify the target device:

```bash
clawperator operator setup \
  --apk ~/.clawperator/downloads/operator.apk \
  --device-id <device_id>
```

This is also the recovery command to use after a multi-device installer run
that completed host setup but intentionally skipped device selection.

For local debug builds, specify the receiver package:

```bash
clawperator operator setup \
  --apk ~/.clawperator/downloads/operator-debug.apk \
  --operator-package com.clawperator.operator.dev
```

This command runs three phases in order:

1. Installs the APK onto the device via `adb`.
2. Grants required device permissions (accessibility service, notification listener).
3. Verifies the package is accessible after install.

The command fails with a structured error if any phase fails. The error includes which phase failed and why, so agents and users can diagnose and recover.

> Do not use raw `adb install` for normal setup. It copies the APK but leaves the device in a partial state without required permissions. Use `clawperator operator setup` instead.

> Always use `clawperator operator setup` for setup. `clawperator operator install` remains an alias. Only run `clawperator grant-device-permissions` after the Operator APK crashes and Android revokes the accessibility or notification permissions.

---

## Step 4 - Verify Setup

Run the diagnostic check:

```bash
clawperator doctor
```

A fully configured device will show all checks passing. Common warnings:

| Warning | Fix |
| :--- | :--- |
| `DEVICE_UNAUTHORIZED` | Tap "Allow" on the device USB debugging dialog |
| `RECEIVER_NOT_INSTALLED` | Complete Step 3. Run `clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>` and add `--operator-package com.clawperator.operator.dev` for debug builds. |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | If the Operator APK crashed after setup, run `clawperator grant-device-permissions` to restore the revoked permissions |
| `DEVICE_DEV_OPTIONS_DISABLED` | Enable Developer options (physical device only) |
| `DEVICE_USB_DEBUGGING_DISABLED` | Enable USB debugging (physical device only) |

---

## Step 5 - Run Your First Command

Observe the current UI state:

```bash
clawperator observe snapshot --device-id <device_id>
```

Open an app:

```bash
clawperator action open-app \
  --app com.android.settings \
  --device-id <device_id> \
  --operator-package com.clawperator.operator
```

> Use `com.clawperator.operator` for the release [Clawperator Operator Android app](android-operator-apk.md), `com.clawperator.operator.dev` for the local debug build.

Before running real automations, make sure the Android apps the user wants Clawperator to operate are installed, signed in, and already configured on the device or emulator.

---

## Keeping the Device Ready

For reliable automation:

- Keep the device **screen unlocked** (set screen timeout to maximum or "Never" in Display settings)
- Keep the device **plugged in** (charging)
- Keep the Clawperator **Accessibility Service enabled**
- For physical devices: keep **USB Debugging enabled**

---

## Troubleshooting

See [Troubleshooting the Operator App](https://docs.clawperator.com/troubleshooting/troubleshooting/) for common issues.

For environment checks: `clawperator doctor --output pretty`

Verify the installed CLI and [Clawperator Operator Android app](android-operator-apk.md) pair explicitly:

```bash
clawperator version --check-compat --operator-package com.clawperator.operator
```

If the versions do not match, install the exact APK for the CLI version from `https://downloads.clawperator.com/operator/v<version>/operator-v<version>.apk` and `https://downloads.clawperator.com/operator/v<version>/operator-v<version>.apk.sha256`.

### Multiple devices connected

**Why the installer stops at device selection**

The installer does not guess which device should receive the APK when more than
one is connected. Instead, it checks each connected device's readiness and
prints a per-device status line before returning control to you.

**What the installer output means**

```
  ✅ <serial> - ready
  ⚠  <serial> - setup required: clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <serial>
```

- `✅ ready` - the APK is installed and the accessibility service is running on
  that device. No further action needed.
- `⚠ setup required` - the APK is missing or the accessibility service is not
  active. Run the printed `operator setup` command to complete setup.

If every device is ready, the installer prints `All devices ready. No setup
required.` and exits cleanly.

**How to check a device's readiness yourself**

```bash
clawperator doctor --device-id <serial>
```

A healthy device shows all checks passing and exits 0. An unhealthy device
exits 1 with details on which checks failed (for example,
`RECEIVER_NOT_INSTALLED` or `DEVICE_ACCESSIBILITY_NOT_RUNNING`).

**How to complete setup for a device that needs it**

```bash
clawperator operator setup \
  --apk ~/.clawperator/downloads/operator.apk \
  --device-id <serial>
```

This installs the APK, grants required permissions, and verifies the handshake
in one step. Run it once for each device that shows `⚠ setup required`.

**If you only have one device now**

Disconnect the extra devices, then re-run the installer with only the target
device connected. The installer will handle APK install and permission grant
automatically without requiring a manual `operator setup` call.
