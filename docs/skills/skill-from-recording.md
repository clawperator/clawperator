# Skill Authoring from Recordings

This note captures how agents should turn a raw Android recording into a
reusable skill. If you are starting from the capture itself, first read
[Android Recording Format for Agents](../ai-agents/android-recording.md) so
the recording fields and limits are clear before you normalize anything.

The key principle is that a recording is evidence of user intent, not the
final replay script. A skill is allowed to normalize the trace when that makes
the flow more reliable, but those normalizations must be deliberate and
documented.

The Phase 3 skills built from recordings currently live as local
proof-of-concept artifacts under `~/.clawperator/skills/skills/...` rather
than as canonical entries in the shared skills repo. This page explains the
recording-side contract and the durable lessons from the experiment; the
skills-repo docs cover the general authoring workflow and prompt templates.
When regenerating the docs site locally, keep the sibling skills repo checked
out at a matching commit so the linked authoring pages and this recording note
stay in sync.

In practice, that means the author must be able to answer two questions for
every step:

1. Was this action replayed literally?
2. If not, what stable skill-level action replaced it, and why?

If the answer is unclear, the skill is not done yet.

## What to normalize

### Launcher taps become `open_app`

If the recording shows the user launching an app from the home screen or
launcher, the skill should usually express that as `open_app` rather than as a
launcher-coordinate click.

Why:

- launcher layouts move around
- icon positions change with screen size, folders, and personalization
- the goal of the skill is to reach the app, not to replay the launcher UI

That mapping is a skill-authoring decision. It is not part of the raw
recording contract.

### Fresh starts may need `close_app`

Some apps resume into the last visited screen instead of opening on a clean
home page. If the target flow depends on starting from a stable baseline, the
skill author may intentionally prepend `close_app` before `open_app` to force a
fresh launch.

This should be treated as a deliberate normalization step, not a default
recording transformation. Do not inject `close_app` automatically just because a
recording exists.

Use it when:

- the app is stateful and resumes into a stale subpage
- the skill needs a known baseline to be reproducible
- the cost of reset is lower than the risk of resuming mid-flow

Do not use it when:

- preserving the exact post-launch state matters
- the recorded flow already begins from a clean app session
- the skill is intentionally meant to resume from the current app state

## What makes a recording-derived skill complete

The most important lesson from constructing recording-derived skills is that
"it reaches the right screen" is not enough. The replay is complete only when:

- every meaningful recorded action is represented literally or intentionally
  normalized
- any omitted step has a documented reason
- the skill reaches the same semantic terminal state as the recording
- the final screen is detected from live state, not from a fixed timeout

This is the gap that kept causing premature finishes while we built skills.
The author would reach an intermediate screen, extract useful text, and declare
success before the recorded intent had actually been replayed. Future skill
work should treat that as a validation failure, not as a successful shortcut.

## Practical replay rule

When the agent validates a recording, it should read the raw step log as a
guide, then decide which parts should remain literal and which parts should be
abstracted into stable runtime actions.

Typical pattern:

1. Keep the recorded intent.
2. Map launcher entry to `open_app`.
3. Add `close_app` only when a fresh start is needed for reproducibility.
4. Re-check the device state with live snapshots while validating the flow.
5. Author the skill from the validated, normalized sequence.

## Common patterns from recording-derived skills

The following patterns came out of the Phase 3 skill work and should be
preserved because they are the kinds of moves a future agent will need to
make when turning a recording into a skill.

### Settings-style list navigation

- open the app or parent tab
- let the screen settle briefly
- scroll to the target row
- click the row explicitly
- wait for the detail page to load

This is the pattern behind the Settings skills we authored. The important
part is that the skill should click the row that was actually meant to open a
detail page, not just stop when the row becomes visible.

### Search flows that need a real submit key

- focus the query field
- enter the text
- press the IME submit key if the app does not advance on its own
- continue only when the result screen or suggestion state changes

This was necessary for one of the recording-derived skills because the search
screen stayed open after text entry until the real IME submit action was sent.

### Terminal-state screens

- trigger the action
- poll live snapshots until the real result screen is visible
- stop immediately when the terminal state appears

This avoids the “it looked done, but the last action never actually happened”
failure mode that kept appearing during skill authorship.

## Skill authoring lessons

These lessons came out of the first recording-derived skills we built.

- Treat the recording as intent evidence, not as a literal replay script.
- Launcher taps are often better represented as `open_app`.
- `close_app` is a deliberate reset step for stateful apps, not an automatic
  rewrite of every recording.
