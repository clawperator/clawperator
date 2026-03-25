## Prompt for PR-3: Remaining Content

```
You are implementing PR-3 of the Clawperator docs refactor. This PR replaces 12 placeholder pages with real documentation and rewrites the index page. PR-1 (pipeline) and PR-2 (core content) are already merged. Read this prompt fully before starting any work.

## Lessons From PR-2 and PR-3 Round 1

Both PR-2 and the first round of PR-3 required rewrites. The pattern was the same both times:

- The agent batched all pages into a single commit instead of working one file at a time
- Pages had correct headings and scope but insufficient depth
- Default values were described vaguely instead of with exact values from code
- JSON examples were missing entirely on some pages
- Error cases and failure modes were omitted
- No verification patterns were provided (how to confirm a setting took effect)

The rewrite of `docs/api/environment.md` is the clearest example of the gap. Run this diff to see it:

```bash
git diff 7085589d9409eda87f73070103e35c04c22b1f82..cd8c63c4f7113dd15a00447cf26fda60fd354695 -- docs/api/environment.md
```

Here is what was wrong with the first version and what the rewrite fixed:

### Wrong defaults replaced with exact values from code

- First version: `CLAWPERATOR_LOG_DIR` default was "logger-specific default under the user home directory". Rewrite: `~/.clawperator/logs` (from `logger.ts` line 65).
- First version: `CLAWPERATOR_LOG_LEVEL` default was "logger default level". Rewrite: `info` (from `normalizeLogLevel()` in `logger.ts` line 29).
- First version: `CLAWPERATOR_SKILLS_REGISTRY` default was "skills/skills-registry.json relative to current working directory, with one fallback when loading". Rewrite: documents the full `loadRegistry()` fallback chain including the `../../skills/` fallback and notes that `skills sync` places the registry at `~/.clawperator/skills/skills/skills-registry.json`.

If a default value exists as a literal string or constant in the code, write that literal. Do not paraphrase it.

### JSON examples and verification patterns added

- First version: zero JSON examples. Zero ways to confirm an env var took effect.
- Rewrite: shows `clawperator doctor --json` output with `report.operatorPackage` reflecting the env var. Shows how `host.adb.presence` passing confirms `ADB_PATH` is working.

Every page must include at least one machine-checkable way to verify the documented behavior.

### Error cases documented

- First version: never says what happens when a variable is set incorrectly.
- Rewrite: `OPERATOR_NOT_INSTALLED` for wrong package name, `REGISTRY_READ_FAILED` for missing registry, `ADB_NOT_FOUND` for bad adb path, silent `info` fallback for invalid log level.

If a setting can be wrong, document what happens and which error code surfaces.

### Vague "where it is read" replaced with meaningful descriptions

- First version: "many command modules, runExecution.ts, skillsConfig.ts, serve.ts"
- Rewrite: "every device-targeting CLI command (snapshot, click, read, wait, scroll, doctor, record start, ...)"

"Many" and "various" are not documentation. Name the things or describe the category precisely.

### Agent-facing pattern section added

- The rewrite includes a "Agent Configuration Pattern" section showing the three env vars an agent should set and explaining that `--device` is the only per-command flag still needed.

The exemplar pages (`docs/setup.md`, `docs/api/actions.md`, and now `docs/api/environment.md`) all share these traits. Your pages must match.

## Required Reading Before You Touch Any File

Read these files IN THIS ORDER before writing anything:

1. `tasks/docs/refactor/documentation-drafting-north-star.md` - the governing philosophy. Pay special attention to "Two-Audience Requirement", "Page Completeness by Type", "Known Failure Patterns", and "Multi-Pass Workflow". These sections exist because agents in PR-2 violated them.

2. `docs/setup.md` - EXEMPLAR. This is the quality bar for setup/how-to pages. Study: success conditions at every step, DoctorReport JSON shape, doctor checks summary table, recovery table with exact error codes, agent sequence using exact field paths. Your pages must reach this level of specificity.

3. `docs/api/actions.md` - EXEMPLAR. This is the quality bar for reference pages. Study: per-action parameter tables with valid values and ranges, retry object shape with Android clamping rules, concrete JSON examples for every action, CLI-to-action mapping table, "Result Data You Can Rely On" summary. If actions.md documents valid values for `direction` as `down, up, left, right` and clamping ranges for `maxScrolls` as `[1, 200]`, your pages must document their parameters with equal precision.

4. `docs/api/environment.md` - EXEMPLAR. This is the quality bar you are being held to for this round. Study: exact defaults from code (not paraphrased), JSON verification examples, error cases for each variable, agent configuration pattern. This page was rewritten from your first draft because your first draft had vague defaults, no JSON examples, and no error cases. Your remaining pages must not repeat those mistakes.

5. `tasks/docs/refactor/work-breakdown.md` - PR-3 section (Tasks 3.1-3.4)

If you skip the exemplars and produce thin pages, your work will be rejected. Read them.

## The Rule That Matters Most

CODE IS THE SOURCE OF TRUTH.

Old docs in `tasks/docs/refactor/reference/` are advisory only. They may be stale, wrong, or misleading. For every fact you write:

1. Open the relevant source file in `apps/node/src/`
2. Read the actual code
3. Write the doc based on what the code does

If old docs say one thing and code says another, the code is correct. Period.

The skills repo (`../clawperator-skills/docs/`) is a secondary reference for skills pages. It was written before the current CLI surface and may use outdated terminology or command forms. Verify against the Node code.

## Branch

Work on the `docs-refactor-phase-3` branch, created from `main` after PR-2 merged.

## Commit Discipline

This project uses Conventional Commits (`docs:`, `feat:`, `fix:`, `test:`).

### Commit often. Very often.

The workflow for EACH page is:

1. Read the relevant code files (see verification table below)
2. Read the reference snapshot for context (NOT as source of truth): `tasks/docs/refactor/reference/`
3. Draft the page in `docs/`
4. Run `./scripts/docs_build.sh` to verify the build passes
5. Commit: `docs: draft <page-name> - verified against <source-files>`
6. Reread what you just wrote. Compare it against the code again. Ask yourself:
   - Did I miss any flags, parameters, or action types?
   - Did I copy wording from old docs without verifying it?
   - Is there any claim here that I cannot point to a specific line of code for?
   - Would an agent be able to construct a valid command from this page alone?
   - Does every default value match the literal from code, or did I paraphrase it?
   - Is there at least one JSON example showing the output shape?
   - Did I document what happens when a setting is wrong (error codes, failure behavior)?
   - Compare to the exemplars (`docs/setup.md`, `docs/api/actions.md`, `docs/api/environment.md`): does my page have the same depth?
7. Fix issues found in the reread
8. Commit: `docs: refine <page-name> - <what you fixed>`
9. Move to the next page

Do NOT batch multiple pages into one commit. Each page gets at least one commit (draft), ideally two (draft + refinement).

Do NOT skip the reread step. The first draft of every page in this project so far has had errors that the reread caught. Assume yours will too.

Do NOT write documentation from memory or from your previous draft alone - open the code and verify.

## Terminology Rules (enforced)

- "operator" not "receiver"
- "action" not "command" when referring to execution payload actions
- "selector" not "matcher" (except when referencing the `NodeMatcher` type specifically)
- Primary flag name `--device` (not `--device-id`)
- Primary flag name `--timeout` (not `--timeout-ms`)
- Flat CLI surface: `snapshot` not `observe snapshot`, `click --text` not `action click --selector`
- Never shorten "Clawperator" to "Claw"
- Use regular dashes/hyphens, never em dashes

## Cross-referencing Rules

- Each concept is defined on exactly one page
- Cross-reference using relative markdown links: `[Selectors](selectors.md)`, `[Setup](../setup.md)`
- Do NOT duplicate content that already exists in PR-2 pages
- If a concept is already documented in setup.md, overview.md, actions.md, selectors.md, errors.md, devices.md, doctor.md, or serve.md - link to it, do not repeat it

## Verification Reference Table

Use this for EVERY page. Open the listed files before writing.

| Topic | Verify against |
|-------|---------------|
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Selector flags | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Error codes | `apps/node/src/contracts/errors.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Execution limits and timeouts | `apps/node/src/contracts/limits.ts` |
| Execution validation | `apps/node/src/domain/executions/validateExecution.ts` |
| Execution runtime | `apps/node/src/domain/executions/runExecution.ts` |
| Snapshot extraction | `apps/node/src/domain/executions/snapshotHelper.ts` |
| Environment variables | Grep `process.env.CLAWPERATOR` across `apps/node/src/` |
| Runtime config | `apps/node/src/adapters/android-bridge/runtimeConfig.ts` |
| Navigation builders | `apps/node/src/domain/actions/waitForNav.ts`, `openApp.ts`, `openUri.ts` |
| Recording format | `apps/node/src/domain/recording/recordingEventTypes.ts` |
| Recording parsing | `apps/node/src/domain/recording/parseRecording.ts` |
| Recording CLI | `apps/node/src/cli/commands/record.ts` |
| Skills registry | `apps/node/src/contracts/skills.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Skills runtime | `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/domain/skills/skillsConfig.ts` |
| Skills CLI | `apps/node/src/cli/commands/skills.ts` |
| Skill validation | `apps/node/src/domain/skills/validateSkill.ts` |
| Skill compilation | `apps/node/src/domain/skills/compileArtifact.ts` |
| Operator setup | `apps/node/src/cli/commands/operatorSetup.ts`, `apps/node/src/domain/device/setupOperator.ts` |
| Permissions | `apps/node/src/domain/device/grantPermissions.ts` |
| Version compatibility | `apps/node/src/domain/version/compatibility.ts` |
| Doctor checks | `apps/node/src/domain/doctor/checks/` |

## Page-by-Page Instructions

Work these in order. Each task tells you exactly what to write, what code to verify against, and what reference material to consult.

---

### Page 1: `docs/api/snapshot.md`

**Replaces:** placeholder

**What to write:** The snapshot_ui output format, how XML hierarchy data flows from Android through Node to the agent, extraction mechanics, and what the XML contains.

**Sections to include:**
1. Purpose - what `snapshot_ui` returns and why agents use it
2. How snapshot data flows - Android emits hierarchy via logcat, Node extracts it via `snapshotHelper.ts`, attaches to `stepResults[].data.text`
3. The XML format - what `<hierarchy>` contains, what node attributes are available (resourceId, text, contentDescription, className, bounds, etc.)
4. Extraction failure - `SNAPSHOT_EXTRACTION_FAILED`, when it triggers, what the agent should do
5. Settle warning - `data.warn` when snapshot follows click without sleep
6. Snapshot line limit - `MAX_SNAPSHOT_LINES` from limits.ts
7. JSON example of a successful snapshot stepResult with realistic XML fragment

**Verify against:**
- `apps/node/src/domain/executions/snapshotHelper.ts` - extraction logic, marker parsing, line limits
- `apps/node/src/domain/executions/runExecution.ts` - `attachSnapshotsToStepResults()`, `markExtractionFailedSnapshotSteps()`, settle warning logic
- `apps/node/src/contracts/limits.ts` - `MAX_SNAPSHOT_LINES`
- `apps/node/src/domain/observe/snapshot.ts` - builder defaults

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/snapshot-format.md`

