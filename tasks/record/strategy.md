# Record Feature - Strategic Context

This document captures the reasoning behind the record feature: why it matters, who it serves, and how it fits Clawperator's architecture. It is meant to inform contributors working on this feature and adjacent areas.

---

## The Gap This Fills

Clawperator's core loop is: agent observes device state via snapshot, decides what to do, dispatches an action, repeats. This works well when an agent already knows the shape of a workflow - either from a skill in the registry or from prior exploration.

The gap is the first encounter. When a user wants to automate an app that has no public API and no existing skill, an agent must explore the UI from scratch. It issues a snapshot, reasons about what it sees, clicks something, snapshots again, and so on until it has mapped out the workflow. This is slow, token-expensive, and produces a brittle result because the agent is guessing at intent from visual structure alone.

A recording eliminates that first-encounter cost. The user performs the workflow once. The recording captures the exact path: which elements were tapped, in what order, with what context. Everything the agent would have had to infer is now explicit. The agent's job shifts from blind exploration to guided reproduction and validation.

---

## The Architecture: Record, Parse, Validate, Skill

The record feature is not a replay system. Clawperator does not replay anything - it executes one command at a time and returns a result. The feature follows this path:

1. **Record:** User performs the workflow on the device. The Android Accessibility Service captures each interaction paired with a UI snapshot taken at that moment - the same hierarchy XML that `snapshot_ui` returns. Output is an NDJSON file on device.
2. **Parse:** Node pulls the NDJSON and extracts an ordered step log: each step as a `{uiStateBefore, action}` pair. No matcher synthesis, no sleep injection - just filtering and extraction. Output is a `session.steps.json` file.
3. **Agent validates:** An agent reads the step log and reproduces the flow using individual `clawperator execute` calls, observing device state between each step. For each step it sees what the UI looked like when the user interacted and what they did - the same context it would have doing the flow from scratch, minus the exploration cost. The agent is in the loop at every decision point.
4. **Skill:** Once the agent has validated that the flow works, it authors a skill artifact. The skill is the durable, reusable output. It can be run by any agent via `skills run` and maintained over time. The recording and step log are bootstrap inputs - they do not replace the skill.

This path preserves Clawperator's brain/hand separation. The agent makes all decisions. Clawperator executes individual actions and reports results. At no point does a raw recording become a batch script that runs without agent oversight.

---

## Use Case 1: Android Developer Productivity

Android developers spend a significant fraction of their iteration time on UI navigation that has nothing to do with the code they are writing. A typical loop looks like:

- Make a code change.
- Build.
- Launch app.
- Navigate through login, onboarding, or several menu screens to reach the screen being worked on.
- Observe behavior.
- Return to code.
- Repeat.

The navigation steps in that loop are pure overhead. Deep links reduce it in some cases, but they require explicit setup and do not cover all flows.

Recording addresses this directly. A developer records the navigation path once. The step log is handed to an agent that reproduces the flow step by step with observation between each action. The agent authors a local skill from the validated flow. From that point on, the developer can run the skill via a single `clawperator skills run` command to return to their target screen - rather than navigating manually on every iteration.

This is closest in spirit to Playwright's codegen, but the durable artifact is a Clawperator skill, not a replay script. The skill is the thing the developer runs; the recording and step log are how the skill was bootstrapped. A local, private skill that lives for the duration of a feature branch and is discarded afterward is a valid and intentional use of the skills system.

---

## Use Case 2: Skill Bootstrap for Unknown Apps

The skills repository covers common apps, but cannot cover every private, regional, or internal tool a user wants to automate. Today, an agent must explore an unfamiliar app's UI from scratch to construct a skill - slow, token-expensive, and error-prone.

A recording eliminates that exploration cost. The user demonstrates the flow once. The step log gives the agent ground truth about what was done: which elements were tapped, in what order, and what the UI looked like at each moment. The agent no longer needs to guess the navigation path or explore the UI structure. It reads the step log, reproduces each step with device observation, and authors a skill from the validated flow.

This changes who can initiate skill creation. Today it requires an agent capable of exploration. With recording, a user with no technical background can record a workflow and hand it to an agent that produces a skill from it. The human's demonstration is the specification; the agent's job is refinement and validation.

---

## Use Case 3: UI Testing and Verification

Recording is also a viable path into functional UI testing.

A validated recording - one that an agent has successfully reproduced and authored as a skill - is a lightweight smoke test. Running the skill against a real device or emulator via a single CLI command verifies that the target screen is still reachable. For small teams or individual developers this is often sufficient.

For agent-driven development, the value is higher. An agent tasked with verifying UI behavior needs to navigate to the state it is testing. Today that requires either a skill or exploratory navigation. With the record feature, the agent uses a validated skill (authored from a recording) to reach the target state reliably, then applies assertions using `snapshot_ui` and `read_text`. The skill handles the "get there" problem; the agent handles the "check it" problem.

The critical distinction: the runnable artifact is a skill that was validated from a recording, not the raw recording itself. The skill has been tested, is expected to handle normal app variants, and can be maintained over time. The recording is a one-time trace that served its purpose as bootstrap input.

---

## Relationship to the Existing Architecture

Record is not a new system. It is an extension of what already exists.

The recording is triggered by two new action types (`start_recording`, `stop_recording`) dispatched through the existing broadcast mechanism. The result comes back through the existing `[Clawperator-Result]` envelope. No new IPC, no new process, no new execution path on the Android side.

The parser produces a step log from the NDJSON - an ordered list of `{uiStateBefore, action}` pairs using the same UI hierarchy XML that agents already work with. The agent-validated reproduction loop uses `clawperator execute` and `clawperator observe snapshot` - the same commands it always uses. Skill authoring uses the existing skills system.

The right mental model is: recording is an input mechanism. It produces a step log for an agent. Everything the agent does with that step log is already how Clawperator works.

---

## What This Enables Over Time

The immediate goal is a validated agent-assisted bootstrap for simple flows. But the infrastructure it produces sets up several extensions worth naming even if they are out of scope now.

**Agent-assisted skill refinement.** A step log can be passed to an agent with instructions to generalize it: replace hardcoded text with variables, add wait conditions, handle the case where a dialog appears. The agent's job is straightforward because the base flow is already known - and it has the UI context for each step.

**Shared team recordings.** A developer records a flow and shares the step log with teammates. Each teammate hands it to an agent for reproduction and skill authoring. The recording is the common starting point; the skills may differ in how they generalize it.

**Replay as test fixture.** A skill authored from a validated recording serves as the setup step for an agent-authored test. Navigate to this state (via skill), then apply assertions. The skill handles navigation; the agent handles verification.

---

## Summary

Record serves three audiences with a single piece of infrastructure:

1. **Android developers** who want to eliminate the navigation overhead of iterative development. They record the path to the screen they are working on; an agent validates and authors a local skill that they run on every iteration.

2. **End users** who want to automate apps that have no skill in the registry. They record the flow themselves; an agent validates it and authors a skill.

3. **Developers and agents** who want lightweight UI verification on real devices. A skill authored from a validated recording is a runnable smoke test with no additional tooling required.

All three use cases are served by the same three-phase implementation - record, parse, agent-validate-and-skill - built on top of existing Clawperator infrastructure. The recording and step log are bootstrap artifacts. The skill is the durable output.
