# Skill Development Workflow

This page is the shortest path from "I explored an app manually" to "I have a
reusable skill with a repeatable validation loop."

Clawperator stays neutral in this process:

- the external agent decides what the workflow should do
- Clawperator provides deterministic UI actions and structured results
- the skill packages selectors, parsing, and app-specific behavior

## 1. Explore the UI first

Start with the generic runtime, not a skill.

For unknown apps, use the default observe-act-observe loop:

1. take a snapshot
2. decide on one action
3. execute one small step or one tight sequence
4. snapshot again
5. repeat until the path is understood

Useful commands:

```bash
clawperator observe snapshot --device-id <device_id> --output json
clawperator observe screenshot --device-id <device_id> --path /tmp/example.png --output json
clawperator execute --device-id <device_id> --execution /path/to/execution.json --output json
```

During exploration, record:

- stable `resourceId` selectors
- text labels that are stable enough to match
- whether the real control is hidden behind a decoy control
- overlays, permission dialogs, or OEM-specific variations
- realistic timeout needs for the slowest steps

## 2. Decide whether the skill should be a script or an artifact

Use a script when the workflow needs:

- branching logic
- snapshot parsing
- custom output formatting
- retries or fallback logic
- host-side work such as screenshot file management

Use an artifact when the workflow is mostly a deterministic execution template
with variable substitution.

Rule of thumb:

- artifact for stable "do these actions" flows
- script for "observe, decide, parse, and report" flows

## 3. Scaffold the skill

Use the scaffold command so the folder layout and registry entry start in a
known-good state:

```bash
clawperator skills new <skill_id>
```

This creates:

- a skill folder
- `SKILL.md`
- `skill.json`
- `scripts/run.js`
- a registry entry in the configured local skills registry

If the registry location is unclear, check:

```bash
echo "$CLAWPERATOR_SKILLS_REGISTRY"
```

## 4. Encode the flow

After scaffolding:

1. update `skill.json`
2. replace the starter script with the real workflow
3. add `artifacts/*.recipe.json` if deterministic compile-time templates help
4. document required inputs and outputs in `SKILL.md`

Keep the skill narrow. A skill should package one reusable intent, not a
general planner.

## 5. Run structural validation before touching a device

Use structural validation every time the skill layout or registry entry
changes:

```bash
clawperator skills validate <skill_id>
clawperator skills validate --all
```

What this proves:

- the registry entry exists
- `skill.json` matches the registry metadata
- `SKILL.md` exists
- listed scripts exist
- listed artifacts exist

What this does not prove:

- that the Android app is in the expected state
- that selectors still match live UI
- that script logic produces the intended output

## 6. Validate artifacts without a device

For artifact-backed skills, compile the artifact before any live run:

```bash
clawperator skills compile-artifact <skill_id> --artifact <name> --vars '{"KEY":"value"}' --output json
```

This catches:

- missing artifact files
- missing required template variables
- invalid `--vars` JSON
- execution payloads that fail Clawperator's execution validator

If you want to check the compiled payload again through the execution validator
without sending it to a device, use:

```bash
clawperator execute --validate-only --execution /path/to/compiled-execution.json --output json
```

This is the closest current workflow to a dry run for artifact-backed skills.

### Dry-run payload validation

Before running a skill, validate the skill payload with the pre-run gate:

```bash
clawperator skills validate <skill_id> --dry-run
clawperator skills run <skill_id> --device-id <device_id>
```

`skills validate --dry-run` keeps the normal integrity checks and adds payload
schema validation for artifact-backed skills. It reads each compiled artifact,
parses the JSON, and validates it against Clawperator's execution schema before
any device interaction happens.

What it does not cover:

- runtime UI state
- selector reachability on a live device
- app-specific branching inside a skill script

Script-only skills are a special case: their payload is generated at runtime by
the skill script, so static payload validation is skipped and the command logs a
reason instead of failing.

If you need to bypass the pre-run gate for CI or development, use:

```bash
clawperator skills run <skill_id> --skip-validate --device-id <device_id>
```

