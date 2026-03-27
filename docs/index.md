# Docs Home

Clawperator is a deterministic actuator tool for Android device automation.

Use this page as the routing index into the authored docs. The concrete machine entry points are `llms.txt` and `llms-full.txt`.

---

**Current code version: [0.5.3](https://github.com/clawperator/clawperator/blob/main/CHANGELOG.md)**

*This is the unreleased code version in the repo. See [Version Compatibility](troubleshooting/compatibility.md) for the latest published release.*

---

## Version Quick Reference

Check your CLI version:

```bash
clawperator version
```

Check CLI and APK compatibility:

```bash
clawperator version --check-compat --device <device_serial> --operator-package <package>
```

See [Version Compatibility](troubleshooting/compatibility.md) for detailed compatibility rules and recovery.

## Agent Entry Points

- [llms.txt](https://docs.clawperator.com/llms.txt) - compact machine entrypoint
- [llms-full.txt](https://docs.clawperator.com/llms-full.txt) - full machine-readable docs corpus

Verification pattern:

```bash
curl -fsSL https://docs.clawperator.com/llms.txt
curl -fsSL https://docs.clawperator.com/llms-full.txt
```

Use:

- `llms.txt` when you want the compact docs index
- `llms-full.txt` when you want the full assembled documentation corpus

## Setup

- [Setup](setup.md) - install the CLI, prepare a device, install the Operator APK, verify readiness, and run the first snapshot

## API

- [Overview](api/overview.md) - execution payload, result envelope, and branching model
- [CLI Reference](api/cli.md) - generated command and flag reference
- [Actions](api/actions.md) - canonical action types and parameter semantics
- [Selectors](api/selectors.md) - `NodeMatcher` contract and CLI selector mapping
- [Snapshot Format](api/snapshot.md) - where `snapshot_ui` XML lives and how extraction works
- [Errors](api/errors.md) - public error-code contract and recovery patterns
- [Devices](api/devices.md) - device discovery and deterministic targeting
- [Doctor](api/doctor.md) - doctor report contract and readiness checks
- [Timeouts](api/timeouts.md) - execution and action timeout budgeting
- [Environment Variables](api/environment.md) - current `CLAWPERATOR_*` and runtime environment controls
- [Serve API](api/serve.md) - local HTTP and SSE contract
- [Navigation Patterns](api/navigation.md) - composed navigation workflows for agents
- [Recording Format](api/recording.md) - raw NDJSON recording schema and parsed step log

## Skills

- [Overview](skills/overview.md) - registry model, discovery, and wrapper execution
- [Authoring](skills/authoring.md) - scaffolded files, artifacts, and validation
- [Development Workflow](skills/development.md) - local iteration loop for skills
- [Device Prep and Runtime](skills/runtime.md) - runtime environment, timeout, and output rules

## Troubleshooting

- [Operator App](troubleshooting/operator.md) - installation, permission, handshake, and crash recovery
- [Known Issues](troubleshooting/known-issues.md) - currently verified known issues page
- [Version Compatibility](troubleshooting/compatibility.md) - CLI and Operator APK version alignment
