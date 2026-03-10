# Running Clawperator on Android

## 1. The Actuator Device

Clawperator operates a dedicated Android environment. This environment may be:
- a physical phone
- an Android emulator

### The Model

```text
Agent (Brain)
    |
Clawperator Node Runtime
    |
Android Device (Physical or Emulator)
```

**Key principle:**
Clawperator operates the device. It does not configure the user’s accounts.

## 2. User Responsibilities

**Very important clarification:**

Users must:
- install apps
- sign into apps
- configure apps
- ensure apps are ready for automation

Clawperator will not:
- sign into accounts
- create accounts
- configure apps
- bypass authentication

*Clawperator assumes the Android device is already configured with the user’s apps and logins. It simply operates the device’s UI on behalf of the user.*

## 3. Choosing an Android Environment

You have two options for the actuator environment.

### Option A — Physical Device (recommended)

- Highest reliability
- Best compatibility
- Lowest friction

**Use cases:**
- production automation
- home automation
- long-running agents

### Option B — Android Emulator

- Useful for testing
- Useful when no physical device is available
- **Note:** some apps may detect the emulator, and some apps may refuse login.

Clawperator does not guarantee emulator compatibility for third-party apps.

## 4. Emulator Provisioning

```bash
clawperator provision emulator
```

What happens during provisioning:
1. Node runtime checks for a running supported emulator and reuses it if found.
2. If none is running, it starts a stopped supported AVD if one exists.
3. Otherwise, it creates a new AVD with the default profile (and installs the system image if needed).

**The default emulator profile:**
- API level: 35
- Device: Pixel 7
- ABI: arm64-v8a
- System image: Google Play

**Reminder:** Even with an emulator, users still need to:
- log into a Google account (if using Play Store)
- install apps
- log into apps

## 5. Installing the Operator APK

```bash
adb install operator.apk
```

This works exactly the same for:
- a physical device
- an emulator

## 6. Granting Permissions

```bash
clawperator grant-device-permissions
```

Clawperator uses Android's Accessibility API to observe and interact with UI elements. This command enables the accessibility service requirement from the host machine without needing to touch the device screen.

## 7. Verifying Setup

```bash
clawperator doctor
```

This command runs readiness checks to ensure the Android device is properly configured, the APK is installed, and permissions are granted. All checks must pass before the device can be used for automation.
