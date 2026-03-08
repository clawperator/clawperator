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

1. On the **host computer** (where you run the agent or Node API), run the permissions script from the Clawperator repo:
   ```bash
   ./scripts/clawperator_grant_android_permissions.sh
   ```
   This script uses `adb` to open the right Accessibility settings and can help enable the Clawperator operator service on the connected device.

2. On the **device**, you can also enable it manually:
   - Open **Settings** → **Accessibility** (or **Settings** → **Apps** → **Special app access** → **Accessibility**).
   - Find the **Clawperator** (or operator) service and turn it **On**.
   - Confirm any system dialog (e.g. "Allow [app] to observe your actions...").

3. After enabling, the operator app’s doctor screen should move to **Ready** (green) once the service is connected. If you see "Permissions not granted" or an accessibility-related message, run the grant script again or re-enable the service in Accessibility settings.

**Note:** Android revokes the accessibility permission if the Clawperator app crashes. If the doctor screen shows "Permissions not granted" after the app had been ready, the service may have been disabled by a crash - re-run the grant script or re-enable the Clawperator service in Settings → Accessibility.

**In the app:** If requirements 1 and 2 are met but the accessibility service is not running, the doctor screen shows a message like "Accessibility permissions are not configured" and instructs you to run `clawperator_grant_android_permissions.sh`.

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

`curl -fsSL https://clawperator.com/install.sh | bash` uses the stable metadata file at `https://downloads.clawperator.com/operator/latest.json`, downloads the immutable APK and `.sha256`, verifies the checksum, then handles device install like this:

1. **One connected device** - the installer offers to run `adb install -r ~/.clawperator/downloads/operator.apk`.
2. **Multiple connected devices** - the installer skips the install and prints `adb -s <device_id> install -r ~/.clawperator/downloads/operator.apk`.
3. **No connected devices** - the installer skips the install and leaves the verified APK at `~/.clawperator/downloads/operator.apk`.
4. **`adb` missing** - the installer attempts to install `adb` automatically, or stops with a manual install link if it cannot.

### Installer cloned everything except skills

If the installer finishes but warns that skills setup was skipped, the core CLI and operator APK are still installed. This does not block `clawperator doctor`, device discovery, or direct command execution. To set up skills manually:

```bash
git clone https://clawperator.com/install/clawperator-skills.bundle ~/.clawperator/skills
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

---

## Version Compatibility

The Node CLI and the Android APK must have matching `major.minor` versions.

- `0.1.4` and `0.1.9` are compatible
- `0.1.4` and `0.1.4-d` are compatible
- `0.1.4` and `0.2.0` are not compatible

Use:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

If the versions do not match, upgrade the CLI and install a compatible APK. For the full rule, examples, and remediation steps, see [Version Compatibility](compatibility.md).

---

## Summary

| Requirement              | Where to fix it                    | App doctor state / button              |
|--------------------------|------------------------------------|----------------------------------------|
| Developer settings       | Settings → About phone → Build # x7 | DeveloperOptionsDisabled → Open system settings |
| USB debugging            | Settings → Developer options       | UsbDebuggingDisabled → Open Developer options   |
| Permissions (accessibility) | Run grant script or Settings → Accessibility | PermissionsNotGranted → run script     |

When all three are satisfied, the app shows **Ready** and a **green** background. You can then use the Node API or agent workflows that depend on the operator.
