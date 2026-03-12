# First-Time Setup

Clawperator requires an Android device to operate.

This device may be:

* a physical Android phone
* an Android emulator

In both cases, the device must be configured with the apps and user logins required by the automation.

Clawperator operates the UI on that device. It does not create accounts, sign into apps, or complete app configuration on behalf of the user.

For an overview of the actuator model and user responsibilities, see [Running Clawperator on Android](running-clawperator-on-android.md).

---

## Step 1 - Install CLI

The simplest path is to run the installer:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The installer installs the CLI, downloads the latest stable [Clawperator Operator Android app](android-operator-apk.md) package locally, and runs `clawperator doctor` to detect missing setup.

Historical versions and release notes remain available on [GitHub Releases](https://github.com/clawperator/clawperator/releases).

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

For local debug builds, specify the receiver package:

```bash
clawperator operator setup \
  --apk ~/.clawperator/downloads/operator-debug.apk \
  --receiver-package com.clawperator.operator.dev
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
| `RECEIVER_NOT_INSTALLED` | Complete Step 3 (run `clawperator operator setup`) |
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
  --receiver-package com.clawperator.operator
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
clawperator version --check-compat --receiver-package com.clawperator.operator
```
