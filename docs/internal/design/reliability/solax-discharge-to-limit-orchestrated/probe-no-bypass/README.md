# Solax Orchestrated No-Bypass Probe

Bucket: C

## Purpose

Probe whether the current orchestrated Solax skill depends on the hidden
`CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` toggle before editing
`scripts/run.js`.

## Historical Trace

Git archaeology found prior proving-run and harness-hardening commits on the
`skills/agent-driven` branch, but no committed note that proved the earlier
successful live run was bypass-free. The live probe remained required.

## Host Baseline

- codex version: see [codex-version.txt](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/codex-version.txt)
- codex sandbox flags: see [codex-sandbox-flags.txt](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/codex-sandbox-flags.txt)
- branch-local Clawperator CLI: `/<local_user>/src/clawperator/apps/node/dist/cli/index.js`
- skills registry: `/<local_user>/src/clawperator-skills/skills/skills-registry.json`

## Device Baseline

- device serial: `<device_serial>`
- device model: `SM_S901E`
- Android version: `16`
- SolaX Cloud version: `7.2.0`
- operator package: `com.clawperator.operator.dev`
- pre-run foreground state: launcher recents screen, SolaX app force-closed
- pre-run persisted discharge row evidence: the immediately preceding replay control attempt still read `Discharge to 40%` before its post-save timeout, so the probe baseline used current persisted state `40%` instead of claiming a synthetic `100%` reset that did not actually complete

## Exact Commands

Probe attempts used this command shape, with the bypass explicitly unset:

```bash
env -u CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS \
  CLAWPERATOR_SKILLS_REGISTRY=/<local_user>/src/clawperator-skills/skills/skills-registry.json \
  node /<local_user>/src/clawperator/apps/node/dist/cli/index.js skills run \
    com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
    --device <device_serial> \
    --operator-package com.clawperator.operator.dev \
    --output json -- 40
```

Each attempt was preceded by:

```bash
node /<local_user>/src/clawperator/apps/node/dist/cli/index.js close \
  --app com.solaxcloud.starter \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --json
```

## Timing

- attempt 1 session start: `2026-04-12T04:13:44Z`
- attempt 1 artifact time: `2026-04-12T04:14:17Z`
- attempt 2 artifact time: `2026-04-12T04:15:14Z`
- attempt 3 artifact time: `2026-04-12T04:15:50Z`
- probe session end check: `2026-04-12T04:15:50Z`

## Evidence

- [probe-attempt-1.json](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe-attempt-1.json)
- [probe-attempt-1.stderr](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe-attempt-1.stderr)
- [probe-attempt-2.json](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe-attempt-2.json)
- [probe-attempt-2.stderr](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe-attempt-2.stderr)
- [probe-attempt-3.json](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe-attempt-3.json)
- [probe-attempt-3.stderr](/<local_user>/src/clawperator/docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/probe-attempt-3.stderr)

## Classification

All three attempts failed with the same runtime symptom:

- `DEVICE_NOT_FOUND for device <device_serial>`
- connected devices list reported empty from inside the runtime agent path
- no stderr text cited sandbox, approval, denied access, read-only mode, child-process blocking, or codex refusal to spawn Clawperator

That matches bucket C from the closeout pack: real failure, but unrelated to
sandbox or approval based on the captured evidence.

## C2 Decision

C2 Step 4 should delete `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` from the Solax
orchestrated harness with no contract change.

## Reliability Risk

This probe does not block the bypass-toggle deletion, but it does put C3
reliability at risk. The current orchestrated path can still lose visibility of
an otherwise connected Samsung device from inside the runtime-agent execution
path, so the 10-run reliability phase must treat device-unavailable failures as
first-class evidence instead of assuming the probe flaked for irrelevant
reasons.
