# Agent-Assisted Skill Drafting

## Executive Summary

This pack turns the compiled authorship findings into one concrete workflow:
keep recording as the proving workflow, but add a discovery-first front door
for cases where the agent does not yet know the app route well enough to
record truthfully. This is a 1 PR, 5 phase pack in `clawperator`, and it is
blocked until the prerequisite guardrails in
`tasks/skills/skill-creation-guidance/` PR-2 are merged or landed locally.

The stable design choice in this pack is the hybrid model. We are not extending
`skill-author-by-recording` into a giant all-in-one skill. We are adding a
packaged sibling authoring skill named
`skill-author-by-agent-discovery`, and that new skill routes into the existing
recording workflow when a reusable runtime skill should actually be authored.

This pack also treats discoverability as part of the shipped product surface.
The new front door is not done if it only exists in repo code or deep docs. A
host-facing agent must be able to find the zero-results route from the current
CLI help, install-generated guides, shared agent bridge, and public docs.

This pack also makes evals part of the acceptance path instead of an informal
follow-up. The pack is intentionally eval-driven: Phase 1 updates the existing
`android-version` benchmark so it becomes the Pack A red baseline, then the
remaining phases implement `skill-author-by-agent-discovery` and its wiring
until the benchmark passes on two divergent device families: one AOSP emulator
and one Samsung physical device.

## Status

| Item | Value |
| --- | --- |
| State | in_progress |
| Total PRs | 1 |
| Total phases | 5 |
| Completed | 1, 2 |
| Remaining | 3, 4, 5 |
| Current / Next | Phase 3 |
| Blockers | none |

## Progress Update

- Phase 1 completed locally on 2026-04-19 with commit `aa96fc7`
  `test(evals): define red baseline for discovery-authored settings eval`.
- Phase 1 validation and the accepted Pack A red-baseline canary are recorded
  in `tasks/skills/agent-assisted-skill-drafting/findings.md`.
- Phase 2 validation completed locally on 2026-04-19. The new discovery skill,
  the recording-skill boundary update, and the pack-status refresh are
  recorded in `tasks/skills/agent-assisted-skill-drafting/findings.md`.

## Goal

After this pack ships, a host-facing agent that receives a request like "make a
Clawperator skill that opens Netflix, searches for House of Cards, and adds it
to My List" has one truthful first step when no installed runtime skill exists:
run a bounded discovery workflow that produces a structured routing artifact,
then either hand off to `skill-author-by-recording`, continue as one-shot raw
automation, escalate to a human, or decline with a reason. The repo also has a
dedicated eval path that uses the same workflow to author Settings/About-device
skills on one AOSP emulator and one Samsung physical device and verifies that
the resulting skills emit valid `SkillResult`s.

## Why Now

`skill-author-by-recording` is already a strong proving workflow, but it starts
too late for unfamiliar app routes. The current system answers "what skill can
I run?" well and answers "what should I do when nothing exists yet?" poorly.
That gap is currently filled by improvisation, which biases agents toward
over-authoring and weak first drafts.

## In Scope

- Add a packaged sibling authoring skill named
  `skill-author-by-agent-discovery`
- Define the discovery artifact contract that the new skill must produce before
  any reusable runtime skill is authored
- Lock the routing table for the zero-results case:
  - reuse existing skill
  - proceed to recording
  - fulfill as one-shot direct automation
  - escalate to human
  - decline
- Clarify the boundary between the new discovery skill and
  `skill-author-by-recording`
- Wire the new packaged skill through install and agent discovery surfaces
- Make the zero-results route discoverable from current host entrypoints:
  `clawperator --help`, `clawperator skills --help`,
  `clawperator authoring-skills --help`, `~/.clawperator/AGENTS.md`,
  `~/.agents/AGENTS.md`, and `docs/host-agents.md`
- Document the host-agent zero-results route and the discovery-to-proving
  handoff
- Integrate the new workflow with `/evals` so evals can exercise
  `skill-author-by-agent-discovery`
- Use the existing `android-version` benchmark as the first Settings/About
  proving surface for the new workflow
- Prove the workflow against the anchor scenario and against a dual-device
  Settings/About eval matrix, then record the evidence in an execution-time
  `findings.md`

## Out of Scope

