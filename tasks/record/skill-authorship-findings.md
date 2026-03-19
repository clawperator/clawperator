# Skill Authorship Findings

This note captures the practical lessons learned while turning recordings into
skills. It is intentionally detailed so future agents can create follow-up
tasks from it without reconstructing the whole debugging history.

The headline lesson is simple: a recording is useful, but it is not yet a
skill. The replay skill must preserve the intended user journey, account for
stateful app behavior, and reach the same semantic end state as the human
recording. When any of those pieces are missing, the generated skill is
usually too brittle or stops too early.

## Executive Summary

We successfully built several useful skills from recordings, but the process
required much more hand holding than it should have.

The repeated failure mode was premature completion:

- the skill writer would stop after reaching an intermediate screen
- a clickable item would be visible but not actually activated
- the skill would match text on the page instead of replaying the recorded
  action
- the replay would succeed mechanically, but not reproduce the user’s full
  intent

The second major issue was that the raw recording was treated as if it were a
literal replay script. That led to brittle output and a lot of ad hoc
judgment calls. In practice, the author needed to normalize the recording into
stable actions, but that normalization was not always explicit or documented.

The third issue was statefulness. Some apps do not start from a clean screen
when reopened. If the skill does not reset the app, the replay can land on the
wrong subpage even when the first recorded interaction was correct.

The fourth issue was termination detection. Several skills needed to stop as
soon as the final result screen was visible, not after an arbitrary delay.
Waiting too long made the skill feel hung; stopping too early made it miss the
final state entirely.

## What We Observed

### 1. The same recording can require multiple levels of interpretation

When we converted recordings into skills, the replay path was rarely a simple
“tap exactly what the recording tapped” procedure.

Examples:

- a launcher tap should usually become `open_app`
- a visible settings row should often be treated as a stable card or row
  click, not as a coordinate replay
- a search flow may need a real IME submit key instead of a naive text-entry
  submit flag
- a detail screen may need one extra click after the target row becomes
  visible

This means the agent needs to do more than copy events. It must decide which
parts of the recording are semantic, which are incidental, and which are only
useful as hints for reconstruction.

### 2. Several “done” points were false finishes

The workflow repeatedly reached a state that looked good enough but was not
yet the actual end of the recorded intent.

Common false finish patterns:

- the app launched, but the intended screen did not open
- the target section was visible, but the target row was not tapped
- the expected result text existed somewhere on the page, but not in the final
  post-action state
- the skill extracted a summary from the screen, but the screen had not yet
  transitioned to the real final screen

This is the strongest signal that we need a replay completeness gate. The
skill should not be considered done until it has accounted for every
meaningful action in the recording or documented why an action was normalized
away.

### 3. Explicit resets help, but they are not always safe to inject

We found a useful pattern in stateful apps:

- if an app resumes into a stale or previously visited subpage, the skill may
  need to start with `close_app`
- then reopen the app with `open_app`
- then continue the recorded navigation

This is effective when the target flow needs a known clean baseline. It is
not safe as a universal default, because it changes user state. The skill
author needs to decide whether the reset is semantically part of the replay or
just a reproducibility aid.

### 4. Some screens need a “settle, then scroll” pattern

Long lists and settings-like views were much more reliable when the skill let
the screen settle briefly and then scrolled to the target.

The practical pattern was:

1. open the app or navigate to the parent tab
2. wait briefly for the UI to settle
3. scroll to the target row
4. click the target row explicitly

This is preferable to waiting for the exact row to be visible before any
scrolling occurs. A skill that waits for visibility first can deadlock on
devices where the target is below the fold.

### 5. Final-state detection should be event-driven, not sleep-driven

The most useful skills finished when the result screen became visible, not
after a fixed timeout. If the skill waits on a hard-coded sleep, it can feel
hung even when the answer is already visible.

The better model is:

- take a snapshot after the action
- if the final state is visible, finish immediately
- otherwise poll briefly until the terminal screen appears
- stop as soon as the terminal screen is reached

This matters most when the final screen has asynchronous loading or a slow
transition.

## Root Causes

### A. The recording contract is weaker than the replay contract

The current recording captures the user’s journey, but not all of the
information needed to safely author a skill from it.

What is missing or weak:

- whether a step is literal or should be normalized
- whether a recorded click is meant to open a new app, select a row, or just
  focus a launcher cell
- which recorded steps are semantically required versus incidental
- which final screen state should be treated as the true completion point

Without that metadata, the agent has to infer too much.

### B. The skill writer is forced to decide replay semantics by hand

Today, the agent must answer questions like:

- should this launcher interaction become `open_app`
- should we prepend `close_app` for a clean baseline
- should this scroll target be matched by text, resource ID, or bounds
- should we tap the visible card, the title text, or the row container
- should the skill stop at the screen that contains the result, or at the
  exact result text

These are not trivial style choices. They are correctness decisions. The
current docs help, but they do not yet turn a recording into a one-shot skill
reliably enough.

