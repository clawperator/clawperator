# Evals Live Run Runbook

## Purpose

This repo-local skill is the convenience entrypoint for repeatable live-device
skill proving runs.

The source of truth remains:

- `evals/run_eval.py`
- `evals/harness/live_skill_eval.py`

Use this skill when you want the stable commands and the debugging workflow
without reconstructing them from memory.

## Before Running

- Build the branch-local Node CLI if you changed it:

```bash
npm --prefix apps/node run build
```

- Use the debug operator package for local validation unless you are explicitly
  testing the release path:

```bash
--operator-package com.clawperator.operator.dev
```

- When multiple devices are connected, always pass `--device <serial>`.

## Run The Solax Cold-Start Eval

One run:

```bash
.agents/skills/evals-live-run/scripts/run_solax_live_eval.sh \
  <device_serial> \
  1 \
  manual
```

Repeated proving:

```bash
.agents/skills/evals-live-run/scripts/run_solax_live_eval.sh \
  <device_serial> \
  4 \
  soak
```

The script wraps:

```bash
uv run --project evals --extra dev \
  python evals/run_eval.py solax-orchestrated-cold-start \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --runs <runs> \
  --label <label>
```

Artifacts land under:

- `evals/artifacts/`

If a batch is worth retaining, copy the sanitized batch into the private
`clawperator-artifacts` repo instead of committing it in the product repo.

## Debug The Solax Skill Directly

Use this when the eval batch says `skill_timed_out`, `skill_failed`, or when
you want the runtime-agent transcript and retained run directory.

```bash
.agents/skills/evals-live-run/scripts/debug_solax_orchestrated_skill.sh \
  <device_serial> \
  40
```

That script wraps:

```bash
env \
  CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
  CLAWPERATOR_SKILL_RETAIN_LOGS=1 \
  CLAWPERATOR_SKILL_LOG_DIR=/tmp/solax-orchestrated-debug \
  CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS=120000 \
  node apps/node/dist/cli/index.js skills run \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --output json \
  -- <percent>
```

Retained logs land under:

- `/tmp/solax-orchestrated-debug/`

## Inspect The Newest Batch

```bash
.agents/skills/evals-live-run/scripts/show_latest_solax_eval.sh
```

This prints the newest Solax batch directory and its `summary.json`.

## Interpretation

- `cold_start_verified` means the run started from a restarted outside-app
  state, selected a different target than the observed persisted value, and
  verified the final persisted row.
- `skill_timed_out` means the `skills run` subprocess hit the eval timeout and
  the harness failed the run truthfully.
- `run_start_restarted: true` means the harness force-stopped SolaX before the
  probe and again before the skill run.
