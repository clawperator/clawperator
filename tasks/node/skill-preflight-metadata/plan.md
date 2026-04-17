# Skill Requirements Metadata and Preflight

## Executive Summary

Follow-up to deferred item F6. This pack is the durable home for first-run
requirements metadata work that PR #196 intentionally left out of the
onboarding cleanup scope. The job here is not install/onboarding cleanup. It is
skills-surface maturity: add first-class requirements metadata to the runtime
skills model, surface it through discovery, and enforce only the mechanically
provable requirements before execution. This pack is Node-dominant even though
it includes a paired change in `../clawperator-skills`: 2 PRs, 4 phases. PR-1
ships the metadata contract plus discovery surfaces. PR-2 ships runtime
preflight evaluation and structured failures.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none once PR #196 is merged; this pack is independent work afterward |

## Goal

After this task ships, `clawperator skills get <skill_id>` should tell a caller
what a skill requires before first run, and `clawperator skills run <skill_id>`
should fail early with structured skill-surface errors when a declared hard
requirement can be checked mechanically and is not met.

## Why Now

The onboarding cleanup pack fixed discovery of the Google Home HVAC skills, but
there is still a first-run trust gap: an agent can discover the right skill and
still fail deep in execution because the preconditions are not visible up
front. That is a skills contract and runtime problem, not an install/onboarding
problem, so it deserves its own pack.

## Historical Context Captured Here

This pack replaces the need to consult the deleted onboarding notes. Treat the
following as the baseline problem statement:

- The Google Home HVAC skills already exist and are now discoverable after
  install. The gap is not discovery anymore.
- The remaining problem is first-run requirements visibility and truthful early
  failure handling.
- At minimum, the Google Home exemplar skills still have important requirements
  that a caller should learn before deep runtime execution:
  - `com.google.android.apps.chromecast.app` must be installed on the target
    device
  - Google Home must already be signed in and have a linked climate unit
  - the caller may need to supply the exact `unit_name` that matches the UI
  - the orchestrated HVAC skill internally depends on the `codex` CLI being
    available on the host
- Not all of those requirements are equally provable ahead of time:
  - missing host CLIs and missing installed Android packages can be checked
    mechanically
  - sign-in state, linked-device state, and exact unit-label correctness are
    advisory first-run guidance unless the runtime gains a truthful proof path
- The design intent for this pack is therefore:
  - render all relevant requirements in discovery
  - block execution only on hard requirements that can be checked
    mechanically before spawn
  - keep subjective requirements visible without pretending they are
    authoritatively checked

## In Scope

- Add first-class requirements metadata to the runtime skill contract
- Parse the new metadata from trusted `skill.json` manifests and registry entries
- Surface requirements metadata through `skills get`
- Seed the Google Home HVAC skills in `../clawperator-skills` with real
  requirements metadata as the canonical exemplar
- Add runtime preflight evaluation for hard, mechanically provable requirements
- Return structured skill-surface precondition failures before spawning the
  runtime harness when a hard requirement is known to be unmet
- Update public docs for the new discovery and error surfaces

## Out of Scope

- Install-script or onboarding artifact changes
- Docs IA or CLI-orientation work from D1 and D2
- New runtime skills or app-specific workflow redesign
- Deep UI-state probing for subjective preconditions such as "user is signed in"
- Turning `doctor` into a skill-capability browser

## Existing Artifact Scope

- `apps/node/src/contracts/skills.ts`: in scope for additive requirements
  metadata and new skill-surface precondition codes; preserve existing contract
  semantics for `contract`, `agent`, and `keywords`
- `apps/node/src/domain/skills/runSkill.ts`: in scope for additive preflight
  evaluation before spawn; do not rewrite the core harness contract
- `apps/node/src/domain/skills/skillManifest.ts`: in scope so trusted
  `skill.json` metadata stays aligned with registry entries
- `apps/node/src/cli/commands/skills.ts`: in scope for `skills get` rendering
  only; do not redesign list or search output into verbose metadata dumps