- Authoring the Netflix skill itself
- Adding new runtime verification kinds, new `SkillResult` contract fields, or
  other runtime-contract work
- Adding new general-purpose Node CLI probe commands
- Rewriting `skill-author-by-recording` into a discovery-plus-proving mega-skill
- Broad new scoring work for Android security patch level or Google Play system
  update version if the existing eval harness cannot score those truthfully in
  this pack
- Checking in the eval-authored Settings/About-device skills as shipped runtime
  skills for either device family
- Rewriting `../clawperator-skills/AGENTS.md` or the broader skills-repo
  quality bar work tracked in `tasks/skills/skill-creation-guidance/`

## Existing Artifact Scope

- `.agents/skills/skill-author-by-recording/`: in scope only for additive
  boundary and handoff clarification; preserve its recording-first proving
  workflow and self-test expectations
- `apps/node/src/domain/skills/copyAuthoringSkills.ts`: in scope only for
  additive packaging and wiring behavior; do not redesign authoring-skills
  install semantics
- `apps/node/src/cli/registry.ts`: in scope for additive discoverability help
  only; do not redesign the CLI command tree in this pack
- `sites/landing/public/install.sh`: in scope only for the authoring-skill
  discovery guide block and related install-time guidance, including the
  installer-written local guide at `~/.clawperator/AGENTS.md` and the shared
  bridge block in `~/.agents/AGENTS.md`
- `docs/host-agents.md`: in scope for the explicit zero-results route
- `docs/skills/authoring.md`: in scope for the discovery-to-proving handoff and
  packaged authoring-skill explanation
- `/evals`: in scope for the Pack A proving path only. Use the existing
  `android-version` eval as the seed benchmark before inventing a new eval id.
- `.agents/skills/evals-run/` and `.agents/skills/evals-live-run/`: in scope
  for additive Pack A benchmark guidance only