---

### Page 2: `docs/api/timeouts.md`

**Replaces:** placeholder

**What to write:** Timeout budgeting model - execution-level vs action-level timeouts, how builders inflate execution timeouts, the best-effort runtime extension, and how agents should set timeout values.

**Sections to include:**
1. Purpose - why timeouts exist and the two levels (execution-level, action-level)
2. Execution-level timeout - `timeoutMs` field, valid range from limits.ts, what happens when exceeded (`RESULT_ENVELOPE_TIMEOUT`)
3. Action-level timeout - `params.timeoutMs` on actions like `wait_for_node` and `wait_for_navigation`, how it relates to execution timeout
4. Builder inflation rules - how CLI builders compute execution timeout from action timeout (e.g., `max(actionTimeout + 5000, 30000)` for wait actions)
5. Best-effort runtime extension - `MAX_BEST_EFFORT_RUNTIME_MS` from limits.ts, what it means
6. Concrete timeout budget examples - show a multi-action payload and explain what timeout to set
7. Common mistakes - setting execution timeout too close to action timeout, not accounting for multi-step payloads

**Verify against:**
- `apps/node/src/contracts/limits.ts` - `MIN_EXECUTION_TIMEOUT_MS`, `MAX_EXECUTION_TIMEOUT_MS`, `MAX_BEST_EFFORT_RUNTIME_MS`
- `apps/node/src/domain/executions/validateExecution.ts` - timeout validation rules
- `apps/node/src/domain/executions/runExecution.ts` - timeout enforcement and best-effort extension
- `apps/node/src/domain/actions/waitForNav.ts` - builder timeout inflation (this pattern is typical)
- `apps/node/src/domain/actions/waitForNode.ts` - another builder with timeout inflation
- `apps/node/src/domain/observe/snapshot.ts` - default timeout for snapshot

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/timeout-budgeting.md`

---

### Page 3: `docs/api/environment.md`

**Replaces:** placeholder

**What to write:** Every `CLAWPERATOR_*` environment variable, what it controls, and where it is read.

**Sections to include:**
1. Purpose - env vars for headless/CI/agent environments where CLI flags are impractical
2. Complete table: variable name, what it controls, where it is read, default if unset
3. For each variable: when to use it, what happens when set vs unset
4. Interaction with CLI flags - flags override env vars where both exist

**How to find the complete list:** Do NOT trust the old reference docs for this. Run:
```bash
grep -rn 'process\.env\.CLAWPERATOR' apps/node/src/
grep -rn 'process\.env\.ADB' apps/node/src/
```
Document every match. If a variable appears in code but not in the old docs, it still needs to be documented. If a variable appears in old docs but not in code, do NOT document it.

**Also check:**
- `apps/node/src/adapters/android-bridge/runtimeConfig.ts` - central config reader
- `apps/node/src/domain/skills/skillsConfig.ts` - skill-specific env vars (`CLAWPERATOR_BIN`, `CLAWPERATOR_OPERATOR_PACKAGE`)
- `apps/node/src/cli/commands/serve.ts` - operator package fallback chain uses env var

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/environment-variables.md`

