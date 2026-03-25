# Skills Overview

## Purpose

Explain what Clawperator skills are, how the registry model works, how skills are discovered, and what the `clawperator skills` wrapper actually does.

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

Skills are registry-driven. They are not discovered by folder scanning alone. `clawperator skills list`, `clawperator skills search`, `clawperator skills get`, `clawperator skills validate`, and `clawperator skills run` all read the registry through `loadRegistry()` in `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`.

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

Registry resolution is exact:

- if `CLAWPERATOR_SKILLS_REGISTRY` is set and non-empty, Node uses that literal path
- otherwise it first reads `skills/skills-registry.json` relative to the current working directory
- if the caller passed an explicit `registryPath` and that file is missing, `loadRegistry()` also tries `../../skills/skills-registry.json` relative to the current working directory

The install and sync flow writes the canonical long-lived registry under:

- `~/.clawperator/skills/skills/skills-registry.json`

That path is assembled from these literals in `apps/node/src/domain/skills/skillsConfig.ts`:

- `DEFAULT_SKILLS_DIR = ~/.clawperator/skills`
- `DEFAULT_SKILLS_REGISTRY_SUBPATH = skills/skills-registry.json`
- `SKILLS_REPO_URL = https://github.com/clawperator/clawperator-skills`

## Registry Verification

Use `skills list --json` to confirm that the registry path in your current shell is readable:

```bash
clawperator skills list --json
```

Success means the registry was loaded and the `skills` array was parsed:

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

If the registry cannot be read, every discovery command fails with `REGISTRY_READ_FAILED`:

```json
{
  "code": "REGISTRY_READ_FAILED",
  "message": "Registry not found at configured path: /tmp/missing-registry.json. Update CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."
}
```

Recovery depends on how the path was chosen:

- when `CLAWPERATOR_SKILLS_REGISTRY` points at a missing file, update the env var or run `clawperator skills install`
- when no env var is set and the current working directory does not contain `skills/skills-registry.json`, run from the expected repo root or set `CLAWPERATOR_SKILLS_REGISTRY`
- when the registry file exists but does not contain a `skills` array, fix the JSON because `loadRegistry()` rejects that shape with `Invalid registry: skills array required`

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

`cmdSkillsList()` returns the raw registry entries plus a computed `count`:

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

`skills search` success uses the same response shape as `skills list`:

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

### `skills get`

`cmdSkillsGet()` wraps a single registry entry under `skill`:

```bash
clawperator skills get com.android.settings.capture-overview --json
```

```json
{
  "skill": {
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
}
```

### Discovery Verification

Use these commands to verify the three core discovery paths:

```bash
clawperator skills list --json
clawperator skills search --app com.android.settings --json
clawperator skills get com.android.settings.capture-overview --json
```

Check these exact fields:

- `count` matches the number of returned entries for `list` and `search`
- every result entry includes `id`, `applicationId`, `intent`, `path`, `skillFile`, `scripts`, and `artifacts`
- `skills get` returns a top-level `skill` object, not a `skills` array

### Discovery Error Cases

Top-level usage and lookup failures are exact:

```json
{
  "code": "USAGE",
  "message": "skills get <skill_id>"
}
```

