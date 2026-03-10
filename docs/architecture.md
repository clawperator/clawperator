# Clawperator Architecture

Clawperator is a two-layer system: an Android runtime that executes actions on the device, and a Node CLI/API that agents talk to.

## Layers

### Android Runtime (`apps/android`)

The Android app runs as a persistent background service on the dedicated actuator device. It uses the Android Accessibility API to:

- Inspect the live UI tree of any foreground application
- Perform precise interactions: taps, scrolls, text entry
- Listen for commands via a broadcast receiver (`ACTION_AGENT_COMMAND`)
- Emit structured results via logcat using the canonical `[Clawperator-Result]` envelope

The app ships in two variants:

- `com.clawperator.operator` - release APK, used by default
- `com.clawperator.operator.dev` - local debug APK, used when building from source

### Node CLI/API (`apps/node`)

The Node package is the agent-facing interface. It:

- Wraps all `adb` interactions so agents do not need to issue raw shell commands
- Owns Android emulator discovery, creation, lifecycle, and provisioning
- Validates execution payloads before dispatch
- Broadcasts commands to the Android receiver via `adb shell am broadcast`
- Reads and parses the `[Clawperator-Result]` envelope from logcat
- Exposes an HTTP/SSE server (`clawperator serve`) for remote agent access
- Provides `clawperator doctor` for environment diagnostics

Android emulator support is intentionally implemented in the Node layer. `install.sh` remains a bootstrap script and does not manage emulator lifecycle.

## Data Flow

```
Agent
  |
  | CLI invocation or HTTP POST
  v
Node CLI/API (apps/node)
  |
  | adb shell am broadcast ACTION_AGENT_COMMAND
  v
Android Receiver (apps/android)
  |
  | Accessibility API actions
  v
Device UI
  |
  | [Clawperator-Result] envelope via logcat
  v
Node CLI/API
  |
  | Structured result
  v
Agent
```

## Emulator Provisioning Flow

When the agent needs an emulator instead of a physical device, the Node layer follows a deterministic reuse-first flow:

1. Inspect running emulators from `adb devices`.
2. Resolve running emulator names with `adb -s <serial> emu avd name`.
3. Reuse a running supported emulator if one exists.
4. Otherwise inspect configured AVDs from `~/.android/avd/`.
5. Start a stopped supported AVD if one exists.
6. Otherwise install the default system image and create a new AVD.
7. Start the emulator detached with `-no-snapshot-load -no-boot-anim`.
8. Wait for adb registration and Android boot completion.

The default supported profile is Android API `35`, Google Play, ABI `arm64-v8a`, device profile `pixel_7`, and AVD name `clawperator-pixel`.

## Android Build Modules

```
apps/android/
  app/              - Operator APK (com.clawperator.operator)
  app-conformance/  - Conformance test APK for execution layer testing
  shared/           - Shared Android modules (action engine, contracts, etc.)
```

## Conformance APK

`apps/android/app-conformance` is a dedicated test app with a deterministic, stable UI. It exists to test Clawperator's execution layer without relying on third-party apps. See [Conformance Test APK](conformance-apk.md).

## Website Surfaces

Two separate public sites are maintained in this repository:

- `sites/landing/` - Next.js static site for `https://clawperator.com` (marketing, installer)
- `sites/docs/` - MkDocs site for `https://docs.clawperator.com` (technical docs)

Both deploy automatically to Cloudflare when changes merge to `main`.

## Skills

Skills are packaged app-specific automation recipes maintained in a sibling repository (`../clawperator-skills`). The Node CLI provides discovery, metadata lookup, and a convenience run wrapper. Skills are standalone and can also be invoked directly without the Node CLI.

## Key Design Constraints

- **Deterministic execution:** one broadcast in, one `[Clawperator-Result]` envelope out
- **Single-flight lock:** only one execution per device at a time
- **No autonomous planning in the runtime:** Clawperator executes commands; reasoning stays in the agent
- **No direct adb required for agents:** all routine automation goes through the Node CLI/API
