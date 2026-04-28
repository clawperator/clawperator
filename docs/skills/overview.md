# Skills Overview

## Purpose

Explain what Clawperator skills are, how the registry model works, how skills are discovered, and what the `clawperator skills` wrapper actually does.

For the post-install decision of when to start with `clawperator skills`
instead of MCP or direct CLI automation, read
[Host Agent Orientation](../host-agents.md) first. This page is the detailed
runtime-skills contract.

## Sources

- Registry contract: `apps/node/src/contracts/skills.ts`
- Registry loading: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- Runtime wrapper: `apps/node/src/domain/skills/runSkill.ts`
- Listing and search: `apps/node/src/domain/skills/listSkills.ts`, `apps/node/src/domain/skills/searchSkills.ts`
- CLI surface: `apps/node/src/cli/commands/skills.ts`, `apps/node/src/cli/registry.ts`
- Installer outputs: [`install.sh`](https://github.com/clawperator/clawperator/blob/main/sites/landing/public/install.sh)
- Serve API wrapper: `apps/node/src/cli/commands/serve.ts`

## What Skills Are

Skills are deterministic wrappers around repeatable workflows.

Current role split:

- Clawperator is the execution substrate
- a skill defines a reusable wrapper or artifact
- the agent decides when to invoke the skill and how to interpret the result

Skills are registry-driven. They are not discovered by folder scanning alone. `clawperator skills list`, `clawperator skills for-app`, `clawperator skills search`, `clawperator skills get`, `clawperator skills validate`, and `clawperator skills run` all read the registry through `loadRegistry()` in `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`.

`clawperator skills` and `skills-registry.json` cover runtime skills only.
Authoring skills are a separate category of AI agent programs that live in
`.agents/skills/` in source form and install separately into
`~/.clawperator/bundled-skills/` plus host-agent discovery directories. Claude
Code and Codex receive symlinks into the canonical store. Generic agents
receive managed real directory copies under `~/.agents/skills/`.

Installer-facing discovery is deliberately split:

- `~/.clawperator/AGENTS.md` is the installer-written local guide for runtime skills
- if `~/.agents/AGENTS.md` already exists, the installer appends one bounded Clawperator bridge there that points back to `~/.clawperator/AGENTS.md` and the `clawperator skills` discovery commands
- the installer does not mirror runtime skills into shared agent skill directories such as `~/.agents/skills/`, `~/.claude/skills/`, or `~/.codex/skills/`

## Skill Categories

Current authoring practice recognizes two categories of skills:

- `-replay` skills:
  - recording-derived or replay-oriented wrappers
  - optimized for deterministic path execution on a known UI flow
  - may rely on tighter device or layout assumptions
- `-orchestrated` skills:
  - agent-controlled skills intended to better match the Clawperator brain/hand model
  - may declare an `agent` block in `skill.json`
  - run through their `scripts/run.js` harness, which spawns the configured agent CLI
  - can emit structured `SkillResult` frames with checkpoints and terminal verification that `runSkill` parses and returns

Important current caveats:

- the `-replay` / `-orchestrated` suffix split is still primarily a naming and authoring convention, not a dedicated registry enum
- runtime behavior for orchestrated skills is currently driven by the presence of `skill.json.agent`, not by suffix inspection alone
- the currently supported orchestrated runtime path uses `codex` as the agent CLI
- some orchestrated harnesses currently run codex with `danger-full-access` so the runtime agent can reach live adb targets, but that is a harness-specific choice rather than a Node runtime guarantee
- suffixes identify the intended runtime shape when present
- an unsuffixed id should not be read as proof that a skill is orchestrated

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

Orchestrated skills may also include an `agent` block in `skill.json`:

```json
{
  "agent": {
    "cli": "codex",
    "timeoutMs": 300000
  }
}
```

Current behavior:

- `runSkill()` detects agent-driven orchestrated skills from `skill.json.agent`
- `runSkill()` validates agent CLI availability before spawn and returns `SKILL_AGENT_CLI_UNAVAILABLE` when it is missing
- `runSkill()` executes the skill's `scripts/run.js` harness
- the harness is responsible for spawning the configured agent CLI on `SKILL.md`
- framed `SkillResult` output must omit `source`; `runSkill()` injects trusted source metadata from `skill.json.agent`

## Orchestrated Runtime Contract

An orchestrated skill is an agent-driven runtime shape with these durable rules:

- `skill.json.agent` is the trusted runtime metadata. It names the agent CLI and timeout policy that `runSkill()` enforces.
- registry parity validation does not police `skill.json.agent`. The registry covers distributable skill identity and file layout, while `skill.json.agent` remains the trusted runtime execution config that `runSkill()` reads directly.
- `SKILL.md` is the skill authority. It contains the app-specific runtime program, navigation policy, checkpoints, and terminal verification expectations.
- `scripts/run.js` is a thin harness. It reads the injected Clawperator env vars, spawns the configured agent CLI on `SKILL.md`, and forwards stdout and stderr.
- the harness must not absorb the real skill logic. If app-specific decision policy, navigation authority, or terminal verification rules move into the harness, the skill has left this contract.
- `runSkill()` remains the Clawperator-owned boundary. It validates the skill, injects runtime env vars, executes the harness, parses the framed result, and injects trusted `source` metadata.
- orchestrated output is contract-bound. The runtime agent must emit exactly one terminal `[Clawperator-Skill-Result]` frame with a valid `SkillResult` object.
- replay skills remain first-class. Orchestrated skills are an additional runtime shape, not a replacement for replay-driven skills.

For the practical authoring rules that keep orchestrated skills debuggable and
truthful in real device runs, see
[Authoring](authoring.md#authoring-agent-driven-orchestrated-skills).

Current implementation notes:

- the currently supported orchestrated runtime path uses `codex` as the agent CLI
- some orchestrated harnesses currently run codex with `danger-full-access` so the runtime agent can reach live adb targets, but that is a harness-specific choice rather than a Node runtime guarantee

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

Registry resolution precedence is:

1. explicit `registryPath` argument, when a caller supplied one
2. `CLAWPERATOR_SKILLS_REGISTRY`, when it is set and non-blank
3. default path `skills/skills-registry.json` relative to the current working directory

Current failure and fallback rules:

- if an explicit `registryPath` argument is passed and that path cannot be read, `loadRegistry()` fails immediately and does not fall back
- if `CLAWPERATOR_SKILLS_REGISTRY` is set but blank, `loadRegistry()` fails immediately and does not fall back
- if `CLAWPERATOR_SKILLS_REGISTRY` is set to a non-blank path and that read fails, `loadRegistry()` fails immediately and does not fall back
- if neither an explicit path nor env var is active and the default-path read fails, `loadRegistry()` next tries:
  - `../../skills/skills-registry.json` relative to the current working directory when running from `apps/node`
  - `~/.clawperator/skills/skills/skills-registry.json`

The install and sync flow writes the canonical long-lived registry under:

- `~/.clawperator/skills/skills/skills-registry.json`

That path is assembled from these literals in `apps/node/src/domain/skills/skillsConfig.ts`:

- `DEFAULT_SKILLS_DIR = ~/.clawperator/skills`
- `DEFAULT_SKILLS_REGISTRY_SUBPATH = skills/skills-registry.json`
- `SKILLS_REPO_URL = https://github.com/clawperator/clawperator-skills`

## Registry Verification

Use `skills list` to confirm that the registry path in your current shell is readable:

- after `install.sh`, this works in a fresh non-login shell because `loadRegistry()` falls back to `~/.clawperator/skills/skills/skills-registry.json` when no explicit registry path or env var is active

```bash
clawperator skills list
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
- when no env var is set and neither the current working directory nor `~/.clawperator/skills/skills/skills-registry.json` contains the registry, verify `~/.clawperator/skills/skills/skills-registry.json`, run `clawperator skills list`, then run `clawperator skills install` or set `CLAWPERATOR_SKILLS_REGISTRY`
- when the registry file exists but does not contain a `skills` array, fix the JSON because `loadRegistry()` rejects that shape with `Invalid registry: skills array required`

Wrapper failure fields like `stdout` and `stderr` are optional. `runSkill.ts` includes them only when the child process actually emitted non-empty data on those streams.

## Discovery

If you are starting from a fresh install, the shortest discovery flow is:

```bash
clawperator skills for-app <package_id>
clawperator skills search --keyword <text>
clawperator skills get <skill_id>
clawperator skills run <skill_id>
```

Start with `skills for-app` when you know the Android package id. Use
`skills search --keyword` when you only have app names or user-language intent
terms.

Current discovery commands:

```bash
clawperator skills list
clawperator skills for-app <package_id>
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

Search filters are exact for `--app` and `--intent`.

`--keyword` matching is case-insensitive and deterministic. Current ranking order is:

1. exact `keywords[]` entry match
2. tokenized `keywords[]` match
3. exact `id` or `applicationId` match
4. tokenized `id` or `applicationId` match
5. substring in `keywords[]`
6. substring in `id` or `applicationId`
7. substring in `summary`

Equal-ranked results keep their original registry order.

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

### `skills for-app`

`cmdSkillsForApp()` is a thin discovery alias over `skills search --app <package_id>`.

Use `skills for-app` when you already know the Android package id and want the shortest answer to "what can this host do for this app?" Use `skills search --keyword` when you only have user-language terms such as app names or intents.

Example:

```bash
clawperator skills for-app com.android.settings
```

It returns the same response shape as `skills search --app ...`.

### `skills get`

`cmdSkillsGet()` wraps a single registry entry under `skill`:

```bash
clawperator skills get com.android.settings.capture-overview
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
clawperator skills list
clawperator skills for-app com.android.settings
clawperator skills search --app com.android.settings
clawperator skills get com.android.settings.capture-overview
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
clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--timeout-ms <ms>] [--expect-contains <text>] [--skip-validate] [skill_args...]
```

What the wrapper does:

1. resolves `CLAWPERATOR_BIN` for the child process
2. resolves `CLAWPERATOR_OPERATOR_PACKAGE` for the child process
3. validates the skill with `validateSkill(skillId, undefined, { dryRun: true })` unless `--skip-validate` is passed
4. resolves the target device and probes interactive state
5. loads the registry entry
6. chooses a script, preferring `.js`, then `.sh`, then the first listed script
7. spawns the script
8. captures raw stdout and stderr
9. enforces a timeout

Argument passing rules:

- if `--device` was provided, the wrapper passes that explicit device id through `CLAWPERATOR_DEVICE_ID`, and `runSkill()` prepends it as the first script argument for script-driven skills
- if `--device` was omitted, the wrapper still may resolve a single connected device for preflight, but it does not inject that implicit device selection into the child env or argv, and inherited ambient `CLAWPERATOR_DEVICE_ID` is cleared for the child process
- unknown trailing tokens such as `--limit 40` are forwarded to the script unchanged
- use `--` when you need to force literal passthrough for tokens that would otherwise be parsed as wrapper flags
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
clawperator skills run com.android.settings.capture-overview --timeout 3210
```

Success response:

```json
{
  "skillResult": {
    "result": { "kind": "text", "text": "ok" },
    "status": "success",
    "contractVersion": "1.0.0",
    "skillId": "com.android.settings.capture-overview",
    "checkpoints": [],
    "source": { "kind": "script" }
  },
  "durationMs": 15842,
  "timeoutMs": 3210
}
```

Default JSON **omits** top-level `status`, `skillId`, `exitCode`, and `output`
on success. Verify `skillResult` and especially **`skillResult.result`**.

Check these exact fields:

- `skillResult.skillId` matches the requested registry id
- `skillResult.result` is the domain answer
- `skillResult.status` is the child-authored skill state
- `durationMs` is the measured wrapper runtime
- `timeoutMs` is present only when a timeout override was passed on the CLI

To verify the wrapper-side readiness gate, run against a sleeping or locked device:

```bash
clawperator skills run com.android.settings.capture-overview --device <device_serial>
```

Expected pre-spawn failure shape:

```json
{
  "code": "DEVICE_NOT_INTERACTIVE",
  "message": "Device is not interactive. Interactive automation requires an awake, usable device state."
}
```

To verify wrapper-side output assertions, run:

```bash
clawperator skills run com.android.settings.capture-overview --expect-contains RESULT
```

If the expected text is present, the success payload echoes the assertion:

```json
{
  "skillResult": {
    "result": { "kind": "text", "text": "ok" },
    "status": "success",
    "contractVersion": "1.0.0",
    "skillId": "com.android.settings.capture-overview",
    "checkpoints": [],
    "source": { "kind": "script" }
  },
  "durationMs": 15842,
  "expectedSubstring": "RESULT"
}
```

## `skills run` Success Shape

**Success (default JSON):** the answer is `skillResult.result`. Top-level
`status`, `skillId`, `exitCode`, and `output` are **omitted** so agents do not
scrape duplicate process text. See
[Device Prep and Runtime](runtime.md#skill-result-trust-order-and-json-wrapper-policy).

```json
{
  "skillResult": {
    "result": { "kind": "text", "text": "ok" },
    "status": "success",
    "contractVersion": "1.0.0",
    "skillId": "com.example.app.skill",
    "checkpoints": [],
    "source": { "kind": "script" }
  },
  "durationMs": 15842
}
```

Important:

- read **`skillResult.result`** for the domain return value; do not use
  `diagnostics`, `terminalVerification`, or checkpoint-only evidence as the only
  answer path
- the wrapper parses the terminal `SkillResult` frame and returns it as `skillResult`
- the top-level wrapper `status` is omitted for default JSON success and
  present on failure or indeterminate paths (see [runtime.md](runtime.md))
- when a declared verification contract is not proved, the wrapper returns
  `status: "indeterminate"` without rewriting the emitted `skillResult`
- default JSON success omits `output` because the structured `skillResult` is
  authoritative
- pretty mode still streams human-readable output; use default JSON for machine
  consumption
- in JSON mode, the wrapper returns one JSON object and does not stream live child stdout separately
- `timeoutMs` is present only when the caller passed `--timeout` or `--timeout-ms`
- `expectedSubstring` is present only when the caller passed `--expect-contains`

## `skills run` Indeterminate Shape

**Indeterminate (default JSON):** keep wrapper `status`, `code`, and `message`;
**omit** top-level `skillId`, `exitCode`, and `output`.

```json
{
  "status": "indeterminate",
  "code": "SKILL_VERIFICATION_INDETERMINATE",
  "message": "Declared verification was not proved.",
  "skillResult": {
    "result": { "kind": "json", "value": { "note": "example" } },
    "status": "success",
    "contractVersion": "1.0.0",
    "skillId": "com.android.settings.capture-overview",
    "checkpoints": [],
    "source": { "kind": "script" }
  },
  "durationMs": 15842
}
```

## `skills run` Failure Shape

```json
{
  "status": "failed",
  "code": "SKILL_EXECUTION_FAILED",
  "message": "Skill com.android.settings.capture-overview exited with code 2",
  "skillId": "com.android.settings.capture-overview",
  "exitCode": 2,
  "stdout": "RESULT|status=partial|snapshot=/tmp/settings.xml\n",
  "stderr": "Timed out waiting for expected node\n",
  "skillResult": null
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
  "skillResult": null,
  "expectedSubstring": "missing-value"
}
```

```json
{
  "code": "SKILL_RESULT_PARSE_FAILED",
  "message": "SkillResult frame contained invalid JSON: ...",
  "skillId": "com.android.settings.capture-overview",
  "stdout": "[Clawperator-Skill-Result]\n{not-json\n",
  "skillResult": null
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

The readiness gate can also stop the command before script execution when the
resolved device is not interactive:

```json
{
  "code": "DEVICE_NOT_INTERACTIVE",
  "message": "Device is not interactive. Interactive automation requires an awake, usable device state."
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
- `SKILL_NOT_FOUND`: confirm the exact `id` with `skills list` or `skills search`
- `SKILL_VALIDATION_FAILED`: repair missing files, mismatched `skill.json` metadata, or invalid artifact payloads before rerunning
- `SKILL_SCRIPT_NOT_FOUND`: fix the registry entry or restore the script on disk
- `SKILL_EXECUTION_FAILED`: inspect `stdout`, `stderr`, and the skill script's exit code
- `SKILL_EXECUTION_TIMEOUT`: raise `--timeout` only after confirming the skill is still making progress
- `SKILL_OUTPUT_ASSERTION_FAILED`: verify the expected substring against the raw `output`
- `SKILL_RESULT_PARSE_FAILED`: fix malformed framed output or trusted-provenance metadata before rerunning

## Serve API Context

The local HTTP server exposes:

- `GET /skills`
- `GET /skills/:skillId`
- `POST /skills/:skillId/run`

The serve wrapper uses the same underlying registry and `runSkill()` runtime, with route-local request validation layered on top.

Important boundary:

- the serve route validates the skill, resolves `operatorPackage`, and after the requested Operator package check passes it uses the same bounded pre-spawn readiness preparation as `skills run`
- when the screen is off, that preparation may wake the device before the skill process is spawned
- it still fails with `DEVICE_NOT_INTERACTIVE` for awake-but-locked or post-boot-locked states
- it does not go through the full CLI `cmdSkillsRun()` path, so it still does not include the CLI banner behavior
- serve accepts optional request fields:
  - `deviceId`
  - `operatorPackage`
  - `args`
  - `timeoutMs`
  - `expectContains`

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
| `SKILL_AGENT_CLI_UNAVAILABLE` | orchestrated skill declared `agent.cli` but the configured agent CLI could not be resolved |
| `SKILL_OUTPUT_ASSERTION_FAILED` | `--expect-contains` was set and the output did not contain the text |
| `SKILL_RESULT_PARSE_FAILED` | a framed `SkillResult` was malformed or could not be trusted |

## Practical Model

- use `skills list`, `skills search`, and `skills get` to discover what is available
- use `skills validate --dry-run` when you want to confirm registry integrity before a live run
- use `skills run` when you want the wrapper's validation gate, timeout, env injection, and JSON envelope
- use skill output as deterministic wrapper output, not as autonomous reasoning

## Related Pages

- [Host Agent Orientation](../host-agents.md)
- [Authoring](authoring.md)
- [Development Workflow](development.md)
- [Device Prep and Runtime](runtime.md)
- [Environment Variables](../api/environment.md)
- [Serve API](../api/serve.md)
