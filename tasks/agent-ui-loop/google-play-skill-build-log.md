# Google Play Skill Build Log

This is a lab notebook. Raw, chronological, honest.

## Setup

**Date:** 2026-03-11
**Device:** `<device_serial>` (physical Android device, user logged in)
**CLI version:** 0.2.1
**APK version:** 0.2.1
**Compatible:** true

**Goal for this session:** Perform zero-shot exploratory UI automation against the
Google Play Store to build two skills from scratch:
1. `com.android.vending.search-app` - find an app in the Play Store
2. `com.android.vending.install-app` - install an app from its details page

**Approach:** Single action, then re-observe. No assumptions about UI layout.
Live UI hierarchy is the source of truth.

---

## Step 1: Initial device snapshot

**Why:** Before opening the Play Store, I want to see what is currently on screen.
This tells me the initial state and whether any existing app is in the foreground.

**Action:** `clawperator observe snapshot --device-id <device_serial>`

<!-- SNAPSHOT_1 will be appended after execution -->

---

## Step 2: Attempt known-package direct-entry path

**Hypothesis:** The Play Store package ID is `com.android.vending`. The known-package
path to a specific app's detail page is via an Android deep link / intent:
`market://details?id=<package>` or via `adb shell am start` with that URI.

**Question to resolve:** Does the Clawperator `open_app` action support deep links,
or only `applicationId`-based app launches? If it only supports `applicationId`, I
need to use `adb` directly or another mechanism.

**First attempt:** Try `open_app` with `applicationId: "com.android.vending"` to
confirm the Play Store opens. Then separately investigate whether a deep link entry
is available through the current API.

<!-- ATTEMPT_1 will be appended after execution -->

---

## Step 3: In-app search path

<!-- Will be filled in as exploration progresses -->

---
