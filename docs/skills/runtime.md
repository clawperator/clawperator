# Device Prep and Runtime

## Purpose

Define what must be true before a skill run is reliable: device readiness, wrapper environment, timeout behavior, multi-device targeting, and output capture.

## Sources

- Skill runtime: `apps/node/src/domain/skills/runSkill.ts`
- Skill config: `apps/node/src/domain/skills/skillsConfig.ts`
- CLI skill wrapper: `apps/node/src/cli/commands/skills.ts`

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

## Runtime Success Example

```json
{
  "skillId": "com.android.settings.capture-overview",
  "output": "RESULT|status=success|snapshot=/tmp/settings.xml\n",
  "exitCode": 0,
  "durationMs": 15321,
  "timeoutMs": 120000
}
```

## Runtime Failure Example

```json
{
  "code": "SKILL_EXECUTION_TIMEOUT",
  "message": "Skill com.android.settings.capture-overview timed out after 120000ms",
  "skillId": "com.android.settings.capture-overview",
  "stdout": "RESULT|status=partial\n",
  "stderr": "still waiting for target node\n",
  "timeoutMs": 120000
}
```

## Practical Runtime Rules

- gate device readiness with `doctor` before blaming the skill
- pass `--device` explicitly in multi-device environments
- pass `--operator-package com.clawperator.operator.dev` for local debug APK workflows
- inspect partial stdout and stderr on failures before rerunning blindly

## Related Pages

- [Setup](../setup.md)
- [Doctor](../api/doctor.md)
- [Devices](../api/devices.md)
- [Skills Overview](overview.md)
- [Development Workflow](development.md)
