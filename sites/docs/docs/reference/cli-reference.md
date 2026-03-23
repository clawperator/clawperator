# CLI Reference

```
clawperator <command> [options]
```

---

## Global Options

These flags are parsed globally. Command support varies by path.

| Flag | Description |
|------|-------------|
| `--device <id>` | Target Android device serial (canonical; `--device-id` is accepted) |
| `--operator-package <package>` | Target Operator package for broadcast dispatch |
| `--json` | Output as JSON (canonical; `--output json` is accepted) |
| `--output <json\|pretty>` | Output format (default: `json`) |
| `--timeout <ms>` | Override execution timeout (canonical; `--timeout-ms` is accepted) |
| `--log-level <debug\|info\|warn\|error>` | Persistent log level (default: `info`) |
| `--verbose` | Include debug diagnostics in output |
| `--help` | Show help |
| `--version` | Show version |

Default receiver package: `com.clawperator.operator`. Use `--operator-package com.clawperator.operator.dev` for local debug APKs.

---

## Commands

### `operator setup`

Install the Clawperator Operator APK and grant required device permissions in one step.

```
clawperator operator setup --apk <path> [--device <id>] [--operator-package <package>] [--output <json|pretty>]
```

| Flag | Description |
|------|-------------|
| `--apk <path>` | Local path to the Operator APK file (required) |
| `--device <id>` | Target Android device serial (required when multiple devices are connected) |
| `--operator-package <package>` | Operator package identifier (required when both release and debug variants are installed) |

This is the canonical setup command. `clawperator operator install` remains a compatibility alias. It runs three phases in sequence:

1. **Install**: Copies the APK onto the device via `adb install -r`.
2. **Permissions**: Grants the accessibility service, notification posting, and notification listener permissions.
3. **Verification**: Confirms the package is visible via `pm list packages`.

If `--operator-package` is omitted, setup auto-detects the package only when exactly one known Operator variant is installed. If both release and debug variants are installed, pass `--operator-package` explicitly.

If any phase fails, the command exits with a structured JSON error identifying which phase failed. Error codes:

| Code | Phase | Meaning |
|------|-------|---------|
| `OPERATOR_APK_NOT_FOUND` | pre-install | APK path does not exist on disk |
| `OPERATOR_INSTALL_FAILED` | install | `adb install` returned a non-zero exit code |
| `OPERATOR_GRANT_FAILED` | permissions | One or more permission grants failed |
| `OPERATOR_VERIFY_FAILED` | verification | Package not found after install |

Do not use raw `adb install` for normal setup. It installs the APK without granting permissions, leaving the device in an unusable state.

For debug builds, pass `--operator-package com.clawperator.operator.dev`.

---

### `emulator list`

List configured Android Virtual Devices and their compatibility metadata.

```
clawperator emulator list [--output <json|pretty>]
```

---

### `emulator inspect`

Show the normalized metadata for one Android Virtual Device.

```
clawperator emulator inspect <name> [--output <json|pretty>]
```

This is the diagnostic command for understanding whether an AVD is supported and why.

---

### `emulator create`

Create the default supported Google Play Android Virtual Device.

```
clawperator emulator create [--name <name>] [--output <json|pretty>]
```

Defaults:

- Android API `35`
- Google Play image
- ABI `arm64-v8a`
- device profile `pixel_7`
- AVD name `clawperator-pixel`

---

### `emulator start`

Start an existing Android Virtual Device and wait for Android boot completion.

```
clawperator emulator start <name> [--output <json|pretty>]
```

---

### `emulator stop`

Stop a running Android emulator by AVD name.

```
clawperator emulator stop <name> [--output <json|pretty>]
```

---

### `emulator delete`

Delete an Android Virtual Device by name.

```
clawperator emulator delete <name> [--output <json|pretty>]
```

---

### `emulator status`

List running Android emulators and boot state.

```
clawperator emulator status [--output <json|pretty>]
```

---

### `emulator provision`

Reuse or create a supported Android emulator and return a booted ADB target.

```
clawperator emulator provision [--output <json|pretty>]
clawperator provision emulator [--output <json|pretty>]
```

Provisioning prefers:

1. a running supported emulator
2. a stopped supported AVD
3. creation of a new supported AVD

---

