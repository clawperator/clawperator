# Daemon

## Purpose

Define the lifecycle contract for the Clawperator background daemon. The daemon is a long-running Node process that binds the same Express app used by `clawperator serve` to a Unix domain socket instead of a TCP port.

Phase 2 exposes lifecycle commands only. Transparent CLI proxying is not active yet.

## Sources

- CLI registration and global flag parsing: `apps/node/src/cli/registry.ts`, `apps/node/src/cli/index.ts`
- Daemon command implementation: `apps/node/src/cli/commands/daemon.ts`
- Daemon path and process helpers: `apps/node/src/domain/daemon/lifecycle.ts`
- Serve app, `/ping`, and `/version`: `apps/node/src/cli/commands/serve.ts`
- CLI version source: `apps/node/src/domain/version/compatibility.ts`
- Error codes: `apps/node/src/contracts/errors.ts`

## Commands

All daemon lifecycle commands return JSON on stdout by default. `--output pretty` pretty-prints the same object.

| Command | Purpose | Success status values |
| --- | --- | --- |
| `clawperator daemon start [--device <id>] [--operator-package <package>]` | Spawn `daemon run` as a detached background process and wait for `/ping`. | `started`, `already_running` |
| `clawperator daemon stop [--device <id>]` | Send `SIGTERM` to the PID in the metadata file and remove PID/socket files. | `stopped`, `not_running` |
| `clawperator daemon status [--device <id>]` | Check `/ping`, read metadata, call `/version`, and report state. | `running`, `not_running` |
| `clawperator daemon restart [--device <id>] [--operator-package <package>]` | Stop, then start. | `started`, `already_running` |

Internal command:

| Command | Public support |
| --- | --- |
| `clawperator daemon run` | Internal foreground server process. It is registered so `daemon start` can spawn it, but it is intentionally omitted from help output. |

## Device Key And Paths

The daemon lifecycle is keyed by the raw `--device` value before device resolution. If `--device` is omitted or blank, the key is `default`.

Sanitization from `sanitizeDaemonKey()`:

| Raw device value | Daemon key |
| --- | --- |
| omitted | `default` |
| `""` | `default` |
| `192.168.1.1:5555` | `192.168.1.1-5555` |

Path formulas from `apps/node/src/domain/daemon/lifecycle.ts`:

| File | Formula |
| --- | --- |
| socket | `~/.clawperator/daemon-<daemon_key>.sock` |
| PID metadata | `~/.clawperator/daemon-<daemon_key>.pid` |
| log | `~/.clawperator/daemon-<daemon_key>.log` |

The daemon directory is created with mode `0700`. The PID metadata file is JSON:

```json
{
  "pid": 12345,
  "startedAt": 1777176000000
}
```

`daemon status` uses `startedAt` to compute `daemon.uptimeSeconds`.

## Output Shapes

### Start

Started:

```json
{
  "ok": true,
  "daemon": {
    "status": "started",
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock"
  }
}
```

Already running:

```json
{
  "ok": true,
  "daemon": {
    "status": "already_running",
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock"
  }
}
```

### Status

Running:

```json
{
  "ok": true,
  "daemon": {
    "status": "running",
    "pid": 12345,
    "version": "0.7.9",
    "uptimeSeconds": 4,
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock"
  }
}
```

Not running:

```json
{
  "ok": true,
  "daemon": {
    "status": "not_running",
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock"
  }
}
```

### Stop

Stopped:

```json
{
  "ok": true,
  "daemon": {
    "status": "stopped",
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock"
  }
}
```

Stop when not running:

```json
{
  "ok": true,
  "daemon": {
    "status": "not_running",
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock"
  }
}
```

## Version Policy

The daemon exposes `GET /version` on its Unix socket and returns:

```json
{
  "version": "0.7.9"
}
```

The value comes from `getCliVersion()` in `apps/node/src/domain/version/compatibility.ts`. Phase 2 lifecycle status reports this value. Version mismatch replacement is implemented by the proxy layer in the later daemon proxy phase, not by these lifecycle commands.

## Failure Modes

| Failure | Output code | Exit code | Recovery |
| --- | --- | --- | --- |
| `daemon start` spawns `daemon run` but `/ping` does not become reachable within `3000` ms | `DAEMON_START_FAILED` | `1` | Inspect `~/.clawperator/daemon-<daemon_key>.log`, then retry `clawperator daemon start --device <id>`. |
| `daemon start` cannot spawn the background process | `DAEMON_START_FAILED` | `1` | Verify the branch-local CLI entrypoint exists and retry from the same checkout. |
| `daemon stop` cannot signal or clean up the process | `DAEMON_STOP_FAILED` | `1` | Inspect the PID metadata file and socket path, stop the process manually if needed, then retry `daemon stop`. |

Top-level daemon failures use the same CLI error shape as other Node-side failures:

```json
{
  "code": "DAEMON_START_FAILED",
  "message": "Daemon did not become ready within 3000ms.",
  "details": {
    "socketPath": "/Users/<local_user>/.clawperator/daemon-emulator-5554.sock",
    "timeoutMs": 3000
  }
}
```

## Verification

Use the branch-local CLI when validating source changes:

```bash
node apps/node/dist/cli/index.js daemon start --device emulator-5554
node apps/node/dist/cli/index.js daemon status --device emulator-5554
node apps/node/dist/cli/index.js daemon stop --device emulator-5554
node apps/node/dist/cli/index.js daemon status --device emulator-5554
```

Success conditions:

- start exits `0` and `daemon.status` is `started` or `already_running`
- status while running exits `0`, `daemon.status == "running"`, `daemon.pid` is a number, `daemon.version` is a string, and `daemon.uptimeSeconds >= 0`
- stop exits `0` and `daemon.status` is `stopped` or `not_running`
- final status exits `0` and `daemon.status == "not_running"`

Verify the internal command is hidden from help:

```bash
node apps/node/dist/cli/index.js --help | grep "daemon run"
```

Success condition: no matches.
