# Installing the Android Operator APK

The Operator APK is the "hand" of the Clawperator system, running on your Android device to execute actions.

## Prerequisites
- Android device with Developer Options and USB Debugging enabled.
- `adb` installed on your host machine.

## Automatic Installation
The easiest way to install the APK is via the one-line installer:
```bash
curl -fsSL https://clawperator.com/install.sh | bash
```
This will download the latest APK and install it to your connected device.

## Manual Installation
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
Example for v0.2.0:
- [https://downloads.clawperator.com/operator/v0.2.0/operator-v0.2.0.apk](https://downloads.clawperator.com/operator/v0.2.0/operator-v0.2.0.apk)

## Granting Permissions
After installation, you must grant accessibility and notification permissions for the Operator to function correctly.
You can do this via the CLI:
```bash
clawperator grant-device-permissions
```

## Logging and Debugging
Starting from v0.2.1, the Operator APK enables **debug logging in release builds** by default. This ensures that remote AI agents can observe the internal state and troubleshoot issues directly through `adb logcat` even when using production APKs. The app is intentionally "noisy" in logcat to provide maximum visibility into UI events and command execution state for AI agents.

To view logs:
```bash
adb logcat | grep -E '(Operator|Clawperator)'
```

## Troubleshooting
- **Device not found:** Run `adb devices` to ensure your device is recognized.
- **Permission denied:** Ensure you have accepted the USB debugging prompt on your device.
- **Handshake timeout:** Ensure the Clawperator Accessibility Service is enabled in your device's Accessibility settings.