### `devices`

List connected Android devices.

```
clawperator devices
```

**Output:** JSON array of `{ serial, state }` objects.

---

### `packages list`

List installed package IDs on a device.

```
clawperator packages list [--device <id>] [--third-party]
```

| Flag | Description |
|------|-------------|
| `--device <id>` | Target device serial |
| `--third-party` | Limit to third-party packages only |

---

### `exec`

Execute a validated command payload. The CLI also accepts `execute` as a synonym.

```
clawperator exec --execution <json-or-file> [--validate-only] [--dry-run] [--device <id>] [--operator-package <package>] [--timeout <ms>]
```

| Flag | Description |
|------|-------------|
| `--execution <json-or-file>` | Execution payload as inline JSON or a path to a JSON file (required) |
| `--validate-only` | Validate and normalize the payload without dispatching to any device |
| `--dry-run` | Print the execution plan without dispatching to any device |
| `--device <id>` | Target device serial |
| `--operator-package <package>` | Target Operator package |
| `--timeout <ms>` | Override execution timeout within policy limits |

The `--execution` value must conform to the `Execution` contract (see [api-overview.md](./api-overview.md)).

With `--validate-only`, Clawperator validates the payload, applies any
`--timeout` override, and returns the normalized execution without touching
adb or resolving a device.

---

### `snapshot`

Capture the current UI snapshot from the device.

```
clawperator snapshot [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
```

Returns the current Android UI hierarchy as XML. Output includes the `[Clawperator-Result]` envelope with `stepResults[0].actionType = "snapshot_ui"` and `stepResults[0].data.text` containing the XML.

---

### `screenshot`

Capture the current device screen as a PNG.

```
clawperator screenshot [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--path <file>] [--json]
```

| Flag | Description |
|------|-------------|
| `--path <file>` | Save PNG to the specified path; if omitted, image is base64-encoded in the output |

---

### `open`

Open an app, URL, or URI on the device.

```
clawperator open <package-id|url|uri> [--device <id>] [--json]
```

| Flag / Arg | Description |
|------------|-------------|
| `<package-id\|url\|uri>` | Target to open (positional, required) |
| `--app <package>` | Explicitly open as Android app package (override for ambiguous cases) |

Target detection: `https?://` or any `*://` scheme routes as URI; otherwise treated as a package name.

---

### `click`

Tap a UI element matching a selector.

```
clawperator click --selector '<json>' [--device <id>] [--operator-package <pkg>] [--json]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |

Example selector: `'{"resourceId":"com.example.app:id/button_ok"}'`

Synonym: `tap` (accepted, not in help).

---

### `type`

Type text into a UI element matching a selector.

```
clawperator type <text> --selector '<json>' [--device <id>] [--operator-package <pkg>] [--submit] [--clear] [--json]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |
| `--submit` | Press Enter after typing |
| `--clear` | No effect on the device today: the Operator runtime still does not clear the field before typing. Node accepts the flag (same long-standing behavior as the `clear` field on `enter_text` in JSON). |

Text may be supplied as a positional argument or via `--text <text>`. Synonym: `fill` (accepted, not in help).

---

### `read`

Read text from a UI element matching a selector.