```json
{
  "code": "USAGE",
  "message": "skills search requires --app <package_id>, --intent <intent>, or --keyword <text>",
  "example": "clawperator skills search --keyword solax"
}
```

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: com.android.settings.capture-overview"
}
```

`SKILL_NOT_FOUND` comes from `getSkill()` in `apps/node/src/domain/skills/getSkill.ts`. `REGISTRY_READ_FAILED` comes from the shared registry loader and can appear on `list`, `search`, and `get`.

## Execution

Current execution command:

```bash
clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [-- <extra_args>]
```

What the wrapper does:

1. resolves `CLAWPERATOR_BIN` for the child process
2. resolves `CLAWPERATOR_OPERATOR_PACKAGE` for the child process
3. validates the skill with `validateSkill(skillId, undefined, { dryRun: true })` unless `--skip-validate` is passed
4. loads the registry entry
5. chooses a script, preferring `.js`, then `.sh`, then the first listed script
6. spawns the script
7. captures raw stdout and stderr
8. enforces a timeout

Argument passing rules:

- if `--device` was provided, the wrapper prepends that device id as the first script argument
- arguments after `--` are forwarded to the script unchanged
- `CLAWPERATOR_BIN` and `CLAWPERATOR_OPERATOR_PACKAGE` are injected into the script environment
- in JSON mode, the wrapper suppresses the pretty banner so stdout stays parseable JSON

Default execution values are exact:

- `DEFAULT_TIMEOUT_MS = 120000`
- `DEFAULT_OPERATOR_PACKAGE = com.clawperator.operator`
- `CLAWPERATOR_BIN` resolution order is:
  1. non-empty `CLAWPERATOR_BIN`
  2. branch-local sibling build at `apps/node/dist/cli/index.js`
  3. global `clawperator` binary

### `skills run` Verification

Use a JSON run first so you can verify the wrapper envelope separately from the skill's own stdout contract:

```bash
clawperator skills run com.android.settings.capture-overview --timeout 3210 --json
```

Success response:

```json
{
  "skillId": "com.android.settings.capture-overview",
  "output": "RESULT|status=success|snapshot=/tmp/settings.xml\n",
  "exitCode": 0,
  "durationMs": 15842,
  "timeoutMs": 3210
}
```

Check these exact fields:

- `skillId` matches the requested registry id
- `output` is the raw stdout stream captured from the skill script
- `exitCode` is `0` on success
- `durationMs` is the measured wrapper runtime
- `timeoutMs` is present only when a timeout override was passed on the CLI

To verify wrapper-side output assertions, run:

```bash
clawperator skills run com.android.settings.capture-overview --expect-contains RESULT --json
```

If the expected text is present, the success payload echoes the assertion:

```json
{
  "skillId": "com.android.settings.capture-overview",
  "output": "RESULT|status=success|snapshot=/tmp/settings.xml\n",
  "exitCode": 0,
  "durationMs": 15842,
  "expectedSubstring": "RESULT"
}
```

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
- progress lines written by the skill to stdout remain inside `output` in JSON mode
- pretty mode writes a banner before streaming live skill output, so use `--json` when another agent needs machine-readable output

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

Other wrapper failures are distinct and worth handling separately:

```json
{
  "code": "SKILL_EXECUTION_TIMEOUT",
  "message": "Skill com.android.settings.capture-overview timed out after 150ms",
  "skillId": "com.android.settings.capture-overview",
  "stdout": "{\"stage\":\"before-timeout\"}\n"
}
```

```json
{
  "code": "SKILL_OUTPUT_ASSERTION_FAILED",
  "message": "Skill com.android.settings.capture-overview output did not include expected text",
  "skillId": "com.android.settings.capture-overview",
  "output": "RESULT|status=success|snapshot=/tmp/settings.xml\n",
  "expectedSubstring": "missing-value"
}
```

```json
{
  "code": "SKILL_SCRIPT_NOT_FOUND",
  "message": "Script not found: /abs/path/to/skills/com.android.settings.capture-overview/scripts/run.js",
  "skillId": "com.android.settings.capture-overview"
}
```

### `skills run` Error Cases

There are three layers of failure to expect:

1. CLI usage and option parsing
2. validation gate failure before the skill starts
3. wrapper execution failure after the child process is spawned

Exact CLI parsing failures include:

```json
{
  "code": "USAGE",
  "message": "--timeout-ms requires a value"
}
```

```json
{
  "code": "USAGE",
  "message": "--expect-contains requires a value"
}
```

```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "timeoutMs must be a finite number"
}
```

The pre-run validation gate can stop the command before script execution. `cmdSkillsRun()` calls `validateSkill(..., { dryRun: true })` unless `--skip-validate` is present. That gate fails with `SKILL_VALIDATION_FAILED` when required files or artifact payloads are wrong:

```json
{
  "code": "SKILL_VALIDATION_FAILED",
  "message": "Skill com.android.settings.capture-overview is missing required files",
  "details": {
    "skillJsonPath": "/abs/path/to/skills/com.android.settings.capture-overview/skill.json",
    "missingFiles": [
      "/abs/path/to/skills/com.android.settings.capture-overview/scripts/run.js"
    ]
  }
}
```

For script-only skills, dry-run payload validation is skipped on purpose. The success payload from `skills validate --dry-run` includes:

```json
{
  "valid": true,
  "dryRun": {
    "payloadValidation": "skipped",
    "reason": "skill has no pre-compiled artifacts; payload is generated at runtime by the skill script"
  }
}
```

Recovery depends on the error code:

- `REGISTRY_READ_FAILED`: fix `CLAWPERATOR_SKILLS_REGISTRY`, run from the correct working directory, or reinstall the skills repo
- `SKILL_NOT_FOUND`: confirm the exact `id` with `skills list --json` or `skills search --json`
- `SKILL_VALIDATION_FAILED`: repair missing files, mismatched `skill.json` metadata, or invalid artifact payloads before rerunning
- `SKILL_SCRIPT_NOT_FOUND`: fix the registry entry or restore the script on disk
- `SKILL_EXECUTION_FAILED`: inspect `stdout`, `stderr`, and the skill script's exit code
- `SKILL_EXECUTION_TIMEOUT`: raise `--timeout` only after confirming the skill is still making progress
- `SKILL_OUTPUT_ASSERTION_FAILED`: verify the expected substring against the raw `output`

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
| `SKILL_VALIDATION_FAILED` | pre-run validation found missing files, mismatched metadata, or invalid artifacts |
| `SKILL_SCRIPT_NOT_FOUND` | registry exists but the chosen script file does not |
| `SKILL_EXECUTION_FAILED` | subprocess exited non-zero or failed to spawn |
| `SKILL_EXECUTION_TIMEOUT` | wrapper timeout elapsed |
| `SKILL_OUTPUT_ASSERTION_FAILED` | `--expect-contains` was set and the output did not contain the text |

## Practical Model

- use `skills list`, `skills search`, and `skills get` to discover what is available
- use `skills validate --dry-run` when you want to confirm registry integrity before a live run
- use `skills run` when you want the wrapper's validation gate, timeout, env injection, and JSON envelope
- use skill output as deterministic wrapper output, not as autonomous reasoning

## Related Pages

- [Authoring](authoring.md)
- [Development Workflow](development.md)
- [Device Prep and Runtime](runtime.md)
- [Environment Variables](../api/environment.md)
- [Serve API](../api/serve.md)
