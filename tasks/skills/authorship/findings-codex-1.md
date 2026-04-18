# Skill Authorship Findings

Date: 2026-04-19
Author: Codex

## Executive summary

Clawperator already has one strong authoring front door: `skill-author-by-recording`. It gives a grounded recording-to-skill workflow, makes replay versus orchestrated an explicit choice, requires a self-test, and keeps the resulting evidence inspectable. That is a good authoring execution workflow once an agent already knows it should author a new skill.

The main gap is earlier in the flow. For a natural-language request like "Make a Clawperator skill that opens Netflix, searches for House of Cards, and adds it to My List," the current system does not offer a distinct discovery-first route that helps an agent decide whether an existing runtime skill already solves the request, whether a new skill should be personalized-local or shared-general, whether recording should happen now, or whether replay versus orchestrated is the truthful first shape. In this workspace on 2026-04-19, `clawperator skills search --keyword netflix --json`, `clawperator skills search --keyword "house of cards" --json`, and `clawperator skills for-app com.netflix.mediaclient --json` all returned `count: 0`, so the documented runtime discovery path fails closed for the anchor scenario and leaves the agent to improvise the next step.

The second gap is durable guidance. The main repo contains detailed authoring guidance and durable design notes, but the skills repo is the place where repeated authoring mistakes are actually happening. `../clawperator-skills/AGENTS.md` and `README.md` do not yet carry enough of the current review-hardening lessons. Worse, `../clawperator-skills/README.md` still advertises `docs/skill-development-workflow.md`, `docs/skill-authoring-guidelines.md`, and `docs/device-prep-and-runtime-tips.md`, but those files are absent from the working tree. The PR history for [PR #27](https://github.com/clawperator/clawperator-skills/pull/27) and [PR #29](https://github.com/clawperator/clawperator-skills/pull/29), plus the existing local findings file under `~/.clawperator/findings/skill-drafting/findings.md`, show the same lessons repeating: contract drift, generated index drift, helper duplication, diagnostics that overstate reality, parser ambiguity, and privacy leakage into PR metadata.

The follow-up work should split into two task packs, not one:

- Track A: agent-assisted skill drafting and discovery-to-recording flow
- Track B: durable skill creation guidance and repo guardrails

## Scope and method

This was a findings pass only. No product changes were implemented, no task packs were created, and `$task-author` was not run.

Method:

- Read the requested main-repo docs, design notes, and Node source contracts.
- Read the current `skill-author-by-recording` skill and its later workflow sections around scaffolding, self-test, compare, and repair.
- Inspected the sibling `../clawperator-skills` repo layout, `AGENTS.md`, `README.md`, index-generation script, and Google Home replay/orchestrated exemplars.
- Inspected the packaged and installed authoring-skill surfaces through `apps/node/authoring-skills/`, `clawperator authoring-skills list --json`, `~/.clawperator/AGENTS.md`, and `~/.agents/AGENTS.md`.
- Used `gh` to inspect [PR #27](https://github.com/clawperator/clawperator-skills/pull/27) and [PR #29](https://github.com/clawperator/clawperator-skills/pull/29), including inline review comments, then extracted repeated authoring failure patterns.
- Read the existing local findings file at `~/.clawperator/findings/skill-drafting/findings.md`.

## Verified source map

| Surface | Verified sources | Key point verified |
| --- | --- | --- |
| Authoring front door | `.agents/skills/skill-author-by-recording/SKILL.md` | Current canonical authoring workflow is recording-first and includes self-test plus repair loop. |
| Public authoring docs | `docs/skills/overview.md`, `docs/skills/authoring.md`, `docs/skills/development.md`, `docs/skills/runtime.md` | Runtime skills, authoring skills, replay/orchestrated split, compare contract, and install surfaces are documented in the main repo. |
| Host-agent integration | `docs/host-agents.md`, `docs/internal/openclaw-reference.md`, `docs/internal/design/agent-host-integration.md` | Post-install host discovery is centered on runtime skill discovery, not authoring. |
| Durable design lessons | `docs/internal/design/skill-design.md`, `docs/internal/design/evals.md` | Truthful verification, thin orchestrated harnesses, compare/eval boundaries, and privacy rules already exist as design guidance. |
| Recording and env contracts | `docs/api/recording.md`, `docs/api/environment.md` | Recording export is authoring evidence, not the skill itself; orchestrated runtime env vars are defined in the main repo. |
| Runtime contracts and implementation | `apps/node/src/contracts/skills.ts`, `apps/node/src/contracts/skillResult.ts`, `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/domain/skills/validateSkill.ts`, `apps/node/src/domain/skills/scaffoldSkill.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`, `apps/node/src/domain/skills/copyAuthoringSkills.ts`, `apps/node/src/cli/commands/authoringSkills.ts` | Registry, scaffold, validation, `SkillResult`, declared verification, and authoring-skill install behavior match the docs. |
| Install surfaces | `sites/landing/public/install.sh`, `~/.clawperator/AGENTS.md`, `~/.agents/AGENTS.md` | Install writes runtime-skill guidance prominently and authoring-skill discovery secondarily. |
| Skills repo author guidance | `../clawperator-skills/AGENTS.md`, `../clawperator-skills/README.md`, `../clawperator-skills/scripts/generate_skill_indexes.sh` | The skills repo has only partial author guidance and still links missing docs. |
| Exemplars | `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/*`, `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/*` | Google Home exemplars show both replay and orchestrated shapes with explicit contract/verification structure. |
| PR-history evidence | `gh pr view 27`, `gh pr view 29`, `gh api repos/clawperator/clawperator-skills/pulls/27/comments`, `gh api repos/clawperator/clawperator-skills/pulls/29/comments` | Repeated authoring and review-hardening failure modes are visible in actual review discussion. |
| Existing local findings | `~/.clawperator/findings/skill-drafting/findings.md` | Prior findings already point toward skills-repo guidance as the durable home for runtime-skill drafting lessons. |

Important missing-source note:

- `../clawperator-skills/README.md` advertises `docs/skill-development-workflow.md`, `docs/skill-authoring-guidelines.md`, and `docs/device-prep-and-runtime-tips.md`, but those files are absent in this working tree.
- The prompt also listed those paths as required reading, which means the current source map is already internally inconsistent for future agents.

## Current-state map

### Main repo: `clawperator`

- Owns the runtime contracts, recording contract, compare contract, install behavior, and the most detailed authoring documentation.
- Defines runtime skill discovery through registry-backed CLI commands such as `skills list`, `skills search`, `skills for-app`, `skills get`, `skills validate`, and `skills run`.
- Defines authoring-skill install/update/list behavior and copies packaged authoring skills into `~/.clawperator/authoring-skills/`, then symlinks them into Claude, Codex, and generic agent skill directories.
- Currently packages `skill-author-by-recording` as the only first-party authoring skill surface.

### Skills repo: `../clawperator-skills`

- Owns shipped runtime skill folders, `skills/skills-registry.json`, and generated discovery shards under `skills/generated/`.
- Provides lightweight repo rules in `AGENTS.md` and high-level orientation in `README.md`.
- Does not currently contain the docs directory that `README.md` says is the local home for skill workflow and authoring guidance.
- Uses `scripts/generate_skill_indexes.sh` as the authoritative regeneration step for registry-adjacent generated artifacts.

### Install-distributed authoring skills

- `clawperator authoring-skills list --json` reports only one installed first-party authoring skill in this environment: `skill-author-by-recording`.
- `apps/node/authoring-skills/skill-author-by-recording` is a symlink to the repo-local authoring skill source under `.agents/skills/skill-author-by-recording`.
- `~/.clawperator/AGENTS.md` foregrounds runtime skills first and lists authoring skills later.
- `~/.agents/AGENTS.md` includes a bounded Clawperator bridge that points host agents to runtime-skill discovery commands, not to authoring-skill entrypoints.

### Anchor-scenario current state

- There is no installed runtime skill for Netflix in this workspace.
- On 2026-04-19 in this environment:
  - `clawperator skills search --keyword netflix --json` returned `{"skills":[],"count":0}`
  - `clawperator skills search --keyword "house of cards" --json` returned `{"skills":[],"count":0}`
  - `clawperator skills for-app com.netflix.mediaclient --json` returned `{"skills":[],"count":0}`
- That means the documented runtime-skill discovery route gives the host agent a truthful "nothing installed" answer, but it does not provide the next authoring decision path.

## Track A findings: agent-drafted skill workflow

### Current-state facts

- The current front door is explicitly `skill-author-by-recording`, and the public docs mirror that choice.
- The skill is strong once the authoring decision has already been made. It gathers goal and app context, resets target apps, records a single real flow, exports recording evidence, derives `skill_id`, chooses replay versus orchestrated using an explicit table, scaffolds with `--recording-context`, requires one self-test, and keeps the repair loop inside the authored skill.
- The workflow is also explicit about truthfulness:
  - recording export is evidence, not the skill
  - replay and orchestrated are both first-class maintained shapes
  - personalized local skills are valid first outcomes
  - nearby exemplar reuse must be disclosed
  - compare baseline stays separate from runtime artifacts
- The later sections of `skill-author-by-recording` are unusually concrete. They tell the agent exactly which files to surface, what to save from the self-test, how to classify failures, and how to inspect orchestrated debug bundles before patching.
- `scaffoldSkill()` is intentionally narrow. It creates `SKILL.md`, `skill.json`, `scripts/run.js`, `scripts/run.sh`, and optional `recording-context.json`, but it does not derive selectors, control flow, or verification from the recording export.
- `validateSkill()` verifies file existence, registry parity, contract input schemas, and some orchestrated harness requirements. It does not verify whether the chosen skill shape is truthful, whether `recording-context.json` was interpreted well, whether the author reused the right helpers, or whether the declared verification matches what the skill can actually prove.
- `runSkill()` gives a strong runtime target once the skill exists:
  - script versus agent source is authoritative
  - orchestrated skills must emit a terminal framed `SkillResult`
  - declared verification can force `indeterminate` when the skill exits cleanly but fails to prove its matcher
  - `SkillResult.inputs`, `terminalVerification`, and `source` are normalized and checked against trusted invocation data
- The workflow stops being enough before recording begins. It assumes the agent already knows:
  - that no existing runtime skill fits
  - which target app/package should be recorded
  - whether the result should be personalized-local or shared-general
  - whether recording is the correct next step now
- The installed host-agent path after install emphasizes runtime discovery, not authoring discovery. A host agent that only follows `~/.agents/AGENTS.md` and the bridge text will learn `clawperator skills for-app/search/get/run`, but not an explicit decision tree for "no existing skill found, now author one".
- There is no packaged sibling skill today for discovery-first skill drafting. The install-distributed authoring surface currently contains only `skill-author-by-recording`.
- For the Netflix scenario specifically, the current system leaves a gap between:
  - truthful runtime-skill discovery returning no result
  - the recording-first authoring workflow that assumes the agent is ready to record

### Recommendations

- Keep recording-first as the authoring execution workflow. It is already the strongest and most concrete part of the current system.
- Add an explicit discovery-first phase before recording for natural-language skill requests that begin from "Can Clawperator already do this?" rather than from "Please record and author this now."
- Prefer a hybrid model over a replacement model:
  - discovery-first should answer reuse-versus-author, package selection, local-versus-shared scope, and probable replay-versus-orchestrated direction
  - recording-first should remain the execution path that turns a chosen authoring route into a real skill plus self-test evidence
- The discovery-first follow-up should not pretend to auto-author from thin air. It should be an explicit routing and evidence-gathering step that can stop early when an existing runtime skill already solves the request.
- The install-distributed authoring surface should make this route more visible to host agents. Right now runtime discovery is easy to find and authoring is secondary.

## Track B findings: skill creation guidance

### Current-state facts

- The strongest durable guidance currently lives in the main repo, not in the skills repo where most runtime-skill drafting work happens.
- `docs/skills/authoring.md` already covers a lot of high-value authoring material:
  - recording-derived truthfulness
  - personalized versus shared skill stance
  - authoring mode disclosure
  - Google Home exemplar family
  - compare-baseline placement
  - `SKILL.md` and `skill.json` contract expectations
  - declared verification semantics
  - orchestrated authoring rules
  - `SkillResult` framing and compare usage
- `docs/internal/design/skill-design.md` also captures durable design lessons around:
  - thin orchestrated harnesses
  - terminal verification proving persisted state
  - preserving per-run debug artifacts
  - keeping privacy-sensitive literals out of skill assets
- The skills repo guidance is materially thinner:
  - `../clawperator-skills/AGENTS.md` covers categories, light validation reminders, and privacy rules
  - `../clawperator-skills/README.md` gives orientation and points back to main-repo docs
- The skills repo does not currently give a strong, canonical local answer for:
  - when `contract.verification` should be `null`
  - when shared helpers are mandatory
  - which generated files must be regenerated together
  - how truthful diagnostics should be shaped
  - what parser-side test coverage is expected for new parsing logic
  - how to apply privacy hygiene to PR bodies and review metadata, not just committed code
- The README/source map is currently broken. `../clawperator-skills/README.md` points to missing local docs, so future agents following the repo-local guidance will hit dead ends.
- The existing local findings file at `~/.clawperator/findings/skill-drafting/findings.md` already argues that runtime-skill drafting and review-hardening rules should live in `clawperator-skills/AGENTS.md`, not in `clawperator/AGENTS.md`.
- The current validator is not a replacement for authoring guidance. `validateSkill()` does not enforce:
  - index regeneration
  - helper reuse
  - parser correctness beyond JSON/execution schema where applicable
  - truthful `contract.verification` choice
  - quality of `SKILL.md` internals
  - privacy/metadata hygiene
- PR #27 and PR #29 show that real authoring still depends heavily on review comments to catch repeated mistakes after the first draft exists.

### Recommendations

- Make the skills repo the canonical home for runtime-skill drafting guardrails and review-hardening rules that are specific to `clawperator-skills`.
- Restore or replace the missing skills-repo docs that `README.md` currently advertises. A README that points at absent files is actively misleading for future agents.
- Keep the main repo as the source of truth for runtime contracts and public authoring concepts, but add a sharper skills-repo checklist for what authors must actually do when changing or adding runtime skills.
- Promote the repeated review lessons into mandatory guidance in `../clawperator-skills/AGENTS.md` and companion docs:
  - generated index regeneration in lockstep
  - truthful `contract.verification`
  - shared helper reuse
  - bounded and truthful diagnostics
  - parser/unit-test expectations
  - privacy hygiene for PR metadata and examples
- Treat install-distributed authoring skills as consumers of this guidance, not as the permanent home for it. The prompt-skill should point at canonical rules rather than becoming the only place those rules exist.

## Shared issues and dependencies

### Current-state facts

- Runtime skills and authoring skills are deliberately separate surfaces.
- Runtime skills are registry-driven CLI assets. They are not mirrored into shared prompt-skill directories.
- Authoring skills are prompt-skill assets copied into `~/.clawperator/authoring-skills/` and symlinked into `~/.claude/skills/`, `~/.codex/skills/`, and `~/.agents/skills/`.
- The shared `~/.agents/AGENTS.md` bridge explicitly teaches host agents to discover runtime skills through CLI commands and not to mirror them into shared skill directories.
- That split is honest, but it creates a discoverability asymmetry:
  - host agents easily discover runtime skill lookup
  - host agents do not get an equally explicit decision route for "no runtime skill exists, now what?"
- Adding a new first-party authoring skill is a main-repo packaging and install concern, not a `clawperator-skills` concern. `copyAuthoringSkills()` and `install.sh` already define the bundling path.
- Improving runtime-skill drafting rules is mostly a `clawperator-skills` concern, even though many of the underlying runtime contracts live in the main repo.
- Some critical review lessons span both repos:
  - `contract.verification` truthfulness depends on `runSkill()` semantics in `clawperator`
  - generated index lockstep depends on `clawperator-skills`
  - compare-baseline rules depend on both the main repo compare contract and skills-repo retained baselines
- The current host-agent install artifacts do a decent job on runtime discovery. The gap is not "how do I list installed skills?" The gap is "how does a host agent reason from an unmet user request to a safe authorship workflow?"

### Recommendations

- Keep the repo boundary explicit in follow-up work:
  - `clawperator` should own discovery flow, install-distributed authoring skill packaging, and public/runtime contract docs
  - `clawperator-skills` should own runtime-skill drafting checklist, local authoring docs, and review-hardening guidance
- Any new discovery-first authoring skill should be packaged from `clawperator`, but it should lean on durable authoring rules that live in `clawperator-skills` for runtime-skill quality expectations.
- The host-agent bridge should stay honest about runtime skills versus prompt-skills, but it likely needs a clearer route for what to do when runtime discovery returns zero matches.

## Recurrent lessons from PR history and existing findings

Evidence sources:

- [PR #27](https://github.com/clawperator/clawperator-skills/pull/27) review comments
- [PR #29](https://github.com/clawperator/clawperator-skills/pull/29) review comments
- `~/.clawperator/findings/skill-drafting/findings.md`

Recurring lessons:

- Contract drift is common.
  - PR #27 caught `contract.verification` being declared as `node_text_matches` even though the skill verified state through screenshot classification.
  - PR #27 also caught frontmatter `clawperator-skill-type: script` drifting from the documented `replay` / `orchestrated` convention.
  - PR #29 caught documentation drift where usage text marked `query` as optional even though the script required it.
- Generated discovery artifacts drift easily.
  - Both PR #27 and PR #29 received review comments noting that `skills/skills-registry.json` had been changed without regenerating `skills/generated/*`.
  - The same drift already appears in the existing local findings file as a candidate rule to formalize.
- Helper reuse versus copy-paste is still ad hoc.
  - PR #27 called out bypassing `resolveOperatorPackage()` and duplicating entity-decoding behavior.
  - PR #29 called out duplicated parser helpers and decoder logic between files.
- Diagnostics truthfulness is a repeated issue.
  - PR #27 repeatedly focused on cleanup behavior, leaked temp-path diagnostics, and preserving real runtime state when terminal verification failed.
  - PR #29 focused on bounding noisy failure messages and making failure wording match the real failure class instead of a misleading generic explanation.
- Parser ambiguity keeps surfacing.
  - PR #27 found positional argument parsing that could steal another option’s value.
  - PR #29 found price-regex truncation, merge-window edge cases, dedupe issues, and `MAX_RESULTS` behavior that could hide or distort results.
- Verification-state semantics matter and are subtle.
  - PR #27 specifically distinguished "automation executed" from "post-action verification failed" and pushed to preserve that truth in `runtimeState`.
  - This aligns with the main repo’s design notes about per-exec versus per-skill result boundaries and terminal verification proving persisted state.
- Privacy hygiene leaks outside code files.
  - The local findings file notes that PR metadata itself included a real zone label, real device id, and local path, even after code was cleaned up.
  - That means repo guidance needs to cover PR bodies and examples, not only committed source files.

## Design options and tradeoffs

### Option 1: extend `skill-author-by-recording` into the full discovery-to-authoring front door

Pros:

- One visible entrypoint
- No extra install-distributed authoring skill to package
- Keeps the current recording-first skill as the obvious top-level surface

Cons:

- The skill is already large and specialized
- It would mix two different jobs:
  - discover whether a new skill is even needed
  - author the skill from fresh recording evidence
- It risks making the first step feel like "record now" even when the truthful next step is "discover what already exists"

### Option 2: add a sibling skill such as `skill-author-by-agent-discovery`

Pros:

- Clean separation between discovery/routing and recording-based authoring
- Better fit for natural-language host-agent requests
- Can stop after finding an existing runtime skill, which `skill-author-by-recording` is not designed to do

Cons:

- Adds another installed authoring skill surface
- Requires a clean handoff contract into `skill-author-by-recording`
- Slightly higher install and discoverability complexity

### Option 3: add helper tooling and docs only, without a new top-level authoring skill

Pros:

- Minimal new runtime surface
- Lowest packaging burden
- Could improve the system with better docs and scripts alone

Cons:

- Leaves host agents to compose the flow themselves
- Does not solve the current "zero discovery result, now what?" gap well
- Relies on repo knowledge and prompt quality more than on a durable front door

### Option 4: hybrid flow

Shape:

- discovery-first front door for routing and gap analysis
- recording-first front door remains the authoring execution workflow
- stronger skills-repo guidance becomes the quality backstop

Pros:

- Best match for the current architecture
- Preserves the best existing workflow instead of rewriting it
- Separates "should we author?" from "how do we author?"
- Creates a clearer owner split between install-distributed authoring skills and skills-repo guidance

Cons:

- Requires coordinated work across multiple surfaces
- Needs careful handoff design so the two front doors do not drift

## Recommended direction

### Owner: `clawperator`

- Keep `skill-author-by-recording` as the canonical recording-to-skill execution workflow.
- Add a discovery-first authoring route for requests that begin from natural-language intent and unknown skill coverage.
- Improve host-agent facing guidance so "no installed skill found" has a documented next step instead of forcing repo archaeology.
- Keep public docs and runtime contract docs in the main repo, but make them point more clearly into the actual authoring decision flow.

### Owner: install-distributed authoring skills

- Expose both stages of the future authoring flow:
  - discovery/routing
  - recording-based execution
- Do not move long-term runtime-skill quality rules into the prompt-skill surface alone. The prompt skill should consume canonical guidance, not replace it.

### Owner: `../clawperator-skills`

- Make runtime-skill drafting and review-hardening rules discoverable where skill authors actually work.
- Restore the missing local docs or stop advertising them from `README.md`.
- Expand `AGENTS.md` to codify the review lessons already repeating in PRs:
  - truthful declared verification
  - generated index regeneration
  - helper reuse
  - bounded, truthful diagnostics
  - parser/unit-test expectations
  - privacy hygiene for metadata and examples

Overall recommendation:

- Choose the hybrid design. Keep Track A and Track B as linked but separate efforts.

## Recommended split for future task packs

Recommended answer: split the follow-up into two task packs.

### Task pack 1: Track A - agent-assisted skill drafting

Scope:

- Discovery-first route from natural-language request to:
  - existing runtime skill reuse
  - no-skill-found authorship decision
  - personalized-local versus shared-general recommendation
  - replay versus orchestrated recommendation before recording
- Handoff into `skill-author-by-recording`
- Host-agent and install-surface discoverability for the new flow

Primary owner surfaces:

- `clawperator`
- install-distributed authoring skills
- host-agent facing docs and install artifacts

### Task pack 2: Track B - skill creation guidance

Scope:

- Skills-repo authoring checklist and durable docs
- Restoration or cleanup of broken README-linked docs
- Formalizing PR-hardening lessons from PR #27, PR #29, and existing local findings
- Clarifying which rules belong in:
  - `clawperator-skills/AGENTS.md`
  - repo-local docs in `clawperator-skills`
  - main-repo public docs

Primary owner surfaces:

- `../clawperator-skills`
- selective cross-references back to `clawperator` docs

Why split:

- Track A is about workflow routing, host-agent UX, and packaged authoring surfaces.
- Track B is about runtime-skill quality rules in the skills repo.
- They share evidence, but they do not share the same dominant files, owners, or acceptance criteria.

## Open questions

- Should a discovery-first authoring flow stop after recommending "record this next," or should it actively drive exploratory observation before recording starts?
- Is the desired first-class outcome for scenarios like Netflix usually a personalized local skill, or is the product trying to push authors toward shared-general skills earlier?
- Should discovery-first live as a new sibling authoring skill, or as an explicit mode inside `skill-author-by-recording`?
- Were the missing `../clawperator-skills/docs/*.md` files intentionally removed, or is `README.md` simply stale?
- How visible should authoring routes be in shared host-agent guidance such as `~/.agents/AGENTS.md` without blurring runtime skills and prompt-skills?
- Which review-hardening rules should stay as documentation, and which should eventually become enforced validation or CI checks?
- For declared verification specifically, should future work focus first on better guidance, stricter lint/validation, or both?
