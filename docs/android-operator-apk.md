# Clawperator Operator Android app

This is Clawperator's own Android app. It runs as a background service on the dedicated Android device and executes actions requested by the Node API.

This app is intentionally distinct from the Android apps the user wants Clawperator to operate. Those user-installed Android apps are not part of Clawperator itself. See [Clawperator Terminology](terminology.md) for the full distinction.

## Application IDs

The app is distributed in two variants, each with its own application ID:

* **`com.clawperator.operator`**: The stable, release version. This is the default package used by the CLI and intended for most users and remote AI agents.
* **`com.clawperator.operator.dev`**: The local debug version. This is used by developers building the APK from source locally.

*Note: The CLI communicates with `com.clawperator.operator` by default. If you are using a debug build, you must pass the `--receiver-package com.clawperator.operator.dev` flag to CLI commands.*

## Installation

### Prerequisites
- Android device with Developer Options and USB Debugging enabled.
- `adb` installed on your host machine.

### Automatic Installation
The easiest way to install is via the one-line installer:
```bash
curl -fsSL https://clawperator.com/install.sh | bash
```
This downloads the latest app package and installs it to your connected device.

### Manual Installation
To install manually:
1. Download the latest app package from [clawperator.com/operator.apk](https://clawperator.com/operator.apk).
2. Connect your device via USB.
3. Run the canonical install command:
   ```bash
   clawperator operator install --apk operator.apk
   ```

This command installs the APK and grants all required permissions in one step. See [First-Time Setup](first-time-setup.md) for full details.

> Do not use raw `adb install` for normal setup. It installs the APK but does not grant the permissions required for the app to operate.

### Historical Versions
Historical versions can be downloaded from `downloads.clawperator.com`. The URL structure follows the versioning pattern:
- `https://downloads.clawperator.com/operator/v<version>/operator-v<version>.apk`

Example for v0.2.5:
- [https://downloads.clawperator.com/operator/v0.2.5/operator-v0.2.5.apk](https://downloads.clawperator.com/operator/v0.2.5/operator-v0.2.5.apk)

## Required Permissions
The app requires three permissions to operate:

```bash
clawperator operator install --apk <path>
```

This command grants all three permissions automatically during install. The permissions are:

| Permission | ADB mechanism | Purpose |
|---|---|---|
| Accessibility service | `settings put secure enabled_accessibility_services` | Read UI tree and dispatch gestures |
| Post notifications (`POST_NOTIFICATIONS`) | `pm grant android.permission.POST_NOTIFICATIONS` | Show foreground service status notification (Android 13+) |
| Notification listener | `settings put secure enabled_notification_listeners` | Observe notifications from all apps on the device |

The accessibility service and notification listener permissions are enabled by appending the Clawperator service component to the relevant secure setting, matching the format Android uses internally. The `POST_NOTIFICATIONS` grant is a standard runtime permission grant; on Android 12 and below it is silently skipped.

If the Operator APK crashes after setup and Android revokes the granted permissions, use the remediation command:

```bash
clawperator grant-device-permissions
```

This re-grants the same permissions without reinstalling the APK. Do not use it for normal setup - agents should use `clawperator operator install` for the initial install path every time.

## Logging and Debugging

The app enables **debug logging in release builds** by default. This provides maximum visibility into UI events, accessibility node trees, and command execution states, so remote AI agents can observe internal state and troubleshoot issues directly through `adb logcat` even when using production APKs.

To view logs:
```bash
adb logcat | grep -E '(Operator|Clawperator)'
```

## Troubleshooting
- **Device not found:** Run `adb devices` to ensure your device is recognized.
- **Permission denied:** Ensure you have accepted the USB debugging prompt on your device.
- **Handshake timeout:** Ensure the Clawperator Accessibility Service is enabled in your device's Accessibility settings.
