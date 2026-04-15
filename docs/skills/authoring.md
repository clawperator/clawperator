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

When `--recording-context <file>` is provided, the scaffold also copies the source file to:

- `skills/<skill_id>/recording-context.json`

The success payload includes that copied path and the `files` array lists it.

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
  "artifacts": [],
  "contract": {
    "inputs": {},
    "goal": null,
    "verification": null
  }
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

## Recording Context

`clawperator skills new <skill_id> --recording-context <file>` copies the provided export file verbatim to `skills/<skill_id>/recording-context.json`.

What that file is for:

- it is reference evidence for an external human or agent authoring the skill
- it is not an executable recipe
- `scaffoldSkill()` does not infer selectors, parameters, or control flow from it
- the source file must already match the recording export artifact schema
- `skills validate` does not inspect `recording-context.json`; it still validates only the registry-linked skill files

Practical authoring workflow:

- before recording, identify the target app or apps and close them so the
  capture starts from a fresh app state rather than a half-explored mid-flow
  screen
- after `record stop`, run `record pull` first and retain the local NDJSON file
- generate `recording export` from that pulled file or directory before any
  optional `record parse` inspection
- scaffold with `--recording-context` from the retained export, not from the
  parsed step log
- treat `recording-context.json` as authoring evidence that helps you design
  the skill, not as a skill that only needs light cleanup

Recommended source:

- use `clawperator recording export --snapshots omit` by default when the goal is agent or human authoring context
- use `--snapshots include` only when the author genuinely needs the raw XML snapshots for manual inspection
- the parsed `recording parse` output is not a substitute for `recording-context.json`
- `recording parse` is a lossy step log, while `recording export` preserves the raw event timeline and package-transition evidence
- recording-derived selectors and path hints are starting evidence only; the
  authored skill still needs explicit control flow and truthful terminal
  verification
- the saved `clawperator skills run --json` wrapper is the v1 compare input for `clawperator recording compare --result <file>`
- the recording export baseline is reference evidence for compare and authoring, not a runtime input passed to the skill

Recording-derived authoring truthfulness:

- the export is evidence, not a complete recipe
- authors may need live snapshots, fresh UI reads, or one-off inspection to
  refine selectors and verification
- if live inspection materially informed the authored route, say so in
  `SKILL.md` instead of implying the recording alone was sufficient
- do not over-claim `from scratch` if the author reused nearby same-app skills,
  fixtures, or shared helpers while drafting the result
- if the first recording looked exploratory, stateful, or obviously
  suboptimal, capture an additional pass instead of pretending one recording
  is a reliable baseline

Personalized versus shared skills:

- a recording-derived skill is often valuable even when it is personalized to
  one user's setup, labels, account state, or device graph
- personalized local skills are a valid first outcome
- do not pretend a personalized skill is generic if it hardcodes local labels
  such as room names, device names, or one user's climate tile
- a shared skill should replace those personal assumptions with generalized
  inputs or broader selector strategy before it is presented as reusable

Authoring mode terminology:

- `from scratch` means do not consult same-app exemplar skills while authoring
- `assisted from nearby patterns` means exemplar reuse is allowed, but the
  authored skill must still be truthful about what came from the recording and
  what came from nearby references
- if you used nearby exemplars, say so in the authoring notes or `SKILL.md`
  rather than presenting the result as recording-only synthesis

Recording-count guidance:

- one recording is the minimum viable authoring handoff
- two recordings are often better when the first pass looked messy or
  branch-dependent
- three recordings are reserved for flows that are especially flaky or whose
  path differs materially by state
- do not merge multiple recordings by hand-waving; explain which pass became
  the retained baseline and why

Durable compare-baseline rule:

