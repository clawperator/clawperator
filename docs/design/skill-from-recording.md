# Skill Authoring from Recordings

This note captures how agents should turn a raw recording into a reusable
skill.

The key principle is that a recording is evidence of user intent, not the
final replay script. A skill is allowed to normalize the trace when that makes
the flow more reliable, but those normalizations must be deliberate and
documented.

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

## What Phase 3 taught us

- Treat the recording as intent evidence, not as a literal replay script.
- Launcher taps are often better represented as `open_app`.
- `close_app` is a deliberate reset step for stateful apps, not an automatic
  rewrite of every recording.
- A good replay skill should finish on terminal screen detection, not on fixed
  post-action sleeps.
- If the result screen is slow or transitional, poll live snapshots until the
  terminal state appears, then stop immediately.
- Keep a small amount of stderr progress logging so manual runs are not
  opaque, but keep stdout reserved for the actual result artifact.
- During validation, prefer the branch-local Node CLI build and the dev
  receiver package so the skill exercises the code that is actually being
  authored.

## Related docs

- [Android Recording Format for Agents](../ai-agents/android-recording.md)
- [Clawperator Node API - Agent Guide](../ai-agents/node-api-for-agents.md)
- [Clawperator Skill Design](../design/skill-design.md)
