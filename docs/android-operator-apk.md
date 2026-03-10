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
3. Run:
   ```bash
   adb install -r operator.apk
   ```

### Historical Versions
Historical versions can be downloaded from `downloads.clawperator.com`. The URL structure follows the versioning pattern:
- `https://downloads.clawperator.com/operator/v<version>/operator-v<version>.apk`

Example for v0.2.3:
- [https://downloads.clawperator.com/operator/v0.2.3/operator-v0.2.3.apk](https://downloads.clawperator.com/operator/v0.2.3/operator-v0.2.3.apk)

## Granting Permissions
After installation, grant accessibility permissions so the app can inspect the screen and interact with the UI:

```bash
clawperator grant-device-permissions
```

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