**IMPORTANT:** The old docs may reference `CLAWPERATOR_RECEIVER_PACKAGE` or similar "receiver" terminology. The correct name is `CLAWPERATOR_OPERATOR_PACKAGE`. Verify against code.

---

### Page 4: `docs/api/navigation.md`

**Replaces:** placeholder

**What to write:** Navigation patterns for agents - how to open apps, open URIs, wait for navigation, and compose multi-step navigation sequences.

**Sections to include:**
1. Purpose - deterministic app navigation for agents
2. `open_app` - applicationId parameter, what happens, how to verify success
3. `open_uri` - uri parameter, MAX_URI_LENGTH from limits.ts, how to verify
4. `wait_for_navigation` - expectedPackage, expectedNode, timeoutMs, mutual requirements, builder timeout inflation
5. Common navigation sequence - open_app + wait_for_navigation + snapshot_ui as a three-step pattern
6. JSON payload example for a complete navigation sequence with success conditions
7. Failure modes: app not installed, navigation timeout, wrong package on screen

**Verify against:**
- `apps/node/src/domain/actions/openApp.ts` - builder logic
- `apps/node/src/domain/actions/openUri.ts` - builder logic, URI validation
- `apps/node/src/domain/actions/waitForNav.ts` - timeout inflation, parameter requirements
- `apps/node/src/domain/executions/validateExecution.ts` - validation rules for these action types
- `apps/node/src/contracts/limits.ts` - MAX_URI_LENGTH
- `apps/node/src/contracts/execution.ts` - ActionParams for navigation fields

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/navigation-patterns.md`

**Key constraint:** This page should focus on navigation as a composed pattern. Individual action parameter details are already in `docs/api/actions.md`. Do not duplicate - cross-reference. The value of this page is showing how to combine actions into navigation workflows with concrete examples.

---

### Page 5: `docs/api/recording.md`

**Replaces:** placeholder

**What to write:** Recording system - how to start, stop, retrieve, and parse recordings. The NDJSON schema. How agents use recordings.

**Sections to include:**
1. Purpose - capture user interactions as replayable NDJSON sequences
2. CLI commands - `clawperator record start`, `record stop`, `record pull`, `record parse`
3. NDJSON format - header line shape, event types (click, scroll, window_change, press_key, text_change), per-event fields
4. Recording lifecycle - start -> interact -> stop -> pull -> parse
5. Parse output shape - what `record parse` returns
6. JSON examples - at least one recording header and one event line
7. Common failure modes - `RECORDING_ALREADY_IN_PROGRESS`, `RECORDING_NOT_IN_PROGRESS`, `RECORDING_SESSION_NOT_FOUND`, `RECORDING_PULL_FAILED`, `RECORDING_PARSE_FAILED`, `RECORDING_SCHEMA_VERSION_UNSUPPORTED`

**Verify against:**
- `apps/node/src/domain/recording/recordingEventTypes.ts` - the NDJSON schema (header + event types). READ THIS FILE IN FULL.
- `apps/node/src/domain/recording/parseRecording.ts` - what parsing produces
- `apps/node/src/domain/recording/pullRecording.ts` - retrieval logic
- `apps/node/src/cli/commands/record.ts` - CLI commands, flags, output shapes
- `apps/node/src/contracts/errors.ts` - verify every recording error code you reference exists

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/` (check for any recording docs)

