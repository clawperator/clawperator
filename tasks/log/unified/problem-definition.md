# Unified Logging: Problem Definition

Created: 2026-03-22

Status: pre-planning. No implementation scheduled.
Context: assumes PRD-1 through PRD-5.5 have shipped.

---

## The Problem

Clawperator currently has three logging surfaces that operate independently and do not
share a common infrastructure. This creates two practical problems:

1. **Incomplete log files.** When something goes wrong, the on-disk log does not contain
   enough context to diagnose it without the terminal session that produced the output.

2. **No consistent control surface.** There is no single place to say "log this at debug
   level to file but not to terminal" or "suppress skill progress in JSON mode but keep
   it in the file." Each surface has its own implicit rules.

---

## The Three Current Surfaces

**Surface 1 — Node lifecycle events → NDJSON file** (PRD-5)

The Node CLI writes structured events to `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`.
These cover coarse lifecycle moments: skill run start/complete/timeout,
broadcast dispatched, envelope received, APK pre-flight result, doctor checks.

Controlled by `--log-level` and `CLAWPERATOR_LOG_DIR`. Written by the Node domain and CLI
layers. Agents and operators can `tail` this file to understand what the system did.

**Surface 2 — Skill script progress → terminal only** (PRD-5.5)

Skill scripts emit `[skill] ...` lines via `console.log`. These are streamed to the
terminal in real time via PRD-4's `onOutput` callback. They never reach the NDJSON log.

**Surface 3 — Structured terminal output → terminal only**

The CLI layer emits formatted output to stdout (pretty mode) or a JSON envelope (JSON
mode). This includes the pre-run banner (PRD-4), validation results, doctor output, and
final result envelopes. None of this goes to the log file.

---

## The Gap

The gap is most visible when a skill times out. The NDJSON log contains:

```
{"event":"skills.run.start","skillId":"com.globird.energy.get-usage","ts":...}
{"event":"skills.run.timeout","skillId":"com.globird.energy.get-usage","elapsedMs":30021,"ts":...}
```

It does NOT contain:

```
{"event":"skill.progress","message":"Launching GloBird app...","ts":...}
{"event":"skill.progress","message":"Navigating to Energy tab...","ts":...}
{"event":"skill.progress","message":"Capturing energy usage snapshot...","ts":...}  ← timed out here
```

An agent or operator reading the log file after the fact knows a timeout occurred, but
not which phase the skill was on when it timed out. That context exists only in the
terminal session that ran the skill — which may no longer be available.

The same gap applies to the pre-run banner, validation results, and other terminal output:
none of it is in the log file.

---

## What a Unified Logger Would Do

A unified logger would be a single abstraction that all Clawperator layers (domain,
CLI, skill scripts) route through. The logger would decide where each event goes based
on its level, type, and the current output configuration.

Key behaviours:

- **Skill progress in the log file.** `[skill]` lines from PRD-5.5 would be captured
  as `skill.progress` events in the NDJSON log, not just streamed to the terminal.
  After a timeout, you could grep the log for the last `skill.progress` event to see
  exactly which phase the skill was on.

- **Single control surface.** `--log-level` would control what goes to file. Output mode
  (`pretty` vs `json`) would control what goes to terminal. One place to configure both,
  no duplication.

- **No dropped events.** Today, if the `onOutput` callback is not wired (e.g. JSON mode),
  skill progress lines are never emitted to anyone. With a unified logger, they would
  still go to the log file even when suppressed from the terminal.

- **Consistent event schema.** All events — lifecycle, skill progress, terminal output —
  share the same `{event, ts, ...payload}` shape. Easier to filter, correlate, and
  forward to external systems later.

---

## Relationship to Existing PRDs

| PRD | What it adds | Gap it leaves |
|-----|-------------|---------------|
| PRD-5 | NDJSON file for lifecycle events | Skill progress not captured |
| PRD-5.5 | Skill progress to terminal | Not in log file; not captured in JSON mode |
| PRD-4 | `onOutput` callback; `onOutput` consumers control destination | No shared logger; each consumer wired independently |

A unified logger would sit above all three, replacing the ad-hoc wiring of individual
`onOutput` consumers with a single routing layer.

---

## Known Constraints

- **Skill scripts are separate processes.** Skill scripts run as child processes spawned
  by `runSkill.ts`. They cannot directly call a Node logger object. Their stdout/stderr
  is the only channel available. The unified logger would capture this output via the
  existing `onOutput` callback — the skill scripts themselves would not change.

- **JSON mode must stay clean.** Any unified logger must not write to `process.stdout` in
  JSON mode. The log file is the right destination for events that should not appear on
  stdout. This constraint is already respected by PRD-4 and PRD-5 individually; a unified
  logger must maintain it.

- **Fail-open requirement.** PRD-5 establishes that logging must be fail-open: if the log
  directory cannot be created, emit one stderr warning and continue. A unified logger must
  inherit this behaviour.

---

## Out of Scope for This Document

- Implementation plan, API design, or module structure
- Log forwarding to external systems (Datadog, CloudWatch, etc.)
- Log rotation, compression, or retention policies (deferred in PRD-5)
- Structured logging protocol for skill scripts (deferred in PRD-5.5)

These are downstream of getting the unified logger architecture right and should be
planned once the core design is settled.

---

## Deferred Work Required

### `clawperator logs`

Status: deferred until the unified logger exists.

Required work:

- add a `logs` top-level command with the settled streaming form `clawperator logs --follow`
- support the alias `logs -f`
- stream NDJSON log output until Ctrl+C
- keep query and filter flags out of scope until the logger event schema is defined
- preserve the existing fail-open logging behavior if the log directory is unavailable

Why this is deferred:

- the command depends on the unified logger event schema
- the logger design must settle the file and terminal routing rules before filters and queries can be defined
- the CLI surface is intentionally frozen around streaming-only behavior for now

Acceptance criteria:

- `clawperator logs --follow` streams the current log file and exits cleanly on interrupt
- `logs -f` behaves identically
- the command is documented in the source-of-truth docs once implemented
- no additional command groups or compatibility shims are introduced unless the logger design requires them

---

## Next Step

When this becomes a priority, the first task is an architecture spike: design the
`ClawperatorLogger` interface, define the event schema, and map the wiring points across
the domain and CLI layers. That spike should produce a PRD with concrete implementation
details before any code is written.
