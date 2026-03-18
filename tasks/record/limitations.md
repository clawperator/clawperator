# Record Feature - Limitations and Design Boundaries

This document captures what the record feature does and does not do, and explains key constraints that should inform any future work on this feature. It is intended as a reference for contributors and agents working on adjacent areas.

---

## What Recording Captures

The Android Accessibility Service captures discrete interaction events: element taps, key presses, and screen transitions. It does not capture:

- Visual rendering or animation state between gestures
- Scroll position within a list (scroll events are captured in the schema but not compiled in v1)
- Text input (captured in schema but out of PoC scope)
- Network requests or any app-internal state
- Timing nuances between gestures (timestamps are recorded but not used for replay timing)

A recording is a lossy representation of user intent. The event log captures identifiable moments of interaction, not a full-fidelity record of what the user did. This is by design: the recording is meant to give an agent enough context to reproduce a flow, not to reconstruct the exact session.

---

## Why Recordings Are Not Directly Executable Scripts

Clawperator's architecture separates concerns: the agent is the brain; Clawperator is the hand. The agent observes, reasons, and decides what to do next. Clawperator executes one discrete command at a time and reports the result.

A compiled recording looks like an execution script, and it is tempting to dispatch it as one. This inverts the model for recordings specifically, for the following reasons:

**Android apps are dynamic.** The same flow run twice on the same device can encounter:
- Interstitial dialogs (permission requests, app review prompts, subscription upsells)
- One-time update or migration screens
- A/B test variants that change UI structure
- Loading states that vary with network and device conditions
- App state left from a prior run (a screen already open, a toggle already active)

None of these appear in a recording. A batched script has no mechanism to notice or handle any of them. The agent does - by calling `observe snapshot` between steps and deciding whether device state matches the expected trajectory.

**A raw recording is not a validated skill.** Skills in the Clawperator skills registry are authored and maintained artifacts. They are expected to handle known variants and have been tested for robustness. A recording is a one-time trace. Running it without agent oversight on anything other than a controlled, stable target app will produce brittle results.

**`execute --execution-file` exists for a reason, but not this reason.** The existing `execute --execution-file` command and the underlying `runExecution()` function are appropriate for stable, validated flows - specifically, skills. Skills are the right destination for a recording that has been validated by an agent, generalized, and deemed robust enough to run without oversight. A raw recording is not there yet. The path from recording to reliable automated flow runs through the agent's judgment.

---

## The Correct Execution Model for Recordings

The agent receives the compiled execution JSON from `record compile`. The agent uses it as a map:

1. Read the next step from the compiled JSON.
2. Issue a single-action `clawperator execute` call.
3. Call `clawperator observe snapshot` to verify device state.
4. If state matches expectation: proceed. If not: adapt, retry, or halt and report.
5. After all steps complete: optionally author a skill artifact from the validated flow.

This model preserves the brain/hand separation. The recording eliminates the exploration cost - the agent no longer needs to discover the navigation path - but execution control stays with the agent at every step.

---

## Replay Reliability

Even with an agent in the loop, accessibility-based playback is best-effort:

- `resourceId` values are not stable across all apps or all versions of the same app. Some apps use dynamic, synthetic IDs that change between sessions.
- Text labels can be localized or changed by the app.
- UI structure can differ between device OEMs and Android versions.
- The PoC targets cooperative, stable apps (Android Settings) specifically because they have stable identifiers.

The compiler's matcher fallback chain (`resourceId` preferred, `textEquals` fallback, `bounds` last resort) handles the common case, but bounds-based matchers are inherently brittle against different screen sizes and densities.

Robustness against the full range of real-world app behavior is a post-PoC concern.

---

## PoC Scope Constraints

The following behaviors are explicitly out of scope for the PoC:

- **Scroll steps:** Captured in the NDJSON schema but not compiled. The compiler emits a warning when scroll events are dropped. Flows that require scrolling to reach a target element will not replay correctly until scroll compilation is implemented (v2).
- **Text input:** Captured in the schema but not compiled. The PoC demo scenario is specifically chosen to avoid text input.
- **Long recordings:** Behavior on recordings longer than roughly 10 user-initiated steps is undefined. The compiler emits a warning at 40+ compiled steps (accounting for injected sleep actions).
- **Cross-device portability:** A recording made on one device may not replay successfully on another due to differing screen dimensions, UI structure, or OEM customizations.
- **Idempotency:** Replays are not guaranteed to produce the same outcome on consecutive runs if app state differs between runs.
- **Popup and dialog handling:** Unexpected dialogs, permission requests, and interstitials that were not present during recording are outside PoC scope. The agent must handle these using its general reasoning capabilities.

---

## What Recordings Are For

A recording is ground truth about what a user did. Its primary value is as structured context for an agent:

- **Skill bootstrap:** An agent constructing a skill for an unfamiliar app can use a recording as a concrete, ordered description of the target flow. The agent no longer needs to explore the UI from scratch. Its job shifts from discovery to refinement: verifying that the recorded steps generalize, adding variable substitution, handling edge cases.
- **Developer iteration context:** A developer can hand a recording to an agent with the instruction to reach a specific screen. The agent uses the recording as a map rather than guessing navigation paths through an app it has never seen.
- **Lightweight smoke test seed:** A validated recording (one that an agent has successfully reproduced) is close to a smoke test. Once the agent authors a skill from it, that skill can be run against a real device as a functional check.

A recording is not a substitute for a skill. It is the seed from which a skill may be grown - with agent involvement.