```
clawperator read --selector '<json>' [--device <id>] [--operator-package <pkg>] [--json]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |

---

### `wait`

Wait until a UI element matching a selector appears.

```
clawperator wait --selector '<json>' [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |

---

### `press`

Press a hardware key on the device.

```
clawperator press <key> [--device <id>] [--operator-package <pkg>] [--json]
```

| Key | Description |
|-----|-------------|
| `back` | Navigate to previous screen |
| `home` | Return to home screen |
| `recents` | Open recent apps |

Key may be supplied as a positional argument or via `--key <key>`. Synonym: `press-key` (accepted, not in help).

---

### `back`

Press the Android back key.

```
clawperator back [--device <id>] [--operator-package <pkg>] [--json]
```

Equivalent to `clawperator press back`.

---

### `scroll`

Scroll the screen in a direction.

```
clawperator scroll <direction> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
```

Valid directions: `down`, `up`, `left`, `right`. Direction may be supplied as a positional argument or via `--direction <direction>`.

---

### `recording start`

Start an on-device recording session through the Operator app. `record` is a supported alias.

```
clawperator recording start [--session-id <id>] [--device <serial>] [--operator-package <pkg>]
```

Use `--session-id` to choose the recording name. If omitted, the Operator app
generates one. This command dispatches the `start_recording` action through
the normal execution pipeline.

---

### `recording stop`

Stop the active recording session and finalize the on-device NDJSON file. `record` is a supported alias.

```
clawperator recording stop [--session-id <id>] [--device <serial>] [--operator-package <pkg>]
```

Use the same `--session-id` you started with if you want to target a specific
recording.

---

### `recording pull`

Pull a recording from device storage to the host. `record` is a supported alias.

```
clawperator recording pull [--session-id <id>] [--out <dir>] [--device <serial>]
```

If `--session-id` is omitted, Clawperator reads the device-side `latest`
pointer first and pulls that recording. Output defaults to `./recordings/`.

---

### `recording parse`

Parse a raw NDJSON recording into a step log JSON file. `record` is a supported alias.

```
clawperator recording parse --input <file> [--out <file>]
```

If `--out` is omitted, Clawperator writes `<input>.steps.json` when the input
ends in `.ndjson`, otherwise it appends `.steps.json`. This command does not
touch the device; it only parses a local file.

---

### `skills list`

List available skills from the local index/cache.

```
clawperator skills list
```

---

### `skills get <skill_id>`

Show metadata for a specific skill.

```
clawperator skills get <skill_id>
```

---

### `skills compile-artifact`

Compile a skill artifact with optional variable substitution.

```
clawperator skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
clawperator skills compile-artifact --skill-id <id> --artifact <name> [--vars <json>]
```

| Flag / Arg | Description |
|------------|-------------|
| `<skill_id>` | Skill ID (positional) |
| `--skill-id <id>` | Skill ID (named flag, alternative to positional) |
| `--artifact <name>` | Artifact name, e.g. `climate-status` or `climate-status.recipe.json` (required) |
| `--vars <json>` | Variable substitution JSON object (default: `{}`) |

---

### `skills new`

Scaffold a new local skill folder and registry entry.

```
clawperator skills new <skill_id> [--summary <text>] [--output <json|pretty>]
```

| Flag / Arg | Description |
|------------|-------------|
| `<skill_id>` | Skill ID to create (required) |
| `--summary <text>` | Override the default TODO summary written to `skill.json` and `SKILL.md` |

Derives `applicationId` and `intent` by splitting `<skill_id>` on the final dot. Creates `SKILL.md`, `skill.json`, `scripts/run.js`, and `scripts/run.sh`. Updates the configured registry JSON so the new skill appears in `skills list`.

---

### `skills validate`

Validate one local skill or the entire configured registry.

```
clawperator skills validate <skill_id> [--output <json|pretty>]
clawperator skills validate --all [--output <json|pretty>]
```

| Flag / Arg | Description |
|------------|-------------|
| `<skill_id>` | Skill ID to validate |
| `--all` | Validate every registry entry in one pass |

Verifies that the registry entry exists, checks that `skill.json`, `SKILL.md`, script files, and artifact files exist on disk, and confirms that the parsed `skill.json` metadata matches the registry entry. This is an integrity check, not a live device test.

---

### `skills search`

Search skills by target application, intent, or keyword.

```
clawperator skills search [--app <package_id>] [--intent <intent>] [--keyword <text>]
clawperator skills search <keyword>
```

| Flag | Description |
|------|-------------|
| `--app <package_id>` | Filter by Android application ID |
| `--intent <intent>` | Filter by skill intent |
| `--keyword <text>` | Search skill ID and summary text |

The bare `<keyword>` positional form is shorthand for `--keyword`. At least one filter is required.

---

### `skills run`

Invoke a skill's primary script as a convenience wrapper.

```
clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [--output <json|pretty>] [-- <extra_args>]
```

| Flag / Arg | Description |
|------------|-------------|
| `<skill_id>` | Skill ID (required) |
| `--device <id>` | Device serial passed as first script arg |
| `--operator-package <pkg>` | Operator package for this run (default: `com.clawperator.operator`) |
| `--json` | Canonical JSON output shorthand (same as global options; `--output json` accepted) |
| `--output` | Output format: `json` or `pretty` (`--format` accepted as alias) |
| `--timeout <ms>` | Override the wrapper timeout for this run only (`--timeout-ms` accepted as alias) |
| `--expect-contains <text>` | Lightweight output assertion; fails with `SKILL_OUTPUT_ASSERTION_FAILED` if text is missing |
| `--skip-validate` | Bypass the pre-run dry-run validation gate (for CI or development escape hatches only) |
| `-- <extra_args>` | Additional arguments forwarded to the underlying skill script unchanged |

Skills are standalone programs. This command is a convenience - agents can also invoke skill scripts directly.

---

### `skills install`

Clone the skills repository to `~/.clawperator/skills/`.

```
clawperator skills install
```

Prints the `CLAWPERATOR_SKILLS_REGISTRY` env var export instruction on success.

---

### `skills update`

Pull latest skills from the repository.

```
clawperator skills update [--ref <git-ref>]
```

| Flag | Description |
|------|-------------|
| `--ref <git-ref>` | Pin to a specific git ref (default: `main`) |

---

### `skills sync`

Sync and pin the skills index/cache to a specific git ref.

```
clawperator skills sync --ref <git-ref>
```

| Flag | Description |
|------|-------------|
| `--ref <git-ref>` | Git ref to pin to (required) |

---

### `grant-device-permissions`

Re-grant accessibility and notification permissions only after an Operator APK crash causes Android to revoke them.

```
clawperator grant-device-permissions [--device <id>] [--operator-package <package>] [--output <json\|pretty>]
```

This command is for **crash recovery only**. Use it after a previously working Operator APK crashes and Android revokes the accessibility or notification permissions. For initial setup, always use `clawperator operator setup` instead.

Use the release package by default. Pass `--operator-package com.clawperator.operator.dev` for local debug builds.

---

### `serve`

Start a local HTTP/SSE server for remote control.

```
clawperator serve [--port <number>] [--host <string>]
```

| Flag | Description |
|------|-------------|
| `--port <number>` | Port to listen on (default: `3000`) |
| `--host <string>` | Host to bind (default: `127.0.0.1`) |

HTTP endpoints exposed:
- `GET /devices` - list connected devices
- `POST /execute` - run an execution payload
- `POST /snapshot` - capture UI snapshot
- `POST /screenshot` - capture screenshot
- `GET /skills` - list or search skills
- `GET /skills/:skillId` - get skill metadata
- `POST /skills/:skillId/run` - run a skill script
- `GET /events` - SSE stream of execution results

See [api-overview.md](./api-overview.md) for HTTP API details.

---

### `doctor`

Run environment and runtime checks.

```
clawperator doctor [--output <json\|pretty>] [--device <id>] [--operator-package <package>] [--verbose]
clawperator doctor --json
clawperator doctor --fix
clawperator doctor --full
clawperator doctor --check-only
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (alias for `--output json`) |
| `--fix` | Attempt non-destructive host fixes |
| `--full` | Full Android build + install + handshake + smoke |
| `--check-only` | Always exit 0 for CI or automation |
| `--device <id>` | Target device serial |
| `--operator-package <package>` | Target Operator package |

`doctor` checks APK presence before attempting version compatibility and handshake validation. Use `clawperator doctor --help` if you need the current timeout and package-target guidance.

Exit code behavior:

- `0` - all critical checks pass, including the multi-device ambiguity case where `--device` is still required
- `1` - a genuine failure occurred, such as no device found, APK not installed, or handshake failure

---

### `version`

Show the CLI version, or compare it with the installed Operator APK.

```
clawperator version
clawperator version --check-compat [--device <id>] [--operator-package <package>]
```

| Flag | Description |
|------|-------------|
| `--check-compat` | Compare the CLI version with the installed APK version |
| `--device <id>` | Target device serial |
| `--operator-package <package>` | Target Operator package |

`clawperator version --check-compat` reports the CLI version, installed APK version, APK `versionCode`, receiver package, compatibility verdict, and remediation guidance when versions do not match.

---

## Exit Codes

- `0` - success
- `1` - error (JSON error object with `code` field printed to stdout)

Error output always uses the `[Clawperator-Result]` terminal envelope format when dispatched via an execution, or a plain `{ code, message }` JSON object for CLI-level errors.
