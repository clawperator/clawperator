# Docs Home

Clawperator is a deterministic actuator tool for Android device automation.

Use this page as the human and agent index into the authored docs. The concrete machine entry points are `llms.txt` and `llms-full.txt`, while the command-verification entry points are `doctor --json`, `version --check-compat --json`, and the API-specific pages below.

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

Fast verification entry point:

```bash
clawperator doctor --json
```

Check `criticalOk` before assuming the local environment is ready for API calls or skill runs.

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

Recommended API verification sequence:

```bash
clawperator doctor --json --device <device_serial> --operator-package <package>
clawperator snapshot --json --device <device_serial> --operator-package <package>
clawperator version --check-compat --json --device <device_serial> --operator-package <package>
```

Use those three commands to confirm:

- readiness and next actions
- live result-envelope success
- CLI and APK version compatibility

## Skills

- [Overview](skills/overview.md) - registry model, discovery, and wrapper execution
- [Authoring](skills/authoring.md) - scaffolded files, artifacts, and validation
- [Development Workflow](skills/development.md) - local iteration loop for skills
- [Device Prep and Runtime](skills/runtime.md) - runtime environment, timeout, and output rules

Recommended skills verification sequence:

```bash
clawperator skills list --json
clawperator skills validate --all --dry-run --json
clawperator skills run <skill_id> --device <device_serial> --json
```

Those commands prove:

- the registry is readable
- every registered skill passes structural validation
- the wrapper can execute one skill and return machine-readable output

## Troubleshooting

- [Operator App](troubleshooting/operator.md) - installation, permission, handshake, and crash recovery
- [Known Issues](troubleshooting/known-issues.md) - currently verified known issues page
- [Version Compatibility](troubleshooting/compatibility.md) - CLI and Operator APK version alignment

Recommended troubleshooting entry points:

```bash
clawperator doctor --json --device <device_serial> --operator-package <package>
clawperator version --check-compat --json --device <device_serial> --operator-package <package>
```

Common code-backed failure categories to branch on first:

- `OPERATOR_NOT_INSTALLED`
- `OPERATOR_VARIANT_MISMATCH`
- `DEVICE_ACCESSIBILITY_NOT_RUNNING`
- `RESULT_ENVELOPE_TIMEOUT`
- `VERSION_INCOMPATIBLE`

## Related Pages

- [Setup](setup.md)
- [API Overview](api/overview.md)
- [Skills Overview](skills/overview.md)
- [Operator App](troubleshooting/operator.md)