**IMPORTANT:** The recording NDJSON schema is defined in `recordingEventTypes.ts`. This is a TypeScript file with type definitions. Read each type carefully and document the field names, types, and meanings. Do not invent field names that are not in the code.

---

### Page 6: `docs/skills/overview.md`

**Replaces:** placeholder

**What to write:** What skills are, the runtime model, how they are discovered and executed.

**Sections to include:**
1. Purpose - skills are deterministic wrappers that compose Clawperator actions into repeatable workflows. Clawperator is the execution substrate, skills define what to do, agents decide when to invoke a skill.
2. Skill structure - SKILL.md, run scripts, artifacts, skill ID
3. Discovery - `clawperator skills list`, `skills search`, `skills get`
4. Execution - `clawperator skills run <id>`, how device and args are passed, timeout, output format
5. Registry - skills-registry.json, how skills are resolved
6. JSON examples - skill list response, skill run success response
7. Error codes - `SKILL_EXECUTION_FAILED`, `SKILL_OUTPUT_ASSERTION_FAILED`, `REGISTRY_READ_FAILED`, etc.

**Verify against:**
- `apps/node/src/contracts/skills.ts` - `SkillEntry` type, registry types
- `apps/node/src/domain/skills/runSkill.ts` - `runSkill()`, `SkillRunResult`, `SkillRunError`, timeout default
- `apps/node/src/domain/skills/listSkills.ts` - list behavior
- `apps/node/src/domain/skills/searchSkills.ts` - search behavior
- `apps/node/src/domain/skills/skillsConfig.ts` - env vars, paths, defaults
- `apps/node/src/cli/commands/skills.ts` - CLI subcommands and their flags
- `apps/node/src/cli/commands/serve.ts` - skill endpoints for HTTP interface context

