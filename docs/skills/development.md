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

The code-backed defaults that shape this loop are:

- skill runtime timeout default: `120000`
- default Operator package for skill runs: `com.clawperator.operator`
- install/update sync target: `main`
- default installed skills repo: `~/.clawperator/skills`
- default installed registry path: `~/.clawperator/skills/skills/skills-registry.json`

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

Success response:

```json
{
  "created": true,
  "skillId": "com.example.app.do-thing",
  "registryPath": "/abs/path/to/skills/skills-registry.json",
  "skillPath": "/abs/path/to/skills/com.example.app.do-thing",
  "files": [
    "/abs/path/to/skills/com.example.app.do-thing/SKILL.md",
    "/abs/path/to/skills/com.example.app.do-thing/skill.json",
    "/abs/path/to/skills/com.example.app.do-thing/scripts/run.js",
    "/abs/path/to/skills/com.example.app.do-thing/scripts/run.sh"
  ],
  "next": "Edit SKILL.md and scripts/run.js, then verify with: clawperator skills validate <skill_id>"
}
```

Verification pattern:

```bash
clawperator skills new com.example.app.do-thing --summary "Do one deterministic workflow" --json
clawperator skills get com.example.app.do-thing --json
```

Confirm:

- `created` is `true`
- `files` includes all four scaffolded files
- `skills get` returns the new registry entry immediately

Common scaffold failures:

```json
{
  "code": "USAGE",
  "message": "skills new <skill_id> [--summary <text>]"
}
```

```json
{
  "code": "SKILL_ID_INVALID",
  "message": "skill_id must contain at least one dot so applicationId and intent can be derived"
}
```

```json
{
  "code": "SKILL_ALREADY_EXISTS",
  "message": "Skill already exists: com.example.app.do-thing"
}
```

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

Single-skill success response:

```json
{
  "valid": true,
  "skill": {
    "id": "com.example.app.do-thing",
    "applicationId": "com.example.app",
    "intent": "do-thing",
    "summary": "Do one deterministic workflow",
    "path": "skills/com.example.app.do-thing",
    "skillFile": "skills/com.example.app.do-thing/SKILL.md",
    "scripts": [
      "skills/com.example.app.do-thing/scripts/run.js",
      "skills/com.example.app.do-thing/scripts/run.sh"
    ],
    "artifacts": []
  },
  "registryPath": "/abs/path/to/skills/skills-registry.json",
  "dryRun": {
    "payloadValidation": "skipped",
    "reason": "skill has no pre-compiled artifacts; payload is generated at runtime by the skill script"
  },
  "checks": {
    "skillJsonPath": "/abs/path/to/skills/com.example.app.do-thing/skill.json",
    "skillFilePath": "/abs/path/to/skills/com.example.app.do-thing/SKILL.md",
    "scriptPaths": [
      "/abs/path/to/skills/com.example.app.do-thing/scripts/run.js",
      "/abs/path/to/skills/com.example.app.do-thing/scripts/run.sh"
    ],
    "artifactPaths": []
  }
}
```

All-skills success response:

```json
{
  "valid": true,
  "totalSkills": 12,
  "registryPath": "/abs/path/to/skills/skills-registry.json",
  "validSkills": [
    {
      "skill": {
        "id": "com.example.app.do-thing",
        "applicationId": "com.example.app",
        "intent": "do-thing",
        "summary": "Do one deterministic workflow",
        "path": "skills/com.example.app.do-thing",
        "skillFile": "skills/com.example.app.do-thing/SKILL.md",
        "scripts": [
          "skills/com.example.app.do-thing/scripts/run.js",
          "skills/com.example.app.do-thing/scripts/run.sh"
        ],
        "artifacts": []
      },
      "checks": {
        "skillJsonPath": "/abs/path/to/skills/com.example.app.do-thing/skill.json",
        "skillFilePath": "/abs/path/to/skills/com.example.app.do-thing/SKILL.md",
        "scriptPaths": [
          "/abs/path/to/skills/com.example.app.do-thing/scripts/run.js",
          "/abs/path/to/skills/com.example.app.do-thing/scripts/run.sh"
        ],
        "artifactPaths": []
      }
    }
  ]
}
```

