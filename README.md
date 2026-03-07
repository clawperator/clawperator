# Clawperator

<img src="docs/img/clawperator-logo.png" width="200" height="200" alt="Clawperator logo" />

Clawperator ("Claw Operator") is a deterministic actuator tool that enables LLM agents to automate the control of Android devices on behalf of a user.

## Why Clawperator?

Many consumer services only expose critical data in mobile apps, not public web APIs.

Examples include:
- Family tracking/location apps
- Home automation apps
- Grocery/shopping apps
- Ride-hailing apps

Clawperator lets AI agents interact with these apps on your behalf. Its API is predictable and stable, so skills can be created, reused, and shared.

## What is Clawperator?

Clawperator is the execution layer for LLM-driven Android automation. It provides a deterministic Node.js CLI and HTTP API - the "hand" for an LLM "brain."

**What agents can do:**
- Connect to a real Android device
- Run deterministic UI actions (tap, scroll, type, read)
- Observe screen state via structured snapshots
- Get canonical terminal results (`[Clawperator-Result]`)
- Compose primitives into repeatable skills

**Design principles:**
- **Deterministic:** Strict contracts, no hidden retries, one result envelope per command
- **Observable:** Structured UI snapshots and machine-readable error codes
- **Agent-first:** JSON output, typed errors, single-flight concurrency

**Typical setup:** A dedicated Android device (any cheap/old phone) stays connected to your agent's host machine as a permanent actuator. The agent sends commands via the Clawperator API; Clawperator executes and reports results.


## Install

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The installer:
- installs or upgrades the CLI prerequisites
- downloads the current stable operator APK via `latest.json`
- verifies the APK checksum
- offers to install the APK to a single connected Android device, even when run via `curl ... | bash`

Or install the CLI directly:

```bash
npm install -g clawperator
```

## Quick Start

```bash
clawperator doctor                         # Verify setup
clawperator devices                        # List connected devices
clawperator observe snapshot \
  --device-id <device_id>                  # Capture UI tree
clawperator execute \
  --execution payload.json \
  --device-id <device_id>                  # Run an execution
```

## Requirements

- Node.js >= 22
- `adb` in PATH
- Android device with USB debugging enabled
- Clawperator APK installed ([stable download](https://clawperator.com/operator.apk), [historical releases](https://github.com/clawpilled/clawperator/releases))

## For AI Agents

See [Node API for Agents](docs/node-api-for-agents.md) for the full API contract, error codes, and integration examples.

## Documentation

Full docs at [docs.clawperator.com](https://docs.clawperator.com)

- [First-Time Setup](docs/first-time-setup.md) - Device prep, APK install, accessibility
- [Node API for Agents](docs/node-api-for-agents.md) - CLI, HTTP API, execution contract
- [Architecture](docs/architecture.md) - System design
- [Troubleshooting](docs/troubleshooting.md) - Common issues

## For Developers

```bash
git clone https://github.com/clawpilled/clawperator.git
cd clawperator
npm --prefix apps/node ci && npm --prefix apps/node run build && npm --prefix apps/node link
```

## License

Apache 2.0
