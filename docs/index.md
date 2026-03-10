# Clawperator Docs

Clawperator is a deterministic actuator tool for LLM-driven Android automation. It acts as the "hand" for an LLM "brain," allowing agents to automate device control on a dedicated Android device.

## Getting Started

- [Running Clawperator on Android](getting-started/running-clawperator-on-android.md) - Canonical actuator model, physical device vs emulator, and user responsibilities
- [First-Time Setup](getting-started/first-time-setup.md) - Install the CLI, choose an Android environment, and prepare the [Clawperator Operator Android app](getting-started/android-operator-apk.md)
- [OpenClaw Remote Bootstrap Guide](getting-started/openclaw-remote-bootstrap.md) - Step-by-step environment setup for remote agents
- [Project Overview](getting-started/project-overview.md) - Mission, architecture, and repository surfaces
- [Clawperator Operator Android app](getting-started/android-operator-apk.md) - Package variants, installation, and permissions for Clawperator's Android app

## For AI Agents

- [Node API - Agent Guide](ai-agents/node-api-for-agents.md) - CLI and HTTP API reference for agents
- [Operator LLM Playbook](design/operator-llm-playbook.md) - Action contracts, skill packaging, and runtime conventions

## Reference

- [CLI Reference](reference/cli-reference.md) - Command-line usage
- [API Overview](reference/api-overview.md) - Execution payload, action types, and result envelopes
- [Error Codes](reference/error-codes.md) - Error code reference
- [Doctor](reference/node-api-doctor.md) - Runtime readiness checks, exit behavior, and JSON report shape

## Architecture

- [System Overview](architecture/architecture.md)
- [Node Runtime and API Design](design/node-api-design.md)
- [Conformance Test APK](architecture/conformance-apk.md)

## Troubleshooting

- [Version Compatibility](troubleshooting/compatibility.md)
- [Troubleshooting the Operator App](troubleshooting/troubleshooting.md)
- [Known Issues](troubleshooting/known-issues.md)
- [Crash Logs](troubleshooting/crash-logs.md)

## Skills

- [Usage Model](skills/usage-model.md)
- [Skill Authoring Guidelines](skills/skill-authoring-guidelines.md)
- [Skill Design](design/skill-design.md)
- [Device Prep and Runtime Tips](skills/device-prep-and-runtime-tips.md)
- [Skills Verification](skills/skills-verification.md)
- [Blocked Terms Policy](skills/blocked-terms-policy.md)
