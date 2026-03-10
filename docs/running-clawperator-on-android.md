# Running Clawperator on Android

Clawperator operates an Android device on behalf of a user. In these docs, "Android device" means either:

- a physical Android phone connected over `adb`
- a local Android emulator provisioned through the Node CLI

This is the canonical actuator model for Clawperator. The Node runtime talks to an Android device, and the Android device runs the [Clawperator Operator Android app](android-operator-apk.md).

## Terminology

- **Android device**: the actuator environment. This can be a physical Android device or a local Android emulator.
- **[Clawperator Operator Android app](android-operator-apk.md)**: Clawperator's own Android app. It receives commands from the Node runtime and executes them through Android Accessibility.
- **User-installed Android apps**: the apps the user wants Clawperator to operate, such as Settings, shopping apps, banking apps, or social apps. These apps are the user's responsibility to install and sign into.

## The actuator model

```text
Agent (Brain)
    |
Clawperator Node Runtime
    |
Android Device (physical or emulator)
```

Clawperator operates the device UI. It does not own account setup, app configuration, or user credentials.

## User responsibilities

Before automation starts, the user is responsible for preparing the Android device. That includes:

- installing the apps the automation will target
- signing into Google, Play Store, and any app-specific accounts
- completing first-run flows, prompts, and app configuration
- ensuring the user-installed Android apps are in a usable state for automation

Clawperator does not:

- create accounts
- sign into accounts
- configure apps on the user's behalf
- bypass authentication or anti-abuse gates

Agents should assume the device already contains the required apps, logins, and configuration.

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

The [Clawperator Operator Android app](android-operator-apk.md) installs the same way on both environments:

```bash
adb install -r ~/.clawperator/downloads/operator.apk
```

If multiple devices are connected, target one explicitly:

```bash
adb -s <device_id> install -r ~/.clawperator/downloads/operator.apk
```

## Granting permissions

Clawperator uses Android Accessibility to observe and operate the UI. After the [Clawperator Operator Android app](android-operator-apk.md) is installed, enable the required permissions from the host:

```bash
clawperator grant-device-permissions
```

This works for both physical devices and emulators. If multiple devices are connected, pass `--device-id <id>`.

## Verifying setup

Use `doctor` to confirm the Android device is ready:

```bash
clawperator doctor
```

`doctor` verifies that the device is reachable, the [Clawperator Operator Android app](android-operator-apk.md) is installed, and the runtime handshake is working. All critical checks must pass before automation starts.
