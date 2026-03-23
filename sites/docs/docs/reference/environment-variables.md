# Environment Variables

This page is the central reference for the most important environment variables
used by the current Clawperator CLI, installer, and local runtime tooling.

It focuses on variables that are useful or observable for operators and agents,
not every internal shell temporary used by validation scripts.

## Commonly useful variables

| Variable | Used by | Meaning |
| :--- | :--- | :--- |
| `CLAWPERATOR_SKILLS_REGISTRY` | CLI, installer | Path to the local skills registry JSON |
| `CLAWPERATOR_OPERATOR_PACKAGE` | CLI, installer, skills | Default Android Operator package to target when `--operator-package` is omitted. Also passed to skill scripts. |
| `CLAWPERATOR_BIN` | skills | Path to CLI binary used by skill scripts (defaults to global `clawperator` or auto-detected sibling build) |
| `CLAWPERATOR_INSTALL_APK` | installer | Pre-seeds the installer's APK install prompt |
| `CLAWPERATOR_INSTALL_SKIP_SKILLS` | installer | Skips `skills install` during installer setup when set to `1` |
| `CLAWPERATOR_APK_METADATA_URL` | installer | Overrides the metadata endpoint used to discover the latest downloadable Operator APK |
| `ADB_PATH` | CLI | Overrides the `adb` binary path |
| `ANDROID_HOME` | CLI runtime config | Android SDK root used to locate emulator and SDK tools |
| `ANDROID_SDK_ROOT` | CLI runtime config | Fallback Android SDK root if `ANDROID_HOME` is unset |
| `EMULATOR_PATH` | emulator commands, `serve` | Overrides the emulator binary path |
| `SDKMANAGER_PATH` | emulator commands, `serve` | Overrides the `sdkmanager` binary path |
| `AVDMANAGER_PATH` | emulator commands, `serve` | Overrides the `avdmanager` binary path |

## `CLAWPERATOR_SKILLS_REGISTRY`

Points Clawperator at one local registry JSON for skills discovery.

Typical value:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

Use it when:

- the installer has not yet updated your shell profile
- you are switching between local skill registries
- you want `skills list`, `skills get`, `skills run`, and `skills new` to use
  a specific local repo

## `CLAWPERATOR_OPERATOR_PACKAGE`

Sets the default receiver package for commands that dispatch to the Android
Operator APK. Also injected into skill scripts via `CLAWPERATOR_OPERATOR_PACKAGE`
so skills know which Operator package to target.

Typical values:

- `com.clawperator.operator`
- `com.clawperator.operator.dev`

Example:

```bash
export CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator.dev"
```

CLI flags still win over the environment variable. Use an explicit
`--operator-package` when you want one command to differ from your shell
default.

For skill execution, this is also available as a CLI flag:

```bash
clawperator skills run <skill_id> --operator-package com.clawperator.operator.dev
```

## `CLAWPERATOR_BIN`

Sets the path to the Clawperator CLI binary that skill scripts should use.
This is injected into skill scripts automatically by `clawperator skills run`.

Resolution order (highest priority first):

1. `CLAWPERATOR_BIN` environment variable (explicit override)
2. Local sibling build at `apps/node/dist/cli/index.js` (if present)
3. Global `clawperator` binary (fallback)

The sibling build is preferred over the global binary so that developers with a
local checkout automatically get the correct compiled output.

Example for development with a local build:

```bash
export CLAWPERATOR_BIN=/path/to/clawperator/apps/node/dist/cli/index.js
clawperator skills run <skill_id>
```

Or set it for a single command:

```bash
CLAWPERATOR_BIN=/path/to/clawperator/apps/node/dist/cli/index.js \
  clawperator skills run <skill_id>
```

## `CLAWPERATOR_INSTALL_APK`

Controls the installer's "install APK now?" prompt.

Current behavior in `sites/landing/public/install.sh`:

- `Y`, `y`, `yes`, `YES` mean proceed with APK install
- any other non-empty value means skip APK install
- if unset, the installer prompts interactively

Example:

```bash
CLAWPERATOR_INSTALL_APK=Y curl -fsSL https://clawperator.com/install.sh | bash
```

## `CLAWPERATOR_INSTALL_SKIP_SKILLS`

Skips the installer's skills bootstrap phase when set to `1`.

Example:

```bash
CLAWPERATOR_INSTALL_SKIP_SKILLS=1 curl -fsSL https://clawperator.com/install.sh | bash
```

This is mainly useful for constrained or staged setups where you want the CLI
without immediately cloning the skills repository.

## `CLAWPERATOR_APK_METADATA_URL`

Overrides the metadata document used by the installer to find the latest
downloadable Operator APK and checksum.

This is an advanced override, mainly useful for testing alternate download
surfaces or release-candidate flows.

## Android tool path variables

Clawperator can use environment variables to find Android host tools.

### `ADB_PATH`

Overrides the `adb` binary path used by CLI commands such as `devices`,
`doctor`, `exec`, and `operator setup`.

Example:

```bash
export ADB_PATH="/opt/android/platform-tools/adb"
```

### `ANDROID_HOME` and `ANDROID_SDK_ROOT`

These point to the Android SDK root. Clawperator uses them to derive default
paths for:

- `emulator`
- `sdkmanager`
- `avdmanager`

If both are set, `ANDROID_HOME` wins.

### `EMULATOR_PATH`, `SDKMANAGER_PATH`, `AVDMANAGER_PATH`

These override the individual binaries directly.

Use them when:

- your SDK is installed in a non-standard location
- you want emulator commands to use a specific toolchain
- you are debugging path resolution on CI or a custom workstation

## Recommended shell profile baseline

For a typical local setup, these are the most useful persistent exports:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
export CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator"
```

Then pass `--device` per command when more than one Android target is connected
(`--device-id` is accepted as an alias).

For development with a local branch build, also set:

```bash
export CLAWPERATOR_BIN="/path/to/clawperator/apps/node/dist/cli/index.js"
export CLAWPERATOR_OPERATOR_PACKAGE="com.clawperator.operator.dev"
```

## Related docs

- [Device and Package Model](device-and-package-model.md)
- [Clawperator Doctor](node-api-doctor.md)
- [First-Time Setup](../getting-started/first-time-setup.md)
