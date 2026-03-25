# Device Prep and Runtime

## Purpose

Define what must be true before a skill run is reliable: device readiness, wrapper environment, timeout behavior, multi-device targeting, and output capture.

## Sources

- Skill runtime: `apps/node/src/domain/skills/runSkill.ts`
- Skill config: `apps/node/src/domain/skills/skillsConfig.ts`
- CLI skill wrapper: `apps/node/src/cli/commands/skills.ts`
- Environment variables overview: `docs/api/environment.md`

## Device Prep Checklist

Before `clawperator skills run`, the target should already satisfy the normal Clawperator readiness path:

1. device visible to adb
2. expected Operator package installed
3. accessibility service running
4. version compatibility healthy

Recommended verification:

```bash
clawperator doctor --json --device <device_serial> --operator-package com.clawperator.operator.dev
```

Treat the device as ready only when:

- exit code `0`
- `criticalOk == true`

Verification pattern:

- run `clawperator doctor --json --device <device_serial> --operator-package <package>`
- confirm `report.operatorPackage` matches the package you plan to use inside the skill
- confirm the doctor report is for the same `deviceId` you plan to pass to `skills run`

For first-time setup, use [Setup](../setup.md). For runtime recovery, use [Operator App](../troubleshooting/operator.md).

## Runtime Environment Passed To Skill Scripts

The wrapper injects these environment variables:

| Variable | Meaning |
| --- | --- |
| `CLAWPERATOR_BIN` | command the skill should use when it needs to invoke Clawperator |
| `CLAWPERATOR_OPERATOR_PACKAGE` | Operator package the skill should target on its internal CLI calls |

Resolution behavior:

- `CLAWPERATOR_BIN` uses explicit env override first, then a local sibling build, then global `clawperator`
- `CLAWPERATOR_OPERATOR_PACKAGE` uses the explicit wrapper flag first, then environment, then `com.clawperator.operator`

The wrapper also preserves the rest of `process.env` when spawning the child process.

The exact `CLAWPERATOR_BIN` resolution order from `resolveSkillBin()` is:

1. non-empty `CLAWPERATOR_BIN`
2. branch-local sibling build at `apps/node/dist/cli/index.js` when it exists
3. global `clawperator`

The exact `CLAWPERATOR_OPERATOR_PACKAGE` resolution order from `cmdSkillsRun()` plus `resolveOperatorPackage()` is:

1. `--operator-package <pkg>` on `clawperator skills run`
2. non-empty `CLAWPERATOR_OPERATOR_PACKAGE`
3. `com.clawperator.operator`

Verification pattern:

```bash
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev clawperator skills run com.android.settings.capture-overview --json
```

Then verify the skill's internal `clawperator` calls behave against the intended package. When you need stronger confirmation, add a deliberate internal probe inside the skill script and inspect the raw `output`.

## How Device Id Is Passed

`runSkill()` itself does not invent a device id. The CLI wrapper decides argument passing.

Current `skills run` behavior:

- if `--device <serial>` is present, the wrapper prepends that serial as the first child argument
- then it appends any forwarded args after `--`

That means most scripts should expect:

```text
argv[2] = <device_serial>
```

when they are run through the wrapper with explicit device targeting.

Verification pattern:

```bash
clawperator skills run com.example.app.do-thing --device <device_serial> --json -- --mode smoke
```

Confirm that your script receives:

- first positional child argument: `<device_serial>`
- remaining forwarded args after that: `--mode`, `smoke`

If `--device` is omitted, the wrapper passes no synthetic device argument at all.

## Timeout Behavior

Default skill timeout:

- `120000` milliseconds

This comes from `runSkill.ts` and applies to the subprocess wrapper, not to any single Clawperator action inside the skill.

Override it with:

```bash
clawperator skills run <skill_id> --timeout 90000
```

If the child does not exit in time:

- the wrapper sends `SIGTERM`
- the command fails with `SKILL_EXECUTION_TIMEOUT`

Top-level timeout parsing failures happen before the skill starts:

```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "timeoutMs must be a finite number"
}
```

```json
{
  "code": "USAGE",
  "message": "--timeout requires a value"
}
```

Verification pattern:

```bash
clawperator skills run com.android.settings.capture-overview --timeout 3210 --json
```

Check:

- `timeoutMs` is `3210` in the success payload
- if you omit `--timeout`, the JSON payload does not echo `timeoutMs`, but the wrapper still uses the internal default `120000`

