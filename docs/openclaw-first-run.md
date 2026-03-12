# OpenClaw First Run

This guide is the first successful OpenClaw + Clawperator path.

It is written for agents and technical operators who want one clear outcome:

1. install Clawperator from the public website
2. prepare an Android device or emulator
3. install skills
4. verify the runtime
5. run a real skill and return a result

If the user says something like:

> "clawperator.com looks interesting - set this up for me, and tell me the battery % on my home battery"

this is the guide an agent should follow.

## What this guide assumes

- OpenClaw is running on a Mac mini or similar host
- the host can access `https://clawperator.com` and `https://docs.clawperator.com`
- one Android actuator environment will be used:
  - a physical Android device connected over `adb`
  - or a local Android emulator provisioned through Clawperator
- the user is responsible for app installation, login, and app configuration on that Android device

Clawperator operates the Android UI. It does not create accounts, sign into apps, or complete first-run app setup on behalf of the user.

## Trust boundary

The first-time USB debugging authorization prompt on a physical Android device still requires a human tap on the device.

Everything else in this guide is intended to be automatable by an agent once:

- the physical device has already authorized this host for `adb`
- or the emulator path is available and the Android SDK tools are installed

## Step 1 - Install Clawperator from the public website

Start from the public install command shown on `clawperator.com`:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The installer:

- installs the `clawperator` CLI
- downloads the latest stable [Clawperator Operator Android app](android-operator-apk.md) package
- runs `clawperator doctor`
- installs or upgrades the [Clawperator Operator Android app](android-operator-apk.md) when the Android device is present and ready
- runs `clawperator skills install`
- writes `CLAWPERATOR_SKILLS_REGISTRY` into the shell profile when skills install succeeds

Verify the CLI is available:

```bash
clawperator --version
```

## Step 2 - Choose the Android environment

Clawperator can run against either a physical Android device or a local Android emulator.

### Option A - Physical Android device

This is the preferred path for compatibility and long-running reliability.

Verify that a device is connected:

```bash
adb devices
clawperator devices
```

If the device appears as `unauthorized`, the first-time USB debugging prompt must be accepted by a human on the Android device before continuing.

### Option B - Android emulator

If no physical device is available, provision an emulator after the CLI is installed:

```bash
clawperator provision emulator --output json
```

This command reuses a running supported emulator, starts a stopped supported AVD, or creates a new Google Play emulator if none exist.

Capture the returned serial and use it as `--device-id` in later commands.

## Step 3 - Verify or install the Clawperator Operator Android app

The [Clawperator Operator Android app](android-operator-apk.md) must be installed on the Android device.

The installer usually handles this automatically. If needed, install it with the canonical command:

```bash
clawperator operator install --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>
```

If only one device is connected, `--device-id` can be omitted:

```bash
clawperator operator install --apk ~/.clawperator/downloads/operator.apk
```

For a local debug build of the [Clawperator Operator Android app](android-operator-apk.md):

```bash
clawperator operator install \
  --apk ~/.clawperator/downloads/operator-debug.apk \
  --receiver-package com.clawperator.operator.dev
```

This command is the normal path for agents and operators. It installs the APK and grants required permissions (accessibility, notification listener) in one step.

Do not split initial setup into separate `adb install` and `grant-device-permissions` calls. Reserve `clawperator grant-device-permissions` for recovery after the Operator APK crashes and Android revokes the previously granted permissions.

## Step 5 - Run doctor

Before OpenClaw relies on the runtime, verify the environment:

```bash
clawperator doctor --device-id <device_id> --output pretty
```

Expected checks include:

- `adb` healthy
- device connected and reachable
- [Clawperator Operator Android app](android-operator-apk.md) installed
- handshake successful

If doctor does not pass, stop and fix the environment before moving on.

## Step 6 - Verify skills installation

The installer should have run `clawperator skills install`, but agents should verify it.

Check the registry env var:

```bash
echo $CLAWPERATOR_SKILLS_REGISTRY
```

The expected path is:

```bash
~/.clawperator/skills/skills/skills-registry.json
```

If the env var is empty, set it explicitly:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

