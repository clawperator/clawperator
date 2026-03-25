# Skills Overview

## Purpose

Explain what Clawperator skills are, how the registry model works, how skills are discovered, and what the `skills run` wrapper actually does.

## Sources

- Registry contract: `apps/node/src/contracts/skills.ts`
- Registry loading: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- Runtime wrapper: `apps/node/src/domain/skills/runSkill.ts`
- Listing and search: `apps/node/src/domain/skills/listSkills.ts`, `apps/node/src/domain/skills/searchSkills.ts`
- CLI surface: `apps/node/src/cli/commands/skills.ts`, `apps/node/src/cli/registry.ts`
- Serve API wrapper: `apps/node/src/cli/commands/serve.ts`

## What Skills Are

Skills are deterministic wrappers around repeatable workflows.

Current role split:

- Clawperator is the execution substrate
- a skill defines a reusable wrapper or artifact
- the agent decides when to invoke the skill and how to interpret the result

Skills are registry-driven. They are not discovered by folder scanning alone.

## Skill Structure

The registry contract for one skill is:

```json
{
  "id": "com.android.settings.capture-overview",
  "applicationId": "com.android.settings",
  "intent": "capture-overview",
  "summary": "Capture a Settings overview snapshot",
  "path": "skills/com.android.settings.capture-overview",
  "skillFile": "skills/com.android.settings.capture-overview/SKILL.md",
  "scripts": [
    "skills/com.android.settings.capture-overview/scripts/run.js",
    "skills/com.android.settings.capture-overview/scripts/run.sh"
  ],
  "artifacts": [
    "skills/com.android.settings.capture-overview/artifacts/overview.recipe.json"
  ]
}
```

Meaning of the fields:

| Field | Meaning |
| --- | --- |
| `id` | canonical registry id |
| `applicationId` | app package the skill is primarily associated with |
| `intent` | short intent name derived from the id |
| `summary` | one-line description |
| `path` | skill directory relative to the skills repo root |
| `skillFile` | `SKILL.md` path |
| `scripts` | runnable script paths |
| `artifacts` | deterministic recipe payload files |

## Registry

The registry file is a JSON object with:

```json
{
  "schemaVersion": "optional string",
  "generatedAt": "optional string",
  "skills": [
    {
      "id": "com.android.settings.capture-overview",
      "applicationId": "com.android.settings",
      "intent": "capture-overview",
      "summary": "Capture a Settings overview snapshot",
      "path": "skills/com.android.settings.capture-overview",
      "skillFile": "skills/com.android.settings.capture-overview/SKILL.md",
      "scripts": [
        "skills/com.android.settings.capture-overview/scripts/run.js"
      ],
      "artifacts": []
    }
  ]
}
```

Registry resolution:

- if `CLAWPERATOR_SKILLS_REGISTRY` is set, Node uses that path
- otherwise it defaults to `skills/skills-registry.json` relative to the current working directory

## Discovery

Current discovery commands:

```bash
clawperator skills list
clawperator skills search --app <package_id>
clawperator skills search --intent <intent>
clawperator skills search --keyword <text>
clawperator skills get <skill_id>
```

### `skills list`

Success response:

```json
{
  "skills": [
    {
      "id": "com.android.settings.capture-overview",
      "applicationId": "com.android.settings",
      "intent": "capture-overview",
      "summary": "Capture a Settings overview snapshot",
      "path": "skills/com.android.settings.capture-overview",
      "skillFile": "skills/com.android.settings.capture-overview/SKILL.md",
      "scripts": [
        "skills/com.android.settings.capture-overview/scripts/run.js"
      ],
      "artifacts": []
    }
  ],
  "count": 1
}
```

### `skills search`

Search filters are exact for `--app` and `--intent`, and case-insensitive substring matching for `--keyword` against:

- `id`
- `summary`
- `applicationId`

## Execution

Current execution command:

```bash
clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [-- <extra_args>]
```

What the wrapper does:

1. resolves the CLI binary and operator package environment for the child process
2. validates the skill with `--dry-run` unless `--skip-validate` is passed
3. loads the registry entry
4. chooses a script, preferring `.js` over `.sh`
5. spawns the script
6. captures stdout and stderr
7. enforces a timeout

Argument passing rules:

- if `--device` was provided, the wrapper prepends that device id as the first script argument
- arguments after `--` are forwarded to the script unchanged
- `CLAWPERATOR_BIN` and `CLAWPERATOR_OPERATOR_PACKAGE` are injected into the script environment

Default timeout:

- `120000` milliseconds

## `skills run` Success Shape

```json
{
  "skillId": "com.android.settings.capture-overview",
  "output": "RESULT|status=success|snapshot=/tmp/settings.xml\n",
  "exitCode": 0,
  "durationMs": 15842,
  "timeoutMs": 120000
}
```

Important:

- `output` is raw stdout from the script
- the wrapper does not impose a structured stdout format on the skill itself

## `skills run` Failure Shape

```json
{
  "code": "SKILL_EXECUTION_FAILED",
  "message": "Skill com.android.settings.capture-overview exited with code 2",
  "skillId": "com.android.settings.capture-overview",
  "exitCode": 2,
  "stdout": "RESULT|status=partial|snapshot=/tmp/settings.xml\n",
  "stderr": "Timed out waiting for expected node\n",
  "timeoutMs": 120000
}
```

## Serve API Context

The local HTTP server exposes:

- `GET /skills`
- `GET /skills/:skillId`
- `POST /skills/:skillId/run`

The serve wrapper uses the same underlying registry and `runSkill()` runtime, with route-local request validation layered on top.

## Error Codes

The skills contract defines its own stable codes in `apps/node/src/contracts/skills.ts`.

Common ones:

| Code | Meaning |
| --- | --- |
| `REGISTRY_READ_FAILED` | registry file missing, unreadable, or invalid |
| `SKILL_NOT_FOUND` | requested id is not in the registry |
| `SKILL_SCRIPT_NOT_FOUND` | registry exists but the chosen script file does not |
| `SKILL_EXECUTION_FAILED` | subprocess exited non-zero or failed to spawn |
| `SKILL_EXECUTION_TIMEOUT` | wrapper timeout elapsed |
| `SKILL_OUTPUT_ASSERTION_FAILED` | `--expect-contains` was set and the output did not contain the text |

## Practical Model

- use `skills list`, `skills search`, and `skills get` to discover what is available
- use `skills run` when you want the wrapper's validation, timeout, and env injection
- use skill output as deterministic wrapper output, not as autonomous reasoning

## Related Pages

- [Authoring](authoring.md)
- [Development Workflow](development.md)
- [Device Prep and Runtime](runtime.md)
- [Environment Variables](../api/environment.md)
- [Serve API](../api/serve.md)