Treat `--skip-validate` as an escape hatch, not a routine workflow.

### Recording-derived skills

When a skill is authored from a human recording, do not replay the trace
literally. Normalize it into a stable replay sequence:

- map launcher entry taps to `open_app`
- add `close_app` only when the app is stateful and a clean baseline is needed
- keep the raw recording as evidence, but make the replay skill follow the
  stable app-level intent
- if a search screen stays open after `enter_text`, submit with a real IME
  enter key instead of assuming the text action will advance the app
- for long scrollable settings lists, settle briefly after the screen opens,
  then scroll to the target element instead of waiting for that element to
  already be visible
- use live snapshots to detect terminal states instead of long fixed sleeps
- stop immediately when the final screen is visible, even if the screen
  arrived faster than expected
- keep stdout for the final artifact and use stderr for small progress markers

If you need the raw recording contract before you normalize anything, start
with [Android Recording Format for Agents](../ai-agents/android-recording.md),
then return here to turn the trace into a skill.

Do not declare the skill complete until the replay covers every meaningful
recorded action or documents why a step was normalized away. A click that
opened a page in the recording, but is missing from the replay, is a bug - not
just a stylistic difference. The same is true for any action that was
replaced by `open_app`, `close_app`, IME submit, or a deliberate row click.

If the recording lands on a terminal result screen, the skill should finish as
soon as that screen is visible. Avoid fixed "sleep and hope" completion logic
unless the app offers no better signal.

## 7. Use a layered test loop

Treat skill verification as four distinct layers:

1. **Registry integrity**
   `clawperator skills validate <skill_id>`
2. **Artifact compile validity**
   `clawperator skills compile-artifact ...`
3. **Execution payload validity**
   `clawperator execute --validate-only ...`
4. **Live device behavior**
   `clawperator skills run <skill_id> --device-id <device_id> [--timeout-ms <n>]`

This keeps failures local:

- registry failure means metadata or paths are wrong
- compile failure means template variables or payload shape are wrong
- validate-only failure means the execution contract is wrong
- live-run failure usually means runtime state, selectors, timing, or parsing

For lightweight smoke checks on expected markers, add
`--expect-contains <text>` to the live run.

When wrapper flags or output behavior matter, check the shipped CLI help
instead of guessing from memory:

```bash
clawperator skills compile-artifact --help
clawperator skills run --help
```

## 8. Inspect partial output on script failures

When `clawperator skills run` fails or times out, do not assume the run
produced no useful information. The wrapper now preserves partial `stdout` and
`stderr` when available.

Agents should inspect those fields before retrying blindly. A timeout often
still contains:

- the last completed step
- a partial parse result
- enough context to distinguish a slow device from a selector failure

## 9. Promote from exploration to reusable automation

A workflow is ready to become a reusable skill when:

- the navigation path is understood
- the selector choices are intentional
- timeout budgets are documented
- expected output format is stable
- failure messages help the caller recover

At that point, update `SKILL.md` so another agent can understand:

- required inputs
- expected outputs
- known failure modes
- whether credentials, account state, or app setup are assumed

## 10. Recommended development checklist

For a new skill, this is the practical order:

1. explore with `observe snapshot`, `observe screenshot`, and small executions
2. scaffold with `clawperator skills new <skill_id>`
3. encode the skill script or artifact
4. run `clawperator skills validate <skill_id>`
5. if artifacts exist, run `clawperator skills compile-artifact ...`
6. run `clawperator execute --validate-only ...` on candidate payloads
7. run `clawperator skills validate <skill_id> --dry-run`
8. run `clawperator skills run <skill_id> --device-id <device_id>`
9. harden selectors, timeout budgets, and output formatting
10. verify that every meaningful recorded action is covered or explicitly
   normalized
11. run `clawperator skills validate --all --dry-run` before wider use

## Related pages

- [Agent Quickstart](../ai-agents/agent-quickstart.md)
- [Clawperator Snapshot Format](../reference/snapshot-format.md)
- [Usage Model](usage-model.md)
- [Skill Authoring Guidelines](skill-authoring-guidelines.md)
