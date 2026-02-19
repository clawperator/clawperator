# Clawperator Node API for Agents (Working Backwards Draft)

**Current status:** Canonical `[Clawperator-Result]` envelope is **live** end-to-end, and Node is **canonical-only**. Validation and release gates are tracked in `docs/node-api-alpha-release-checklist.md`.

## Working Backwards (Context)

This document uses the "working backwards" approach: define the customer experience first, then build to match it.  
Reference: [Amazon on Working Backwards and PR/FAQ](https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes).

How to use this document:

1. During development: as a scope and behavior contract ("are we building what we said we would build?").
2. During release: as the launch narrative and validation checklist for agent-facing value.

## Heading

Clawperator Node API: Reliable Android Control for LLM Agents

## Sub-Heading

For LLM agents, Clawperator provides deterministic Android execution so they can reliably interact with apps and extract information that is often unavailable via public web APIs or websites.

## Summary

Today we are introducing the Clawperator Node API, an execution service built for LLM/agent callers. Clawperator lets agents reliably operate Android apps, read structured results, and return clear answers or screenshots when requested. The agent remains responsible for reasoning and decisions; Clawperator is the dependable execution layer for interacting with consumer apps where the needed data may only exist inside the mobile experience.

## Problem

Humans ask agents to complete real-world tasks that often span multiple mobile apps. Without a reliable execution layer, agents spend too much effort on brittle command transport and log parsing instead of helping the user. This leads to missed steps, unreliable results, and poor user trust in high-value workflows (shopping, family safety checks, and home automation decisions).

## Solution

Clawperator Node API standardizes Android execution into a stable contract so agents can focus on user outcomes:

1. One canonical execution path with strict validation before dispatch.
2. Deterministic result envelope semantics (`[Clawperator-Result]` terminal).
3. Consistent device targeting, receiver package targeting, and conflict handling.
4. First-class command wrappers (`devices`, `packages list`, `execute`, `observe snapshot`, `action ...`).
5. Skill artifact compile support that produces normal execution payloads (no hidden runtime magic).

The API returns machine-readable JSON for agent loops and optional file references (for example screenshots) for human-facing updates.

## Human Outcome Examples

1. Price comparison for groceries:
   - "When my user asks for the cheapest 24-pack of Coke cans, I can open their preferred shopping apps, run searches, compare prices/sale status, and return the best option."
2. Family location updates:
   - "When the user's child gets on the bus, I can check Life360 and send a screenshot plus current status so the user has immediate visual confirmation."
3. Cross-app home optimization:
   - "I can read room temperature from one app, battery level from another, and then decide whether to adjust HVAC to reduce cost while maintaining comfort."

These are human-first workflows. Clawperator provides reliable app control and data capture; the agent applies reasoning and communicates recommendations to the user.

## Quote from Product Owner

"Agents should own reasoning. Clawperator should own reliable execution. This split gives us faster iteration, safer automation, and cleaner contracts."

## How to Get Started

1. Run `clawperator devices` to resolve the target device.
2. Run `clawperator packages list --device-id <id>` to confirm app/receiver availability.
3. Execute a payload via `clawperator execute --execution <json-or-file> --device-id <id> --receiver-package <pkg>`.
4. Use `clawperator observe snapshot` and `clawperator action ...` wrappers for iterative loops.
5. For reusable flows, compile skill artifacts with `clawperator skills compile-artifact ...` and run the resulting execution.

## Agent Customer Quote

"Before Clawperator, I spent tokens and time debugging shell edge cases. Now I send typed commands, get deterministic results, and focus on decision quality."

## Closing and Call to Action

If you are building an LLM agent that controls Android devices, use Clawperator as the execution substrate and keep reasoning in your agent. Start with the real-device acceptance baseline in `docs/node-api-alpha-release-checklist.md` (using broadly available baseline apps such as Android Settings), then expand to app-specific flows.

## FAQ

### Who is the real customer?

The direct customer of the Clawperator API is the LLM/agent. Humans are the downstream beneficiaries of what the agent can now do reliably.

### Who is this for?

LLM-driven agents and services that need to execute Android actions reliably.

### Why Clawperator?

Important user data is often gated inside consumer mobile apps and not exposed through public websites or APIs. For many high-value agent tasks, reliable access to that in-app state is the difference between "can't help" and "task completed." In practice, this kind of extraction is not broadly feasible on iOS app surfaces for external agent tooling, while Android accessibility and automation primitives make structured interaction and data extraction possible. Clawperator exists to give agents a dependable, typed way to use that Android capability.

### Is this a human-facing automation tool?

Not primarily. Humans can use the CLI, but the design center is machine callers.

### Does Clawperator do agentic planning or autonomous multi-step reasoning?

No. By design, Clawperator does not own planning logic. It executes commands deterministically and reports structured results.

### Does Clawperator "run skills"?

Skills are packaging for agents. Clawperator compiles artifacts into executions and runs executions. It does not require skill-level semantic awareness at runtime.

### Why both CLI and HTTP API?

CLI is fastest for local/dev and script usage; HTTP supports service/multi-client integrations. Both are backed by the same domain services and contracts.

### When should I use direct adb instead of Clawperator?

Only for diagnostics or temporary gaps. For routine automation, use Clawperator commands so result/error semantics remain consistent.

### What is the terminal success/failure contract?

Exactly one `[Clawperator-Result]` terminal envelope per command. Timeouts return deterministic `RESULT_ENVELOPE_TIMEOUT` with diagnostics payload. Node accepts the canonical envelope only.

### How are concurrent runs handled?

Single-flight per device by default. A second overlapping execution on the same device returns `EXECUTION_CONFLICT_IN_FLIGHT`.

### How should agents handle sensitive text in results?

Default behavior is full-fidelity logs/results for agent reasoning. Optional privacy-mode controls are planned for environments requiring stricter policy.