**Reference material (advisory only):**
- `../clawperator-skills/docs/usage-model.md`

---

### Page 7: `docs/skills/authoring.md`

**Replaces:** placeholder

**What to write:** How to create a skill, SKILL.md format, run script requirements, artifact compilation, blocked terms.

**Sections to include:**
1. Purpose - guide for creating new skills
2. SKILL.md format - required fields, what each field means
3. Run script contract - how the script is invoked, argument order, expected stdout markers, exit codes
4. Artifact compilation - what `compile-artifact` does, variable substitution
5. Validation - `clawperator skills validate`, what it checks
6. Scaffolding - `clawperator skills scaffold`
7. Blocked terms - `~/.clawperator/blocked-terms.txt`, what it prevents

**Verify against:**
- `apps/node/src/domain/skills/compileArtifact.ts` - compilation logic, variable substitution
- `apps/node/src/domain/skills/validateSkill.ts` - validation checks
- `apps/node/src/domain/skills/scaffoldSkill.ts` - scaffold output
- `apps/node/src/domain/skills/runSkill.ts` - how scripts are invoked, env vars passed
- `apps/node/src/domain/skills/skillsConfig.ts` - blocked terms path, skill directory resolution
- `apps/node/src/cli/commands/skills.ts` - validate, scaffold, compile-artifact subcommands