- `../clawperator-skills`: in scope for paired schema and skill-metadata updates
  that must land with the Node-side contract work

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/contracts/skills.ts` | Requirements metadata shape and skill-surface precondition codes | PR-1 / Phase 1 |
| `apps/node/src/domain/skills/skillManifest.ts` | Trusted manifest parsing for new metadata | PR-1 / Phase 1 |
| `apps/node/src/cli/commands/skills.ts` | `skills get` discovery output | PR-1 / Phase 2 |
| `apps/node/src/test/unit/skills.test.ts` | Contract, discovery, and runtime preflight regression coverage | PR-1 / Phase 2, PR-2 / Phase 4 |
| `apps/node/src/domain/skills/runSkill.ts` | Hard-requirement preflight evaluation before harness spawn | PR-2 / Phase 3 |
| `docs/skills/overview.md` | Public discovery and requirements guidance | PR-1 / Phase 2, PR-2 / Phase 4 |
| `docs/api/errors.md` | Public documentation for any new stable error codes that belong on that page | PR-2 / Phase 4 |
| `../clawperator-skills/skills/skills-registry.schema.json` | Registry schema for requirements metadata | PR-1 / Phase 2 |
| `../clawperator-skills/skills/com.google.android.apps.chromecast.app.*/skill.json` | Seeded exemplar requirements metadata | PR-1 / Phase 2 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current skill contract | `apps/node/src/contracts/skills.ts` |
| Trusted skill manifest parsing | `apps/node/src/domain/skills/skillManifest.ts` |
| Runtime skill execution boundary | `apps/node/src/domain/skills/runSkill.ts` |
| `skills get` output surface | `apps/node/src/cli/commands/skills.ts`, `docs/skills/overview.md` |
| Existing skill-surface regression patterns | `apps/node/src/test/unit/skills.test.ts` |
| Public error-code contract | `docs/api/errors.md`, `apps/node/src/contracts/errors.ts` |
| Runtime skills registry and schema | `../clawperator-skills/skills/skills-registry.json`, `../clawperator-skills/skills/skills-registry.schema.json` |
| Canonical exemplar manifests | `../clawperator-skills/skills/com.google.android.apps.chromecast.app.*/skill.json` |
| Historical problem framing for this pack | This `plan.md` under `Historical Context Captured Here` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Use `requirements` as the new metadata field on `SkillEntry`. Reserve
  "preflight" for the runtime evaluation step. Do not introduce both `requires`
  and `preflight` as parallel registry fields.
- Keep requirements metadata distinct from the existing `contract` object.
  `contract` describes trusted input shape, goal, and verification. `requirements`
  describes prerequisites and first-run guidance.
- Only `skills get` becomes the detailed requirements surface. Do not turn
  `skills list` or `skills search` into verbose metadata dumps.
- Only mechanically provable hard requirements should block execution in this
  pack. Advisory requirements must be rendered for discovery but must not cause
  false-authoritative runtime failures.
- New stable skill-surface precondition codes belong in
  `apps/node/src/contracts/skills.ts`, where the existing skill-specific codes
  already live. Do not move this pack into `apps/node/src/contracts/errors.ts`
  unless the current code proves that decision wrong.
- The Google Home HVAC skills are the required exemplar seed set for this pack.
  Do not prove the feature only with synthetic local fixtures.

**Judgment required:**

- The exact `requirements` sub-shape as long as it cleanly separates hard
  machine-checkable requirements from advisory first-run guidance
- Which requirements should be rendered most prominently in pretty output for
  `skills get`
- Whether a missing selected device should be a hard runtime blocker for a
  declared device-side package check or whether the check should degrade to
  advisory guidance before execution

## Decision Rules

| Question | Rule |
| --- | --- |
| What metadata name should the registry use? | `requirements`. Runtime "preflight" is derived from it; do not add a second parallel field. |
| What kinds of requirements should this pack support? | At minimum: host CLI requirements, Android package requirements, user-input guidance, advisory account or app-state notes, and an explicit safer-first-run pointer when a safer read-only alternative exists. |
| Which requirements are hard blockers at runtime? | Only requirements that can be checked mechanically before spawn, such as missing host CLIs or missing Android packages when a target device is known. |
| How should subjective requirements such as sign-in state be handled? | Render them as advisory requirements in discovery output. Do not invent UI probing in this pack. |
| How should user inputs be represented? | As guidance metadata that complements, not replaces, the existing `contract.inputs` system. Do not duplicate contract parsing logic. |
| Where should safer-first-run guidance live? | In `requirements`, as an explicit pointer to the safer skill or route. Surface it in `skills get`; do not bury it only in prose docs. |
| Should replay and orchestrated skills share the same metadata field? | Yes. The metadata model is skill-wide; runtime enforcement may differ by what can be checked for each skill. |

## Failure Modes To Prevent

- Requirements metadata duplicates or conflicts with `contract.inputs`.
- Advisory guidance is treated as a hard blocker and causes false-authoritative
  runtime failures.
- Hard requirements are documented but still fail late because `runSkill()`
  does not check what it can know before spawn.
- Only the sibling skills repo changes and the Node runtime never reads the new
  metadata.
- Only Node fixtures change and the real Google Home exemplar skills remain
  unannotated.
- New stable codes are added to the wrong contract surface.
- `skills get` still hides the critical first-run requirements after this pack.

## Output Contract

After PR-1:

- `SkillEntry` supports additive `requirements` metadata.
- `skills get <skill_id>` surfaces that metadata clearly, including a
  safer-first-run pointer when present.
- `../clawperator-skills` schema and the Google Home HVAC exemplar skills ship
  real `requirements` metadata in lockstep with the Node contract.

After PR-2:

- `runSkill()` evaluates declared hard requirements it can prove before spawn.
- When one of those hard requirements fails, the command returns a structured
  skill-surface precondition code and does not launch the runtime harness.
- Advisory requirements remain visible in discovery output but do not become
  false blocker failures.
- Public docs reflect the new metadata and error surfaces.

## Idempotency

- Re-reading the registry and manifests yields stable requirement metadata on
  repeated runs.
- Re-running `skills get` returns the same requirement structure for the same
  registry content.
- Re-running preflight checks is safe and does not mutate runtime state.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Requirements metadata contract | `apps/node/src/contracts/skills.ts` and `../clawperator-skills/skills/skills-registry.schema.json` |
| Trusted manifest parsing rules | `apps/node/src/domain/skills/skillManifest.ts` |
| Discovery surface for requirements | `docs/skills/overview.md` and `apps/node/src/cli/commands/skills.ts` |
| Stable precondition failure codes | `apps/node/src/contracts/skills.ts` and docs that describe them |
