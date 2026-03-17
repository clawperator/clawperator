# Clawperator Docs

Clawperator is a deterministic actuator tool for LLM-driven Android automation. It acts as the "hand" for an LLM "brain," allowing agents to automate device control on a dedicated Android device.

Use this page as a technical map:

- start with setup if you are preparing a device or emulator
- start with the Node API guide if you are integrating an agent
- use the reference section for exact command, payload, and error semantics

## Machine-facing routes

- [llms.txt](https://docs.clawperator.com/llms.txt) - compact machine-oriented docs entrypoint
- [llms-full.txt](https://docs.clawperator.com/llms-full.txt) - compiled full docs corpus on the docs host
- [sitemap.xml](https://docs.clawperator.com/sitemap.xml) - canonical crawl map for this docs host

## Recommended paths

### Start here if you are integrating an agent

- [Agent Quickstart](ai-agents/agent-quickstart.md) - Fastest path from first install to first successful execution
- [Node API - Agent Guide](ai-agents/node-api-for-agents.md) - Canonical CLI and HTTP API contract for agent builders
- [Clawperator Snapshot Format](reference/snapshot-format.md) - Canonical `snapshot_ui` and `observe snapshot` output contract
- [Operator LLM Playbook](design/operator-llm-playbook.md) - Practical operating rules for observation, action loops, and skill execution
- [API Overview](reference/api-overview.md) - Execution payload, action types, result envelope shape, and snapshot semantics
- [CLI Reference](reference/cli-reference.md) - Command-line entrypoints and flags

### Start here if you are preparing runtime infrastructure

- [First-Time Setup](getting-started/first-time-setup.md) - Install the CLI, choose an Android environment, and prepare the [Clawperator Operator Android app](getting-started/android-operator-apk.md)
- [Running Clawperator on Android](getting-started/running-clawperator-on-android.md) - Canonical actuator model, physical device vs emulator, and user responsibilities
- [OpenClaw First Run](getting-started/openclaw-first-run.md) - Task-oriented runbook for installing Clawperator, preparing Android, and completing a first real skill run
- [Clawperator Operator Android app](getting-started/android-operator-apk.md) - Package variants, installation, and permissions for Clawperator's Android app

## Getting Started

- [Running Clawperator on Android](getting-started/running-clawperator-on-android.md) - Canonical actuator model, physical device vs emulator, and user responsibilities
- [Clawperator Terminology](getting-started/terminology.md) - Canonical definitions for Android device, Operator app, user-installed Android apps, and other core terms
- [First-Time Setup](getting-started/first-time-setup.md) - Install the CLI, choose an Android environment, and prepare the [Clawperator Operator Android app](getting-started/android-operator-apk.md)
- [OpenClaw First Run](getting-started/openclaw-first-run.md) - Task-oriented runbook for installing Clawperator, preparing Android, and completing a first real skill run
- [Project Overview](getting-started/project-overview.md) - Mission, architecture, and repository surfaces
- [Clawperator Operator Android app](getting-started/android-operator-apk.md) - Package variants, installation, and permissions for Clawperator's Android app

## For AI Agents

- [Agent Quickstart](ai-agents/agent-quickstart.md) - Fastest path for a cold-start agent
- [Node API - Agent Guide](ai-agents/node-api-for-agents.md) - Canonical CLI and HTTP API reference for agents
- [Clawperator Snapshot Format](reference/snapshot-format.md) - Canonical snapshot output and parsing contract
- [Operator LLM Playbook](design/operator-llm-playbook.md) - Action contracts, runtime conventions, and skill packaging
- [API Overview](reference/api-overview.md) - Execution payload, action types, result envelopes, and snapshot delivery
- [CLI Reference](reference/cli-reference.md) - Exact command surface for local and scripted integrations

## Reference

- [CLI Reference](reference/cli-reference.md) - Command-line usage and flags
- [API Overview](reference/api-overview.md) - Execution payload, action types, result envelopes, and snapshot semantics
- [Clawperator Snapshot Format](reference/snapshot-format.md) - Canonical `hierarchy_xml` contract and parsing guidance
- [Error Codes](reference/error-codes.md) - Structured runtime and API error code reference
- [Doctor](reference/node-api-doctor.md) - Runtime readiness checks, exit behavior, and JSON report shape

## Architecture

- [System Overview](architecture/architecture.md) - High-level architecture and execution flow
- [Runtime Architecture and API Rationale](design/node-api-design.md) - Why the runtime and API are shaped the way they are


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