If skills were not installed, run:

```bash
clawperator skills install
```

Confirm that skills are visible:

```bash
clawperator skills list
```

## Step 7 - Run one safe verification skill

Before attempting a user-facing app skill, run a known-safe verification skill:

```bash
clawperator skills run com.android.settings.capture-overview --device-id <device_id>
```

If this succeeds, the end-to-end OpenClaw + Clawperator + Android path is working.

## Step 8 - Find the SolaX skill

The public skills bundle includes a SolaX battery skill:

- skill ID: `com.solaxcloud.starter.get-battery`
- Android app ID: `com.solaxcloud.starter`
- purpose: read current SolaX Cloud battery percentage

Agents should confirm that the skill is present:

```bash
clawperator skills search --app com.solaxcloud.starter
clawperator skills get com.solaxcloud.starter.get-battery
```

## Step 9 - Understand the preconditions for the SolaX run

For this first-run path, the user must already have:

- the SolaX Cloud Android app installed on the Android device
- the user signed into the SolaX app
- the app in a usable state for automation

That means the agent does **not** need SolaX cloud credentials. The agent still needs the Android runtime to be ready and the correct device selected.

If the user also wants Google Home or another app later, the same rule applies: the user owns the app install and login state, while Clawperator only operates the UI.

## Step 10 - Run the SolaX skill

Run the public SolaX battery skill:

```bash
clawperator skills run com.solaxcloud.starter.get-battery --device-id <device_id>
```

The expected success shape is a line like:

```text
✅ SolaX battery level: 61.0%
```

At this point the agent can answer the user directly with the current battery percentage.

## Exact first-run command sequence

For agents that need one deterministic sequence, the normal path is:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
clawperator --version
clawperator devices
clawperator operator install --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>
clawperator doctor --device-id <device_id> --output pretty
echo $CLAWPERATOR_SKILLS_REGISTRY
clawperator skills list
clawperator skills run com.android.settings.capture-overview --device-id <device_id>
clawperator skills search --app com.solaxcloud.starter
clawperator skills get com.solaxcloud.starter.get-battery
clawperator skills run com.solaxcloud.starter.get-battery --device-id <device_id>
```

If no physical device is present, insert this after install:

```bash
clawperator provision emulator --output json
```

Use the returned emulator serial as `<device_id>`.

## What agents should document during first run

When an agent is asked to "set this up for me", it should record:

- the exact install command used
- whether a physical Android device or emulator was chosen
- the selected device serial
- whether the [Clawperator Operator Android app](android-operator-apk.md) was installed automatically or manually
- whether `operator install` succeeded (or which phase failed)
- whether `doctor` passed
- whether skills installed cleanly
- the value of `CLAWPERATOR_SKILLS_REGISTRY`
- the exact skill command used
- the final returned battery percentage
- every ambiguity, manual step, or failure encountered

## Common failure points

### No Android device present

If `adb devices` shows no device:

- stop if the user expected a physical device and none is available
- otherwise use the emulator path with `clawperator provision emulator`

### Device unauthorized

If `adb devices` shows `unauthorized`, the Android device has not approved this host for USB debugging yet. A human must approve the prompt on the device before the agent can continue.

### Skills registry missing

If `clawperator skills list` fails or the registry env var is empty:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
clawperator skills install
```

### SolaX app not ready

If the SolaX skill fails because the app is logged out, showing onboarding, or blocked by an unexpected screen, that is not a Clawperator install problem. It means the Android device is not yet prepared by the user for that app workflow.

### Multiple devices connected

Always pass `--device-id <device_id>` if more than one device is visible. This is especially important after emulator provisioning, because both a physical device and an emulator may be connected at the same time.

## Summary

The first successful OpenClaw path is:

1. install Clawperator from `clawperator.com`
2. choose a physical Android device or provision an emulator
3. verify the [Clawperator Operator Android app](android-operator-apk.md) and permissions
4. confirm `doctor` passes
5. confirm skills are installed
6. run a safe verification skill
7. run `com.solaxcloud.starter.get-battery`
8. return the battery percentage to the user