Verification pattern:

```bash
clawperator skills validate com.example.app.do-thing --dry-run --json
clawperator skills validate --all --dry-run --json
```

Check:

- `valid` is `true`
- `registryPath` is the registry you intended to validate
- `checks.scriptPaths` and `checks.artifactPaths` point at files that actually exist

Common validation failures:

```json
{
  "code": "USAGE",
  "message": "skills validate <skill_id> [--dry-run] | skills validate --all [--dry-run]"
}
```

```json
{
  "code": "SKILL_VALIDATION_FAILED",
  "message": "Skill com.example.app.do-thing is missing required files",
  "details": {
    "skillJsonPath": "/abs/path/to/skills/com.example.app.do-thing/skill.json",
    "missingFiles": [
      "/abs/path/to/skills/com.example.app.do-thing/scripts/run.js"
    ]
  }
}
```

```json
{
  "code": "SKILL_VALIDATION_FAILED",
  "message": "1 of 12 registered skills failed validation",
  "registryPath": "/abs/path/to/skills/skills-registry.json",
  "details": {
    "totalSkills": 12,
    "validCount": 11,
    "invalidCount": 1,
    "failures": [
      {
        "skillId": "com.example.app.do-thing",
        "code": "SKILL_VALIDATION_FAILED",
        "message": "Skill com.example.app.do-thing metadata does not match the registry entry"
      }
    ]
  }
}
```

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

Exact wrapper rules to keep in mind:

- `--device <serial>` is prepended to the script arguments only when provided
- the skill wrapper injects `CLAWPERATOR_BIN` and `CLAWPERATOR_OPERATOR_PACKAGE` into the child environment
- `.js` scripts run with `process.execPath`
- the wrapper chooses `.js` first, then `.sh`, then the first listed script
- JSON mode suppresses the pretty banner so stdout stays machine-readable
- `--timeout` and `--timeout-ms` are accepted timeout flags for the wrapper

Verification pattern:

```bash
clawperator skills run com.example.app.do-thing --device <device_serial> --operator-package com.clawperator.operator.dev --timeout 90000 --json
```

First-time agent pitfall:

- pretty mode streams live output and prints a banner first
- JSON mode returns one parseable wrapper object with the child stdout captured under `output`

## Step 4: Verify Output

Current wrapper success data:

```json
{
  "skillId": "com.example.app.do-thing",
  "output": "RESULT|status=success\n",
  "exitCode": 0,
  "durationMs": 8421,
  "timeoutMs": 90000
}
```

Current wrapper failure data can include partial output:

