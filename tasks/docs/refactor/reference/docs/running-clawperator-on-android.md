# Running Clawperator on Android

Clawperator operates an Android device on behalf of a user. In these docs, "Android device" means either:

- a physical Android phone connected over `adb`
- a local Android emulator provisioned through the Node CLI

This is Clawperator's current actuator model. The Node runtime talks to an
Android device, and the Android device runs the
[Clawperator Operator Android app](android-operator-apk.md).

Canonical definitions for terms such as "Android device", "[Clawperator Operator Android app](android-operator-apk.md)", and "user-installed Android apps" live in [Clawperator Terminology](terminology.md).

## The actuator model

```text
Agent (Brain)
    |
Clawperator Node Runtime
    |
Android Device (physical or emulator)
```

Clawperator operates the device UI. It does not own planning or policy
decisions about what should be entered. Those belong to the external agent and
the user workflow it is carrying out.

## User responsibilities

Before automation starts, the user is responsible for preparing the Android device. That includes:

- installing the apps the automation will target
- signing into Google, Play Store, and any app-specific accounts
- completing first-run flows, prompts, and app configuration
- ensuring the user-installed Android apps are in a usable state for automation

Clawperator does not:

- create accounts
- decide what credentials or other user-provided inputs are appropriate to use
- bypass authentication or anti-abuse gates

Agents should assume the device already contains the required apps and
configuration, unless the intended workflow explicitly includes entering those
details through the normal UI.

## Choosing an Android environment

Clawperator supports two actuator environments.

### Option A - Physical Android device

This is the recommended path for production use.

- best app compatibility
- least divergence from a normal user device
- lowest risk of emulator detection
- strong fit for persistent or long-running automation

Use a physical device when reliability matters more than convenience.

### Option B - Android emulator

This is primarily for development, testing, and situations where no physical device is available.

- no dedicated hardware required
- quick to reprovision
- useful for local validation and agent development

Some apps detect emulator environments or refuse login on them. Clawperator does not guarantee third-party app compatibility on emulators.

## Emulator provisioning

Provisioning is owned by the Node CLI and API, not by `install.sh`.

```bash
clawperator provision emulator
```

Provisioning is deterministic and reuse-first:

1. Reuse a running supported emulator.
2. Start a stopped supported AVD.
3. Create a new supported AVD if none exist.

The default supported emulator profile is:

- Android API level `35`
- device profile `pixel_7`
- ABI `arm64-v8a`
- Google Play system image
- default AVD name `clawperator-pixel`

Even on an emulator, the user still needs to:

- sign in to a Google account if Play Store access is needed
- install the user-installed Android apps
- sign in to those apps
- complete any first-run configuration

## Installing the Clawperator Operator Android app

Use the canonical install command to install the [Clawperator Operator Android app](android-operator-apk.md) and grant required permissions in one step:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk
```

If multiple devices are connected, target one explicitly:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device <device_id>
```

This command installs the APK, grants the accessibility service and notification listener permissions, and verifies the package is ready.

> Do not use raw `adb install` for normal setup. It installs the APK but leaves the device in an unusable state without required permissions.

If the Operator APK crashes after initial setup and Android revokes its permissions, run the remediation command:

```bash
clawperator grant-device-permissions
```

Do not use this as part of normal setup. The normal setup path is always `clawperator operator setup` (`clawperator operator install` remains an alias).

## Verifying setup

Use `doctor` to confirm the Android device is ready:

```bash
clawperator doctor
```

`doctor` verifies that the device is reachable, the [Clawperator Operator Android app](android-operator-apk.md) is installed, and the runtime handshake is working. All critical checks must pass before automation starts.
