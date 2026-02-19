# Clawperator Node API

Node runtime for Clawperator: deterministic Android execution for LLM agents. See `docs/node-api-for-agents.md`, `docs/node-api-design.md`, and `docs/node-api-alpha-release-checklist.md`.

## Setup

- Node.js 22+
- `adb` on PATH (or set `ADB_PATH`)
- Optional: `CLAWPERATOR_RECEIVER_PACKAGE` (default: `app.actiontask.operator.development`)

## Observability: `terminalSource`

Success responses for execute, observe, and action commands include **`terminalSource`**:

- **`clawperator_result`** – canonical `[Clawperator-Result]` envelope. Node accepts only this; the Operator app must emit it.

## Build & test

```bash
npm install
npm run build
npm run test
```

## Usage

```bash
# List devices
node dist/cli/index.js devices

# List packages (single device or --device-id required if multiple)
node dist/cli/index.js packages list --third-party

# Execute a payload (file or inline JSON)
node dist/cli/index.js execute --execution ./path/to/execution.json
node dist/cli/index.js execute --execution '{"commandId":"c1","taskId":"t1","source":"test","timeoutMs":30000,"actions":[{"id":"s1","type":"sleep","params":{"durationMs":1000}}]}'

# Observe snapshot (UI tree)
node dist/cli/index.js observe snapshot

# Action wrappers (compile to execute)
node dist/cli/index.js action click --selector '{"resourceId":"com.example:id/btn"}'
node dist/cli/index.js action type --selector '{"resourceId":"com.example:id/input"}' --text "hello" --submit
```

## Stages

- **Stage 0** (done): Contracts, limits, validation, aliases, JSON output.
- **Stage 1** (done): CLI core (devices, packages, execute, observe, inspect, action), Android bridge, single-flight, canonical `[Clawperator-Result]` envelope only (legacy path removed).
- **Stage 2** (done): Skills list/get/compile-artifact/sync.
- **Stage 3** (planned): HTTP wrapper, doctor/doctor --fix.