**Reference material (advisory only):**
- `../clawperator-skills/docs/skill-authoring-guidelines.md`
- `../clawperator-skills/docs/skill-from-recording.md`
- `../clawperator-skills/docs/blocked-terms-policy.md`

---

### Page 8: `docs/skills/development.md`

**Replaces:** placeholder

**What to write:** Development workflow for skills - local testing, iteration, sync.

**Sections to include:**
1. Purpose - develop and test skills locally before publishing
2. Local development flow - scaffold, write script, test, validate
3. Running a skill locally - `clawperator skills run <id> --device <serial>`, args, timeout override
4. Skill sync - `clawperator skills sync`, what it does
5. Testing patterns - how to verify skill output, use `expectContains` on serve API
6. Common development issues and fixes

**Verify against:**
- `apps/node/src/cli/commands/skills.ts` - run, sync, validate subcommands with flags
- `apps/node/src/domain/skills/runSkill.ts` - runtime behavior, env vars
- `apps/node/src/domain/skills/skillsConfig.ts` - skill directory resolution
- `apps/node/src/cli/commands/serve.ts` - `/skills/:skillId/run` endpoint for HTTP testing

**Reference material (advisory only):**
- `../clawperator-skills/docs/skill-development-workflow.md`

---

### Page 9: `docs/skills/runtime.md`

**Replaces:** placeholder

**What to write:** Device preparation for skill execution, runtime tips, environment requirements.

**Sections to include:**
1. Purpose - ensure device is ready for skill execution
2. Device prep checklist - what must be true before running skills (doctor passes, app installed, permissions granted)
3. Runtime environment - env vars available to skill scripts, how CLAWPERATOR_BIN and CLAWPERATOR_OPERATOR_PACKAGE are set
4. Timeout behavior - default skill timeout, how to override
5. Multi-device skill execution - passing --device
6. Output and logging - stdout capture, how output is returned

**Verify against:**
- `apps/node/src/domain/skills/runSkill.ts` - `SkillRunEnv`, timeout default (`120000`), how stdout/stderr are captured
- `apps/node/src/domain/skills/skillsConfig.ts` - env var names and resolution
- `apps/node/src/cli/commands/skills.ts` - skill run flags

**Reference material (advisory only):**
- `../clawperator-skills/docs/device-prep-and-runtime-tips.md`

---

### Page 10: `docs/troubleshooting/operator.md`

**Replaces:** placeholder

**What to write:** Operator APK troubleshooting - installation failures, permission issues, crash recovery, accessibility service.

**Sections to include:**
1. Purpose - diagnose and fix Operator APK issues
2. Installation failures - `OPERATOR_INSTALL_FAILED`, `OPERATOR_GRANT_FAILED`, `OPERATOR_VERIFY_FAILED`
3. Accessibility service not running - `DEVICE_ACCESSIBILITY_NOT_RUNNING`, how to re-grant
4. Variant mismatch - `OPERATOR_VARIANT_MISMATCH`, release vs debug, how to fix
5. Handshake failures - `RESULT_ENVELOPE_TIMEOUT`, `BROADCAST_FAILED`
6. Crash recovery - how to detect crashes, how to recover
7. Crash logs access - where to find Android crash logs, adb logcat commands
8. Recovery sequence - recommended order of operations for a broken operator state

