# Clawperator Node API (The Hand)

This module is the canonical **Hand** for Clawperator. It provides a stable, platform-agnostic Node.js API and CLI for executing deterministic Android automations.

## Architectural Doctrine: Generic Actuator

**Clawperator is an actuator, not a planner.** 

1. **No App-Specific Logic:** This codebase must NEVER contain app-specific code (e.g., SwitchBot, Life360, Google Home). It is a generic execution engine that knows only how to process `Execution` JSON payloads.
2. **Skills Live Elsewhere:** App-specific "skills" (the reasoning/recipes) live in the [clawperator-skills](https://github.com/clawpilled/clawperator-skills) repository.
3. **Brain vs. Hand:** The LLM (The Brain) reasons about state; Clawperator (The Hand) executes the physical UI actions and returns structured sensory data.

## Setup

- Node.js 22+
- `adb` on PATH (or set `ADB_PATH`)
- Optional: `CLAWPERATOR_RECEIVER_PACKAGE` (default: `com.clawperator.operator.dev`)

## Core Contracts

### 1. `expectedFormat` Required
Every command that interacts with a device MUST include `expectedFormat: "android-ui-automator"`. This ensures future-proofing for iOS/Web targets.

### 2. Canonical Envelope: `[Clawperator-Result]`
Clawperator only accepts one source of truth for execution outcomes: the `[Clawperator-Result]` JSON envelope emitted by the Android runtime.

## Usage

```bash
# Verify environment and readiness
clawperator doctor

# Full Android build + install + handshake + smoke
clawperator doctor --full

# List devices
clawperator devices

# Execute a generic payload (The Hand only cares about the schema)
clawperator execute --execution ./path/to/execution.json

# Build a single-step action
clawperator action click --selector '{"resourceId":"com.example:id/btn"}'
```

## Build & Test

```bash
npm install
npm run build
npm run test
```

For detailed protocol documentation, see `docs/node-api-design.md`.
