# Clawperator

<img src="docs/img/clawperator-logo.png" width="200" height="200" alt="Clawperator logo" />

Clawperator ("Claw Operator") is a deterministic actuator tool that enables LLM agents to automate the control of Android devices on behalf of a user. 

## What is Clawperator?

Clawperator is the execution layer for OpenClaw. It provides a stable **Node.js API and CLI** that serves as the "hand" for an LLM "brain." While Clawperator currently targets Android, the API is designed to be the primary interface for agents, abstracting the underlying device interactions into a predictable contract.

Intended setup:
- a dedicated **"burner" Android phone** is permanently connected to the OpenClaw box
- the phone stays unlocked and available as a reliable execution target
- Clawperator exposes deterministic APIs so LLM agents can predictably control Android apps on a user’s behalf

**Note:** The Android device is an internal implementation detail, not your primary phone. You don't need to switch from iOS - any cheap, old Android device will work perfectly as a dedicated actuator.

Clawperator is the actuator. The LLM agent is the supervisor and decision-maker.

## Why Clawperator?

Many consumer services only expose critical data in mobile apps, not public web APIs.

Examples include:
- ride-hailing apps
- family tracking/location apps
- home automation apps
- grocery/shopping apps

Clawperator lets OpenClaw interact with a user’s installed apps on their behalf. Its API is predictable and stable, so skills can be created, reused, and shared.

## Install the Node SDK first

The Node SDK/CLI is the primary interface for agents. Install it first, then use it to drive Android execution.

Prerequisites:
- Node.js `>=22`
- `adb` in `PATH`

Install from this repo checkout:

```bash
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node link
```

Verify:

```bash
clawperator --help
```

Without global link, you can run directly:

```bash
node apps/node/dist/cli/index.js --help
```

## Working Backwards (v1)

### Customer and problem

The immediate customer is an AI agent acting on behalf of a human user.

The problem: many high-value tasks are locked inside consumer Android apps, where web APIs are unavailable, incomplete, or inconsistent.

### v1 outcome

At v1, an agent can:
- connect to a real Android device
- run deterministic UI actions through Clawperator
- observe screen state via structured snapshots
- get canonical terminal results (`[Clawperator-Result]`)
- compose these primitives into repeatable skills (stored in a dedicated skills repo)

This is intentionally a two-handed model:
- Clawperator executes actions and reports outcomes
- the agent decides what to do next

## Quickstart (5 Minutes)

1. **Install the CLI:**
   ```bash
   # Blessed v1 install (from npm when live)
   npm install -g @clawperator/cli
   
   # For now, run from checkout:
   npm --prefix apps/node ci && npm --prefix apps/node run build && npm --prefix apps/node link
   ```

2. **Run Doctor:**
   ```bash
   clawperator doctor
   ```

3. **List Devices:**
   ```bash
   clawperator devices
   ```

4. **Observe UI Snapshot:**
   ```bash
   clawperator observe snapshot --device-id <device_id> --receiver-package com.clawperator.operator.dev
   ```

5. **Execute a Command:**
   ```bash
   # Create a tiny execution file
   echo '{"commandId":"q1","taskId":"t1","source":"manual","expectedFormat":"android-ui-automator","actions":[{"id":"a1","type":"open_app","params":{"applicationId":"com.android.settings"}}]}' > /tmp/exec.json
   
   # Run it
   clawperator execute --execution /tmp/exec.json --device-id <device_id> --receiver-package com.clawperator.operator.dev
   ```

## Installation

### User Install (Blessed)
For most users and agents:
```bash
npx @clawperator/cli@latest --help
```

### Development Workflow
If you are contributing to Clawperator:
```bash
git clone https://github.com/Clawcave/clawperator.git
cd clawperator
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node link
```

## Compatibility Matrix

| Node CLI | Android Runtime (APK) | Required Prefix |
| :--- | :--- | :--- |
| `0.1.x` | `com.clawperator.operator` >= 0.1.0 | `[Clawperator-Result]` |
| `0.2.x` | `com.clawperator.operator` >= 0.2.0 | `[Clawperator-Result]` |

**Note:** If versions are mismatched, the CLI will attempt to run but may fail to parse results or return `EXECUTION_ACTION_UNSUPPORTED`. Use `clawperator doctor` to verify compatibility.

## Why this exists

Clawperator is designed to be a stable actuator, not a planner.

That means:
- **Strict contracts:** No hidden retries or auto-fallbacks.
- **Deterministic behavior:** Exactly one terminal result envelope per command.
- **Strong diagnostics:** Machine-readable error codes for agent branching.

If an app changes UI, shows a permissions sheet, or has rollout variance, the agent can observe and adapt at runtime instead of relying on brittle hardcoded flows.

## Validation scripts

- `./scripts/clawperator_validate_receiver.sh`
- `./scripts/clawperator_smoke_core.sh`
- `./scripts/clawperator_smoke_skills.sh`
- `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_integration_canonical.sh`

## Key docs

- `docs/project-overview.md`
- `docs/operator-llm-playbook.md`
- `docs/node-api-for-agents.md`
- `docs/node-api-design.md`
- `docs/node-api-alpha-release-checklist.md`
- `docs/v1-todo.md`
