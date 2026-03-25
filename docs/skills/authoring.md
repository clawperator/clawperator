# Authoring

## Purpose

Document the current authoring contract for local skills: scaffolded files, `SKILL.md`, run scripts, artifact compilation, and validation.

## Sources

- Scaffold implementation: `apps/node/src/domain/skills/scaffoldSkill.ts`
- Artifact compilation: `apps/node/src/domain/skills/compileArtifact.ts`
- Validation: `apps/node/src/domain/skills/validateSkill.ts`
- Runtime invocation: `apps/node/src/domain/skills/runSkill.ts`
- Runtime env resolution: `apps/node/src/domain/skills/skillsConfig.ts`
- CLI surface: `apps/node/src/cli/commands/skills.ts`

## What A New Skill Contains

`clawperator skills new <skill_id>` creates:

- `SKILL.md`
- `skill.json`
- `scripts/run.js`
- `scripts/run.sh`

and appends a new entry to the active skills registry.

The scaffold writes exact relative paths:

- `skills/<skill_id>/SKILL.md`
- `skills/<skill_id>/skill.json`
- `skills/<skill_id>/scripts/run.js`
- `skills/<skill_id>/scripts/run.sh`

It also appends this exact registry shape:

```json
{
  "id": "com.example.demo.capture-state",
  "applicationId": "com.example.demo",
  "intent": "capture-state",
  "summary": "TODO: describe com.example.demo.capture-state",
  "path": "skills/com.example.demo.capture-state",
  "skillFile": "skills/com.example.demo.capture-state/SKILL.md",
  "scripts": [
    "skills/com.example.demo.capture-state/scripts/run.js",
    "skills/com.example.demo.capture-state/scripts/run.sh"
  ],
  "artifacts": []
}
```

## Skill ID Rules

The scaffold command requires `skill_id` to contain at least one dot, and the final segment cannot be empty.

Why:

- the scaffold derives `applicationId` from everything before the final dot
- it derives `intent` from everything after the final dot

Example:

| Skill id | Derived `applicationId` | Derived `intent` |
| --- | --- | --- |
| `com.android.settings.capture-overview` | `com.android.settings` | `capture-overview` |

If the id has no dot, scaffolding fails with `SKILL_ID_INVALID`.

Exact failure shape:

```json
{
  "code": "SKILL_ID_INVALID",
  "message": "skill_id must contain at least one dot so applicationId and intent can be derived"
}
```

## `SKILL.md` Format

The current scaffold writes `SKILL.md` with YAML frontmatter:

```markdown
---
name: com.android.settings.capture-overview
description: |-
  Capture a Settings overview snapshot
---

Starter scaffold for `com.android.settings.capture-overview`.
```

The scaffold always writes the frontmatter as a YAML block scalar under `description: |-`. That matters for multi-line summaries because `indentYamlBlockScalar()` preserves embedded lines without collapsing them:

```markdown
---
name: com.example.multiline.capture
description: |-
  Line1
  Line2: has colon
  - list-looking line
  # looks like a comment
---
```

Current reality:

- the scaffold always writes `name` and `description`
- the validator does not currently parse the internals of `SKILL.md`
- validation only checks that the file exists at the path referenced by the registry

So the minimum current contract is:

- `SKILL.md` exists
- the registry entry points to it correctly

The scaffold's usage section is a starting point, not a machine-enforced schema.

## `skill.json` Contract

`skill.json` is stricter than `SKILL.md`. Validation compares its parsed fields against the registry entry.

Important current rule:

- `skill.json` metadata must match the registry entry exactly for these fields:
  - `id`
  - `applicationId`
  - `intent`
  - `summary`
  - `path`
  - `skillFile`
  - `scripts`
  - `artifacts`

If any of those differ, validation fails with `SKILL_VALIDATION_FAILED`.

Use `clawperator skills validate <skill_id> --json` to verify the file paths and metadata match:

```bash
clawperator skills validate com.example.demo.capture-state --json
```

Success response:

