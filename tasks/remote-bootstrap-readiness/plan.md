# Remote Bootstrap Readiness

## Goal

Reach the point where a remote OpenClaw agent on the Mac mini can be given a simple instruction such as:

> Look at `clawperator.com`, install Clawperator, and set up the Solax and Google Home skills.

Also reach the point where the same environment can support a concrete user-facing automation outcome such as:

> Configure an OpenClaw cron job to text me every hour with the current battery status of my Solax home battery between 6am and 10pm.

This task assumes:

- the host is a Mac mini already running OpenClaw
- a dedicated Android device is physically connected
- the device is already logged in with the required personal accounts
- the Solax and Google Home skills in `../clawperator-skills/skills/` are already verified to work

The remaining work is therefore not app-flow design. It is installation, setup, compatibility, and operator-trust hardening.

## Real-World Readiness Targets

The readiness bar for this task is not just "Clawperator installed." It is the ability to support these concrete outcomes reliably:

1. A remote OpenClaw agent can install Clawperator on the Mac mini, connect to the attached Android device, and prepare the verified Solax and Google Home skills for use.
2. A remote OpenClaw agent can configure a recurring automation that checks the Solax battery state and sends an hourly text message update between 6:00 AM and 10:00 PM.

The second target matters because it exercises the full path:

- hosted install flow
- device connectivity
- APK/runtime health
- skill availability
- app-account access
- recurring OpenClaw execution
- user-visible delivery

## Remaining Work

### 1. Version Compatibility and Handshaking

Dependency:

- `tasks/version-handshaking/plan.md`

Why it matters:

- remote setup becomes unreliable if the CLI and APK can silently drift
- the agent needs a deterministic way to detect and fix mismatch before attempting skill setup

Exit criteria:

- doctor reports compatibility clearly
- the CLI can check compatibility directly
- mismatch remediation is obvious and documented

### 2. Remote Install Path Validation on the Real Mac Mini

Validate the actual target environment instead of relying on generic installer confidence.

Checks:

- run `curl -fsSL https://clawperator.com/install.sh | bash` on the Mac mini
- verify CLI install/upgrade behavior
- verify APK download, checksum validation, and local persistence
- verify single-device `adb install -r` flow on the connected Android device
- verify re-run behavior is idempotent

Exit criteria:

- the installer works end to end on the real host
- the second run is safe and predictable
- failure messages are actionable without local repo knowledge

### 3. OpenClaw-Oriented Bootstrap Documentation

Create a short canonical doc for the exact deployment model:

- Mac mini host
- OpenClaw agent
- one connected Android burner device
- skills repo already available or installable

Content should cover:

- expected preconditions
- one-command install path
- post-install verification commands
- how the agent should confirm the device is ready before attempting skills
- how to recover from the top 3 likely setup failures

Suggested output:

- `docs/openclaw-remote-bootstrap.md`

### 4. Deterministic Skill Setup Verification Flow

Define the minimum verification sequence the agent should run after install and before announcing success.

Checks:

- `clawperator doctor`
- `clawperator devices`
- one observation command against the connected device
- confirm required skills are discoverable/listed
- run a lightweight smoke check for the Solax and Google Home setup path, if a non-destructive smoke exists

Exit criteria:

- the agent has a deterministic readiness checklist
- success means "host installed, device reachable, runtime healthy, skills available"

### 5. Recovery Guidance for Remote Failures

The remote agent must know what to do when setup partially fails.

Cover at least:

- APK not installed
- accessibility service not enabled
- multiple devices connected unexpectedly
- CLI/APK version mismatch
- skills registry or skills checkout unavailable

Suggested output:

- fold this into `docs/openclaw-remote-bootstrap.md` or `docs/troubleshooting.md`

### 6. Trust Boundary Review for Personal-Account Use

Before treating this as ready for personal-account automation, explicitly confirm the operational trust model.

Questions to settle:

- what setup steps are allowed to be fully autonomous
- what must still require a human confirmation on device
- how success/failure should be reported back to the user in plain language

This is not a request for new governance. It is a narrow product-surface clarification so the agent does not overclaim completion.

### 7. Cron-to-User Outcome Validation

Validate the specific Solax reporting use case end to end.

Target automation:

- source: Solax skill on the attached Android device
- schedule: hourly
- active window: 6:00 AM through 10:00 PM
- delivery: text message to the user
- payload: current home battery status

Checks:

- confirm the agent can retrieve the Solax battery state deterministically
- confirm the output format is concise and user-readable
- confirm OpenClaw can create or update the recurring cron job correctly
- confirm scheduling semantics are correct for the host locale
- confirm duplicate or overlapping scheduled runs do not create ambiguous user messaging

Exit criteria:

- the cron job can be configured from a plain-language request
- the resulting job runs on the intended schedule
- each successful run produces the expected text message content
- failure cases are detectable and do not silently report stale battery data

## Non-Goals

- redesigning Solax or Google Home skill logic
- inventing new app-specific strategies
- broadening support to arbitrary apps
- replacing OpenClaw-side reasoning

## Acceptance Criteria

This task is complete when:

- version compatibility checks are implemented
- the hosted install flow is verified on the real Mac mini + Android device setup
- there is one canonical remote-bootstrap doc for the OpenClaw deployment model
- the agent has a deterministic post-install verification checklist
- the likely remote recovery paths are documented
 - the Solax hourly battery-status automation can be configured and validated end to end

## Suggested Execution Order

1. Finish `tasks/version-handshaking/plan.md`.
2. Validate the installer on the real Mac mini.
3. Write the remote-bootstrap doc.
4. Define and validate the post-install verification checklist.
5. Document failure recovery and trust-boundary expectations.
6. Validate the Solax hourly battery-status automation end to end.