```json
{
  "code": "SKILL_EXECUTION_FAILED",
  "message": "Skill com.example.app.do-thing exited with code 1",
  "skillId": "com.example.app.do-thing",
  "exitCode": 1,
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

Additional execution failures to expect:

```json
{
  "code": "SKILL_EXECUTION_TIMEOUT",
  "message": "Skill com.example.app.do-thing timed out after 90000ms",
  "skillId": "com.example.app.do-thing",
  "stdout": "{\"stage\":\"before-timeout\"}\n"
}
```

```json
{
  "code": "SKILL_SCRIPT_NOT_FOUND",
  "message": "Script not found: /abs/path/to/skills/com.example.app.do-thing/scripts/run.js",
  "skillId": "com.example.app.do-thing"
}
```

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

Assertion failure shape:

```json
{
  "code": "SKILL_OUTPUT_ASSERTION_FAILED",
  "message": "Skill com.example.app.do-thing output did not include expected text",
  "skillId": "com.example.app.do-thing",
  "output": "RESULT|status=success\n",
  "expectedSubstring": "missing-value"
}
```

Verification pattern:

```bash
clawperator skills run com.example.app.do-thing --device <device_serial> --expect-contains RESULT --json
```

Check that:

- `expectedSubstring` is echoed back in the success payload
- `output` still contains the raw skill stdout, not a transformed assertion result

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

Verification pattern:

- send `POST /skills/:skillId/run` with `deviceId`, `args`, `timeoutMs`, and `expectContains`
- success response shape is:

```json
{
  "ok": true,
  "skillId": "com.example.app.do-thing",
  "output": "RESULT|status=success\n",
  "exitCode": 0,
  "durationMs": 8421,
  "timeoutMs": 90000,
  "expectedSubstring": "RESULT"
}
```

- failure response shape is:

```json
{
  "ok": false,
  "error": {
    "code": "SKILL_EXECUTION_FAILED",
    "message": "Skill com.example.app.do-thing exited with code 1",
    "skillId": "com.example.app.do-thing",
    "exitCode": 1,
    "stdout": "RESULT|status=partial\n",
    "stderr": "Expected node not found\n"
  }
}
```

- unlike CLI `skills run`, this route calls `runSkill()` directly
- it does not run the CLI pre-validation gate from `cmdSkillsRun()`
- it does not inject the CLI wrapper banner
- handle `error.code` values such as `SKILL_OUTPUT_ASSERTION_FAILED`, `SKILL_EXECUTION_FAILED`, and `SKILL_EXECUTION_TIMEOUT` through the nested `error` object, not as the top-level response object

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

Exact success shapes:

`skills install --json`:

```json
{
  "synced": true,
  "message": "Skills synced to /Users/<local_user>/.clawperator/skills (ref: main)",
  "registryPath": "/Users/<local_user>/.clawperator/skills/skills/skills-registry.json",
  "envInstruction": "export CLAWPERATOR_SKILLS_REGISTRY=\"/Users/<local_user>/.clawperator/skills/skills/skills-registry.json\""
}
```

`skills update --json` and `skills sync --ref <git-ref> --json`:

```json
{
  "synced": true,
  "message": "Skills synced to /Users/<local_user>/.clawperator/skills (ref: main)"
}
```

Verification pattern:

```bash
clawperator skills install --json
clawperator skills update --json
clawperator skills sync --ref main --json
```

Check:

- `synced` is `true`
- `registryPath` from `skills install` ends with `~/.clawperator/skills/skills/skills-registry.json`
- after install, exporting `envInstruction` makes `skills list --json` succeed in a fresh shell

Common sync failures:

```json
{
  "code": "USAGE",
  "message": "skills sync --ref <git-ref>"
}
```

```json
{
  "code": "SKILLS_GIT_NOT_FOUND",
  "message": "git is not installed or not on PATH. Install git to use skills install/update."
}
```

```json
{
  "code": "SKILLS_SYNC_FAILED",
  "message": "Registry file not found or unreadable after sync: ENOENT: no such file or directory, open '/Users/<local_user>/.clawperator/skills/skills/skills-registry.json'. Expected at /Users/<local_user>/.clawperator/skills/skills/skills-registry.json"
}
```

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

### `EXECUTION_VALIDATION_FAILED`

Cause:

- `--timeout` or `--timeout-ms` was present but not finite

Exact failure:

```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "timeoutMs must be a finite number"
}
```

Fix:

- pass an actual number such as `--timeout 90000`

### `USAGE`

Cause:

- a required argument was omitted
- a value-taking flag such as `--timeout-ms` or `--expect-contains` was missing its value

Fix:

- rerun with the exact command shape shown in the error message

## Recommended Local Loop

```bash
clawperator skills new com.example.app.do-thing --summary "Describe it"
clawperator skills validate com.example.app.do-thing --dry-run
clawperator skills run com.example.app.do-thing --device <device_serial> --operator-package com.clawperator.operator.dev --json
clawperator skills run com.example.app.do-thing --device <device_serial> --expect-contains RESULT --json
```

Repeat until:

- validation passes
- wrapper exits `0`
- output contains the signals your agent will actually consume

## Related Pages

- [Skills Overview](overview.md)
- [Authoring](authoring.md)
- [Device Prep and Runtime](runtime.md)
- [Setup](../setup.md)
- [Serve API](../api/serve.md)