## Multi-Device Skill Execution

When more than one device is connected:

- always pass `--device <serial>`

Example:

```bash
clawperator skills run com.android.settings.capture-overview --device <device_serial> --operator-package com.clawperator.operator.dev
```

Why:

- the wrapper forwards the selected device id into the child script
- the child script can then pass that same serial into its internal Clawperator calls

Without explicit targeting, skill behavior depends on what the script itself does. The wrapper does not auto-add a device argument unless one was provided.

Related failure mode:

- if the child script later invokes Clawperator without a device while multiple devices are connected, the nested call can fail with `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`

Recovery:

- pass `--device <serial>` on the outer `skills run`
- ensure the child script forwards that positional device id into its own internal Clawperator calls

## Output and Logging

`runSkill()` captures:

- stdout
- stderr
- exit code
- total duration

Success wrapper fields:

| Field | Meaning |
| --- | --- |
| `skillId` | invoked registry id |
| `output` | raw stdout |
| `exitCode` | child exit code |
| `durationMs` | total wrapper runtime |

Failure wrapper fields may also include:

| Field | Meaning |
| --- | --- |
| `stdout` | partial stdout captured before failure |
| `stderr` | partial stderr captured before failure |
| `exitCode` | non-zero child exit code when available |

In pretty mode, the CLI also prints a one-line banner with:

- CLI version
- APK status
- log path
- docs hint

That banner is a convenience layer from `cmdSkillsRun()`, not part of the JSON wrapper contract.

The pretty banner contains these exact components:

- CLI version from `getCliVersion()`
- APK status derived from `checkApkPresence()`
- log path, defaulting to `~/.clawperator/logs/clawperator-YYYY-MM-DD.log` when `logger.logPath()` did not supply an override
- docs hint: `https://docs.clawperator.com/llms.txt`

Verification pattern:

- use `--json` when another tool needs parseable output
- use pretty mode when a human operator wants the banner plus streamed skill output
- if pretty mode shows an APK warning or failure, fix the package/device setup before assuming the skill logic is wrong

## Runtime Success Example

```json
{
  "skillId": "com.android.settings.capture-overview",
  "output": "RESULT|status=success|snapshot=/tmp/settings.xml\n",
  "exitCode": 0,
  "durationMs": 15321
}
```

## Runtime Failure Example

```json
{
  "code": "SKILL_EXECUTION_TIMEOUT",
  "message": "Skill com.android.settings.capture-overview timed out after 120000ms",
  "skillId": "com.android.settings.capture-overview",
  "stdout": "RESULT|status=partial\n",
  "stderr": "still waiting for target node\n"
}
```

Another common failure is a bad registry or missing script:

```json
{
  "code": "REGISTRY_READ_FAILED",
  "message": "Registry not found at configured path: /tmp/missing-registry.json. Update CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."
}
```

```json
{
  "code": "SKILL_SCRIPT_NOT_FOUND",
  "message": "Script not found: /abs/path/to/skills/com.android.settings.capture-overview/scripts/run.js",
  "skillId": "com.android.settings.capture-overview"
}
```

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: com.android.settings.capture-overview",
  "skillId": "com.android.settings.capture-overview"
}
```

Recovery patterns:

- `REGISTRY_READ_FAILED`: repair `CLAWPERATOR_SKILLS_REGISTRY` or reinstall the skills repo
- `SKILL_NOT_FOUND`: confirm the exact registry `id` with `clawperator skills list --json`
- `SKILL_SCRIPT_NOT_FOUND`: repair the registry entry or restore the script file on disk
- `SKILL_EXECUTION_FAILED`: inspect `exitCode`, `stdout`, and `stderr`
- `SKILL_EXECUTION_TIMEOUT`: inspect partial `stdout` and only then consider increasing `--timeout`

## Practical Runtime Rules

- gate device readiness with `doctor` before blaming the skill
- pass `--device` explicitly in multi-device environments
- pass `--operator-package com.clawperator.operator.dev` for local debug APK workflows
- prefer `--json` for machine-consumed skill runs so the pretty banner does not pollute stdout
- inspect partial stdout and stderr on failures before rerunning blindly

## Related Pages

- [Setup](../setup.md)
- [Doctor](../api/doctor.md)
- [Devices](../api/devices.md)
- [Skills Overview](overview.md)
- [Development Workflow](development.md)