- Search-entry screens often need a real IME submit key event instead of a
  synthetic `enter_text` submit flag.
- A good replay skill should finish on terminal screen detection, not on fixed
  post-action sleeps.
- If the result screen is slow or transitional, poll live snapshots until the
  terminal state appears, then stop immediately.
- Keep a small amount of stderr progress logging so manual runs are not
  opaque, but keep stdout reserved for the actual result artifact.
- Treat a raw recording as bootstrap evidence. The parser output is a guide
  for authoring, not a promise that the exact event sequence should be replayed
  verbatim.
- If a literal replay drops a step that mattered in the recording, either add
  the step back or explain the normalization in the skill docs before calling
  the skill complete.
- A replay skill should be judged by semantic coverage, not just by whether it
  found a plausible end screen.

## Suggested authoring prompt

When an agent is turning a recording into a skill, a useful starting prompt is:

> Read the recording as bootstrap evidence, not as a literal replay script.
> For every meaningful action, either replay it literally or explain how it
> was normalized into a stable skill-level step. Normalize launcher taps to
> `open_app`, use `close_app` only when a fresh baseline is required, keep
> scrollable lists in a settle-then-scroll pattern, and finish on terminal-state
> detection instead of fixed sleeps. If a recorded step disappears, stop and
> justify the change before calling the skill complete.

## Why one-shot skill generation is still hard

The recording captures what the user did, but not what it meant. It does not
indicate which steps are semantically required versus incidental, whether a
given click was intended to open a new context or just focus a field, or which
final screen state represents genuine completion. Without that metadata, the
skill author must reconstruct those decisions from scratch every time.

The agent is therefore forced to make correctness decisions - not style choices
- by hand on every authoring pass. Should this launcher interaction become
`open_app`? Should this scroll target be matched by text, resource ID, or
bounds? Does the skill stop at the screen that contains the result, or at the
exact result element? The current docs reduce the cost of those decisions but
do not eliminate them. Until the recording contract carries normalization
metadata, one-shot skill generation will require an author who understands what
the recording was trying to accomplish, not just what it captured.

This is the structural motivation for the parser metadata follow-up below.

## Validated recording-derived skills

These are the reusable skills that were produced from human-recorded flows
and smoke-tested during Phase 3. They are still local proof-of-concept
artifacts in the installed skills checkout, but their skill IDs and replay
commands are stable enough for future agents to reuse or rerun.

| Skill ID | Provenance | Smoke command |
| :--- | :--- | :--- |
| `com.android.settings.check-software-update` | Settings -> Software update flow, validated to the "Your software is up to date" terminal screen. | `clawperator skills run com.android.settings.check-software-update --device <device_id>` |
| `com.android.settings.set-theme` | Samsung Settings theme flow, parameterized for dark or light and validated on both themes. | `clawperator skills run com.android.settings.set-theme --device <device_id>` |
| `com.solaxcloud.starter.get-device-discharging` | SolaX Cloud Device Discharging flow, validated to the detail screen text extraction path. | `clawperator skills run com.solaxcloud.starter.get-device-discharging --device <device_id>` |

If you are reusing one of these skills, start from the skill ID and the
validated smoke command above, then inspect the matching `SKILL.md` in the
skills checkout for argument details and output expectations.

## Open follow-ups

These are the future improvements that the skill-authorship work surfaced and
should be tracked as follow-on tasks rather than forgotten when the PoC task
files are cleaned up:

- a replay-completeness validator that compares the recording against the
  authored skill and reports missing or unnormalized actions
- parser metadata that marks whether a step was literal, normalized, or
  terminal-state related - this is the direct fix for the structural gap above
- a canonical normalization policy covering all five known normalizations:
  launcher tap to `open_app`, stale app state to optional `close_app`, search
  submit to real IME event, long lists to settle-then-scroll, and result screens
  to terminal-state detection rather than fixed sleeps
- a documented decision rule for when `close_app` is a reproducibility aid
  versus an inappropriate mutation of the user's recorded state
- a checklist that requires terminal-state detection for replay-derived skills
  and explicitly prohibits fixed "sleep and hope" completion logic

## Related docs

- [Android Recording Format for Agents](../ai-agents/android-recording.md)
- [Skill Authoring Guidelines](../skills/skill-authoring-guidelines.md)
- [Clawperator Node API - Agent Guide](../ai-agents/node-api-for-agents.md)
- [Clawperator Skill Design](../design/skill-design.md)
