# Development Workflow

## Purpose

Show the current local iteration loop for skills: scaffold, edit, validate, run, and sync.

## Sources

- CLI skill commands: `apps/node/src/cli/commands/skills.ts`, `apps/node/src/cli/registry.ts`
- Runtime wrapper: `apps/node/src/domain/skills/runSkill.ts`
- Validation: `apps/node/src/domain/skills/validateSkill.ts`
- Registry resolution: `apps/node/src/domain/skills/skillsConfig.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- Serve API skill endpoint: `apps/node/src/cli/commands/serve.ts`

## Local Development Flow

Recommended current loop:

1. scaffold the skill
2. edit `skill.json`, `SKILL.md`, scripts, and any artifacts
3. validate the skill
4. run the skill locally on a chosen device
5. tighten assertions or artifact payloads
6. sync the local skills repo if you need a different upstream ref

## Step 1: Scaffold

```bash
clawperator skills new com.example.app.do-thing --summary "Do one deterministic workflow"
```

This gives you:

- registry entry
- `SKILL.md`
- `skill.json`
- `scripts/run.js`
- `scripts/run.sh`

## Step 2: Validate Structure

Single skill:

```bash
clawperator skills validate com.example.app.do-thing --dry-run
```

All skills:

```bash
clawperator skills validate --all --dry-run
```

Why `--dry-run` matters:

- it validates artifact payload JSON against the execution schema when artifacts exist
- it catches missing files and metadata mismatches before device execution

## Step 3: Run Locally

Use explicit device targeting when more than one device is connected:

```bash
clawperator skills run com.example.app.do-thing --device <device_serial> --operator-package com.clawperator.operator.dev --timeout 90000 --json
```

Argument rules:

- `--device <serial>` becomes the first positional script argument
- arguments after `--` are forwarded unchanged to the script

Example with forwarded args:

```bash
clawperator skills run com.example.app.do-thing --device <device_serial> -- --mode smoke --limit 3
```

## Step 4: Verify Output

Current wrapper success data:

```json
{
  "skillId": "com.example.app.do-thing",
  "output": "RESULT|status=success\n",
  "exitCode": 0,
  "durationMs": 8421
}
```

Current wrapper failure data can include partial output:

```json
{
  "code": "SKILL_EXECUTION_FAILED",
  "message": "Skill com.example.app.do-thing exited with code 1",
  "stdout": "RESULT|status=partial\n",
  "stderr": "Expected node not found\n"
}
```

During development, inspect:

- `output`
- `stdout`
- `stderr`
- wrapper timeout
- the actual device state after the run

## `--expect-contains`

For lightweight output assertions:

```bash
clawperator skills run com.example.app.do-thing --device <device_serial> --expect-contains RESULT
```

Behavior:

- the wrapper still runs the full skill
- after success, it checks whether stdout contains the expected substring
- if not, it fails with `SKILL_OUTPUT_ASSERTION_FAILED`

This is useful for smoke checks in CI or local iteration when the script emits stable markers.

## HTTP Testing Pattern

When using `clawperator serve`, the matching route is:

```http
POST /skills/:skillId/run
```

Request body:

```json
{
  "deviceId": "<device_serial>",
  "args": ["--mode", "smoke"],
  "timeoutMs": 90000,
  "expectContains": "RESULT"
}
```

This is useful for local HTTP-based tests of the same wrapper contract.

## Skill Sync

Current sync commands:

```bash
clawperator skills install
clawperator skills update [--ref <git-ref>]
clawperator skills sync --ref <git-ref>
```

Behavior:

- `skills install` syncs `main`
- `skills update` syncs the given ref or defaults to `main`
- `skills sync --ref ...` pins the local skills repo to a specific git ref

Success response includes whether sync occurred and the registry path.

## Common Development Issues

### `REGISTRY_READ_FAILED`

Cause:

- `CLAWPERATOR_SKILLS_REGISTRY` missing or wrong
- registry file does not exist

Fix:

- set the env var to the correct registry
- or run `clawperator skills install`

### `SKILL_SCRIPT_NOT_FOUND`

Cause:

- registry entry points to a script that does not exist

Fix:

- update `skill.json` and the registry entry together
- rerun `skills validate`

### `SKILL_VALIDATION_FAILED`

Cause:

- missing files
- `skill.json` does not match the registry
- artifact payload violates execution schema in `--dry-run`

Fix:

- inspect the returned `details`
- correct metadata or payload shape

### `SKILL_EXECUTION_TIMEOUT`

Cause:

- wrapper hit the timeout before the child exited

Fix:

- increase `--timeout` only if the workflow really needs it
- otherwise inspect whether the skill is hanging on an invalid selector or external state

## Recommended Local Loop

```bash
clawperator skills new com.example.app.do-thing --summary "Describe it"
clawperator skills validate com.example.app.do-thing --dry-run
clawperator skills run com.example.app.do-thing --device <device_serial> --operator-package com.clawperator.operator.dev --json
```

Repeat until:

- validation passes
- wrapper exits `0`
- output contains the signals your agent will actually consume
