# The Android Operator APK

The Operator APK is the "hand" of the Clawperator system. It runs as a background service on your dedicated Android device to execute actions requested by the Node API.

## Application IDs

The Operator APK is distributed in two variants, each with its own application ID:

* **`com.clawperator.operator`**: The stable, release version. This is the default package used by the CLI and intended for most users and remote AI agents.
* **`com.clawperator.operator.dev`**: The local debug version. This is used by developers building the APK from source locally.

*Note: The CLI communicates with `com.clawperator.operator` by default. If you are using a debug build, you must pass the `--receiver-package com.clawperator.operator.dev` flag to CLI commands.*

## Installation

### Prerequisites
- Android device with Developer Options and USB Debugging enabled.
- `adb` installed on your host machine.

### Automatic Installation
The easiest way to install the APK is via the one-line installer:
```bash
curl -fsSL https://clawperator.com/install.sh | bash
```
This will download the latest APK and install it to your connected device.

### Manual Installation
If you need to install the APK manually:
1. Download the latest APK from [clawperator.com/operator.apk](https://clawperator.com/operator.apk).
2. Connect your device via USB.
3. Run the following command:
   ```bash
   adb install -r operator.apk
   ```

### Historical Versions
Historical versions of the APK can be downloaded from `downloads.clawperator.com`. The URL structure follows the versioning pattern:
- `https://downloads.clawperator.com/operator/v<version>/operator-v<version>.apk`

Example for v0.2.1:
- [https://downloads.clawperator.com/operator/v0.2.1/operator-v0.2.1.apk](https://downloads.clawperator.com/operator/v0.2.1/operator-v0.2.1.apk)

## Granting Permissions
After installation, you must grant accessibility and notification permissions for the Operator to function correctly. This allows it to inspect the screen and interact with the UI.

You can do this via the CLI:
```bash
clawperator grant-device-permissions
```

## Logging and Debugging

Starting from v0.2.1, the Operator APK enables **debug logging in release builds** by default. 

The app is **intentionally "noisy" in logcat**. This provides maximum visibility into UI events, accessibility node trees, and command execution states, ensuring that remote AI agents can observe the internal state and troubleshoot issues directly through `adb logcat` even when using production APKs.

To view logs:
```bash
adb logcat | grep -E '(Operator|Clawperator)'
```

## Troubleshooting
- **Device not found:** Run `adb devices` to ensure your device is recognized.
- **Permission denied:** Ensure you have accepted the USB debugging prompt on your device.
- **Handshake timeout:** Ensure the Clawperator Accessibility Service is enabled in your device's Accessibility settings.
