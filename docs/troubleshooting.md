# Troubleshooting the Operator App

The Clawperator operator app on Android must satisfy **three requirements** before it is ready to accept agent commands. The in-app "doctor" screen shows the current state and turns **green** only when all three are met. This document walks through each requirement and how to fix it.

## The three requirements

1. **Developer settings enabled** - The device’s Developer options menu is unlocked.
2. **USB debugging enabled** - USB debugging is turned on in Developer options.
3. **Permissions granted** - The Clawperator accessibility (operator) service is enabled and running.

If any requirement is not met, the app shows an orange background and a dedicated screen explaining what to do.

---

## 1. Developer settings enabled

**What it means:** Android hides the Developer options menu until you unlock it by tapping "Build number" (or "System version") multiple times.

**How to fix:**

1. Open **Settings** on the device.
2. Go to **About phone** (or **About device**).
3. Find **Build number** (on some devices this is under "Software information" or labeled "System version").
4. Tap **Build number** **7 times in a row**. You should see a message like "You are now a developer!" or "Developer mode has been enabled."
5. Go back to the main Settings screen. You should now see **Developer options** (often under System or Additional settings).

**In the app:** If this requirement is not met, the doctor screen shows "Android Developer mode must be turned on" and steps similar to the above. Use **Open system settings** to jump to Settings; on some devices the app opens About phone or Developer options directly.

---

## 2. USB debugging enabled

**What it means:** Even after Developer options are visible, USB debugging must be turned on so that your computer (and tools like `adb` or the Node API) can talk to the device.

**How to fix:**

1. Ensure **Developer options** are enabled (see requirement 1).
2. Open **Settings** → **Developer options**.
3. Find **USB debugging** and turn it **On**.
4. When you connect the device via USB (or use wireless debugging), you may see a prompt to **Allow USB debugging** for this computer. Check "Always allow from this computer" if you want to avoid the prompt next time, then tap **Allow**.

**In the app:** If developer options are on but USB debugging is off, the doctor screen shows "USB debugging must be turned on" and an **Open Developer options** button to open that settings screen.

---

## 3. Permissions granted (accessibility / operator service)

**What it means:** The Clawperator operator relies on an Android **Accessibility service** to inspect and act on the UI. That service must be enabled in system settings and running.

**How to fix:**

1. On the **host computer**, run:
   ```bash
   clawperator grant-device-permissions
   ```
   This uses `adb` to enable the Clawperator accessibility service on the connected device without requiring screen interaction. Add `--device-id <id>` if multiple devices are connected.

2. On the **device** (manual alternative):
   - Open **Settings** → **Accessibility** (or **Settings** → **Apps** → **Special app access** → **Accessibility**).
   - Find the **Clawperator** (or operator) service and turn it **On**.
   - Confirm any system dialog (e.g. "Allow [app] to observe your actions...").

3. After enabling, run `clawperator doctor` to confirm the handshake passes. If doctor still fails, wait 2-3 seconds for the service to initialize and retry.

**Note:** Android revokes the accessibility permission if the Clawperator app crashes. If the doctor screen shows "Permissions not granted" after the app had been ready, the service may have been disabled by a crash - re-run `clawperator grant-device-permissions` or re-enable the Clawperator service in Settings → Accessibility.

---

## Wireless Debugging (YMMV)

Clawperator is designed to work with a dedicated, **always-on, permanently powered** Android device. For maximum reliability, a physical USB connection is strongly recommended. 

If you must use **Wireless Debugging**, be aware that your mileage may vary (YMMV) as connection stability can drop unexpectedly.

1. Ensure both the Android device and your host computer are on the same Wi-Fi network.
2. Go to **Settings** → **Developer options**.
3. Turn on **Wireless debugging**.
4. Tap **Wireless debugging** to see the IP address and port (e.g., `192.168.1.100:5555`).
5. On your computer, run:
   ```bash
   adb connect <ip_address>:<port>
   ```

**Warning:** Wireless debugging sessions are prone to disconnection. If the device drops off the network, the Node CLI will return `NO_DEVICES`. For production use, always prefer a wired connection.

---

## Installer behavior

`curl -fsSL https://clawperator.com/install.sh | bash` uses the stable metadata file at `https://downloads.clawperator.com/operator/latest.json`, downloads the immutable package for the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) plus its `.sha256`, verifies the checksum, then handles device install like this:

1. **One connected device** - the installer offers to run `adb install -r ~/.clawperator/downloads/operator.apk`.
2. **Multiple connected devices** - the installer skips the install and prints `adb -s <device_id> install -r ~/.clawperator/downloads/operator.apk`.
3. **No connected devices** - the installer skips the install and leaves the verified package for the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) at `~/.clawperator/downloads/operator.apk`.
4. **`adb` missing** - the installer attempts to install `adb` automatically, or stops with a manual install link if it cannot.

## Emulator-Specific Issues

Clawperator can provision a local Android emulator through the Node CLI and API. If provisioning fails, use the checks below.

### Missing Android SDK tools

If provisioning returns `ANDROID_SDK_TOOL_MISSING`, verify that all required tools are available:

```bash
which adb
which emulator
which sdkmanager
which avdmanager
```