- `tasks/skills/authorship/findings-compiled.md`: preserved as the problem
  statement; do not rewrite it during implementation

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `.agents/skills/evals-run/` | Emulator-facing Pack A eval guidance and red-baseline workflow | Phase 1 |
| `.agents/skills/evals-live-run/` | Physical-device Pack A eval guidance and red-baseline workflow | Phase 1 |
| `evals/README.md` | Eval-harness guidance for the Pack A benchmark | Phase 1 |
| `docs/internal/design/evals.md` | Durable eval-boundary note for Pack A | Phase 1 |
| `evals/specs/android-version/` | Existing benchmark prompt and scoring surface that Pack A should extend first | Phase 1 |
| `evals/run_eval.py` and `evals/harness/` | Only if additive scoring or artifact capture is required for authored-skill proof | Phase 1 |
| `.agents/skills/skill-author-by-agent-discovery/` | New discovery-first authoring skill, prompt contract, and `agents/openai.yaml` metadata | Phase 2 |
| `.agents/skills/skill-author-by-recording/SKILL.md` | Additive handoff and boundary clarification only | Phase 2 |
| `apps/node/authoring-skills/skill-author-by-agent-discovery` | New packaged-skill symlink entry | Phase 3 |
| `apps/node/src/domain/skills/copyAuthoringSkills.ts` | Install and discovery wiring only if the new packaged skill needs additive support | Phase 3 |
| `apps/node/src/cli/registry.ts` | Zero-results route and authoring-skill discoverability in help text | Phase 3 |
| `apps/node/src/test/unit/authoringSkills.test.ts` | Packaging and install regression coverage | Phase 3 |
| `apps/node/src/test/unit/authoringSkillsPack.test.ts` | Packaged authoring-skills tree coverage | Phase 3 |
| `apps/node/src/test/unit/cliHelp.test.ts` | CLI help regression coverage for the discoverability route | Phase 3 |
| `sites/landing/public/install.sh` | Installer-written local guide at `~/.clawperator/AGENTS.md` and shared bridge at `~/.agents/AGENTS.md` advertise both authoring front doors | Phase 3 |
| `docs/host-agents.md` | Host-agent zero-results route | Phase 4 |
| `docs/skills/authoring.md` | Discovery-to-proving handoff and authoring-skill front-door guidance | Phase 4 |
| `docs/internal/design/agent-host-integration.md` | Additive durable routing note only if the public docs need a matching internal rule | Phase 4 |
| `tasks/skills/agent-assisted-skill-drafting/findings.md` | Execution-time red/green proof of the workflow, including eval matrix runs | Phase 1, Phase 5 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Problem statement and stable recommendations | `tasks/skills/authorship/findings-compiled.md` |
| Current proving workflow | `.agents/skills/skill-author-by-recording/SKILL.md`, `docs/skills/authoring.md` |
| Host-agent discovery route | `docs/host-agents.md`, `docs/internal/design/agent-host-integration.md` |
| Current CLI help and command-surface discoverability | `apps/node/src/cli/registry.ts`, `apps/node/src/test/unit/cliHelp.test.ts` |
| Packaged authoring-skill installation and installer-owned agent guides | `apps/node/src/domain/skills/copyAuthoringSkills.ts`, `sites/landing/public/install.sh` |
| Authoring-skills CLI and test coverage | `apps/node/src/cli/commands/authoringSkills.ts`, `apps/node/src/test/unit/authoringSkills.test.ts`, `apps/node/src/test/unit/authoringSkillsPack.test.ts` |
| Eval harness boundary and current benchmark model | `docs/internal/design/evals.md`, `evals/README.md` |
| Existing Settings/About benchmark | `evals/specs/android-version/spec.json`, `evals/specs/android-version/prompt-skill.md`, `evals/run_eval.py` |
| Repo-local eval helper skills | `.agents/skills/evals-run/SKILL.md`, `.agents/skills/evals-live-run/SKILL.md` |
| Runtime skill discovery precedence | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Dependency pack that must land first | `tasks/skills/skill-creation-guidance/plan.md` |
| Dependency execution boundary | `tasks/skills/skill-creation-guidance/work-breakdown.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Implement the hybrid model. The new front door is a sibling skill named
  `skill-author-by-agent-discovery`. Do not rename it in this pack.
- The discovery skill does not author a durable runtime skill directly. Its job
  is to produce a structured routing artifact and decide the next step.
- `skill-author-by-recording` remains the proving workflow for reusable skill
  authoring after discovery says `proceed_to_recording`.
- Discoverability is part of the shipped surface. Do not assume host agents
  will read deep docs or repo source to find the zero-results route.
- Prefer strengthening existing entrypoints before adding new CLI nouns:
  top-level help, `skills --help`, `authoring-skills --help`,
  install-generated guides, and public docs.
- Treat the installer-written local guide at `~/.clawperator/AGENTS.md` as a
  first-class discoverability surface. After install, it must advertise
  `skill-author-by-agent-discovery` alongside `skill-author-by-recording` and
  explain when discovery comes before recording.
- Keep the shared bridge in `~/.agents/AGENTS.md` truthful and lightweight. It
  should route agents toward the local guide and the existing runtime-skill
  discovery commands without pretending the shared skill directories contain
  Clawperator runtime skills.
- The discovery artifact must contain every required field listed in
  `Decision Rules`. Missing required fields block handoff.
- The default discovery budget unless `findings.md` justifies different numbers:
  max 5 snapshots, max 3 screenshots, max 90 seconds wall time. The skill prompt
  must enforce a concrete budget; record the actual values chosen in `findings.md`.
- Do not add new runtime CLI probe commands in this pack. Use existing
  Clawperator surfaces and authoring-skill guidance.
- Do not add a `skills create` alias by default. `skills new` is the low-level
  manual scaffold, not the primary zero-results authoring route.
- Evals are part of the acceptance path for this pack. Do not leave Pack A with
  only a one-off manual proof.
- Use the existing `android-version` eval as the first Pack A benchmark and
  extend it before inventing a new eval id.
- Treat the Pack A eval as the red/green spec for implementation:
  - Phase 1 makes the benchmark explicit and records the current red baseline
  - later phases change the workflow until that same benchmark goes green
- The required confidence matrix is one AOSP emulator plus one Samsung physical
  device. Use explicit `--device` selection for both.
- If the required Samsung physical device is unavailable or unusable, stop and
  mark the pack blocked. Do not substitute a second emulator or another OEM
  without updating the pack.
- Pack A success requires two target-specific authored skills under the eval
  pass, one per device family. Do not redefine success as a single universal
  Settings skill.
- The eval-authored Settings/About-device skills are validation artifacts, not
  shipped repo deliverables. Record their identity and evidence in
  `findings.md`, but do not check them in as part of this pack.
- The required scored field remains Android version unless a truthful richer
  scorer lands inside this pack. Android security patch level and Google Play
  system update version are allowed as additive evidence fields, not required
  pass-fail gates.
- Keep Pack A blocked until `tasks/skills/skill-creation-guidance/` PR-2 is
  merged or landed locally.

**Judgment required:**

- The exact wording and examples inside the new skill prompt
- Whether `docs/internal/design/agent-host-integration.md` needs a small
  matching durable note in addition to the public docs
- Whether the default discovery budget needs a justified deviation in
  `findings.md`
- Whether the Pack A eval can stay entirely inside the current
  `android-version` benchmark or needs a narrow sibling prompt variant for the
  authored-skill flow

## Decision Rules

### Stable workflow decision

| Question | Rule |
| --- | --- |
| What front door should handle the zero-results case? | `skill-author-by-agent-discovery` |
| What workflow proves a reusable new skill after discovery? | `skill-author-by-recording` |
| Should discovery create a durable runtime skill directly? | No. Discovery only routes and hands off. |
| Which surfaces must advertise the zero-results route? | `clawperator --help`, `clawperator skills --help`, `clawperator authoring-skills --help`, installer-owned `AGENTS.md` surfaces, and the public host-agent docs. |
| Should this pack add `clawperator skills create`? | No, not by default. Strengthen existing help and bridge surfaces first; `skills new` remains the low-level manual scaffold. |
| Should this pack add new runtime contracts or verification kinds? | No. Record any need as follow-up. |
| What eval surface should prove this pack first? | `/evals`, starting with `android-version` on the Settings/About-device surface rooted at `com.android.settings`. |
| Should the first Pack A eval require one universal cross-device Settings skill? | No. Require one target-specific authored skill for the AOSP emulator family and one for the Samsung family. |
| What if the Samsung physical device is unavailable or unusable? | Stop and mark the pack blocked. Do not substitute a second emulator or another OEM without updating the pack. |
| What makes the eval pass acceptable? | Both authored skills emit valid `SkillResult`s on their originating devices and the required Android-version answer remains correct. |
| Are the eval-authored Settings/About-device skills deliverables of this pack? | No. They are validation artifacts recorded in `findings.md` unless a follow-up pack explicitly promotes them. |
| Do Android security patch level and Google Play system update version block this pack? | No. Capture them only if the eval can do so truthfully without widening the scorer beyond safe scope. |
| What are the default discovery budget limits? | max 5 snapshots, max 3 screenshots, max 90 seconds wall time. Record actual values chosen in `findings.md`. |

### Discovery artifact contract

The discovery phase must produce one artifact with all of the following fields.

| Field | Allowed values | Required when | Purpose |
| --- | --- | --- | --- |
| `recommended_next_step` | `use_existing_skill`, `proceed_to_recording`, `iterate_discovery`, `one_shot_direct_automation`, `escalate_to_human`, `decline` | always | Primary route decision |
| `existing_skill_verdict` | `match`, `partial_match`, `none`, plus queried registry paths | always | Explains whether a new skill is actually needed |
| `target_app_package` | app label, package id, and any sub-route observed | always | Anchors the route to the right app surface |
| `route_confidence` | `high`, `medium`, `low`, plus supporting evidence | always | Decides whether discovery is sufficient |
| `mutation_risk` | `read_only`, `reversible_mutation`, `irreversible_mutation` | always | Guards side effects during proof |
| `evidence_collected` | artifact inventory and failed probes | always | Prevents handoff without evidence |
| `discovery_budget_used` | snapshot count, screenshot count, elapsed time | always | Enforces bounded discovery |
| `skill_classification` | `shared-general` or `personalized-local` | when `recommended_next_step = proceed_to_recording` | Chooses publication target |
| `handoff_target` | `skill-author-by-recording`, `raw-clawperator`, `human`, `none` | always | Makes the next actor explicit |
| `handoff_reasoning` | short justification | always | Keeps the route inspectable |

### Route table

| Situation | Required route |
| --- | --- |
| Installed runtime skill is a clear match | `use_existing_skill` |
| No skill exists, route is understood, and reusable authoring is justified | `proceed_to_recording` |
| No skill exists, route is still uncertain, and discovery budget remains | `iterate_discovery` |
| One-shot fulfillment is better than a reusable skill | `one_shot_direct_automation` |
| Mutation risk is too high or user intent is underspecified | `escalate_to_human` |
| Request cannot be served truthfully | `decline` |

## Failure Modes To Prevent

- The new skill becomes a second proving workflow instead of a discovery route
- The discovery artifact omits key routing or safety fields and still hands off
- Host-facing guidance still leaves "no installed skill found" as a dead end
- The new discovery skill ships but is only discoverable by reading repo code
  or deep docs
- The packaged skill installs correctly but the installer-written
  `~/.clawperator/AGENTS.md` never mentions it
- Authoring-skill install succeeds but the new skill is not discoverable in all
  three agent directories
- `authoring-skills` help remains too thin to explain when it should be used or
  continues to under-describe the installed discovery surfaces
- Pack A only proves the workflow once by hand and never binds it to the eval
  harness
- The Pack A eval only proves one device family and misses OEM and Android-skin
  variance
- The pack silently substitutes another device and claims the required
  emulator-plus-Samsung matrix passed
- The eval proves an answer but not a valid authored `SkillResult`
- The eval reuses the old temp skill-emission path without exercising
  `skill-author-by-agent-discovery`
- The eval-generated authored skills or device-specific artifacts get committed
  as if they are shipped deliverables of this pack
- Pack A silently reopens runtime-contract questions that belong in a follow-up
  pack
- Docs and skill prompts disagree about whether discovery, recording, or
  one-shot automation is the correct next step

## Output Contract

After this pack ships:

- a new packaged authoring skill named `skill-author-by-agent-discovery`
  exists and is wired into the normal authoring-skills install flow
- the zero-results route is visible from current host entrypoints, not only
  from deep docs
- the installer-written `~/.clawperator/AGENTS.md` and shared
  `~/.agents/AGENTS.md` bridge advertise `skill-author-by-agent-discovery`
  truthfully and explain when discovery should precede recording
- the new skill requires a discovery artifact that matches the contract above
- `skill-author-by-recording` explicitly describes itself as the proving step
  after discovery, not the zero-results router
- `docs/host-agents.md` and `docs/skills/authoring.md` document the zero-results
  route and the discovery-to-proving handoff
- `/evals` has a first-class Pack A proving path rooted in the existing
  `android-version` benchmark
- the repo-local `evals-run` and `evals-live-run` skills tell future agents how
  to run that benchmark on the emulator and Samsung device surfaces
- `tasks/skills/agent-assisted-skill-drafting/findings.md` proves the workflow
  on the anchor scenario and records a successful or failed dual-device eval
  matrix with follow-up gaps called out explicitly
- the pack does not require checking in the eval-authored Settings/About-device
  skills; `findings.md` records their identity and proof instead

## Idempotency

- Re-running authoring-skills install keeps the same packaged skill set and
  restores the same discovery symlinks
- Re-running the discovery workflow on the same request and device state should
  produce the same routing choice unless the observed app state changed
- Re-running the Pack A eval on the same device class should produce the same
  benchmark route and the same answer contract unless the device UI changed
- Re-running docs generation should preserve the same public guidance

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Discovery-to-proving front-door guidance | `docs/skills/authoring.md`, `docs/host-agents.md` |
| Install-distributed authoring-skill discovery surface | `.agents/skills/skill-author-by-agent-discovery/`, `apps/node/authoring-skills/`, `sites/landing/public/install.sh`, generated `~/.clawperator/AGENTS.md`, generated `~/.agents/AGENTS.md` |
| CLI help discoverability for the zero-results route | `apps/node/src/cli/registry.ts`, `apps/node/src/test/unit/cliHelp.test.ts` |
| Pack A benchmark and eval usage guidance | `evals/README.md`, `docs/internal/design/evals.md`, `.agents/skills/evals-run/`, `.agents/skills/evals-live-run/` |
| Stable authoring-skill install behavior | `apps/node/src/domain/skills/copyAuthoringSkills.ts` and related tests |
| Any follow-on runtime-contract need discovered during implementation | `tasks/skills/agent-assisted-skill-drafting/findings.md`, then a new pack if still needed |
