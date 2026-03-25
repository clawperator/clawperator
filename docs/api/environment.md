# Environment Variables

## Purpose

Define every environment variable the Node CLI reads, its exact default, where it takes effect, and how to verify it is working. Use environment variables for workspace-wide defaults in headless, CI, or agent environments where repeating CLI flags on every command is impractical.

## Sources

- Global flag parsing (reads `--log-level`, `--operator-package`, `--device`, `--timeout`): `apps/node/src/cli/index.ts`
- Logger construction (reads `CLAWPERATOR_LOG_DIR`, `CLAWPERATOR_LOG_LEVEL`): `apps/node/src/adapters/logger.ts`
- Android SDK tool resolution (reads `ANDROID_HOME`, `ANDROID_SDK_ROOT`): `apps/node/src/adapters/android-bridge/runtimeConfig.ts`
- Skill binary and package resolution (reads `CLAWPERATOR_BIN`, `CLAWPERATOR_OPERATOR_PACKAGE`): `apps/node/src/domain/skills/skillsConfig.ts`
- Skills registry path (reads `CLAWPERATOR_SKILLS_REGISTRY`): `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- Per-command operator package and adb path: every device-targeting command in `apps/node/src/cli/commands/`
- Execution runtime (reads `CLAWPERATOR_OPERATOR_PACKAGE`, `ADB_PATH`): `apps/node/src/domain/executions/runExecution.ts`

## Precedence Rule

When both a CLI flag and an environment variable control the same setting, the CLI flag wins. The CLI parses global flags before dispatching to any command, so flags like `--operator-package` and `--log-level` can appear anywhere on the command line.

Resolution order for a typical setting:

1. Explicit CLI flag (highest priority)
2. Environment variable
3. Hardcoded default (lowest priority)

There is no configuration file layer between the environment variable and the default.

## Complete Reference

| Variable | Default if unset | CLI flag override |
| --- | --- | --- |
| `CLAWPERATOR_OPERATOR_PACKAGE` | `com.clawperator.operator` | `--operator-package` |
| `CLAWPERATOR_LOG_DIR` | `~/.clawperator/logs` | none |
| `CLAWPERATOR_LOG_LEVEL` | `info` | `--log-level` |
| `CLAWPERATOR_SKILLS_REGISTRY` | `<cwd>/skills/skills-registry.json` | none |
| `CLAWPERATOR_BIN` | local sibling build if present, otherwise `clawperator` | none |
| `ADB_PATH` | `adb` (from `PATH`) | none |
| `ANDROID_HOME` | unset | none |
| `ANDROID_SDK_ROOT` | unset (fallback for `ANDROID_HOME`) | none |

## `CLAWPERATOR_OPERATOR_PACKAGE`

Controls which Operator APK package name the runtime targets when `--operator-package` is not passed.

Read by every device-targeting CLI command (`snapshot`, `click`, `read`, `wait`, `scroll`, `doctor`, `record start`, `record stop`, `record pull`, `operator setup`, `grant-device-permissions`, `version --check-compat`, `exec`, `serve`), plus `runExecution()` and `resolveOperatorPackage()` in the skills runtime.

Default: `com.clawperator.operator`

Common values:

| Value | When to use |
| --- | --- |
| `com.clawperator.operator` | Release APK. Default. |
| `com.clawperator.operator.dev` | Local debug APK built from source. |

Example:

```bash
export CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev
clawperator snapshot --json --device emulator-5554
```

That snapshot runs against the debug Operator package. No `--operator-package` flag needed.

Verification - confirm the env var took effect:

```bash
clawperator doctor --json --device emulator-5554
```

Check `report.operatorPackage` in the JSON output:

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "emulator-5554",
  "operatorPackage": "com.clawperator.operator.dev",
  "checks": []
}
```

If `operatorPackage` shows the value you set, the env var is active.

Error case: if the env var names a package that is not installed, commands that target a device will fail with `OPERATOR_NOT_INSTALLED` or `OPERATOR_VARIANT_MISMATCH`. Run `clawperator doctor --json` to diagnose.

Note: the CLI also accepts `--receiver-package` as a legacy alias for `--operator-package`. Both override the same env var. Do not use `--receiver-package` in new code.

## `CLAWPERATOR_LOG_DIR`

Controls where the CLI writes structured log files.

Default: `~/.clawperator/logs`

Log files are named `clawperator-YYYY-MM-DD.log` and contain NDJSON entries with `ts`, `level`, `event`, `commandId`, `taskId`, `deviceId`, and `message` fields.

There is no CLI flag to override this. To change the log directory, set the env var.

Example:

```bash
export CLAWPERATOR_LOG_DIR=/tmp/clawperator-logs
clawperator snapshot --json
# logs written to /tmp/clawperator-logs/clawperator-2026-03-25.log
```

This variable affects logging only. It does not change device behavior, result envelopes, or execution outcomes.

## `CLAWPERATOR_LOG_LEVEL`

Controls the logger threshold when `--log-level` is not passed.

Default: `info`

Valid values: `debug`, `info`, `warn`, `error`

If set to an unrecognized value (e.g., `trace`, `verbose`, or an empty string), the logger silently falls back to `info`. This is not an error - it is how `normalizeLogLevel()` in `logger.ts` works.

