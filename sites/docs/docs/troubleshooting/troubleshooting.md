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

## Missing Operator APK

**What it means:** The requested Clawperator Operator package is not installed on the device. This is now a blocking readiness failure, so `clawperator doctor` and `clawperator execute` fail fast instead of waiting for a runtime timeout.

**How to fix:**

1. Install the Operator APK with the canonical setup command:
   ```bash
   clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>
   ```
2. If you are using a local debug build, add:
   ```bash
   --receiver-package com.clawperator.operator.dev
   ```
3. Re-run `clawperator doctor --device-id <device_id>` to confirm the package is now installed.

**In the app:** The doctor screen no longer reaches the runtime handshake until the package is installed, so this is usually the first thing to fix when a fresh device is not ready.

---

## Reading the Clawperator log

When a command times out or behaves unexpectedly, check the persistent log file
for the matching `commandId`.

**Default path:**

```text
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

You can override the directory with `CLAWPERATOR_LOG_DIR`. The file is NDJSON:
one JSON object per line, with no pretty-printing. Each line can be parsed with
`jq` or `JSON.parse`.

Useful filters:

```bash
grep '"'"'"commandId":"cmd-001"'"'"' ~/.clawperator/logs/clawperator-YYYY-MM-DD.log
jq -c '"'"'select(.commandId == "cmd-001")'"'"' ~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

Common events mean:

- `preflight.apk.pass` - the Operator APK was present before dispatch
- `preflight.apk.missing` - the requested Operator APK was not installed
- `broadcast.dispatched` - the Node layer sent the adb broadcast
- `envelope.received` - the `[Clawperator-Result]` envelope came back
- `timeout.fired` - the Node layer hit its timeout waiting for a result
- `doctor.check` - one doctor check result was recorded
- `skills.run.start` - a skill script spawned
- `skills.run.complete` - a skill script exited cleanly
- `skills.run.timeout` - a skill script hit its wrapper timeout

Set `--log-level debug` when you need more detail, or leave the default at
`info` for the normal lifecycle events.

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

1. **One connected device** - the installer offers to run `clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>`.
2. **Multiple connected devices** - the installer completes host-side setup, checks each connected device, and prints one `clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>` command for each device that still needs setup. Devices that are unauthorized or offline are reported separately so you can make them ADB-ready first.
3. **No connected devices** - the installer skips the install and leaves the verified package for the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) at `~/.clawperator/downloads/operator.apk`.
4. **`adb` missing** - the installer attempts to install `adb` automatically, or stops with a manual install link if it cannot.

For non-interactive environments, the installer also reads
`CLAWPERATOR_INSTALL_APK` before prompting whether to install the APK on the
connected device.

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

- Ensure hardware virtualization / emulator acceleration is enabled on the host
  (for example, Hypervisor.framework on macOS, WHPX on Windows, or KVM on Linux)
- Ensure the Android emulator has GPU acceleration enabled (check AVD configuration)
- Allocate sufficient RAM to the emulator (2 GB minimum recommended)

If the emulator is consistently slow, consider using a physical device instead.

### Multiple devices connected

Once an emulator is provisioned, you may have both a physical device and an emulator connected at the same time. In that state, continue to pass `--device-id <serial>` to `execute`, `observe`, `action`, and `skills run` commands.

If you omit it, the CLI returns `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`.

### Installer cloned everything except skills

If the installer finishes but warns that skills setup was skipped, the core CLI and [Clawperator Operator Android app](../getting-started/android-operator-apk.md) are still installed. This does not block `clawperator doctor`, device discovery, or direct command execution. To set up skills manually:

