# SolaX Battery Skill Daemon Polling Timing

Date: 2026-04-26

## Change Under Test

The SolaX battery skill was changed in the sibling `clawperator-skills` repo to
remove fixed Android `sleep` actions. The skill now:

- starts a fresh SolaX Cloud session with `close_app` and `open_app`
- polls small `read_text` executions for the battery value and unit resource IDs
- stops as soon as the battery value parses as a number
- emits attempt count and elapsed timing diagnostics in the terminal SkillResult

## Validation Setup

- Device: Samsung SM-S901E physical device over USB
- Operator package: `com.clawperator.operator.dev`
- Skill registry: local `clawperator-skills` checkout
- CLI: branch-local `apps/node/dist/cli/index.js` from the local `clawperator` checkout
- Daemon: started before timing and verified `running` before and after every measured run
- Invocation: `clawperator skills run com.solaxcloud.starter.get-battery --device <device_serial> --operator-package com.clawperator.operator.dev --timeout 240000 --output json`

The wrapper environment used:

```text
CLAWPERATOR_BIN=<local_clawperator_repo>/apps/node/dist/cli/index.js
CLAWPERATOR_SKILLS_REGISTRY=<local_clawperator_skills_repo>/skills/skills-registry.json
```

This ensured inner skill calls used the local CLI implementation with daemon
support, not the global `clawperator` binary.

## Five-Run Timing

| Run | Total wall time (ms) | Wrapper duration (ms) | Setup elapsed (ms) | Poll elapsed (ms) | Attempts |
| --- | --- | --- | --- | --- | --- |
| 1 | 9948 | 9226 | 1301 | 7840 | 1 |
| 2 | 10471 | 9751 | 1349 | 8322 | 1 |
| 3 | 10326 | 9601 | 1304 | 8217 | 1 |
| 4 | 11307 | 10575 | 1367 | 9129 | 1 |
| 5 | 10173 | 9459 | 1324 | 8051 | 1 |
| Median | 10326 | 9601 | 1324 | 8217 | 1 |

All five runs succeeded.

## Findings

The prior daemon-versus-direct validation in this task area measured the old
fixed-sleep SolaX skill at a 21233ms no-daemon median and a 21363ms daemon
median. With fixed sleeps removed and the local daemon path enabled, the measured
median was 10326ms.

The current bottleneck is no longer the explicit 12000ms sleep. The single poll
attempt takes about 8-9 seconds because the first `read_text` execution waits
until the SolaX dashboard exposes the battery value. This is still better than
sleeping for a fixed 12 seconds, and it returns earlier when the app is ready.
