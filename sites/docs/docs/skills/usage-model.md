# Usage Model

Related runtime/API repository: [clawperator](https://github.com/clawperator/clawperator)

## Core Principle

Skills are a reliability layer for execution, not a substitute for agent reasoning.

The intended operating model is two-handed:

1. Execution hand (`clawperator` + these skills)
   - dispatches Android actions
   - interacts through accessibility APIs
   - logs/captures outputs for downstream interpretation

2. Reasoning hand (LLM/agent)
   - interprets outputs
   - decides next command
   - handles unexpected UI states
   - manages retries/fallbacks/escalations

## What Skills Guarantee

Skills aim to provide:

- repeatable command structure
- known selector and parsing strategies
- stable output formatting

Skills do **not** guarantee:

- that UI structure is unchanged
- that remote config/experiments are inactive
- that alerts/permission/update dialogs are absent
- that app/login/account state is valid

## Recommended Agent Loop

1. Start from a deterministic baseline state.
2. Run skill command.
3. Parse outputs (and screenshot path if provided).
4. Validate expected signal presence.
5. If mismatch: inspect UI state, adapt command, retry with controlled strategy.
6. Return user-facing answer with confidence/fallback note if needed.

## Minimal Baseline Demo (No App-Specific Skill Required)

Use Android Settings (`com.android.settings`) as a universal baseline probe:

1. `close_app` Settings
2. `open_app` Settings
3. short settle delay
4. `snapshot_ui` (`hierarchy_xml`)
5. capture an ADB screenshot and persist absolute file path

This gives:

- a device-specific text snapshot (`snapshot_ui`) and
- a visual snapshot (ADB `screencap` path)

which together are useful for multimodal LLM interpretation before moving to app-specific skills.

You can run the packaged baseline skill via the Node API wrapper:

```bash
clawperator skills run com.android.settings.capture-overview --device-id <device_id>
```

Or invoke the script directly (no Node API required):

```bash
DEVICE_ID="$(adb devices | awk 'NR>1 && $2==\"device\" {print $1; exit}')"
./skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh "$DEVICE_ID" app.actiontask.operator.development
```

Always pass `--device-id` to `skills run` when more than one device is connected. Without it the wrapper will fail if device auto-detection is ambiguous.

If a wrapped script exits non-zero or times out, `clawperator skills run`
preserves partial `stdout` and `stderr` in the structured error output when
they exist. Agents should inspect those fields before discarding the run as an
opaque failure.

## Private skills

Private skills are not discovered by scanning folders automatically. The
current model is registry-driven:

1. create the skill folder
2. add `skill.json`
3. add a matching entry to the local registry JSON pointed to by
   `CLAWPERATOR_SKILLS_REGISTRY`

Once that registry entry exists, the skill becomes visible to:

- `clawperator skills list`
- `clawperator skills get`
- `clawperator skills search`
- `clawperator skills run`

For the current metadata contract and authoring details, see
`skills/skill-authoring-guidelines.md`.

For the full path from ad hoc exploration to a validated reusable skill, see
`skills/skill-development-workflow.md`.

## Anti-Patterns

- Blindly trusting first result line.
- Treating skill scripts as static truth forever.
- Embedding business decisions directly in skill scripts.
- Ignoring non-zero exits or warning-only outputs.

## Practical Takeaway

These skills reduce execution friction. The LLM/agent remains responsible for correctness.
