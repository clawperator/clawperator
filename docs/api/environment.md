# Environment Variables

## Purpose

Document the environment variables currently read by the Node CLI and runtime, especially the `CLAWPERATOR_*` variables used in headless automation and CI where repeating flags is impractical.

## Sources

- Global CLI bootstrap: `apps/node/src/cli/index.ts`
- Runtime config: `apps/node/src/adapters/android-bridge/runtimeConfig.ts`
- Execution and command modules: `apps/node/src/cli/commands/`, `apps/node/src/domain/executions/runExecution.ts`
- Skills config: `apps/node/src/domain/skills/skillsConfig.ts`
- Skills registry loader: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- Serve command fallback: `apps/node/src/cli/commands/serve.ts`

## Precedence Rule

Where both a CLI flag and an environment variable exist, the explicit CLI flag wins.

Common examples:

- `--operator-package` overrides `CLAWPERATOR_OPERATOR_PACKAGE`
- `--log-level` overrides `CLAWPERATOR_LOG_LEVEL`
- `skills run --timeout` overrides any default timeout behavior for that single run

If no matching flag exists, the environment variable is the highest caller-controlled input for that setting.

## Complete Table

| Variable | What it controls | Where it is read | Default if unset |
| --- | --- | --- | --- |
| `CLAWPERATOR_OPERATOR_PACKAGE` | default Operator package for execution, doctor, recording, serve, and skill wrapper runs | many command modules, `runExecution.ts`, `skillsConfig.ts`, `serve.ts` | `com.clawperator.operator` |
| `CLAWPERATOR_LOG_DIR` | structured log directory for the CLI logger | `cli/index.ts`, `adapters/logger.ts` | logger-specific default under the user home directory |
| `CLAWPERATOR_LOG_LEVEL` | logger threshold | `cli/index.ts`, `adapters/logger.ts` | logger default level |
| `CLAWPERATOR_SKILLS_REGISTRY` | path to the active skills registry JSON | `adapters/skills-repo/localSkillsRegistry.ts` | `skills/skills-registry.json` relative to current working directory, with one fallback when loading |
| `CLAWPERATOR_BIN` | command used by skill scripts when the wrapper injects the CLI path | `domain/skills/skillsConfig.ts` | local sibling build if present, otherwise global `clawperator` |
| `ADB_PATH` | adb binary path for runtime and CLI commands | device, doctor, record, operator setup, serve, and execution modules | `adb` |
| `ANDROID_HOME` | Android SDK root for resolving emulator/sdkmanager/avdmanager binaries | `runtimeConfig.ts` | no SDK-root override |
| `ANDROID_SDK_ROOT` | fallback Android SDK root for resolving emulator/sdkmanager/avdmanager binaries | `runtimeConfig.ts` | no SDK-root override |

## `CLAWPERATOR_OPERATOR_PACKAGE`

This is the main runtime default for Operator package selection.

When used:

- device execution commands fall back to it when `--operator-package` is omitted
- `doctor`, `record`, `grant-device-permissions`, `operator setup`, `version --check-compat`, and `serve` all read it
- `skills run` uses it when the caller did not pass `--operator-package`

When unset:

- the runtime default package is `com.clawperator.operator`

When set:

- every command that does not get an explicit `--operator-package` uses the environment value instead

Example:

```bash
export CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev
clawperator snapshot --json --device <device_serial>
```

That command runs against the debug Operator package even though no `--operator-package` flag was passed.

## `CLAWPERATOR_LOG_DIR`

Controls where the CLI's structured logger writes log files.

When unset:

- the logger uses its built-in default directory under the user's home directory

When set:

- logs are written to the specified directory instead

This variable affects logging only. It does not change device behavior or result envelopes.

## `CLAWPERATOR_LOG_LEVEL`

Controls the logger threshold when `--log-level` is not passed.

Accepted CLI values for the corresponding flag are:

- `debug`
- `info`
- `warn`
- `error`

If both are present:

- `--log-level` wins over `CLAWPERATOR_LOG_LEVEL`

## `CLAWPERATOR_SKILLS_REGISTRY`

Defines the path to the active `skills-registry.json`.

Used by:

- `clawperator skills list`
- `clawperator skills get`
- `clawperator skills search`
- `clawperator skills run`
- `clawperator skills validate`
- `clawperator skills compile-artifact`
- `clawperator skills new`

When unset:

- `getRegistryPath()` defaults to `skills/skills-registry.json` relative to the current working directory
- `loadRegistry()` warns and then fails if that default file does not exist

When set:

- Node reads the configured file directly
- if the configured file is missing, commands fail with `REGISTRY_READ_FAILED`

Example:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
clawperator skills list --json
```

## `CLAWPERATOR_BIN`

This variable is for skill subprocesses, not for the main CLI bootstrap.

`skills run` resolves a command string and injects it into the child process environment as `CLAWPERATOR_BIN`.

Resolution order:

1. explicit `CLAWPERATOR_BIN`
2. local sibling build if present
3. global `clawperator`

When unset:

- the wrapper prefers the local compiled CLI from the current checkout when available

When set:

- the skill script receives that exact command path instead

This is useful when you need a skill to call a particular CLI binary during testing.

## `ADB_PATH`

Overrides the adb executable used by the runtime.

Used by:

- `devices`
- `doctor`
- `grant-device-permissions`
- `operator setup`
- `record ...`
- `serve`
- `runExecution()`

When unset:

- Node uses `adb` and relies on the process `PATH`

When set:

- Node uses the provided executable path or command name

Example:

```bash
export ADB_PATH=/opt/android/platform-tools/adb
clawperator devices --json
```

There is no primary CLI flag that overrides `ADB_PATH`.

## `ANDROID_HOME` and `ANDROID_SDK_ROOT`

These are not `CLAWPERATOR_*` variables, but the runtime reads them when resolving Android SDK tools.

They affect:

- `emulator`
- `sdkmanager`
- `avdmanager`

Resolution behavior:

- `runtimeConfig.ts` checks `ANDROID_HOME` first
- if unset, it checks `ANDROID_SDK_ROOT`
- if neither produces a usable tool path, the runtime falls back to bare command names like `emulator`, `sdkmanager`, and `avdmanager`

These variables matter mainly for emulator and SDK provisioning flows, not normal device execution against an already available adb target.

## Effective Defaults Summary

```json
{
  "CLAWPERATOR_OPERATOR_PACKAGE": "com.clawperator.operator",
  "CLAWPERATOR_BIN": "local sibling build if present, otherwise global clawperator",
  "CLAWPERATOR_SKILLS_REGISTRY": "skills/skills-registry.json relative to cwd",
  "ADB_PATH": "adb"
}
```

## Interaction With CLI Flags

Most common overrides:

| CLI flag | Overrides |
| --- | --- |
| `--operator-package` | `CLAWPERATOR_OPERATOR_PACKAGE` |
| `--log-level` | `CLAWPERATOR_LOG_LEVEL` |
| `--device` | no environment variable equivalent |
| `--timeout` | per-command timeout behavior, not an environment default |

Practical rule:

- use environment variables for workspace-wide defaults
- use flags for per-command determinism