**Verify against:**
- `apps/node/src/cli/commands/operatorSetup.ts` - setup phases and error handling
- `apps/node/src/domain/device/setupOperator.ts` - setup logic
- `apps/node/src/domain/device/grantPermissions.ts` - permission logic
- `apps/node/src/domain/doctor/checks/readinessChecks.ts` - handshake, APK presence, settings checks
- `apps/node/src/contracts/errors.ts` - verify every error code referenced on this page

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/troubleshooting.md`
- `tasks/docs/refactor/reference/docs/crash-logs.md`

---

### Page 11: `docs/troubleshooting/known-issues.md`

**Replaces:** placeholder

**What to write:** Current known issues. This page can be minimal - list only issues that are actually current.

**Verify against:**
- Check if `tasks/docs/refactor/reference/docs/known-issues.md` contains any issues that are still valid by checking if the described behavior still exists in code
- If no current issues can be verified, the page should say "No known issues at this time" with a pointer to the GitHub issues tracker

---

### Page 12: `docs/troubleshooting/compatibility.md`

**Replaces:** placeholder

**What to write:** Version compatibility between CLI and Operator APK, how version checking works, what to do on mismatch.

**Sections to include:**
1. Purpose - understand CLI/APK version relationship
2. How compatibility is checked - `readiness.version.compatibility` doctor check
3. Version probing - how `probeVersionCompatibility()` works
4. Error codes - `VERSION_INCOMPATIBLE`, `APK_VERSION_UNREADABLE`, `APK_VERSION_INVALID`, `CLI_VERSION_INVALID`
5. Recovery - how to align versions

**Verify against:**
- `apps/node/src/domain/version/compatibility.ts` - `probeVersionCompatibility()`, version parsing
- `apps/node/src/domain/doctor/checks/readinessChecks.ts` - `checkVersionCompatibility()` check
- `apps/node/src/contracts/errors.ts` - verify error codes

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/compatibility.md`

---

### Page 13: `docs/index.md` (write this LAST)

**Replaces:** current minimal index

**What to write:** Routing page - 4 sections (Setup, API, Skills, Troubleshooting), links to every page, links to `llms.txt` and `llms-full.txt`. This is the front door.

**Sections to include:**
1. One-line description of Clawperator
2. Agent entry points - links to `llms.txt` and `llms-full.txt` prominently at the top
3. Setup section - link to setup.md
4. API section - links to all API pages (overview, actions, selectors, errors, devices, doctor, serve, snapshot, timeouts, environment, navigation, recording, cli)
5. Skills section - links to all skills pages
6. Troubleshooting section - links to all troubleshooting pages

**Key constraint:** This is a routing page, not a content page. No duplicated explanations. Just links with one-line descriptions. Write this after ALL other pages exist so all links are valid.

---

## Build and Validation

After EACH page, run:
```bash
./scripts/docs_build.sh
```

After ALL pages are done, run:
```bash
grep -ri "receiver" docs/api/ docs/skills/ docs/troubleshooting/ docs/index.md docs/setup.md
grep -r "observe snapshot\|action click\|action press" docs/
grep -r "\-\-timeout-ms" docs/
```
All three greps must return zero results.

Then verify:
```bash
# Check no placeholders remain
grep -rl "Placeholder - content coming" docs/
```
Must return zero results.

## What Done Looks Like

For each page:
- Every default value is the exact literal from code, not a paraphrase
- Every parameter's valid values are documented, not just the parameter name
- At least one concrete JSON example for every major contract on the page
- At least one verification pattern showing how to confirm the documented behavior
- Error cases: what happens when a setting, argument, or state is wrong, with the exact error code
- All error codes referenced on the page exist in `apps/node/src/contracts/errors.ts`
- An agent could construct valid commands and parse responses using only this page and cross-referenced pages
- `./scripts/docs_build.sh` passes
- The page has comparable depth and specificity to `docs/setup.md`, `docs/api/actions.md`, and `docs/api/environment.md`

## PR-3 Validation Checklist

Before declaring PR-3 done:

- [ ] `./scripts/docs_build.sh` succeeds
- [ ] All 12 content pages + index are non-placeholder and verified against code
- [ ] Each commit message cites what code was verified against
- [ ] Zero occurrences of "receiver" in authored docs
- [ ] Zero occurrences of old CLI syntax ("observe snapshot", "action click")
- [ ] Zero placeholder pages remain
- [ ] All relative links resolve (docs build validates this)
- [ ] `llms-full.txt` contains all 22 pages with real content
- [ ] Zero error codes referenced that do not exist in `apps/node/src/contracts/errors.ts`
```
