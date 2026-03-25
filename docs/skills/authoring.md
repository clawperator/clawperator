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

## Skill ID Rules

The scaffold command requires `skill_id` to contain at least one dot.

Why:

- the scaffold derives `applicationId` from everything before the final dot
- it derives `intent` from everything after the final dot

Example:

| Skill id | Derived `applicationId` | Derived `intent` |
| --- | --- | --- |
| `com.android.settings.capture-overview` | `com.android.settings` | `capture-overview` |

If the id has no dot, scaffolding fails with `SKILL_ID_INVALID`.

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

The scaffolded `run.sh` just forwards to `run.js`.

Current wrapper expectations:

- device id is passed as the first positional arg when the caller used `skills run --device ...`
- `CLAWPERATOR_BIN` is available in the environment
- `CLAWPERATOR_OPERATOR_PACKAGE` is available in the environment

There are no special stdout markers enforced by `runSkill.ts`. Any stdout contract beyond "raw output string" is skill-defined.

## Artifact Compilation

Current compile command:

```bash
clawperator skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
```

What `compileArtifact()` does:

1. load the registry
2. find the skill
3. resolve the artifact path
4. parse `--vars` JSON into string values
5. add deterministic `COMMAND_ID` and `TASK_ID` if they were not supplied
6. substitute `{{VAR}}` placeholders in the artifact template
7. parse the result as JSON
8. validate it as an execution payload
9. set `execution.mode = "artifact_compiled"`

Placeholder rules:

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
- use `skills compile-artifact` when a workflow should compile into deterministic execution JSON
- treat `SKILL.md` as required documentation, but do not overstate its current machine enforcement

## Related Pages

- [Skills Overview](overview.md)
- [Development Workflow](development.md)
- [Device Prep and Runtime](runtime.md)
- [Actions](../api/actions.md)
- [API Overview](../api/overview.md)
