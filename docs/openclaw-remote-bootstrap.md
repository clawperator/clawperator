# OpenClaw Remote Bootstrap Guide

This doc covers the exact steps a remote OpenClaw agent should follow to install Clawperator, prepare the connected Android device, and confirm the environment is ready for skill execution.

**Deployment model:** Mac mini host running OpenClaw, one Android device connected via USB.

---

## Preconditions

Before starting:

- The host Mac has `curl`, `adb`, and `git` installed (`node` v22 is installed automatically by the installer if not present)
- One Android device is physically connected via USB
- USB debugging is enabled on the device
- The device has previously authorized USB debugging for this host (the RSA prompt was accepted)
- The device is unlocked

If USB debugging has not been authorized before, the first adb connection attempt will surface an on-device prompt. This requires a human tap and cannot be bypassed.

---

## Step 1 - Install

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The installer:

- detects `node`, `adb`, `git`, `curl`
- installs the `clawperator` CLI to a location on `PATH`
- runs `clawperator doctor --format json` to detect what still needs repair
- downloads and installs or upgrades the Operator APK on the connected device when doctor reports it missing, mismatched, or incompatible
- auto-runs `clawperator grant-device-permissions` after a successful APK install when exactly one device is connected
- runs `clawperator skills install` to populate `~/.clawperator/skills/`
- writes `CLAWPERATOR_SKILLS_REGISTRY` into your shell profile when skills setup succeeds
- runs a final doctor check and exits non-zero if the environment is still not ready

In non-interactive mode (piped execution), the APK install proceeds automatically without prompts.

Verify the CLI is available after install:

```bash
clawperator --version
```

---

## Step 2 - Set the Skills Registry

The installer writes `CLAWPERATOR_SKILLS_REGISTRY` to your shell profile automatically when skills are set up successfully. Restart your terminal or source your profile, then verify:

```bash
echo $CLAWPERATOR_SKILLS_REGISTRY
```

If the variable is empty, skills setup either failed or was skipped during install. Set it explicitly:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

If skills were not installed at all, run:

```bash
clawperator skills install
```

---

## Step 3 - Grant Device Permissions

The Operator APK requires the Android Accessibility Service to be running. Enable it via the CLI:

```bash
clawperator grant-device-permissions
```

By default, the CLI targets the release package `com.clawperator.operator`. For local debug builds, pass `--receiver-package com.clawperator.operator.dev`.

With multiple devices connected, target one explicitly:

```bash
clawperator grant-device-permissions --device-id <device_id>
```

With the debug APK variant:

```bash
clawperator grant-device-permissions --receiver-package com.clawperator.operator.dev
```

This command enables the accessibility service via adb and does not require on-device interaction.

---

## Step 4 - Verify

Run the doctor to confirm all checks pass:

```bash
clawperator doctor --output pretty
```

If you are using a local debug APK, add `--receiver-package com.clawperator.operator.dev` to `grant-device-permissions`, `doctor`, `version --check-compat`, and `observe snapshot`.

Expected passing output (condensed):

```
PASS  Node version is compatible
PASS  adb is installed and healthy
PASS  Device is connected and reachable
PASS  Operator APK is installed
PASS  Developer options are enabled
PASS  USB debugging is enabled
PASS  Handshake successful
```

Also confirm the device is visible:

```bash
clawperator devices
```

Confirm skills are discoverable:

```bash
clawperator skills list
```

---

## Step 5 - Run a Verification Skill

Run the settings overview skill as a lightweight end-to-end check:

```bash
clawperator skills run com.android.settings.capture-overview
```

Expected output begins with `Settings Overview captured` followed by the UI snapshot. If this succeeds, the environment is ready.

---

## Recovery from Common Failures

### Handshake timed out

**Cause:** The Accessibility Service is not running on the device.

This can also happen if the command was sent to the wrong receiver package. Public installs usually use `com.clawperator.operator`. Local debug builds use `com.clawperator.operator.dev`.

**Fix:**

```bash
clawperator grant-device-permissions [--device-id <id>] [--receiver-package <pkg>]
```

If the `grant-device-permissions` command fails, check that the APK is installed and the device is reachable:

```bash
clawperator doctor --output pretty
```

Wait 3 seconds after granting, then re-run doctor.

If it still fails, collect a direct snapshot with explicit timeout and diagnostics:

```bash
clawperator observe snapshot --timeout-ms 5000 --output pretty --verbose
```

---

### Operator APK not installed (RECEIVER_NOT_INSTALLED)

**Cause:** The installer did not install the APK, or the wrong variant is installed.

**Fix:** Re-run the installer:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

Or install the APK manually:

```bash
adb install -r <path-to-operator.apk>
```

The APK is cached at `~/.clawperator/downloads/operator.apk` after first install.

---

### CLI/APK version mismatch (VERSION_INCOMPATIBLE)

**Cause:** The installed APK does not match the CLI's expected `major.minor` version.

**Check:**

```bash
clawperator version --check-compat
```

**Fix:** Re-run the installer. The installer now upgrades an incompatible installed APK as part of the normal bootstrap flow:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

---

### Skills list fails or returns empty (REGISTRY_READ_FAILED)

**Cause:** The skills repo was not set up correctly by the installer, or the registry env var is not set.

**Fix:**

```bash
# Set the env var
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"

# If skills install was skipped entirely
clawperator skills install

# If auth or clone state broke the local checkout, remove it and retry
rm -rf ~/.clawperator/skills
clawperator skills install
```

---

### Multiple devices connected (wrong device targeted)

**Cause:** `adb` sees more than one device and selects an unexpected one.

**Fix:** Pass `--device-id` explicitly to all commands:

```bash
clawperator doctor --device-id <device_id>
clawperator grant-device-permissions --device-id <device_id>
clawperator skills run <skill_id> --device-id <device_id>
```

List connected devices:

```bash
clawperator devices
```

---

## Trust Boundary

All steps in this guide are fully automatable by a remote agent, provided:

- USB debugging was previously authorized by a human on the device
- The device remains unlocked during operation

The one step that cannot be automated without prior human action is the first-time USB debugging authorization prompt on the device. This is an OS-level security gate. Once authorized, subsequent connections from the same host require no on-device confirmation.

The `grant-device-permissions` command enables the accessibility service without requiring on-device interaction.