```json
{
  "valid": true,
  "skill": {
    "id": "com.example.demo.capture-state",
    "applicationId": "com.example.demo",
    "intent": "capture-state",
    "summary": "TODO: describe com.example.demo.capture-state",
    "path": "skills/com.example.demo.capture-state",
    "skillFile": "skills/com.example.demo.capture-state/SKILL.md",
    "scripts": [
      "skills/com.example.demo.capture-state/scripts/run.js",
      "skills/com.example.demo.capture-state/scripts/run.sh"
    ],
    "artifacts": []
  },
  "registryPath": "/abs/path/to/skills/skills-registry.json",
  "checks": {
    "skillJsonPath": "/abs/path/to/skills/com.example.demo.capture-state/skill.json",
    "skillFilePath": "/abs/path/to/skills/com.example.demo.capture-state/SKILL.md",
    "scriptPaths": [
      "/abs/path/to/skills/com.example.demo.capture-state/scripts/run.js",
      "/abs/path/to/skills/com.example.demo.capture-state/scripts/run.sh"
    ],
    "artifactPaths": []
  }
}
```

If `skill.json` drifts from the registry, validation fails with `SKILL_VALIDATION_FAILED` and names the mismatched fields:

```json
{
  "code": "SKILL_VALIDATION_FAILED",
  "message": "Skill com.example.demo.capture-state metadata does not match the registry entry",
  "details": {
    "skillJsonPath": "/abs/path/to/skills/com.example.demo.capture-state/skill.json",
    "mismatchFields": [
      "summary",
      "scripts"
    ]
  }
}
```

## Run Script Contract

Current runtime rules from `runSkill.ts`:

- the wrapper loads the registry entry
- it chooses the first `.js` script if present
- otherwise it chooses the first `.sh` script
- if neither exists, it uses the first script entry

Invocation rules:

- `.js` scripts are run with `process.execPath`
- other scripts are spawned directly
- stdout and stderr are captured separately
- success requires subprocess exit code `0`

The scaffolded `run.js` contract is:

```text
node run.js <device_id> [operator_package]
```

The scaffold writes an exact default `run.js` payload shape:

```json
{
  "commandId": "com.example.demo.capture-state-" ,
  "taskId": "com.example.demo.capture-state",
  "source": "com.example.demo.capture-state",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "close",
      "type": "close_app",
      "params": {
        "applicationId": "com.example.demo"
      }
    },
    {
      "id": "wait_close",
      "type": "sleep",
      "params": {
        "durationMs": 1500
      }
    },
    {
      "id": "open",
      "type": "open_app",
      "params": {
        "applicationId": "com.example.demo"
      }
    },
    {
      "id": "wait_open",
      "type": "sleep",
      "params": {
        "durationMs": 3000
      }
    },
    {
      "id": "snap",
      "type": "snapshot_ui"
    }
  ]
}
```

Notes on those literals:

- `taskId` is the literal `skillId`
- `commandId` is `${skillId}-${Date.now()}`
- the default `operatorPackage` fallback inside the scaffolded script is `com.clawperator.operator`
- the child `execFileSync()` timeout inside scaffolded `run.js` is `120000`

The scaffolded `run.sh` just forwards to `run.js`.

Current wrapper expectations:

- device id is passed as the first positional arg when the caller used `skills run --device ...`
- `CLAWPERATOR_BIN` is available in the environment
- `CLAWPERATOR_OPERATOR_PACKAGE` is available in the environment

There are no special stdout markers enforced by `runSkill.ts`. Any stdout contract beyond "raw output string" is skill-defined.

### Run Script Verification

Validate the registry entry first, then run the scaffolded skill through the wrapper:

```bash
clawperator skills validate com.example.demo.capture-state --dry-run --json
clawperator skills run com.example.demo.capture-state --device <device_serial> --json
```

For the run result, verify:

- `skillId` matches the registry id
- `output` contains the raw JSON emitted by the scaffolded `clawperator exec --json` call
- `exitCode` is `0`

If the script exits non-zero, `skills run` returns `SKILL_EXECUTION_FAILED` and preserves `stdout`, `stderr`, and `exitCode`.

## Artifact Compilation

Current compile command:

```bash
clawperator skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
```

What `compileArtifact()` does:

1. load the registry
2. find the skill
3. resolve the artifact path
4. parse `--vars` JSON into string values with `String(v)` coercion
5. add deterministic `COMMAND_ID` and `TASK_ID` if they were not supplied
6. substitute `{{VAR}}` placeholders in the artifact template
7. parse the result as JSON
8. validate it as an execution payload
9. set `execution.mode = "artifact_compiled"`