- `recording-context.json` is the scaffold-time handoff for an external author or agent
- once a skill has a retained baseline that should be used for ongoing compare, keep that baseline under `skills/<skill_id>/references/compare-baseline.export.json`
- keep the compare baseline outside `skill.json.artifacts`
- do not treat `recording-context.json` as the long-term canonical compare path for a maintained skill
- for replay and orchestrated sibling skills, both may compare against the same retained export baseline when that baseline captures the intended contract-level route and terminal outcome

Cross-repo baseline sync:

- the Clawperator test fixtures under `apps/node/src/test/fixtures/recording-compare/` must stay in sync with the canonical retained baseline in the skills repo
- when the canonical baseline changes, update the corresponding Clawperator test fixture in the same PR or the next available PR
- to verify sync: `CLAWPERATOR_SKILLS_ROOT=../clawperator-skills npm --prefix apps/node run test`
- this is a developer-side guard for the closeout branch, not the final durability mechanism; the generic compare follow-on should wire canonical-baseline provenance into CI or another required validation path

The scaffolded `SKILL.md` includes this section before the `Usage:` block:

```markdown
## Recording Context

This skill was scaffolded with recording context at `recording-context.json`.
Read that file to inspect the recorded interaction timeline and raw events.
The recording context is reference evidence, not an executable skill recipe.
An external agent or human author must write the reusable skill logic.
```

Success output with recording context adds the copied path:

```json
{
  "created": true,
  "skillId": "com.example.recording.export-demo",
  "registryPath": "/abs/path/to/skills/skills-registry.json",
  "skillPath": "/abs/path/to/skills/com.example.recording.export-demo",
  "recordingContextPath": "/abs/path/to/skills/com.example.recording.export-demo/recording-context.json",
  "files": [
    "/abs/path/to/skills/com.example.recording.export-demo/SKILL.md",
    "/abs/path/to/skills/com.example.recording.export-demo/skill.json",
    "/abs/path/to/skills/com.example.recording.export-demo/scripts/run.js",
    "/abs/path/to/skills/com.example.recording.export-demo/scripts/run.sh",
    "/abs/path/to/skills/com.example.recording.export-demo/recording-context.json"
  ],
  "next": "Edit SKILL.md and scripts/run.js, then verify with: clawperator skills validate <skill_id>"
}
```

Verification:

```bash
clawperator skills new com.example.recording.export-demo --recording-context ./recordings/export-demo.export.json --json
```

Check:

- `recordingContextPath` points at the copied file inside the new skill folder
- the copied file contents match the source export file byte-for-byte
- `skill.json.artifacts` remains `[]`

Failure modes:

- blank `--recording-context` values: `SKILLS_SCAFFOLD_FAILED`
- missing or unreadable source file: `SKILLS_SCAFFOLD_FAILED`
- non-export JSON or malformed export artifacts: `SKILLS_SCAFFOLD_FAILED`
- the scaffold does not derive skill logic from the recording context

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

Current skill-type convention:

- `clawperator-skill-type` may be added to `SKILL.md` frontmatter as author-facing metadata
- current expected values are `replay` and `orchestrated`
- this field is documentation only today; the runtime and validator do not enforce or consume it yet
- some legacy skills predate this convention and may not include the field or a suffix in the id

Recommended current practice:

- use a `-replay` id suffix for replay-oriented baseline skills
- use a `-orchestrated` id suffix for agent-controlled skills
- when a skill follows one of those conventions, keep the frontmatter `clawperator-skill-type` value aligned with the id suffix

So the minimum current contract is:

- `SKILL.md` exists
- the registry entry points to it correctly

The scaffold's usage section is a starting point, not a machine-enforced schema.

For agent-driven orchestrated skills, `SKILL.md` is also the runtime agent
program. In that shape:

- `scripts/run.js` should stay a thin harness
- the harness spawns the configured agent CLI from `skill.json.agent`
- the runtime agent uses Clawperator as the hand
- the runtime agent emits exactly one terminal `[Clawperator-Skill-Result]` frame
- the currently supported orchestrated runtime path uses `codex` as the agent CLI
- some orchestrated harnesses currently run codex with `danger-full-access` so the runtime agent can reach live adb targets, but that is a harness-specific choice rather than a Node runtime guarantee

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
- `agent` is intentionally excluded from this parity check. `skill.json.agent` is trusted runtime config, not registry identity metadata.
- other `skill.json` fields are allowed, but the current validator does not
  compare or enforce them

