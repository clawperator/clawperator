# CLI Reference

```
clawperator <command> [options]
```

---

## Global Options

These flags are parsed globally. Command support varies by path.

| Flag | Description |
|------|-------------|
| `--device-id <id>` | Target Android device serial |
| `--receiver-package <package>` | Target Operator package for broadcast dispatch |
| `--output <json\|pretty>` | Output format (default: `json`) |
| `--timeout-ms <number>` | Override execution timeout for `execute`, `observe snapshot`, `observe screenshot`, and `inspect ui` within policy limits |
| `--verbose` | Include debug diagnostics in output |
| `--help` | Show help |
| `--version` | Show version |

Default receiver package: `com.clawperator.operator`. Use `--receiver-package com.clawperator.operator.dev` for local debug APKs.

---

## Commands

### `operator setup`

Install the Clawperator Operator APK and grant required device permissions in one step.

```
clawperator operator setup --apk <path> [--device-id <id>] [--receiver-package <package>] [--output <json|pretty>]
```

| Flag | Description |
|------|-------------|
| `--apk <path>` | Local path to the Operator APK file (required) |
| `--device-id <id>` | Target Android device serial (required when multiple devices are connected) |
| `--receiver-package <package>` | Operator package identifier (required when both release and debug variants are installed) |

This is the canonical setup command. `clawperator operator install` remains a compatibility alias. It runs three phases in sequence:

1. **Install**: Copies the APK onto the device via `adb install -r`.
2. **Permissions**: Grants the accessibility service, notification posting, and notification listener permissions.
3. **Verification**: Confirms the package is visible via `pm list packages`.

If `--receiver-package` is omitted, setup auto-detects the package only when exactly one known Operator variant is installed. If both release and debug variants are installed, pass `--receiver-package` explicitly.

If any phase fails, the command exits with a structured JSON error identifying which phase failed. Error codes:

| Code | Phase | Meaning |
|------|-------|---------|
| `OPERATOR_APK_NOT_FOUND` | pre-install | APK path does not exist on disk |
| `OPERATOR_INSTALL_FAILED` | install | `adb install` returned a non-zero exit code |
| `OPERATOR_GRANT_FAILED` | permissions | One or more permission grants failed |
| `OPERATOR_VERIFY_FAILED` | verification | Package not found after install |

Do not use raw `adb install` for normal setup. It installs the APK without granting permissions, leaving the device in an unusable state.