Placeholder rules are exact:

- every placeholder must have a non-empty value
- values are JSON-escaped before substitution
- missing vars fail with `COMPILE_VAR_MISSING`

Deterministic id rule:

- if `COMMAND_ID` and `TASK_ID` are absent, the compiler derives them from a sha256 hash of `skillId`, normalized artifact name, and sorted vars

Compile success example:

```json
{
  "execution": {
    "commandId": "cmd-1a2b3c4d5e6f",
    "taskId": "task-1a2b3c4d5e6f",
    "source": "com.android.settings.capture-overview",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      {
        "id": "snap",
        "type": "snapshot_ui"
      }
    ],
    "mode": "artifact_compiled"
  }
}
```

The generated IDs are deterministic for the tuple:

- `skillId`
- normalized artifact name with any trailing `.recipe.json` removed
- `vars` sorted by key

So `climate-status` and `climate-status.recipe.json` produce the same default `commandId` and `taskId`.

### Artifact Compilation Verification

Run the compiler with JSON output, then validate the result as a normal execution payload:

```bash
clawperator skills compile-artifact com.google.android.apps.chromecast.app.get-climate --artifact climate-status --vars '{"CLIMATE_TILE_NAME":"Master"}' --json
```

Success shape:

```json
{
  "execution": {
    "commandId": "cmd-1a2b3c4d5e6f",
    "taskId": "task-1a2b3c4d5e6f",
    "source": "com.google.android.apps.chromecast.app.get-climate",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      {
        "id": "snap",
        "type": "snapshot_ui"
      }
    ],
    "mode": "artifact_compiled"
  }
}
```

Check these exact fields:

- `execution.mode` is always set to `"artifact_compiled"` after validation succeeds
- `commandId` starts with `cmd-`
- `taskId` starts with `task-`
- the payload is valid input to `clawperator exec --validate-only`

### Artifact Compilation Error Cases

Top-level usage failure:

```json
{
  "code": "USAGE",
  "message": "skills compile-artifact requires <skill_id> (positional) or --skill-id <id>, and --artifact <name>. Example: skills compile-artifact com.example.skill --artifact climate-status [--vars '{}']"
}
```

Compile failures from `compileArtifact()` are exact:

```json
{
  "code": "ARTIFACT_NOT_FOUND",
  "message": "Artifact not found: climate-status (skill: com.google.android.apps.chromecast.app.get-climate)",
  "details": {
    "skillId": "com.google.android.apps.chromecast.app.get-climate",
    "artifactName": "climate-status"
  }
}
```

```json
{
  "code": "COMPILE_VARS_PARSE_FAILED",
  "message": "Invalid --vars JSON",
  "details": {
    "varsJson": "{bad json}"
  }
}
```

```json
{
  "code": "COMPILE_VAR_MISSING",
  "message": "Missing required variable: CLIMATE_TILE_NAME",
  "details": {
    "placeholder": "CLIMATE_TILE_NAME",
    "skillId": "com.google.android.apps.chromecast.app.get-climate",
    "artifactName": "climate-status"
  }
}
```

```json
{
  "code": "COMPILE_VALIDATION_FAILED",
  "message": "actions[0].type must be a string",
  "details": {
    "skillId": "com.google.android.apps.chromecast.app.get-climate",
    "artifactName": "climate-status"
  }
}
```

Recovery pattern:

- `ARTIFACT_NOT_FOUND`: confirm the exact artifact filename in `skill.json` and the registry entry
- `COMPILE_VARS_PARSE_FAILED`: fix the JSON string passed to `--vars`
- `COMPILE_VAR_MISSING`: provide every `{{VAR}}` placeholder with a non-empty value
- `COMPILE_VALIDATION_FAILED`: repair the compiled execution payload until `clawperator exec --validate-only` accepts it

## Validation

Current validation commands:

```bash
clawperator skills validate <skill_id> [--dry-run]
clawperator skills validate --all [--dry-run]
```

Validation checks:

- registry entry exists
- `skill.json` exists
- `SKILL.md` exists
- every listed script exists
- every listed artifact exists
- parsed `skill.json` matches the registry entry

With `--dry-run`:

- if artifacts exist, each artifact is parsed and validated as an execution payload
- if no artifacts exist, dry-run returns success with `payloadValidation: "skipped"`

