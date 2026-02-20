Clawperator app-conformance
==========================

Purpose:
This is a standalone Android application designed specifically for automated testing and conformance verification of the Clawperator execution layer.

Why this project exists:
Clawperator acts as an "actuator" (the Hand) that controls other Android applications. To verify that core primitives like clicking, scrolling, reading text, and entering text are working correctly and deterministically, we need a stable target application that we control.

Testing against third-party apps (like retail or utility apps) is brittle because their UI can change at any time, causing tests to fail for reasons unrelated to the Clawperator runtime itself.

app-conformance provides:
- A stable, predictable Jetpack Compose UI.
- Fixed resource IDs and testTags for all key interactive elements.
- Predictable state transitions (Home -> List -> Detail).
- A long scrollable list (200 rows) to verify scrolling mechanics.

Usage:
This APK is installed on a target device during CI/CD or manual verification runs. Agents then dispatch commands to Clawperator to interact with this app, ensuring the runtime accurately executes actions and parses results in a controlled environment.

Build:
./gradlew :apps:android:app-conformance:assembleDebug

Package: clawperator.conformance
Application ID: com.clawperator.conformance
