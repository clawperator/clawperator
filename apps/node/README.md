# clawperator

Deterministic Node.js CLI and API for Android automation, designed for AI agents.

## Install

```bash
npm install -g clawperator
```

For the full host + APK install flow, use:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

## Requirements

- Node.js 22+
- `adb` on `PATH`
- Android device with USB debugging enabled
- Clawperator APK installed from [clawperator.com/operator.apk](https://clawperator.com/operator.apk)

## Quick Start

```bash
clawperator doctor
clawperator devices
clawperator observe snapshot --device-id <device_id>
```

## Documentation

Full docs: [docs.clawperator.com](https://docs.clawperator.com)

- First-time setup: [docs/first-time-setup.md](../../docs/first-time-setup.md)
- Node API contract: [docs/node-api-for-agents.md](../../docs/node-api-for-agents.md)

## Build and Test

```bash
npm install
npm run build
npm run test
```