For debug builds, pass `--receiver-package com.clawperator.operator.dev`.

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
clawperator packages list [--device-id <id>] [--third-party]
```

| Flag | Description |
|------|-------------|
| `--device-id <id>` | Target device serial |
| `--third-party` | Limit to third-party packages only |

---

### `execute`

Execute a validated command payload.

```
clawperator execute --execution <json-or-file> [--validate-only] [--dry-run] [--device-id <id>] [--receiver-package <package>] [--timeout-ms <number>]
```

| Flag | Description |
|------|-------------|
| `--execution <json-or-file>` | Execution payload as inline JSON or a path to a JSON file (required) |
| `--validate-only` | Validate and normalize the payload without dispatching to any device |
| `--dry-run` | Print the execution plan without dispatching to any device |
| `--device-id <id>` | Target device serial |
| `--receiver-package <package>` | Target Operator package |
| `--timeout-ms <number>` | Override execution timeout within policy limits |

The `--execution` value must conform to the `Execution` contract (see [api-overview.md](./api-overview.md)).

With `--validate-only`, Clawperator validates the payload, applies any
`--timeout-ms` override, and returns the normalized execution without touching
adb or resolving a device.

**Note:** `execute best-effort` is not implemented in this stage. Use `observe snapshot` + agent reasoning instead.

---

### `observe snapshot`

Capture the current UI snapshot from the device.

```
clawperator observe snapshot [--device-id <id>] [--receiver-package <package>] [--timeout-ms <number>] [--output <json\|pretty>] [--verbose]
```

Returns ASCII-formatted UI tree via the `snapshot_ui` action.

---

### `observe screenshot`

Capture the current device screen as a PNG file.

```
clawperator observe screenshot [--device-id <id>] [--receiver-package <package>] [--timeout-ms <number>] [--output <json\|pretty>] [--verbose]
```

The PNG is saved to a temp path and the path is returned in the result envelope.

---

### `inspect ui`

Alias for `observe snapshot` with formatted output.

```
clawperator inspect ui [--device-id <id>] [--receiver-package <package>] [--timeout-ms <number>] [--output <json\|pretty>] [--verbose]
```

`inspect ui` is a wrapper alias over `observe snapshot`.

---

### `action open-uri`

Open a URI on the device using the system default handler.

```
clawperator action open-uri --uri <uri> [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--uri <uri>` | URI to open (required). Any scheme: `https://`, `market://`, deep links, etc. |

---

### `action open-app`

Open an app by package ID.

```
clawperator action open-app --app <packageId> [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--app <packageId>` | Android application ID (required) |

---

### `action click`

Click a UI node matching a selector.

```
clawperator action click --selector <json> [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |

Example selector: `'{"resourceId":"com.example.app:id/button_ok"}'`

---

### `action read`

Read text from a UI node.

```
clawperator action read --selector <json> [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |

---

### `action wait`

Wait for a UI node to appear.

```
clawperator action wait --selector <json> [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |

---

### `action type`

Type text into a UI node.

```
clawperator action type --selector <json> --text <value> [--submit] [--clear] [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--selector <json>` | `NodeMatcher` JSON (required) |
| `--text <value>` | Text to type (required) |
| `--submit` | Send submit/enter after typing |
| `--clear` | Clear the field before typing |

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
| `--artifact <name>` | Artifact name, e.g. `ac-status` or `ac-status.recipe.json` (required) |
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
```

| Flag | Description |
|------|-------------|
| `--app <package_id>` | Filter by Android application ID |
| `--intent <intent>` | Filter by skill intent |
| `--keyword <text>` | Search skill ID and summary text |

At least one filter is required.

---

### `skills run`

Invoke a skill's primary script as a convenience wrapper.

```
clawperator skills run <skill_id> [--device-id <id>] [-- <extra_args>]
```

| Flag / Arg | Description |
|------------|-------------|
| `<skill_id>` | Skill ID (required) |
| `--device-id <id>` | Device serial passed as first script arg |
| `-- <extra_args>` | Additional arguments passed through to the script |

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

Use `clawperator skills sync --help` when you need the current clone and registry-path guidance.

---

### `grant-device-permissions`

Re-grant accessibility and notification permissions only after an Operator APK crash causes Android to revoke them.

```
clawperator grant-device-permissions [--device-id <id>] [--receiver-package <package>] [--output <json\|pretty>]
```

This command is for **crash recovery only**. Use it after a previously working Operator APK crashes and Android revokes the accessibility or notification permissions. For initial setup, always use `clawperator operator setup` instead.

Use the release package by default. Pass `--receiver-package com.clawperator.operator.dev` for local debug builds.

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
- `POST /observe/snapshot` - capture UI snapshot
- `POST /observe/screenshot` - capture screenshot
- `GET /skills` - list or search skills
- `GET /skills/:skillId` - get skill metadata
- `POST /skills/:skillId/run` - run a skill script
- `GET /events` - SSE stream of execution results

See [api-overview.md](./api-overview.md) for HTTP API details.

---

### `doctor`

Run environment and runtime checks.

```
clawperator doctor [--output <json\|pretty>] [--device-id <id>] [--receiver-package <package>] [--verbose]
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
| `--device-id <id>` | Target device serial |
| `--receiver-package <package>` | Target Operator package |

`doctor` checks APK presence before attempting version compatibility and handshake validation. Use `clawperator doctor --help` if you need the current timeout and package-target guidance.

Exit code behavior:

- `0` - all critical checks pass, including the multi-device ambiguity case where `--device-id` is still required
- `1` - a genuine failure occurred, such as no device found, APK not installed, or handshake failure

---

### `version`

Show the CLI version, or compare it with the installed Operator APK.

```
clawperator version
clawperator version --check-compat [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--check-compat` | Compare the CLI version with the installed APK version |
| `--device-id <id>` | Target device serial |
| `--receiver-package <package>` | Target Operator package |

`clawperator version --check-compat` reports the CLI version, installed APK version, APK `versionCode`, receiver package, compatibility verdict, and remediation guidance when versions do not match.

Use `clawperator version --help` for the current compatibility-check notes and default receiver-package guidance.

---

## Exit Codes

- `0` - success
- `1` - error (JSON error object with `code` field printed to stdout)

Error output always uses the `[Clawperator-Result]` terminal envelope format when dispatched via an execution, or a plain `{ code, message }` JSON object for CLI-level errors.
