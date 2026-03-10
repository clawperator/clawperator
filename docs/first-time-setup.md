# First-Time Setup

You've installed the Clawperator CLI. This guide walks through connecting an Android device (physical or emulator) so it can be used as an actuator.

For an overview of the actuator model and user responsibilities, see [Running Clawperator on Android](running-clawperator-on-android.md).

## Choose Your Setup Path

| Path | Requirements |
| :--- | :--- |
| [Physical device](#physical-device-setup) | USB cable, any Android 5.0+ device |
| [Android emulator](#emulator-setup) | Android SDK tools: `adb`, `emulator`, `sdkmanager`, `avdmanager` |

Both paths converge at [Step 5: Install the APK](#step-5-install-the-apk).

---

## Download the APK

Before setting up the device, get the Clawperator operator APK. If you want the simplest path, run:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

With one connected device, the installer installs the CLI, runs `clawperator doctor --format json` to detect missing setup, downloads the latest stable APK when needed, verifies its checksum, and offers to install or upgrade it immediately. If no device is connected yet, it saves the APK locally at `~/.clawperator/downloads/operator.apk`.

For manual installation, download the latest APK from [clawperator.com/operator.apk](https://clawperator.com/operator.apk) and save it locally.

Historical versions and release notes remain available on [GitHub Releases](https://github.com/clawpilled/clawperator/releases).

---

## Physical Device Setup

### Step 1: Enable Developer Options

On the Android device:

1. Open **Settings**
2. Go to **About Phone**
3. Tap **Build Number** 7 times until you see "You are now a developer"
4. Go back to **Settings** - a **Developer Options** entry will appear

### Step 2: Enable USB Debugging

In **Developer Options**:

1. Enable **Developer Options** (toggle at the top)
2. Enable **USB Debugging**

### Step 3: Connect via USB

Connect the device to your machine via USB cable.

On the device, a dialog will appear: **"Allow USB debugging?"**
- Tap **Allow** (optionally check "Always allow from this computer")

Verify the connection:

```bash
adb devices
```

You should see your device listed as `device` (not `unauthorized`).

Then continue to [Step 5: Install the APK](#step-5-install-the-apk).

---

## Emulator Setup

Clawperator manages the Android emulator lifecycle. No manual AVD setup is required.

Requirements:

- `adb` in `PATH`
- `emulator` in `PATH`
- `sdkmanager` in `PATH`
- `avdmanager` in `PATH`

### Step 1: Provision the Emulator

```bash
clawperator provision emulator --output json
```

This command:

1. Reuses a running supported emulator if one exists
2. Starts a stopped supported AVD if one exists
3. Creates a new AVD with the default profile if none exists (installs system image if needed)

The default supported emulator profile is:

- Android API level `35`
- Google Play system image
- ABI `arm64-v8a`
- device profile `pixel_7`
- AVD name `clawperator-pixel`

Provisioning result:

```json
{
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true,
  "created": false,
  "started": false,
  "reused": true
}
```

You can inspect configured AVDs at any time:

```bash
clawperator emulator list --output json
clawperator emulator inspect clawperator-pixel --output json
```

Then continue to [Step 5: Install the APK](#step-5-install-the-apk), passing `--device-id <serial>` from the provisioning result.

---

## Step 5: Install the APK

Install the operator APK onto the connected device or emulator:

```bash
adb install -r ~/.clawperator/downloads/operator.apk
```

If you have multiple devices connected, specify the target:

```bash
adb -s <device_id> install -r ~/.clawperator/downloads/operator.apk
```

After `clawperator provision emulator`, use the returned serial:

```bash
adb -s emulator-5554 install -r ~/.clawperator/downloads/operator.apk
```

---

## Step 6: Enable the Accessibility Service

Clawperator uses Android's Accessibility API to observe and interact with UI elements. You must enable the service before it can accept commands.

**From the host machine (recommended for remote and agent-driven setups):**

```bash
clawperator grant-device-permissions
```

This uses `adb` to enable the accessibility service without touching the device screen. Works identically for physical devices and emulators. Optionally pass `--device-id <id>` if multiple devices are connected.

For a standard public install, the default receiver package is `com.clawperator.operator`. For local debug builds, pass `--receiver-package com.clawperator.operator.dev`.

**On the device (manual alternative):**

1. Open **Settings**
2. Go to **Accessibility** (or **Accessibility > Installed Services** on some devices)
3. Find **Clawperator** in the list
4. Tap it and toggle it **On**
5. Accept the permissions prompt

> The accessibility service must remain enabled. If it is disabled, executions will time out.

---

## Step 7: Verify Setup

Run the diagnostic check:

```bash
clawperator doctor
```

A fully configured device will show all checks passing. The installer itself runs a final doctor check and exits non-zero if the environment is still not ready. Common warnings:

| Warning | Fix |
| :--- | :--- |
| `DEVICE_UNAUTHORIZED` | Tap "Allow" on the device USB debugging dialog |
| `RECEIVER_NOT_INSTALLED` | Complete Step 5 (install APK) |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Complete Step 6 (enable accessibility service) |
| `DEVICE_DEV_OPTIONS_DISABLED` | Complete Step 1 (physical device only) |
| `DEVICE_USB_DEBUGGING_DISABLED` | Complete Step 2 (physical device only) |

---

## Step 8: Run Your First Command

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

> Use `com.clawperator.operator` for release APK, `com.clawperator.operator.dev` for debug APK.

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

Verify the installed CLI/APK pair explicitly:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

For local debug builds, use `com.clawperator.operator.dev` instead.
