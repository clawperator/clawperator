# Project Overview

## Mission
Clawperator is a deterministic actuator tool for LLM-driven Android automation. It provides a stable execution layer that allows agents to perform actions on a dedicated, permanently-connected Android device (affectionately called a **"burner"**) on behalf of a user.

This approach ensures that the user's primary phone (e.g., an iPhone) remains undisturbed while the burner device handles automation tasks. There are virtually no hardware requirements; any cheap or old Android device can serve as a reliable actuator.

## Core Philosophy: The Brain and the Hand
Clawperator is designed as the execution "hand" for an LLM "brain":

1.  **The Agent (The Brain):** An external LLM (e.g., OpenClaw) that owns reasoning, planning, and decision-making. It supervises the automation and decides which actions to take based on the user's intent.
2.  **Clawperator (The Hand):** A deterministic actuator tool. It provides the reliable "fingers" to observe UI state (`snapshot_ui`), perform precise interactions (taps, scrolls), and report structured results back to the brain.

**Clawperator is intentionally not intelligent.** It does not perform autonomous multi-step reasoning or agentic planning. It follows instructions and provides high-fidelity feedback so the Agent can drive the process.

## Architecture
The system consists of two primary layers:

-   **Android Runtime (`apps/android`):** An Android application that leverages Accessibility APIs to inspect the UI tree and perform actions (taps, scrolls, text entry, and system hard-keys like `back`/`home`). It listens for commands via a broadcast receiver.
-   **Node Runtime/CLI (`apps/node`):** The primary interface for agents. It wraps `adb` interactions, validates execution payloads, dispatches commands to the Android device, and parses canonical result envelopes from logs.

## The Role of Skills
Skills are reusable templates for app-specific workflows (e.g., "get thermostat temperature" or "check grocery prices").

-   **Canonical Home:** `../clawperator-skills` (a dedicated sibling repository).
-   **Nature of Skills:** Due to the dynamic nature of mobile apps (A/B tests, server-side flags, unexpected popups), skills are treated as **highly informed context** for the Agent rather than purely deterministic scripts.
-   **Agent Responsibility:** The Agent uses skill templates as a baseline, modifying them at runtime to handle personal configurations (variable substitution) or UI drift.

## Package Identifiers
-   **`com.clawperator.operator`**: The production/release package name.
-   **`com.clawperator.operator.dev`**: The local development package name (used when building from source).

## Safety & Privacy
- **Redaction (Upcoming):** Future versions will include regex-based redaction of PII (names, addresses, digits) from result envelopes to ensure sensitive data is not leaked into agent memory.
- **Control:** The "Two-Handed" model ensures that agents can only execute within the safety bounds defined by the Clawperator runtime.
-   **Observability:** Agents use `snapshot_ui` (ASCII or JSON) and screenshots to "see" the device state.