Dry-run skipped example:

```json
{
  "valid": true,
  "dryRun": {
    "payloadValidation": "skipped",
    "reason": "skill has no pre-compiled artifacts; payload is generated at runtime by the skill script"
  }
}
```

If an artifact-backed skill compiles to an invalid execution shape, `skills validate --dry-run` fails before any live device run:

```json
{
  "code": "SKILL_VALIDATION_FAILED",
  "message": "Skill com.example.demo.capture-state: artifact payload schema violation",
  "details": {
    "artifact": "climate-status.recipe.json",
    "path": "actions[0]",
    "reason": "type must be a string"
  }
}
```

### Validation Verification

Use:

```bash
clawperator skills validate com.example.demo.capture-state --json
clawperator skills validate com.example.demo.capture-state --dry-run --json
clawperator skills validate --all --dry-run --json
```

Check:

- single-skill validation returns `valid: true`
- `registryPath` points at the active registry file
- `checks.skillJsonPath`, `checks.skillFilePath`, `checks.scriptPaths`, and `checks.artifactPaths` resolve to real files
- `validate --all` returns `totalSkills` and `validSkills`

## Scaffolding

Create a new skill:

```bash
clawperator skills new com.example.app.do-thing --summary "Do one deterministic workflow"
```

Success response shape:

```json
{
  "created": true,
  "skillId": "com.example.app.do-thing",
  "registryPath": "/path/to/skills-registry.json",
  "skillPath": "/path/to/skills/com.example.app.do-thing",
  "files": [
    "/path/to/skills/com.example.app.do-thing/SKILL.md",
    "/path/to/skills/com.example.app.do-thing/skill.json",
    "/path/to/skills/com.example.app.do-thing/scripts/run.js",
    "/path/to/skills/com.example.app.do-thing/scripts/run.sh"
  ]
}
```

Exact defaults and follow-up behavior:

- if `--summary` is omitted, the scaffold writes `TODO: describe <skill_id>`
- blank or whitespace-only summaries are treated as omitted
- `cmdSkillsNew()` returns `next: "Edit SKILL.md and scripts/run.js, then verify with: clawperator skills validate <skill_id>"`

### Scaffolding Error Cases

Top-level CLI usage failure:

```json
{
  "code": "USAGE",
  "message": "skills new <skill_id> [--summary <text>]"
}
```

Duplicate failures are exact:

```json
{
  "code": "SKILL_ALREADY_EXISTS",
  "message": "Skill already exists: com.android.settings.capture-overview"
}
```

```json
{
  "code": "SKILL_ALREADY_EXISTS",
  "message": "Skill directory already exists: /abs/path/to/skills/com.android.settings.capture-overview"
}
```

Registry write or filesystem write failures surface as `SKILLS_SCAFFOLD_FAILED`.

### Scaffolding Verification

Run:

```bash
clawperator skills new com.example.app.do-thing --summary "Do one deterministic workflow" --json
clawperator skills get com.example.app.do-thing --json
clawperator skills validate com.example.app.do-thing --json
```

Confirm:

- `created` is `true`
- `files` includes `SKILL.md`, `skill.json`, `scripts/run.js`, and `scripts/run.sh`
- the new registry entry appears in `skills get`
- validation succeeds without hand-editing file paths

## Blocked Terms

Repository policy reserves the local blocked-terms file at:

```text
~/.clawperator/blocked-terms.txt
```

Important boundary:

- this path is part of the repo's safety guidance and related skills docs
- the current `apps/node/src/domain/skills/*` implementation does not read or enforce blocked terms during `skills run`, `skills validate`, or `skills new`

So for authoring:

- treat blocked terms as local Git hygiene
- do not assume the Node skill runtime will reject sensitive strings automatically

## Practical Authoring Rules

- keep `skill.json` and the registry in sync
- let `skills validate --dry-run` prove artifact payloads
- use `skills new --json`, then immediately verify with `skills get --json` and `skills validate --json`
- use `skills compile-artifact` when a workflow should compile into deterministic execution JSON
- treat `SKILL.md` as required documentation, but do not overstate its current machine enforcement

## Related Pages

- [Skills Overview](overview.md)
- [Development Workflow](development.md)
- [Device Prep and Runtime](runtime.md)
- [Actions](../api/actions.md)
- [API Overview](../api/overview.md)
