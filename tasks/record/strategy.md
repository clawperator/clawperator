# Record and Replay - Strategic Context

This document captures the reasoning behind the record and replay feature: why it matters, who it serves, and how it fits Clawperator's architecture. It is meant to inform contributors working on this feature and adjacent areas.

---

## The Gap This Fills

Clawperator's core loop is: agent observes device state via snapshot, decides what to do, dispatches an action, repeats. This works well when an agent already knows the shape of a workflow - either from a skill in the registry or from prior exploration.

The gap is the first encounter. When a user wants to automate an app that has no public API and no existing skill, an agent must explore the UI from scratch. It issues a snapshot, reasons about what it sees, clicks something, snapshots again, and so on until it has mapped out the workflow. This is slow, token-expensive, and produces a brittle result because the agent is guessing at intent from visual structure alone.

A recording eliminates that first-encounter cost. The user performs the workflow once. The recording captures the exact path: which elements were tapped, in what order, with what context. Everything the agent would have had to infer is now explicit.

---

## Use Case 1: Skill Bootstrap for Unknown Apps

The skills repository provides reusable workflows for common apps. But the repository cannot cover every app a user wants to automate - especially private apps, regional apps, internal tools, or home automation UIs.

For these cases, the current path is: agent explores UI from scratch and produces a skill. Recording shortens that path significantly.

Even a rough recording used only as context for an agent constructing a skill has meaningful value. The agent no longer needs to guess how to navigate to the target state - the user has already demonstrated it. The agent's job shifts from exploration to refinement: verifying that the recorded steps generalize, adding variable substitution, handling edge cases.

This also changes who can initiate skill creation. Today it requires an agent capable of exploration. With recording, a user with no technical background can record a workflow and hand it to an agent that produces a skill from it. The human's demonstration is the specification.

---

## Use Case 2: Android Developer Productivity

Android developers spend a significant fraction of their iteration time on UI navigation that has nothing to do with the code they are writing. A typical loop looks like:

- Make a code change.
- Build.
- Launch app.
- Navigate through login, onboarding, or several menu screens to reach the screen being worked on.
- Observe behavior.
- Return to code.
- Repeat.

The navigation steps in that loop are pure overhead. Deep links reduce it in some cases, but they require explicit setup and do not cover all flows. Espresso and UIAutomator tests exist but are heavyweight to author and are oriented toward CI, not interactive development.

Replay addresses this directly. A developer records the navigation path once - open app, log in with test credentials, navigate to the target screen - and then replays it whenever they need to return to that state. The replay runs in a few seconds via a single command and requires no build-time setup.

This is closest in spirit to Playwright's codegen, but oriented toward developer iteration rather than test authoring. The recorded flow does not need to be shared, checked into a repository, or maintained. It can be a local, temporary script that a developer keeps for the duration of a feature branch and discards afterward. The skills system supports exactly this - skills do not have to be published.

---

## Use Case 3: Automated and Agent-Driven Testing

Recording is also a viable path into functional UI testing, and this use case should not be undersold.

A recorded happy path - open app, perform a core flow, verify final state - is a lightweight smoke test. It does not require a test framework, does not require instrumenting the app, and can be run against a real device or emulator via a single CLI command. For small teams or individual developers, this is often sufficient.

For agent-driven testing, the value is higher. An agent tasked with verifying UI behavior needs to be able to navigate to the state it is testing. Today that requires either a skill or exploratory navigation. With replay, the agent can use a recorded path to reach the state under test reliably, then apply assertions using snapshot and read_text. The recording handles the "get there" problem; the agent handles the "check it" problem.

This is a meaningful shift. It makes Clawperator a practical tool for UI validation work on real devices - not just automation of external services. The same infrastructure that unlocks home automation workflows also enables a coding agent to verify that a UI change behaves correctly on a physical device, which is something no existing lightweight tool handles well.

---

## Relationship to the Existing Architecture

Record and replay is not a new system. It is an extension of what already exists.

The recording is triggered by two new action types (`start_recording`, `stop_recording`) dispatched through the existing broadcast mechanism. The result comes back through the existing `[Clawperator-Result]` envelope. No new IPC, no new process, no new execution path on the Android side.

The compiler transforms a raw event log into a standard `Execution` JSON - the same format an agent would construct by hand. The replay runs through `runExecution()` unchanged. From the runtime's perspective, a replay is indistinguishable from any other execution.

This alignment is important for long-term maintenance. The recording feature benefits from every improvement made to the execution pipeline - better error messages, new action types, timeout handling - without requiring parallel updates. And the execution pipeline does not need to know or care whether an execution was authored by an agent, compiled from a recording, or written by a human.

The right mental model is: recording is an input mechanism. It produces an `Execution`. Everything downstream of that is the same system it always was.

---

## What This Enables Over Time

The immediate goal is deterministic replay of simple flows. But the infrastructure it produces - a captured event log, a compiler, a replayable execution artifact - sets up several extensions that are worth naming even if they are out of scope now.

**Agent-assisted skill refinement.** A raw recording can be passed to an agent with instructions to generalize it: replace hardcoded text with variables, add wait conditions, handle the case where a dialog appears. The agent's job is straightforward because the base flow is already known.

**Replay as test fixture.** A recorded navigation flow can serve as the setup step for an agent-authored test. Navigate to this state, then apply assertions. This is a clean separation: replay handles navigation, agent handles verification.

**Shared team recordings.** A developer records a login flow and commits the compiled execution JSON to a shared repository. Other developers and agents on the team use it as a local shortcut. This requires nothing beyond what ships in Phase 3.

**Visual regression baseline.** A recording session that captures screenshots at each step establishes a visual baseline. Subsequent replays can compare against it. This is a future phase, but the recording event schema is designed to accommodate screenshot events without breaking changes.

---

## Summary

Record and replay serves three audiences with a single piece of infrastructure:

1. **End users** who want to automate apps that have no skill in the registry. They record the flow themselves; an agent or the compiler turns it into a replayable automation.

2. **Android developers** who want to eliminate the navigation overhead of iterative development. They record the path to the screen they are working on and replay it instead of navigating manually on every iteration.

3. **Developers and agents** who want lightweight UI verification on real devices. A recorded happy path is a runnable smoke test with no additional tooling required.

All three use cases are served by the same three-phase implementation - record, extract, replay - built on top of existing execution infrastructure.
