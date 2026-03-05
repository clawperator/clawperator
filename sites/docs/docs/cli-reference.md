# CLI Reference

```
clawperator <command> [options]
```

---

## Global Options

These flags apply to all commands.

| Flag | Description |
|------|-------------|
| `--device-id <id>` | Target Android device serial |
| `--receiver-package <package>` | Target Operator package for broadcast dispatch |
| `--output <json\|pretty>` | Output format (default: `json`) |
| `--timeout-ms <number>` | Override execution timeout within policy limits |
| `--verbose` | Include debug diagnostics in output |
| `--help` | Show help |
| `--version` | Show version |

---

## Commands

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
clawperator execute --execution <json-or-file> [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--execution <json-or-file>` | Execution payload as inline JSON or a path to a JSON file (required) |
| `--device-id <id>` | Target device serial |
| `--receiver-package <package>` | Target Operator package |

The `--execution` value must conform to the `Execution` contract (see [api-overview.md](./api-overview.md)).

**Note:** `execute best-effort` is not implemented in this stage. Use `observe snapshot` + agent reasoning instead.

---

### `observe snapshot`

Capture the current UI snapshot from the device.

```
clawperator observe snapshot [--device-id <id>] [--receiver-package <package>]
```

Returns ASCII-formatted UI tree via the `snapshot_ui` action.

---

### `observe screenshot`

Capture the current device screen as a PNG file.

```
clawperator observe screenshot [--device-id <id>] [--receiver-package <package>]
```

The PNG is saved to a temp path and the path is returned in the result envelope.

---

### `inspect ui`

Alias for `observe snapshot` with formatted output.

```
clawperator inspect ui [--device-id <id>] [--receiver-package <package>]
```

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

### `skills sync`

Sync and pin the skills index/cache to a specific git ref.

```
clawperator skills sync --ref <git-ref>
```

| Flag | Description |
|------|-------------|
| `--ref <git-ref>` | Git ref to pin to (required) |

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
- `GET /events` - SSE stream of execution results

See [api-overview.md](./api-overview.md) for HTTP API details.

---

### `doctor`

Run environment and runtime checks.

```
clawperator doctor [--json] [--fix] [--full] [--device-id <id>] [--receiver-package <package>]
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (alias for `--output json`) |
| `--fix` | Attempt non-destructive host fixes |
| `--full` | Full Android build + install + handshake + smoke |
| `--device-id <id>` | Target device serial |
| `--receiver-package <package>` | Target Operator package |

---

## Exit Codes

- `0` - success
- `1` - error (JSON error object with `code` field printed to stdout)

Error output always uses the `[Clawperator-Result]` terminal envelope format when dispatched via an execution, or a plain `{ code, message }` JSON object for CLI-level errors.