`--log-level` is a global flag. It can appear anywhere on the command line and takes priority over this env var:

```bash
# env var sets warn, but flag overrides to debug
export CLAWPERATOR_LOG_LEVEL=warn
clawperator snapshot --json --log-level debug
# logger threshold is debug for this command
```

## `CLAWPERATOR_SKILLS_REGISTRY`

Defines the path to the active `skills-registry.json` used by all skill commands.

Read by: `skills list`, `skills get`, `skills search`, `skills run`, `skills validate`, `skills compile-artifact`, `skills scaffold`, and the `/skills` serve endpoints.

Default when unset: `<cwd>/skills/skills-registry.json` where `<cwd>` is `process.cwd()`.

Fallback behavior in `loadRegistry()`:

1. Try the configured path (env var or explicit argument)
2. If no explicit path and no env var: try `<cwd>/skills/skills-registry.json`
3. If that fails: try `<cwd>/../../skills/skills-registry.json` (covers running from `apps/node/`)
4. If all fail: throw an error suggesting `clawperator skills sync`

After `clawperator skills sync`, the registry lives at `~/.clawperator/skills/skills/skills-registry.json`. Set the env var to point there:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
clawperator skills list --json
```

Error case: if the path does not exist, skill commands fail with `REGISTRY_READ_FAILED`. The error message includes the path that was tried.

## `CLAWPERATOR_BIN`

Controls which Clawperator CLI binary is used when skill scripts call back into Clawperator. This is for skill subprocesses, not for the main CLI bootstrap.

When `clawperator skills run` executes a skill script, it resolves a command string and injects it into the child process environment as `CLAWPERATOR_BIN`.

Resolution order in `resolveSkillBin()`:

1. Explicit `CLAWPERATOR_BIN` env var (if non-empty)
2. Local sibling build at `apps/node/dist/cli/index.js` relative to the running module (if the file exists)
3. Global `clawperator` command

Default: the sibling build when running from a local checkout, otherwise `clawperator`.

The sibling build is preferred over the global binary because it is always in sync with the local Android Operator APK. The global binary may lag behind due to npm publish delays.

Example:

```bash
export CLAWPERATOR_BIN=/usr/local/bin/clawperator-nightly
clawperator skills run com.test.echo --device emulator-5554
# the skill script receives CLAWPERATOR_BIN=/usr/local/bin/clawperator-nightly
```

## `ADB_PATH`

Overrides the adb binary used by the entire runtime. Affects device listing, doctor checks, execution dispatch, recording, operator setup, permission grants, emulator management, package listing, and the serve server.

Default: `adb` (resolved from the process `PATH`).

There is no CLI flag that overrides `ADB_PATH`. This env var is the only way to specify a non-default adb binary.

Read at two levels:

- CLI command handlers pass `adbPath: process.env.ADB_PATH` into domain functions
- `runExecution()` falls back to `process.env.ADB_PATH` when `options.adbPath` is not provided

Example:

```bash
export ADB_PATH=/opt/android/platform-tools/adb
clawperator devices --json
```

Error case: if the path does not point to a working adb binary, `clawperator doctor` reports `ADB_NOT_FOUND` for the `host.adb.presence` check.

Verification:

```bash
clawperator doctor --json
```

If `host.adb.presence` passes, the configured adb binary is usable.

## `ANDROID_HOME` and `ANDROID_SDK_ROOT`

These are standard Android SDK environment variables, not Clawperator-specific. The runtime reads them when resolving paths to `emulator`, `sdkmanager`, and `avdmanager`.

Resolution in `runtimeConfig.ts`:

1. Check `ANDROID_HOME`
2. If unset, check `ANDROID_SDK_ROOT`
3. If neither is set, fall back to bare command names (`emulator`, `sdkmanager`, `avdmanager`) resolved from `PATH`

These variables matter for emulator provisioning flows (`clawperator emulator create`, `emulator start`, and the `/android/emulators` serve endpoints). They do not affect normal device execution against an already-connected adb target.

Tool paths resolved from the SDK root:

| Tool | Resolved path |
| --- | --- |
| `emulator` | `<sdk_root>/emulator/emulator` |
| `sdkmanager` | `<sdk_root>/cmdline-tools/latest/bin/sdkmanager` |
| `avdmanager` | `<sdk_root>/cmdline-tools/latest/bin/avdmanager` |

If the resolved path does not exist, the runtime falls back to the bare command name.

## Agent Configuration Pattern

For deterministic agent environments, set these three variables and forget about per-command flags:

```bash
export CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
export ADB_PATH=/usr/local/bin/adb
```

Then every command uses consistent defaults:

```bash
clawperator doctor --json --device emulator-5554
clawperator snapshot --json --device emulator-5554
clawperator skills run com.test.echo --device emulator-5554
```

The only flag you still need per-command is `--device` when multiple targets are connected. There is no environment variable equivalent for `--device` - device selection must always be explicit.

## Related Pages

- [Setup](../setup.md)
- [Devices](devices.md)
- [Doctor](doctor.md)
- [Serve API](serve.md)
- [Skills Overview](../skills/overview.md)
