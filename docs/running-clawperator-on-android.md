# Running Clawperator on Android

Clawperator uses a dedicated Android device - physical or emulator - as an actuator for agent-driven UI automation. This document explains the actuator model, user responsibilities, and how to prepare either type of device.

## The Actuator Model

Clawperator is the "hand" for an LLM "brain." It:

- Observes the live UI tree on the Android device
- Performs taps, scrolls, text entry, and navigation
- Executes payloads dispatched from the Node API
- Returns structured results to the agent

Clawperator does **not**:

- Plan or reason autonomously
- Configure accounts, apps, or device settings
- Log in to apps on your behalf
- Install apps other than the Clawperator operator APK

**User responsibility:** Before running automations that target apps requiring sign-in, you must log in to those apps manually on the device. Clawperator executes UI actions; it does not own your credentials or session state.

## Android Device Options

The actuator target can be either:

| Option | Best for |
| :--- | :--- |
| Physical Android device | Persistent setups, broad app compatibility, no SDK required |
| Android emulator | Headless setups, CI, reproducible environments |

Both options use the same Node API, the same APK, and the same permissions flow. The only difference is how you connect the device.

## Physical Device

A physical Android device connects over USB (or wireless debugging). Any Android 5.0+ device works - cheap and old phones are fine.

Requirements:

- USB cable
- Developer options enabled on the device
- USB debugging enabled
- Device authorized for ADB

See [First-Time Setup](first-time-setup.md) for step-by-step instructions.

## Android Emulator

Clawperator can provision a local Android emulator through the Node CLI. No manual AVD setup is required - provisioning handles system image installation and AVD creation.

Requirements:

- `adb`, `emulator`, `sdkmanager`, `avdmanager` in `PATH`

Provision a supported emulator:

```bash
clawperator provision emulator --output json
```

The default profile:

- Android API level `35`
- Google Play system image
- ABI `arm64-v8a`
- device profile `pixel_7`
- AVD name `clawperator-pixel`

Provisioning is deterministic: it reuses a running supported emulator, starts a stopped supported AVD, or creates a new one.

See [First-Time Setup](first-time-setup.md) for the full emulator setup flow.

## Installing the Operator APK

Once you have a device or emulator connected, install the Clawperator operator APK:

```bash
adb install -r ~/.clawperator/downloads/operator.apk
```

With a specific device target:

```bash
adb -s <device_id> install -r ~/.clawperator/downloads/operator.apk
```

The APK is downloaded by `curl -fsSL https://clawperator.com/install.sh | bash` or manually from [clawperator.com/operator.apk](https://clawperator.com/operator.apk).

## Granting Permissions

The operator APK requires Android's Accessibility Service to observe and interact with the UI. Enable it from the host machine:

```bash
clawperator grant-device-permissions
```

With a specific device:

```bash
clawperator grant-device-permissions --device-id <device_id>
```

This command works identically for physical devices and emulators. It uses `adb` and does not require on-device interaction.

## Verifying Readiness

Run the diagnostic check:

```bash
clawperator doctor
```

All checks must pass before the device can accept commands. Common failures and fixes:

| Error | Fix |
| :--- | :--- |
| `DEVICE_UNAUTHORIZED` | Tap "Allow" on the USB debugging prompt on the device |
| `RECEIVER_NOT_INSTALLED` | Install the APK (see above) |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Run `clawperator grant-device-permissions` |
| `DEVICE_DEV_OPTIONS_DISABLED` | Enable Developer options on the device |
| `DEVICE_USB_DEBUGGING_DISABLED` | Enable USB debugging in Developer options |

## App Account Setup

Clawperator automates the UI on whatever apps are installed and signed in on the device. It does not log in to apps for you.

Before running automations that target an app requiring authentication, you must:

1. Open the app on the device manually
2. Log in with your credentials
3. Complete any first-run setup the app requires
4. Return to the home screen

For emulators using a Google Play system image, you will also need to sign in to a Google account in the Play Store before Play Store-gated apps can run.

## Keeping the Device Ready

For reliable automation:

- Keep the screen **unlocked** (set screen timeout to maximum or "Never")
- Keep the device **plugged in**
- Keep the **Accessibility Service enabled**
- For physical devices: keep **USB Debugging enabled**