Current orchestrated-skill extension:

- `skill.json.agent` is an optional runtime block for agent-driven skills
- current supported fields are:
  - `cli` required string
  - `cliPath` optional string or null
  - `timeoutMs` optional positive integer
- if `agent` is present, `runSkill()` resolves the configured CLI before spawn
- if the CLI is unavailable, `runSkill()` returns `SKILL_AGENT_CLI_UNAVAILABLE`
- the harness still owns the direct agent spawn; `runSkill()` executes `scripts/run.js`

Current contract declaration extension:

- `skill.json.contract` is optional
- when present, the v1 shape is:
  - `inputs`: object map of input names to simple schema strings
  - `goal`: object with required `kind` plus any extra JSON fields, or `null`
  - `verification`: currently `null` or:
    ```json
    {
      "kind": "node_text_matches",
      "matcher": "Discharge to {percent}%"
    }
    ```
- the scaffold writes a present-but-empty block by default:
  ```json
  "contract": {
    "inputs": {},
    "goal": null,
    "verification": null
  }
  ```
- a missing `contract` block means legacy skill, with no declaration enforcement
- a present-but-empty `contract` block is allowed and validates, but is treated the same as missing until an author fills a meaningful field
- `skill.json.contract` participates in registry parity checks, unlike `agent`

If any of those differ, validation fails with `SKILL_VALIDATION_FAILED`.