```bash
clawperator skills install
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

---

## Snapshot UI returns SNAPSHOT_EXTRACTION_FAILED

**Symptom:** A `snapshot_ui` step returns `success: false` with `data.error: "SNAPSHOT_EXTRACTION_FAILED"`. The device is connected and responding, but no UI hierarchy XML appears in `data.text`. The stderr output from the CLI contains a warning like:

```
[clawperator] WARN: snapshot_ui step "..." UI hierarchy extraction produced no output.
```

**Most common cause:** The installed `clawperator` npm binary is out of date. The compiled `snapshotHelper.js` in older published packages searches for a logcat marker (`TaskScopeDefault:`) that does not match the marker the Android Operator APK actually emits (`[TaskScope] UI Hierarchy:`). The APK is correct and requires no changes. Other less common causes, such as partial or truncated logcat capture, can also leave a `snapshot_ui` step without extracted text and produce the same error.

**How to confirm:**

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

This will report any version mismatch between the CLI and the installed APK.

**How to fix:**

1. Reinstall the npm package to get the current compiled binary:

   ```bash
   npm install -g clawperator
   ```

2. Verify the fix by running a snapshot:

   ```bash
   clawperator observe snapshot --device-id <device_serial> --output json
   ```

   A working snapshot returns `data.text` containing XML starting with `<hierarchy`.

**Temporary workaround (sibling repo checkout):**

If you have a local checkout of the clawperator repo at the sibling path, skills will automatically prefer the local build over the global binary. You can also set `CLAWPERATOR_BIN` explicitly:

```bash
export CLAWPERATOR_BIN=/path/to/clawperator/apps/node/dist/cli/index.js
```

Rebuild the local binary first if needed:

```bash
npm --prefix /path/to/clawperator/apps/node install
npm --prefix /path/to/clawperator/apps/node run build
```

If you are using a local branch build, point `CLAWPERATOR_BIN` at the branch-local
CLI path so skill scripts run against that build.

---

## Version Compatibility

The Node CLI and the installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) must have the same normalized version. The trailing debug suffix `-d` is stripped before comparison, and patch differences are not allowed.

- `0.1.4` and `0.1.4` are compatible
- `0.1.4` and `0.1.4-d` are compatible
- `0.1.4` and `0.1.9` are not compatible

Use:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

If the versions do not match, install the exact matching release APK and checksum from the versioned download URLs. For the full rule, examples, and remediation steps, see [Version Compatibility](compatibility.md).

---

## Summary

| Requirement              | Where to fix it                    | App doctor state / button              |
|--------------------------|------------------------------------|----------------------------------------|
| Developer settings       | Settings → About phone → Build # x7 | DeveloperOptionsDisabled → Open system settings |
| USB debugging            | Settings → Developer options       | UsbDebuggingDisabled → Open Developer options   |
| Permissions (accessibility) | Run grant script or Settings → Accessibility | PermissionsNotGranted → run script     |

When all three are satisfied, the app shows **Ready** and a **green** background. You can then use the Node API or agent workflows that depend on the operator.

---

## Recording capture issues

### Recording has no click events

**Symptom:** After pulling and parsing a recording, the step log contains `open_app` and `window_change` steps but no `click` steps, even though interactions clearly occurred.

**Most common cause:** The recording captured Clawperator-driven interactions rather than manual human taps. Android's accessibility framework emits `TYPE_VIEW_CLICKED` events for human finger taps but does NOT emit them for `adb shell input tap` commands (which Clawperator uses internally for click actions).

**This means:**
- Human taps (manual screen touches) → `click` events captured ✓
- Clawperator click actions → No `click` events captured ✗

**How to capture usable recordings:**

1. **Start recording** on the device:
   ```bash
   clawperator recording start --device-id <serial>
   ```

2. **Manually interact** with the device using your finger (not Clawperator commands)

3. **Stop recording**:
   ```bash
   clawperator recording stop --device-id <serial>
   ```

4. **Pull and parse**:
   ```bash
   clawperator recording pull --device-id <serial> --session-id <id> --out ./recordings/
   clawperator recording parse --input ./recordings/<file>.ndjson
   ```

**Expected behavior:** Manual interactions produce `click` steps in the parsed output; Clawperator-driven flows do not. This is a known Android limitation, not a bug.

---

## Skills execution issues

### Skill returns RESULT_ENVELOPE_TIMEOUT

**Symptom:** Running `clawperator skills run <skill_id>` fails with timeout error even though the device is connected and responsive.

**Most common cause:** The global `clawperator` binary (from npm) does not match the installed APK package or version.

**Check compatibility:**

```bash
# Check if using dev APK
adb shell pm list packages | grep clawperator
# Output: com.clawperator.operator.dev (dev) or com.clawperator.operator (release)

# Check CLI/APK version compatibility
clawperator version --check-compat --receiver-package com.clawperator.operator.dev
```

**How to fix:**

1. **For development/testing with local build and dev APK:**
   ```bash
   # Set CLAWPERATOR_BIN to use local branch build
   export CLAWPERATOR_BIN=/path/to/clawperator/apps/node/dist/cli/index.js
   
   # Set CLAWPERATOR_RECEIVER_PACKAGE to target the dev APK
   export CLAWPERATOR_RECEIVER_PACKAGE=com.clawperator.operator.dev
   
   # Rebuild if needed
   npm --prefix /path/to/clawperator/apps/node install
   npm --prefix /path/to/clawperator/apps/node run build
   
   # Now skills will use the local build and target the dev APK
   clawperator skills run <skill_id>
   ```

   Or use the `--receiver-package` flag for a single run:
   ```bash
   clawperator skills run <skill_id> --receiver-package com.clawperator.operator.dev
   ```

2. **For production use:** Ensure the global npm package matches your APK:
   ```bash
   npm install -g clawperator
   clawperator version --check-compat --receiver-package com.clawperator.operator
   ```

3. **For skills specifically:** Skills receive `CLAWPERATOR_BIN` and `CLAWPERATOR_RECEIVER_PACKAGE` environment variables automatically from the CLI. When testing skills with a dev APK, set these environment variables or use the `--receiver-package` flag.

### Skill validation passes but execution fails

**Symptom:** `clawperator skills validate <skill_id>` succeeds but `clawperator skills run <skill_id>` fails.

**Check:**
1. Device permissions: `clawperator doctor`
2. APK/CLI compatibility: `clawperator version --check-compat`
3. Device selection (if multiple devices): `--device-id <serial>`

**Debug the skill directly:**

Instead of `skills run`, test the skill's execution payload directly:

```bash
# 1. Get the skill's compiled execution
clawperator skills compile-artifact <skill_id> --artifact main --output json

# 2. Save to file and run manually
clawperator execute --execution ./skill-execution.json --device-id <serial>
```

This bypasses the skills wrapper and helps identify whether the issue is the skill logic or the skills runtime.