### C. There is no replay completeness validator

The biggest operational gap is the absence of a machine check that compares:

- the original recording
- the authored skill
- the final skill run

Without that check, we rely on the author noticing that a click was skipped or
that the skill stopped too early. That is why the same class of problem kept
recurring.

## Concrete Findings for Future Work

### Finding 1: Add a recording-to-skill completeness check

We need a validator that can compare the recording against the authored skill
and answer:

- were all meaningful recorded actions represented?
- if not, was the omission explicitly normalized and documented?
- did the skill reach the same semantic terminal state?
- did the skill run exit only after the final screen was present?

This would catch “the target row was visible but never clicked” and “the skill
finished on an intermediate screen” failures immediately.

Suggested future task:

- create a recording-to-skill verifier that accepts a `.steps.json` file and a
  candidate skill artifact, then reports missing or normalized actions.

### Finding 2: Make normalization rules explicit in the docs and skill output

We already know some normalizations are desirable:

- launcher taps -> `open_app`
- stale app state -> optional `close_app`
- search submit -> real IME submit when required
- long lists -> settle, then scroll to target
- result screens -> terminal-state detection, not fixed sleeps

The docs should make it clear that these are deliberate skill-authoring
choices, not transformations automatically implied by the recording.

Suggested future task:

- add a canonical “recording normalization policy” to the skills docs.

### Finding 3: Teach the parser or step log about semantic action coverage

The current step log is good at describing what happened, but not yet good at
telling an agent which steps are mandatory for a faithful replay.

Future parser metadata could include:

- source event sequence number
- whether the step was literal or normalized
- whether it was a terminal-state indicator
- whether it was required for semantic completeness

This would let downstream tooling reason about “did we replay everything that
matters?” instead of just “did we see the same text again?”

Suggested future task:

- extend the recording parser output with normalization metadata and required
  step flags.

### Finding 4: Add a replay-state strategy for stateful apps

For apps like Settings, the skill may need a deliberate state reset rule.
However, that reset should remain an explicit author decision, not an
automatic insert.

Suggested future task:

- document a “state reset” pattern for replay skills, including when to use
  `close_app`, when to avoid it, and how to note the choice in the skill.

### Finding 5: Improve end-state detection guidance

Some of the most useful skills were the ones that kept polling until the
final screen was genuinely visible, then stopped immediately. That should be
codified more aggressively for future authors.

Suggested future task:

- write a skill-authoring checklist section that requires terminal-state
  detection and prohibits fixed “wait X seconds and hope” completion logic
  unless a better signal is unavailable.

## What Future Agents Should Do

If a future agent is asked to create a skill from a recording, it should
follow this order:

1. Read the recording and identify the semantic end state.
2. Compare the recording against the live device flow and note which actions
   are literal and which are candidates for normalization.
3. Map launcher or app-launch steps to stable `open_app` behavior.
4. Decide whether a deliberate `close_app` reset is needed for reproducible
   state.
5. Keep scrolling flows as “settle, then scroll to target.”
6. Make the final click explicit when the recording shows that the row itself
   was tapped.
7. Finish on the terminal screen, not on an intermediate screen or after a
   fixed delay.
8. Write down any normalization decisions in the skill notes.
9. Validate the skill against the physical device.
10. Only declare the skill complete after the replay actually reproduces the
    full intent.

If any of those steps are skipped, the author should assume the skill is not
yet robust enough.

## Practical Examples

### Example A: Settings-style list navigation

Observed pattern:

- open the app
- wait for the screen to settle
- scroll to the target settings row
- click the row explicitly
- wait for the detail page to load

What to normalize:

- launcher tap -> `open_app`
- optional app reset -> `close_app`
- row visibility wait -> settle, then scroll

### Example B: Search flow with IME submit

Observed pattern:

- open the app
- focus the search field
- enter the query
- press the IME submit key
- wait for the result screen

What to normalize:

- do not assume `enter_text` submit behavior is enough
- use the real submit event the app needs on the device

### Example C: Terminal-state result screen

Observed pattern:

- open a detail page
- trigger the action
- poll until the result text appears
- stop immediately when the result screen is visible

What to normalize:

- replace arbitrary sleeps with event-driven polling
- stop once the terminal state is visible

## Recommended Follow-Up Tasks

These are the follow-up task ideas that seem most valuable now:

1. Add a replay-completeness validator for recording-derived skills.
2. Extend the parser or step log format with normalization metadata.
3. Document a formal normalization policy for recording-to-skill authoring.
4. Add a state-reset guideline for stateful app replays.
5. Expand the skill-authoring checklist so terminal-state detection is
   required.
6. Add examples showing when a recorded click becomes `open_app` or an
   explicit row click in the skill.

## Closing Note

The main operational lesson is that we are not yet at true one-shot skill
generation from a recording. We are close, but only if the author performs the
missing reasoning explicitly and validates the result carefully.

The path forward is to move that reasoning out of the author’s head and into
shared docs, parser metadata, and validation tooling.
