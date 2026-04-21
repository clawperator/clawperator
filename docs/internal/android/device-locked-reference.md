# Android Device Locked And Screen State Reference

## Purpose

Capture the Android platform distinctions and Clawperator-specific findings
around:

- screen on vs screen off
- interactive vs asleep
- keyguard showing vs device actually locked
- host-side wake behavior

This page exists so future agents do not have to rediscover these semantics
when working on doctor, readiness checks, operator diagnostics, or skill
preflight behavior.

## Key Platform Distinctions

These states are related, but they are not interchangeable.

### `screen on` / `interactive`

For Clawperator's purposes, the most useful "is the device awake enough to
interact?" signal is `PowerManager.isInteractive()`.

In this repo, that is wrapped by:

- [`PowerManagerSystem.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/power/PowerManagerSystem.kt)
- [`DeviceStateSystem.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt)

Relevant API:

- `queryScreenOn()`
- `isScreenOn`

Practical meaning:

- `true` means the device is awake / interactive
- `false` means the device is asleep or dozing and must be woken before UI
  automation can proceed

### `keyguard showing`

Android `KeyguardManager.isKeyguardLocked()` answers whether the keyguard is
showing.

Important nuance:

- this is not the same as "the device requires authentication"
- keyguard may be showing even when the screen is trivially dismissible
- screen-off transitions can make the keyguard "showing" even on devices
  without a meaningful secure lock screen

### `device locked`

Android `KeyguardManager.isDeviceLocked()` is the better signal for "is the
device actually locked for this user right now?"

In this repo, that is wrapped by:

- [`KeyguardManagerSystem.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/keyguard/KeyguardManagerSystem.kt)
- [`DeviceStateSystem.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt)

Relevant API:

- `queryDeviceLocked`
- `isDeviceLocked`

### `user unlocked after boot`

`UserManagerCompat.isUserUnlocked(context)` answers whether the Android user
has completed the post-boot unlock.

This matters because a device can be awake while still not fully available for
normal app/storage behavior after boot.

In this repo, that is exposed as:

- `isUserUnlocked`

## Current Clawperator Android State Model

The current operator app already has the primitives needed to model readiness:

- `queryScreenOn()` via `PowerManager.isInteractive()`
- `queryDeviceLocked` via `KeyguardManager.isDeviceLocked()`
- `isUserUnlocked`

Primary code path:

- [`DeviceStateSystem.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt)

It also listens for:

- `Intent.ACTION_SCREEN_ON`
- `Intent.ACTION_SCREEN_OFF`
- `Intent.ACTION_USER_PRESENT`

## Important Repo-Specific Caveat

[`DeviceStateSystem.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt)
currently sets:

```kotlin
Intent.ACTION_SCREEN_OFF -> {
    isScreenOn.value = false
    isDeviceLocked.value = true
}
```

This is an overreach.

`ACTION_SCREEN_OFF` does not prove that the device is actually locked. It only
proves that the screen turned off.

Consequences:

- the evented `isDeviceLocked` flow can temporarily report a false locked state
- this is especially relevant on devices with no secure lock screen configured
- a plain screen-off event can be misdiagnosed as "device on lock screen"

Safer interpretation:

- `queryDeviceLocked` is the trustworthy immediate source of truth for actual
  device lock state
- `queryScreenOn()` / `isScreenOn` is the trustworthy source of truth for wake
  / interactivity state
- these should be reported separately in readiness / diagnostics surfaces

## Host-Side Wake Research

On 2026-04-21, live-device probing against the connected Samsung device
confirmed that host-side wake is feasible and deterministic enough to use as a
recovery primitive.

Validated commands:

1. `adb shell cmd power sleep`
2. `adb shell cmd power wakeup`
3. `adb shell input keyevent KEYCODE_WAKEUP`
4. `adb shell input keyevent KEYCODE_HOME`

Observed behavior:

- `cmd power sleep` moved the device to `Asleep` / `SCREEN_STATE_OFF` /
  `INTERACTIVE_STATE_SLEEP`
- `cmd power wakeup` returned the device to `Awake` / `SCREEN_STATE_ON` /
  `INTERACTIVE_STATE_AWAKE`
- `KEYCODE_WAKEUP` also woke the device successfully
- `KEYCODE_HOME` also woke the device successfully on this Samsung device

Host-side validation commands used:

```bash
adb shell dumpsys power | rg "mWakefulness="
adb shell dumpsys window policy | rg "showing=|screenState=|interactiveState="
```

## Wake Primitive Ranking

Based on the live-device probe, prefer host-side wake in this order:

1. `adb shell cmd power wakeup`
2. `adb shell input keyevent KEYCODE_WAKEUP`
3. `adb shell input keyevent KEYCODE_HOME`

Reasoning:

- `cmd power wakeup` is the most semantically direct
- `KEYCODE_WAKEUP` is also direct and worked on the probed Samsung
- `KEYCODE_HOME` worked, but it is less clearly a wake-only operation across
  OEMs and Android versions

Avoid using `KEYCODE_POWER` as the primary recovery primitive because it is a
toggle and therefore less deterministic.

## Accessibility Wake Notes

The current operator app has accessibility global-action support, but that is
not the same thing as having a clean public "wake screen" action.

Current supported accessibility system actions in this repo:

- notification panel
- quick settings
- recents
- lock screen

Relevant code:

- [`SystemAccessibilityActionType.kt`](../../../apps/android/shared/core/common/src/main/kotlin/action/system/accessibility/SystemAccessibilityActionType.kt)
- [`SystemAccessibilityActionTypeExt.kt`](../../../apps/android/shared/app/app-adapter/src/main/kotlin/clawperator/system/accessibility/SystemAccessibilityActionTypeExt.kt)

There is no current wake-screen accessibility action in the operator app.

Even though a host-injected `HOME` key woke the Samsung device during probing,
that should not be conflated with a documented operator-side accessibility wake
primitive.

## Guidance For Future Readiness Work

For readiness and doctor-style surfaces, keep these outputs separate:

- `screenOn`
- `interactive`
- `deviceLocked`
- `userUnlocked`

Do not collapse `screenOff` into `deviceLocked`.

If automatic recovery is attempted, the likely best model is:

1. detect `screenOn=false` / `interactive=false`
2. attempt host-side wake
3. re-check `screenOn` / `interactive`
4. separately report actual `deviceLocked` state

That keeps the readiness contract honest:

- sleeping device
- awake but locked device
- awake and unlocked device

These are different states and should remain distinguishable in diagnostics.

## References

- [PowerManager](https://developer.android.com/reference/android/os/PowerManager.html)
- [KeyguardManager](https://developer.android.com/reference/android/app/KeyguardManager)
- [AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [Manifest.permission.TURN_SCREEN_ON](https://developer.android.com/reference/android/Manifest.permission)
