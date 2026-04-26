# Google Home Climate Skill Daemon Polling Timing

Date: 2026-04-26

## Change Under Test

The Google Home climate replay skill was changed in the sibling
`clawperator-skills` repo to remove fixed Android `sleep` actions. The skill now:

- opens Google Home and snapshots the current Google Home state
- parses the requested controller directly when the app restores to that screen
- otherwise navigates from the Home tab to Climate and the requested controller
- waits for concrete controller values with `wait_for_node`
- parses all climate fields from the final snapshot
- emits route and elapsed timing diagnostics in the terminal SkillResult

## Validation Setup

- Device: Samsung SM-S901E physical device over USB
- Operator package: `com.clawperator.operator.dev`
- Skill registry: local `clawperator-skills` checkout
- CLI: branch-local `apps/node/dist/cli/index.js` from the local `clawperator` checkout
- Daemon: started before timing and verified `running` before and after every measured run
- Skill input: `--unit-name Panasonic`
- Invocation: `clawperator skills run com.google.android.apps.chromecast.app.get-climate-replay --device <device_serial> --operator-package com.clawperator.operator.dev --timeout 240000 --output json -- --unit-name Panasonic`

The wrapper environment used:

```text
CLAWPERATOR_BIN=<local_clawperator_repo>/apps/node/dist/cli/index.js
CLAWPERATOR_SKILLS_REGISTRY=<local_clawperator_skills_repo>/skills/skills-registry.json
```

This ensured inner skill calls used the local CLI implementation with daemon
support, not the global `clawperator` binary.

## Five-Run Timing

| Run | Total wall time (ms) | Wrapper duration (ms) | Open snapshot (ms) | Navigation (ms) | Route |
| --- | --- | --- | --- | --- | --- |
| 1 | 8606 | 7875 | 2758 | 5037 | home-tab-navigation |
| 2 | 12947 | 12204 | 3029 | 9096 | home-tab-navigation |
| 3 | 8950 | 8176 | 2828 | 5270 | home-tab-navigation |
| 4 | 9080 | 8348 | 3130 | 5133 | home-tab-navigation |
| 5 | 12174 | 11437 | 3183 | 8175 | home-tab-navigation |
| Median | 9080 | 8348 | 3029 | 5270 | home-tab-navigation |

All five runs succeeded and returned the expected `Panasonic` climate status.

## Findings

The prior daemon-versus-direct validation in this task area measured the old
fixed-sleep Google Home climate replay skill at a 17237ms daemon median. With
fixed sleeps removed and the local daemon path enabled, the measured median was
9080ms.

The improvement comes from replacing 13000ms of fixed sleeps with two observed
readiness points:

- Google Home app root is present after open
- controller status values are present before the final snapshot

The remaining runtime is dominated by app launch, category navigation, and
waiting for the Google Home controller values to populate. Runs 2 and 5 were
slower because navigation readiness took around 8-9 seconds, which appears to be
live Google Home app-state variance rather than daemon transport overhead.
