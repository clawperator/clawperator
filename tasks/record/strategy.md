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

## Use Case 1: Skill Bootstrap

The skills repository covers common apps, but cannot cover every private, regional, or internal tool a user wants to automate. Today, an agent must explore an unfamiliar app's UI from scratch to construct a skill - slow, token-expensive, and error-prone.

A recording eliminates that exploration cost. The user demonstrates the flow once. The step log gives the agent ground truth about what was done: which elements were tapped, in what order, and what the UI looked like at each moment. The agent no longer needs to guess the navigation path or explore the UI structure. It reads the step log, reproduces each step with device observation, and authors a skill from the validated flow.

This changes who can initiate skill creation. Today it requires an agent capable of exploration. With recording, a user with no technical background can record a workflow and hand it to an agent that produces a skill from it. The human's demonstration is the specification; the agent's job is refinement and validation.

---

## Use Case 2: Android Automation

Once a skill exists - whether bootstrapped from a recording or authored directly - Clawperator can use it as a reliable automation primitive. Two concrete scenarios illustrate this:

**Developer iteration.** Android developers spend a significant fraction of their iteration time on UI navigation that has nothing to do with the code they are writing - logging in with test credentials, tapping through onboarding, reaching a nested settings panel. A developer records the path once, an agent validates and authors a local skill, and from that point on the developer runs the skill as a single `clawperator skills run` command on every iteration. A local, private skill that lives for the duration of a feature branch and is discarded afterward is a valid and intentional use of the skills system. This is closest in spirit to Playwright's codegen, but the durable artifact is a Clawperator skill, not a replay script.

**UI verification.** A validated skill is a lightweight smoke test with no test framework, no instrumentation, and no build-time setup required. Running it against a real device or emulator via a single CLI command verifies that the target screen is still reachable. For agent-driven development, the value is higher: an agent runs the skill to reach the state under test, then applies assertions using `snapshot_ui` and `read_text`. The skill handles the "get there" problem; the agent handles the "check it" problem. This makes Clawperator a practical tool for UI verification on real devices - something existing tools like Espresso and UIAutomator handle poorly in interactive development, because they are test-framework-centric, require build-time instrumentation, and are not agent-friendly.

The critical distinction in both scenarios: the runnable artifact is a skill that was validated from a recording, not the raw recording itself. The recording is a one-time trace that served its purpose as bootstrap input.

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

Record serves two use cases with a single piece of infrastructure:

1. **Skill bootstrap:** A user records a flow on any app - private, regional, or unfamiliar - and hands the step log to an agent. The agent reproduces the flow with device observation and authors a skill. The recording is the specification; the skill is the durable output.

2. **Android automation:** The authored skill becomes a reliable automation primitive - for developer iteration (navigate to the screen under development in one command), for UI verification (run the skill as a smoke test, then apply assertions), or any other agent-driven scenario where a validated navigation path is needed.

Both use cases are served by the same three-phase implementation - record, parse, agent-validate-and-skill - built on top of existing Clawperator infrastructure. The recording and step log are bootstrap artifacts. The skill is the durable output.
