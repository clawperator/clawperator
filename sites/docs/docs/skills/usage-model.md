# Usage Model

Related runtime/API repository: [clawperator](https://github.com/clawpilled/clawperator)

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
4. `snapshot_ui` (`ascii`)
5. capture an ADB screenshot and persist absolute file path

This gives:

- a device-specific text snapshot (`snapshot_ui`) and
- a visual snapshot (ADB `screencap` path)

which together are useful for multimodal LLM interpretation before moving to app-specific skills.

You can run the packaged baseline skill directly:

```bash
./skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh app.actiontask.operator.development
```

## Anti-Patterns

- Blindly trusting first result line.
- Treating skill scripts as static truth forever.
- Embedding business decisions directly in skill scripts.
- Ignoring non-zero exits or warning-only outputs.

## Practical Takeaway

These skills reduce execution friction. The LLM/agent remains responsible for correctness.
