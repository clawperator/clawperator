# Clawperator Terminology

This page defines the canonical terms used across Clawperator documentation. Prefer these terms when writing or updating docs so agents can rely on stable meanings.

## Android device

The Android environment that Clawperator operates on behalf of a user.

An Android device can be:

- a physical Android device connected over `adb`
- a local Android emulator provisioned through the Node CLI or HTTP API

When a doc says "Android device", it does not imply physical hardware only.

## Physical Android device

A real Android phone or tablet connected to the host, usually over USB with `adb` enabled.

This is the recommended actuator environment for production automation because it has the best app compatibility and the least divergence from normal user behavior.

## Android emulator

A local Android Virtual Device provisioned and managed by the Node CLI or HTTP API.

Use this term for the emulator environment itself, not for the Android apps running inside it.

## Actuator device

The Android device that Clawperator operates.

This is a conceptual term for the execution environment. In practice it means the same runtime target as "Android device".

## Clawperator Operator Android app

Clawperator's own Android app, documented in [Clawperator Operator Android app](android-operator-apk.md).

This is the app installed on the Android device so Clawperator can receive commands, observe the UI through Android Accessibility, and execute actions.

Important: this is not the same thing as the Android apps the user wants Clawperator to operate.

## User-installed Android apps

The Android apps the user wants Clawperator to operate, such as Settings, shopping apps, banking apps, ride-share apps, or social apps.

These apps are the user's responsibility to:

- install
- sign into
- configure
- keep ready for automation

Avoid vague phrases like "target app" when "user-installed Android app" is more precise.

## Node runtime

The Clawperator Node CLI and HTTP API running on the host machine.

This layer validates commands, talks to `adb`, manages emulator lifecycle, dispatches executions, and reads result envelopes from the Android device.

## Agent

The external LLM-driven system that reasons about what to do next and calls the Clawperator Node runtime.

In the Clawperator ecosystem, this usually means OpenClaw or another OpenClaw-like agent that uses Clawperator as its execution hand.

Clawperator is the execution hand. The agent is the planning brain.

## Receiver package

The Android application ID of the installed [Clawperator Operator Android app](android-operator-apk.md) variant that the Node runtime should talk to.

Current package IDs:

- `com.clawperator.operator` for the release build
- `com.clawperator.operator.dev` for the local debug build

## Execution

A validated command payload sent from the Node runtime to the [Clawperator Operator Android app](android-operator-apk.md).

An execution contains one or more actions and produces exactly one canonical `[Clawperator-Result]` envelope.

## Skill

A packaged automation recipe distributed through the skills bundle or sibling skills repository.

Skills are not the same thing as the core Clawperator runtime. They sit above it and use the runtime to operate user-installed Android apps.