Literal authored `skill.json` example:

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
  "artifacts": [],
  "contract": {
    "inputs": {},
    "goal": null,
    "verification": null
  }
}
```

## Declared Verification And `indeterminate`

When a skill declares `contract.verification`, `runSkill()` cross-checks that
declaration against the parsed `skillResult`.

Current v1 rule:

- if the declared verification is proved, the run returns `status: "success"`
- if the skill exits without upstream runtime failure but does not prove the declared verification, the run returns `status: "indeterminate"`
- if the skill emits `skillResult.status: "failed"` for a declared-verification run, the run returns a normal failure result

For `node_text_matches`, the runtime currently requires:

- `skillResult.terminalVerification.status === "verified"`
- the declared `matcher` is rendered from trusted invocation inputs, preferring named flags that match declared input names in kebab-case form such as `unit_name -> --unit-name`, then falling back to trailing positional arguments forwarded by `clawperator skills run` in deterministic lexicographic order of `contract.inputs`; `--` is not required for positional args, but can be used to keep wrapper-known flags such as `--timeout` or `--expect-contains` from being consumed by the wrapper, and standalone positional literals such as `--help` or `--foo=bar` remain eligible for positional binding
- `skillResult.inputs` must agree with those trusted invocation inputs for the declared fields
- the observed terminal verification text matches the declared matcher after placeholder replacement; decorative trailing glyphs or punctuation in the observed text are allowed, but a different value or different leading text is not

This keeps `skill.json` claims tied to the shipped `SkillResult` contract instead
of inventing a second result channel.

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

## Authoring Agent-Driven Orchestrated Skills

The authoritative definition of this runtime shape lives in
[Skills Overview](overview.md#orchestrated-runtime-contract).

When a skill follows the orchestrated runtime contract, the authoring split is:

- `SKILL.md` contains the runtime program for the agent
- `skill.json` carries the trusted `agent` metadata
- `scripts/run.js` is a thin harness that:
  - receives the forwarded script args from `clawperator skills run`
  - reads `CLAWPERATOR_SKILL_PROGRAM`
  - reads `CLAWPERATOR_SKILL_INPUTS`
  - reads the resolved agent CLI path from `CLAWPERATOR_SKILL_AGENT_CLI_PATH`
  - spawns the configured agent CLI on `SKILL.md`
  - forwards stdout and stderr

The harness should not absorb skill logic that belongs in `SKILL.md`. If the
wrapper starts containing the real navigation or verification policy, the skill
has left the orchestrated runtime contract described in
[Skills Overview](overview.md#orchestrated-runtime-contract).

### Practical Authoring Rules

These rules are the durable lessons from building and stabilizing the first
real orchestrated skills.

- Treat recordings as evidence, not route authority.
- Keep the harness thin.
- Put app-specific route authority in `SKILL.md`, not in `scripts/run.js`.
- Make `SKILL.md` name the exact checkpoints and the terminal verification rule
  the runtime agent must satisfy.
- Use retained recording export plus live device observation to define the
  checkpoints and terminal verification that matter.
- Require one live Clawperator device command at a time.
- Do not pipeline multiple live device commands for the same run.
- Make success depend on post-save or post-action verification, not on the
  input value that was requested.
- When the UI includes decorative trailing glyphs on a verified row, treat the
  semantic text as authoritative. For example, a read like
  `Discharge to 45% ` still verifies `Discharge to 45%`.
- Prefer several small `exec` payloads over one oversized payload when a flow
  crosses multiple app states.
- When the current UI is already inside the target app flow, continue from the
  current state instead of forcing a full restart path every time.
- If the flow changes persisted state, choose a target value that is different
  from the currently observed value so the verification proves a real change.

### What The Harness Should Do

For orchestrated skills, `scripts/run.js` should be responsible for runtime
plumbing only:

- read the injected env vars
- invoke the configured agent CLI on `SKILL.md`
- preserve stdout and stderr
- optionally retain per-run logs for local debugging

The harness should not become the second source of truth for:

- app navigation policy
- app-specific selectors or coordinates
- checkpoint names or checkpoint success criteria
- terminal verification semantics
- `SkillResult` schema authority

If the harness starts owning those concerns, future updates drift because the
agent is reading one definition while the wrapper is enforcing another.

### Debugging A Failed Orchestrated Run

When an orchestrated skill misbehaves, read these in order:

1. The forwarded agent stderr stream.
2. The emitted `SkillResult.checkpoints`.
3. The retained agent stdout and stderr logs, if the harness kept them.
4. A direct `clawperator snapshot` from the current screen, when the run ended
   in an unexpected UI state.
5. Compare or replay artifacts, if a baseline exists for the same flow.

Recommended current debugging support for orchestrated harnesses:

- keep a per-run `prompt.txt`
- keep the runtime agent stdout log
- keep the runtime agent stderr log
- keep a small metadata file describing device id, operator package, forwarded
  args, and output paths

This matters because many orchestrated failures are not pure route failures.
Common failure shapes include:

- the agent planned but did not act enough
- the save flow had an extra confirmation prompt
- the app resumed from a mid-flow state the prompt did not account for
- the post-save verification read was correct but the matching rule was too
  strict
- two live commands overlapped and drove the UI out of order

The fastest path out of "flying blind" is to preserve the exact runtime prompt,
agent transcript, and final `SkillResult`, then confirm the visible device
state with a direct `snapshot`.

`clawperator skills run` injects the orchestrated runtime env vars that the
harness reads. For the exact variable list and defaults, see
[Environment Variables](../api/environment.md#orchestrated-skill-runtime-env-vars).

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

## Non-Trivial Skill Success Rules

For non-trivial skills, reaching the end of the script is not enough to claim
success.

Required current rule:

- if an underlying `clawperator exec` call fails, the skill must exit non-zero
- a non-trivial skill must verify the intended terminal app state before it
  reports success
- success should mean "the requested state was actually observed", not merely
  "the script finished running"

This guidance is intentionally general. The exact verification step depends on
the app and workflow, but the rule does not: success should reflect verified
state, and execution failure should remain visible to the caller.

The scaffolded `run.js` contract is:

```text
node run.js <device_id> [operator_package]
```

The scaffold writes an exact default `run.js` payload shape:

```json
{
  "commandId": "com.example.demo.capture-state-<Date.now()>",
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
- the scaffolded script currently invokes the literal `"clawperator"` binary, not `process.env.CLAWPERATOR_BIN`

The scaffolded `run.sh` just forwards to `run.js`.

Current wrapper expectations:

- device id is passed as the first positional arg when the caller used `skills run --device ...`
- `CLAWPERATOR_BIN` is available in the environment
- `CLAWPERATOR_OPERATOR_PACKAGE` is available in the environment

Important boundary:

- the wrapper injects `CLAWPERATOR_BIN`, but the scaffolded default `run.js` does not currently read it
- if you want branch-local skill execution to use the resolved wrapper binary, update the scaffolded script explicitly

Current scaffold behavior on nested `clawperator exec` failure is also worth knowing:

- if `execFileSync("clawperator", ...)` throws but produced stdout, the scaffolded script writes that stdout and exits `0`
- only failures with no stdout fall through to `stderr` plus `exit 1`

## Structured Skill Result Contract

Current runtime behavior from `apps/node/src/contracts/skillResult.ts` and
`apps/node/src/domain/skills/runSkill.ts`:

- `runSkill()` recognizes a skill-level framed result marker:
  `[Clawperator-Skill-Result]`
- the v1 frame is two lines at the end of stdout:
  - line 1: the marker exactly
  - line 2: one JSON object line
- any non-whitespace stdout after the JSON line makes the frame malformed in v1
- multiple frames are rejected
- malformed framed output is rejected with `SKILL_RESULT_PARSE_FAILED`
- legacy skills that emit no frame still succeed or fail based on process exit
  code and return `skillResult: null`

The emitted frame must not contain `source`. `runSkill()` injects it after
parsing:

- scripted skills get `source: { "kind": "script" }`
- skills whose `skill.json` contains `agent.cli` get
  `source: { "kind": "agent", "agentCli": "<cli>" }`
- framed `SkillResult` output requires readable trusted metadata from the
  skill's `skill.json`; if that metadata cannot be read or parsed, the runtime
  rejects the frame with `SKILL_RESULT_PARSE_FAILED` instead of guessing
  provenance

Current v1 `SkillResult` fields:

- required:
  - `contractVersion`
  - `skillId`
  - `status`
  - `checkpoints`
- injected by `runSkill()`:
  - `source`
- optional:
  - `goal`
  - `inputs`
  - `terminalVerification`
  - `execEnvelopes`
  - `diagnostics`

Current status enums:

- top-level `status`: `success`, `failed`, `indeterminate`
- checkpoint `status`: `ok`, `failed`, `skipped`
- `diagnostics.runtimeState`: `healthy`, `poisoned`, `unavailable`, `unknown`

Current typed checkpoint evidence kinds:

- `text`
- `json`
- `result_envelope_ref`

Minimal framed example:

```text
[Clawperator-Skill-Result]
{"contractVersion":"1.0.0","skillId":"com.example.demo.capture-state","status":"success","checkpoints":[{"id":"terminal_state_verified","status":"ok","evidence":{"kind":"text","text":"Discharge to 40%"}}],"terminalVerification":{"status":"verified","expected":{"kind":"text","text":"Discharge to 40%"},"observed":{"kind":"text","text":"Discharge to 40%"}}}
```

Current authoring rule for new non-trivial skills:

- emit a framed `SkillResult`
- keep process exit truthful
- use `terminalVerification` when the skill claims a persisted app-state
  change
- choose stable named user-facing inputs early and keep them aligned across:
  - `skill.json.contract.inputs`
  - `SKILL.md` usage examples
  - script argument parsing and emitted `skillResult.inputs`
- avoid positional-only public interfaces for non-trivial skills unless the
  contract is genuinely single-purpose and obvious
- use `skillResult: null` only for legacy skills that have not yet been
  upgraded
- if the skill is authored from a retained recording baseline, save a
  `skills run --json` wrapper for the run you want to compare and feed that
  wrapper directly to `clawperator recording compare`

Current compare contract for authored skills:

- compare reads the saved wrapper's top-level `skillResult`
- compare auto-selects `semantic` mode for `skillResult.source.kind == "agent"`
- compare auto-selects `literal` mode for `skillResult.source.kind == "script"`
- compare uses `terminalVerification` as the final-state proof channel
- compare classifies `diagnostics.runtimeState == "poisoned"` as
  `runtime_poisoned`
- compare classifies `diagnostics.runtimeState == "unavailable"` as
  `runtime_unavailable`
- compare expects the baseline input to be a recording export artifact such as `references/compare-baseline.export.json`, not a parsed `recording parse` step log
- compare accepts the full `skills run --json` wrapper as the durable `--result` input, not a hand-edited bare `SkillResult`
- replay-style runs can succeed as `literal_match`
- agent-driven runs can succeed as either `semantic_match` or `outcome_matches_path_differs`
- v1 compare trust is enforced by fixture-backed Solax regression coverage, not by a generic per-skill compare contract

Version handling:

- same major version with a newer minor version is accepted
- a different major version is rejected with `SKILL_RESULT_PARSE_FAILED`

### Run Script Verification

Validate the registry entry first, then run the scaffolded skill through the wrapper:

```bash
clawperator skills validate com.example.demo.capture-state --dry-run --json
clawperator skills run com.example.demo.capture-state --device <device_serial> --json
```

For the run result, verify:

- `skillId` matches the registry id
- `output` contains the full stdout, including the framed result when emitted
- `exitCode` is `0`
- `skillResult` is either a parsed object or `null` for a legacy skill

If the script exits non-zero, `skills run` returns `SKILL_EXECUTION_FAILED` and
preserves `stdout`, `stderr`, `exitCode`, and any parsed `skillResult`.

If the script emits a malformed frame, `skills run` returns
`SKILL_RESULT_PARSE_FAILED` instead of falling back to legacy stdout parsing.

### Non-Trivial Skill Rule

For non-trivial skills, treat process success as a proof obligation, not just
an implementation detail.

Working definition:

- a skill is `non-trivial` when successful script execution is not enough to
  prove the claimed outcome
- this usually means the skill changes app state, crosses multiple UI
  transitions, or can fail silently while still appearing to have run
- a read-only or capture-only skill is often trivial; a state-changing skill
  should be assumed non-trivial unless proven otherwise

Current authoring expectation:

- if an underlying nested `clawperator exec` call fails, the skill script must
  exit non-zero rather than translating the failure into a "successful" skill run
- if the skill's purpose is to change app state, the skill should verify the
  intended terminal state before reporting success
- if the immediate post-action UI is known to be stale or delayed, re-open or
  re-read the relevant controller before claiming terminal verification
- if replay cannot truthfully prove the persisted state after a reasonable
  re-read strategy, prefer an orchestrated or otherwise richer verification
  path instead of claiming replay success

Examples of terminal-state verification:

- re-read the row or field the skill changed and confirm it matches the
  requested value
- re-open the relevant dialog or screen and confirm the persisted state is
  present

Do not assume that "the taps and text entry ran" is enough evidence for a
non-trivial skill. If the skill changes state, prefer proving the state.

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
  "message": "[object Object]",
  "details": {
    "skillId": "com.google.android.apps.chromecast.app.get-climate",
    "artifactName": "climate-status"
  }
}
```

Current nuance:

- `compileArtifact()` forwards `String(e)` from `validateExecution(JSON.parse(...))`
- when the validator throws a structured object rather than a plain `Error`, the current message can degrade to a generic string such as `"[object Object]"`
- rely on the error code plus the artifact payload itself, not just the message text

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
