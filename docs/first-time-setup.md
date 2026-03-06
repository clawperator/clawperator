# First-Time Setup

You've installed the Clawperator CLI. This guide walks through setting up your Android device so it can be used as an actuator.

## What You Need

- A dedicated Android device (any cheap or old phone works - Android 5.0+)
- A USB cable
- The Clawperator APK from [clawperator.com/operator.apk](https://clawperator.com/operator.apk)

This device will stay connected to your machine as a dedicated actuator. It does not need to be your primary phone.

---

## Step 1: Download the APK

Download the latest APK from [clawperator.com/operator.apk](https://clawperator.com/operator.apk) and save the `operator-vX.X.X.apk` file locally.

Historical versions and release notes remain available on [GitHub Releases](https://github.com/clawpilled/clawperator/releases).

---

## Step 2: Enable Developer Options

On the Android device:

1. Open **Settings**
2. Go to **About Phone**
3. Tap **Build Number** 7 times until you see "You are now a developer"
4. Go back to **Settings** - a **Developer Options** entry will appear

---

## Step 3: Enable USB Debugging

In **Developer Options**:

1. Enable **Developer Options** (toggle at the top)
2. Enable **USB Debugging**

---

## Step 4: Connect via USB

Connect the device to your machine via USB cable.

On the device, a dialog will appear: **"Allow USB debugging?"**
- Tap **Allow** (optionally check "Always allow from this computer")

Verify the connection:

```bash
adb devices
```

You should see your device listed as `device` (not `unauthorized`).

---

## Step 5: Install the APK

```bash
adb install -r /path/to/operator-vX.X.X.apk
```

If you have multiple devices connected, specify the target:

```bash
adb -s <device_id> install -r /path/to/operator-vX.X.X.apk
```

---

## Step 6: Enable the Accessibility Service

Clawperator uses Android's Accessibility API to observe and interact with UI elements. You must enable the service manually.

On the device:

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

A fully configured device will show all checks passing. Common warnings:

| Warning | Fix |
| :--- | :--- |
| `DEVICE_UNAUTHORIZED` | Tap "Allow" on the device USB debugging dialog |
| `RECEIVER_NOT_INSTALLED` | Complete Step 5 (install APK) |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Complete Step 6 (enable accessibility service) |
| `DEVICE_DEV_OPTIONS_DISABLED` | Complete Step 2 |
| `DEVICE_USB_DEBUGGING_DISABLED` | Complete Step 3 |

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
- Keep **USB Debugging enabled**

---

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.

For environment checks: `clawperator doctor --output pretty`
