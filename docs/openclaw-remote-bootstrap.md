# OpenClaw Remote Bootstrap Guide

This doc covers the exact steps a remote OpenClaw agent should follow to install Clawperator, prepare the connected Android device, and confirm the environment is ready for skill execution.

**Deployment model:** Mac mini host running OpenClaw, one Android device connected via USB.

---

## Preconditions

Before starting:

- The host Mac has `node` (v18 or later), `adb`, `git`, and `curl` installed
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
- downloads and installs the Operator APK on the connected device
- attempts to clone the skills repo to `~/.clawperator/skills/`

In non-interactive mode (piped execution), the APK install proceeds automatically without prompts.

Verify the CLI is available after install:

```bash
clawperator --version
```

---

## Step 2 - Set the Skills Registry

The skills registry path must be set explicitly. Add to the shell profile or export for the session:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

---

## Step 3 - Grant Device Permissions

The Operator APK requires the Android Accessibility Service to be running. Enable it via the CLI:

```bash
clawperator grant-device-permissions
```

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

**Fix:**

```bash
clawperator grant-device-permissions [--device-id <id>] [--receiver-package <pkg>]
```

If the `grant-device-permissions` command fails, check that the APK is installed and the device is reachable:

```bash
clawperator doctor --output pretty
```

Wait 3 seconds after granting, then re-run doctor.

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

The APK is cached at `~/.clawperator/operator/` after first install.

---

### Skills list fails or returns empty (REGISTRY_READ_FAILED)

**Cause:** The skills repo was not set up correctly by the installer, or the registry env var is not set.

**Fix:**

```bash
# Set the env var
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"

# If skills install was skipped entirely
clawperator skills install

# If the repo exists but has no remote (common after a failed installer run)
cd ~/.clawperator/skills
git remote add origin git@github.com:clawpilled/clawperator-skills.git
git fetch origin
git reset --hard origin/main
cd -
```

---

### CLI/APK version mismatch (VERSION_INCOMPATIBLE)

**Cause:** The installed APK does not match the CLI's expected `major.minor` version.

**Check:**

```bash
clawperator version --check-compat
```

**Fix:** Re-run the installer to align the APK version with the CLI:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
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