If one tool is outside your normal shell `PATH`, pass it explicitly when starting the HTTP API or CLI process:

```bash
ADB_PATH=/path/to/adb \
EMULATOR_PATH=/path/to/emulator \
SDKMANAGER_PATH=/path/to/sdkmanager \
AVDMANAGER_PATH=/path/to/avdmanager \
clawperator provision emulator
```

### AVD exists but is unsupported

If `clawperator emulator inspect <name> --output json` shows `supported: false`, the AVD will not be auto-selected by provisioning. Clawperator currently supports:

- Android API level `35`
- Google Play system image
- ABI `arm64-v8a`
- device profile `pixel_7`

Inspect the normalized metadata and unsupported reasons:

```bash
clawperator emulator inspect <name> --output json
```

Clawperator evaluates compatibility from:

- `~/.android/avd/<name>.avd/config.ini`
- `~/.android/avd/<name>.ini`

The key fields are:

- `PlayStore.enabled`
- `abi.type`
- `image.sysdir.1`
- `hw.device.name`

### Emulator starts but never becomes ready

Provisioning waits for two Android boot signals:

- `getprop sys.boot_completed`
- `getprop dev.bootcomplete`

If either never flips to `1`, Clawperator returns `EMULATOR_BOOT_TIMEOUT`. This usually points to a broken AVD, stale emulator state, or a host-level emulator issue.

Recommended recovery:

1. Stop the emulator with `clawperator emulator stop <name>`.
2. Delete the AVD with `clawperator emulator delete <name>`.
3. Re-run `clawperator provision emulator`.

Clawperator starts emulators with `-no-snapshot-load` to avoid stale snapshot state, so repeated boot timeouts usually indicate a deeper emulator or SDK problem.

### Emulator process launches but does not appear in adb

If start returns `EMULATOR_START_FAILED`, the emulator process did not register with adb before the registration timeout expired.

Check:

- `adb devices`
- `clawperator emulator status --output json`

If the emulator window appears but adb never sees it, restart the adb server:

```bash
adb kill-server
adb start-server
```

Then retry:

```bash
clawperator emulator start clawperator-pixel
```

### App requires a Google account or Play Store sign-in

The default emulator profile uses a Google Play system image. Some apps require a Google account to be signed in to the emulator before they can run. Clawperator does not handle account setup.

To sign in:

1. Open the Play Store app on the emulator
2. Sign in with a Google account
3. Accept any prompts
4. Return to the home screen before running automations

Some apps require additional configuration (such as accepting terms of service or completing a first-run flow) before Clawperator can interact with them.

If an agent is blocked on a login screen or onboarding flow, treat that as device-preparation work that must be completed by the user.

### App not installed or not detected on the emulator

If an automation targets an app that is not installed on the emulator, the `open_app` step will fail - the execution envelope will return `status: "failed"` with the reason in `envelope.error`. `NODE_NOT_FOUND` is a selector/matcher error and will not appear for a missing app. Install the app from the Play Store or via `adb install` before running.

### Slow emulator boot or sluggish UI

Android emulators are resource-intensive. On machines without hardware virtualization or GPU acceleration, boots can be slow and UI interactions may be sluggish.

Recommended settings:

- Enable hardware virtualization (Intel HAXM or KVM) on the host
- Ensure the Android emulator has GPU acceleration enabled (check AVD configuration)
- Allocate sufficient RAM to the emulator (2 GB minimum recommended)

If the emulator is consistently slow, consider using a physical device instead.

### Multiple devices connected

Once an emulator is provisioned, you may have both a physical device and an emulator connected at the same time. In that state, continue to pass `--device-id <serial>` to `execute`, `observe`, `action`, and `skills run` commands.

### Installer cloned everything except skills

If the installer finishes but warns that skills setup was skipped, the core CLI and [Clawperator Operator Android app](../getting-started/android-operator-apk.md) are still installed. This does not block `clawperator doctor`, device discovery, or direct command execution. To set up skills manually:

```bash
git clone https://clawperator.com/install/clawperator-skills.bundle ~/.clawperator/skills
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

---

## Version Compatibility

The Node CLI and the installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) must have matching `major.minor` versions.

- `0.1.4` and `0.1.9` are compatible
- `0.1.4` and `0.1.4-d` are compatible
- `0.1.4` and `0.2.1` are not compatible

Use:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

If the versions do not match, upgrade the CLI and install a compatible [Clawperator Operator Android app](../getting-started/android-operator-apk.md). For the full rule, examples, and remediation steps, see [Version Compatibility](compatibility.md).

---

## Summary

| Requirement              | Where to fix it                    | App doctor state / button              |
|--------------------------|------------------------------------|----------------------------------------|
| Developer settings       | Settings → About phone → Build # x7 | DeveloperOptionsDisabled → Open system settings |
| USB debugging            | Settings → Developer options       | UsbDebuggingDisabled → Open Developer options   |
| Permissions (accessibility) | Run grant script or Settings → Accessibility | PermissionsNotGranted → run script     |

When all three are satisfied, the app shows **Ready** and a **green** background. You can then use the Node API or agent workflows that depend on the operator.
