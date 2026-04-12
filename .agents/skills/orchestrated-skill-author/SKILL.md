---
name: orchestrated-skill-author
description: Author or refactor Clawperator orchestrated skills so they follow the durable orchestrated runtime contract: `SKILL.md` owns skill authority, `skill.json.agent` owns trusted runtime metadata, and `scripts/run.js` stays a thin harness.
---

# Orchestrated Skill Author

Author or refactor `-orchestrated` skills without smuggling skill authority into the harness.

Use this skill when:

- creating a new orchestrated skill
- converting an existing skill into an orchestrated sibling
- reviewing whether an orchestrated skill still matches the intended runtime shape

## Governing Definition

Read these first:

- `docs/skills/overview.md#orchestrated-runtime-contract`
- `docs/skills/authoring.md#authoring-agent-driven-orchestrated-skills`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`

Treat the docs section in `docs/skills/overview.md` as the durable contract name and `runSkill.ts` as the implementation authority.

## Orchestrated Runtime Contract

An orchestrated skill must follow these rules:

- `skill.json.agent` is trusted runtime metadata only. It declares the agent CLI and timeout policy.
- `SKILL.md` is the skill authority. It owns the app-specific runtime program, checkpoints, and terminal verification policy.
- `scripts/run.js` is a thin harness. It reads Clawperator-injected env vars, spawns the configured agent CLI on `SKILL.md`, and forwards stdout and stderr.
- the harness must not become the real skill. Do not move navigation logic, recovery policy, checkpoint policy, or terminal verification rules into `scripts/run.js`.
- the runtime agent must emit exactly one terminal `[Clawperator-Skill-Result]` frame with a valid `SkillResult` object.
- the frame must omit `source`. Clawperator injects trusted source metadata from `skill.json.agent`.
- replay skills remain first-class. Do not treat orchestrated authoring as a replacement for replay authoring.

Current implementation notes:

- the currently supported orchestrated runtime path uses `codex` as the agent CLI
- orchestrated skills currently run codex with `danger-full-access` so the runtime agent can reach live adb targets

## Authoring Workflow

1. Confirm the skill should be orchestrated.
   - Keep replay skills when deterministic replay remains the right fit.
   - Add an orchestrated sibling only when agent-driven runtime behavior is actually required.
2. Put skill authority in `SKILL.md`.
   - Write the runtime program, app-specific navigation, recovery expectations, checkpoints, and terminal verification there.
3. Keep `skill.json.agent` narrow.
   - Declare only trusted runtime metadata such as `cli` and `timeoutMs`.
4. Keep `scripts/run.js` thin.
   - Read the injected env vars.
   - Spawn the configured agent CLI on `SKILL.md`.
   - Forward stdout and stderr.
   - Exit with the child status.
5. Validate against runtime expectations.
   - `clawperator skills validate`
   - run the skill through the branch-local CLI
   - verify the final framed `SkillResult` shape, not just process exit code

## Failure Patterns To Reject

- a harness that contains app-specific selectors, coordinates, or recovery choreography
- a harness that synthesizes or rewrites `source`
- a `SKILL.md` that defers the real policy back into `scripts/run.js`
- docs that describe temporary project phases instead of current runtime behavior
