# Recording Demo Meta Problem Summary

Created: 2026-04-10

## Purpose

Capture the higher-level problem exposed by the Solax recording exercise:
recordings are useful authoring evidence, but they are not yet sufficient to
reliably produce robust reusable skills for non-trivial app flows.

This file is task-scoped. Durable guidance should later move into the
repo-local authoring skill and, if appropriate, the main docs.

## Problem Statement

Clawperator documentation describes a strong and intuitive `brain` and `hand`
model:

- the agent is the brain
- Clawperator is the hand

That framing is clear and valuable.

However, the current skill-authoring practice does not consistently implement
that model. In practice, the skills we are producing from recordings are often
closer to brittle scripted replays than to brain-guided goal execution.

The Solax `set-discharge-to-limit` work exposed that gap directly.

## What We Observed

### 1. A recording was useful, but not enough

The recording provided:

- the rough path shape
- likely labels and resource ids
- timing pressure points
- evidence that some human taps landed on blank space beside labels rather than
  on the label text itself

But the recording alone did not provide enough information to derive a stable
skill.

We still needed live:

- screenshots
- UI hierarchy dumps
- repeated runs
- direct inspection of where the flow stalled

### 2. The same skill reached different stages on different runs

During development, multiple runs reached different stopping points:

- some runs failed early
- later runs reached deeper screens
- some corrected changes improved one stage but regressed an earlier one

That means the implementation was carrying hidden assumptions about:

- the true clickable node
- the starting screen
- timing
- post-click navigation shape

This is a signal that the skill is not yet operating as a brain-guided workflow
with explicit checkpoints.

### 3. Visible labels were not always the actionable nodes

The recorded human interaction included taps on blank space beside headings.

In the Solax UI, that mattered:

- `Peak Export` text was not the full actionable target
- `Device Discharging (By percentage)` text was not the same as the next
  desired dialog row
- the real working flow required identifying clickable containers and then
  drilling one level deeper to the actual `Discharge to ...` row

This is exactly the kind of nuance that raw replay tends to flatten and miss.

### 4. The working skill required live interpretation

The final working path was only found after combining:

- recording evidence
- parsed step log
- live screenshots
- UI dumps
- iterative hypothesis testing

That is brain work.

The current authoring loop still depends on the human or agent doing that
interpretation manually after the recording, rather than the skill architecture
naturally supporting it.

## Why This Matters

If we treat a recording as though it can directly yield a replayable skill, we
will keep producing flows that break when:

- a remote-config experiment changes the screen
- an upgrade wall or modal appears
- a different device layout changes the tappable area
- a control moves but the underlying intent stays the same
- the same app state is represented by a different intermediate screen

That means the current approach risks producing skills that look promising in a
single captured run but are not durable enough for agent use.

## Core Tension

The docs encourage a `brain -> hand` mental model, but the current recording
authoring workflow tends to compress those roles together:

- the skill script hardcodes path assumptions
- the skill script blindly replays actions
- the agent is not consistently inspecting state between major transitions

That is much closer to a macro recorder than to a deliberate actuator runtime.

## Interim Conclusion

Recording should be treated as:

- evidence for authoring
- a source of candidate selectors
- a source of timing and path observations

Recording should not be treated as:

- sufficient proof of a stable replay path
- a direct generator of durable skills for complex apps

For complex skills, the durable pattern likely needs:

- explicit checkpoints
- state inspection between stages
- conditional navigation
- recovery or failure reporting when expected UI is missing

## Questions To Carry Forward

- How should a skill represent checkpoints and recovery decisions so the agent
  remains the brain and Clawperator remains the hand?
- Should public skills stay coarse while internal helper modules become more
  decomposed?
- What is the minimum viable authoring pattern that converts recording evidence
  into robust checkpointed skills rather than brittle replays?
- Which parts of this should be encoded into the future
  `.agents/skills/skill-author-by-recording/` workflow?
