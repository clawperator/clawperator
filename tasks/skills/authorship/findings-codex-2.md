# Skill Authorship Findings Pass

## 1. Executive summary

### Current-state summary

The current Clawperator skill authorship story is stronger in contracts and examples than it is in discoverability. In `clawperator`, the runtime contract is already strict and well documented across `docs/skills/*.md`, `apps/node/src/contracts/skills.ts`, `apps/node/src/contracts/skillResult.ts`, and `apps/node/src/domain/skills/runSkill.ts`. The current front-door authoring workflow is also clear: `.agents/skills/skill-author-by-recording/SKILL.md` treats recording export as evidence, not as the runtime program, and asks the author to choose replay or orchestrated truthfully.

The main gap is the step before recording. For a host-agent request such as "make a Netflix skill that opens Netflix, searches for House of Cards, and adds it to My List," the system does not yet provide a first-class discovery phase that helps an agent determine whether a reusable skill already exists, whether the route is understood well enough to record, whether the result should stay personalized-local, or what proof bar should apply. Without that phase, an agent either over-relies on recording before it has enough route knowledge or drops to the raw scaffold path, which is materially weaker than the runtime conventions it is supposed to serve.

Track B has a related but different problem. Durable guidance does exist, but it is fragmented. The main repo docs are solid. The sibling `../clawperator-skills` repo is where many authors will naturally start, yet its `README.md` points to `docs/*` files that are not present in this checkout. Recent PR review history in `clawperator-skills` shows the same mistakes repeating: verification claims that are stronger than the proof, generated index drift, copy-pasted helpers, parser ambiguity, misleading diagnostics, and privacy hygiene misses in validation notes.

### Recommendation summary

The follow-up work should split into two task packs. Track A should design an explicit hybrid authorship workflow for agents: discovery first when route knowledge is missing, recording and proving once the route is understood. Track B should harden and co-locate skill creation guidance where authors actually work, especially in `../clawperator-skills`, while keeping runtime contracts canonical in `clawperator`.

## 2. Scope and method

This findings pass was anchored on the prompt scenario: a host agent receives a request to create a Netflix skill that opens the app, searches for a title, and adds it to My List. The goal was not to propose product changes as if they already exist, but to map the real current state, surface the failure modes, and identify the right follow-up work boundaries.

Work completed in this pass:

- Read the required `clawperator` docs and code in the requested order.
- Read the sibling `../clawperator-skills` repo surfaces, including one replay example and one orchestrated example.
- Used `gh` to inspect PR 27 and PR 29 in `clawperator/clawperator-skills` and extracted reusable authorship lessons rather than just summarizing the PRs.
- Read `~/.clawperator/findings/skill-drafting/findings.md` and treated it as additional evidence from real drafting and hardening work.
- Verified missing or misleading source surfaces when encountered instead of assuming the prompt paths existed.

Sections 3 through 8 below are current-state facts and evidence. Sections 9 through 12 are recommendations, options, and open questions.

## 3. Verified source map

### `clawperator` main repo

- `.agents/skills/skill-author-by-recording/SKILL.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/skills/development.md`
- `docs/skills/runtime.md`
- `docs/host-agents.md`
- `docs/internal/openclaw-reference.md`
- `docs/internal/design/agent-host-integration.md`
- `docs/internal/design/skill-design.md`
- `docs/internal/design/evals.md`
- `docs/api/recording.md`
- `docs/api/environment.md`
- `apps/node/src/contracts/skills.ts`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/skills/copyAuthoringSkills.ts`
- `apps/node/src/cli/commands/authoringSkills.ts`
- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- `sites/landing/public/install.sh`

### Sibling `../clawperator-skills` repo

- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/README.md`
- `../clawperator-skills/scripts/generate_skill_indexes.sh`
- Replay example: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/`
- Orchestrated example: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/`

### Required prompt paths that were missing in this checkout

- `../clawperator-skills/docs/skill-development-workflow.md` was not present.
- `../clawperator-skills/docs/skill-authoring-guidelines.md` was not present.
- `../clawperator-skills/docs/device-prep-and-runtime-tips.md` was not present.
- `../clawperator-skills/README.md` still lists these `docs/*` pages as if they exist.

### Prior findings and PR history

- Existing findings: `~/.clawperator/findings/skill-drafting/findings.md`
- PR review via `gh` used:
- `gh pr view 27 --repo clawperator/clawperator-skills --json ...`
- `gh api repos/clawperator/clawperator-skills/pulls/27/comments?per_page=100`
- `gh pr view 29 --repo clawperator/clawperator-skills --json ...`
- `gh api repos/clawperator/clawperator-skills/pulls/29/comments?per_page=100`

## 4. Current-state map

### Ownership by surface

- `clawperator` owns the runtime contract, CLI surfaces, install flow, authoring-skill installation, runtime docs, and validation/runtime behavior.
- `../clawperator-skills` owns reusable runtime skill packages, the generated registry and indexes, example patterns, and the repo-local contribution surface where many authors will work.
- Install-distributed authoring skills are copied into `~/.clawperator/authoring-skills/` and symlinked into prompt-skill discovery directories for Claude, Codex, and generic agents.

### Discovery path today

- Host-agent discovery after install is runtime-skill oriented. `docs/host-agents.md` points agents at `skills for-app`, `skills search`, `skills get`, and `skills run`.
- Runtime skill discovery is registry-based, not folder-scan based. `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` resolves the registry from explicit path, environment, cwd, repo-relative, or installed-home fallbacks.
- Prompt-skill discovery and runtime-skill discovery are deliberately separate systems. `docs/skills/overview.md` and `docs/skills/authoring.md` keep that separation explicit.

### Authorship path today

- The strongest current front door is `.agents/skills/skill-author-by-recording/SKILL.md`.
- That workflow asks for a plain-language goal before recording, resets the app before capture, exports evidence, derives `skill_id` after evidence exists, keeps a retained compare baseline, chooses replay versus orchestrated deliberately, scaffolds once, authors one shape, then self-tests and compares.
- `docs/skills/authoring.md` reinforces the same stance publicly: recording export is evidence, not the runtime program; replay is preferred when truthful; orchestrated is preferred when replay would be misleading or brittle.

### Runtime contract today

- `apps/node/src/contracts/skills.ts` defines the registry shape, optional `agent` config, input schema rules, and the currently supported declared verification kind: `node_text_matches`.
- `apps/node/src/contracts/skillResult.ts` defines the framed `SkillResult` contract, checkpoint model, terminal verification states, and runtime diagnostics shape.
- `apps/node/src/domain/skills/runSkill.ts` enforces the strictest parts of the runtime contract. For agent-driven skills it expects a terminal `[Clawperator-Skill-Result]` frame, requires the trailing JSON object to validate, rejects emitted `source`, and can return wrapper-level `status: "indeterminate"` when declared verification cannot be proved.

### Validation and scaffold today

- `apps/node/src/domain/skills/validateSkill.ts` validates file presence, metadata parity between registry and `skill.json`, contract schema validity, and orchestrated harness requirements.
- The metadata parity check does not compare `agent` directly. Agent-manifest validity is checked separately.
- Validation does not prove that the skill behavior is truthful. It does not prove that declared verification is meaningful in practice, that diagnostics are honest, or that the chosen script structure matches best practice.
- `apps/node/src/domain/skills/scaffoldSkill.ts` creates a generic starter `SKILL.md`, a starter `run.js`, and optional `recording-context.json`.
- The starter `run.js` currently hardcodes `"clawperator"`, defaults the operator package to `com.clawperator.operator`, prints raw exec output, and does not emit a structured `SkillResult`. That means the raw scaffold is weaker than the runtime conventions exercised by current exemplars.

### Observed surface mismatches

- In this checkout, `../clawperator-skills/README.md` advertises a local `docs/` tree that is not present.
- In this checkout, there is no repo-root `authoring-skills/` directory, even though `apps/node/src/domain/skills/copyAuthoringSkills.ts` resolves packaged authoring skills from `../../../authoring-skills` by default. This is an observed checkout mismatch, not yet a verified product-wide conclusion.

## 5. Track A findings: agent-drafted skill workflow

### What already works well

- The current recording-first workflow has a strong truthfulness model. It explicitly separates evidence capture from reusable runtime logic.
- The existing authoring skill already contains good decision rules: get the natural-language goal first, delay `skill_id` until evidence exists, default to replay when truthful, allow personalized-local first outcomes, and treat `SKILL.md` as the program for orchestrated skills.
- The runtime contract behind orchestrated skills is real, not aspirational. `runSkill.ts`, `docs/api/environment.md`, and the Google Home orchestrated example line up on the environment variables, harness shape, and framed `SkillResult` expectations.
- The Google Home examples show both target shapes clearly. The replay example demonstrates direct script execution with structured result emission and shared helper usage. The orchestrated example demonstrates thin harness behavior and agent-driven control via environment.

### Where the workflow stops being enough

- The system does not yet offer a first-class discovery phase for unfamiliar flows. For a Netflix request, an agent still has to answer several questions before recording: whether an existing skill already covers the job, whether the app route is known enough to record cleanly, whether account state or personalization makes the result non-shareable, and what proof bar will be realistic for "added to My List."
- `skill-author-by-recording` is strong once the author is ready to record. It is weaker at helping an agent become ready to record.
- The host-agent discovery route after install is oriented around finding existing runtime skills, not around deciding how to author a missing one. An agent can discover "what can Clawperator run now" more easily than "how should I draft a new skill from this request."
- There is no explicit authored bridge today between discovery and proving. An agent that explores first must improvise its own transition into recording, baseline retention, replay-or-orchestrated choice, and self-test expectations.

### Why the raw scaffold is not a sufficient agent front door

- The raw scaffold path under `apps/node/src/domain/skills/scaffoldSkill.ts` is intentionally generic, but it is too generic to serve as a trustworthy workflow by itself.
- The scaffolded `SKILL.md` is a placeholder. It tells the author to fill in behavior, inputs, outputs, and caveats, but it does not encode the decision rules already captured in `skill-author-by-recording`.
- The scaffolded `run.js` uses direct CLI invocation conventions that lag behind current exemplar practice. It hardcodes `"clawperator"` instead of using the injected CLI path, defaults to the release operator package, and does not emit the structured `SkillResult` that `runSkill.ts` expects from stronger skills.
- An agent that starts from the scaffold without the authoring-skill workflow must infer too much from scattered docs and examples.

### What an agent would likely struggle with in the Netflix scenario

- Determining whether this should be a reusable shared skill or a personalized-local skill tied to a specific logged-in account state.
- Discovering the UI route before recording without silently drifting into invented selectors or unproved assumptions.
- Choosing replay versus orchestrated truthfully. Searching for a title and adding it to My List may be stable enough for replay on one account and device, but brittle across feature flags, recommendations, or title card variants.
- Declaring verification honestly. The runtime only has `node_text_matches` as a declared verification kind today, but the most truthful proof for "added to My List" may require a richer state check than simple node text matching.
- Knowing when the result is "first working draft" versus "shareable reusable skill." The current docs support personalized-local first passes, but that decision is not surfaced prominently in host-agent discovery.

## 6. Track B findings: skill creation guidance

### Guidance that already exists

- `docs/skills/overview.md`, `docs/skills/authoring.md`, `docs/skills/development.md`, and `docs/skills/runtime.md` together provide a substantial amount of grounded guidance.
- Internal design docs add durable lessons that are highly relevant to authorship: `docs/internal/design/skill-design.md` covers truthful proof, serialized device actions, debug artifacts, and continuation over blind restart.
- The Google Home replay and orchestrated examples in `../clawperator-skills/skills/` embody many of the right patterns, including thin harness structure, structured result emission, shared helper usage, and explicit contracts.
- `../clawperator-skills/scripts/generate_skill_indexes.sh` makes the generated-index contract concrete rather than optional.

### Guidance that is missing, broken, or hard to discover

- The sibling repo's `README.md` advertises a local `docs/` surface for skill development guidance, but the referenced files are absent in this checkout. An author starting in `../clawperator-skills` will hit broken guidance paths immediately.
- The most useful durable guidance is currently in the main repo, while the day-to-day authoring surface is the sibling skills repo. That split is manageable for an experienced maintainer, but it is not discoverability-friendly for a new agent or contributor.
- The current quality bar is taught partly by examples and partly by PR review, not by one co-located author checklist near the skill packages themselves.
- The install-distributed authoring story explains how to install prompt-side authoring skills, but it does not by itself solve the repo-local guidance problem for authors editing `../clawperator-skills`.

### Validation coverage versus real authoring risk

- `validateSkill.ts` proves structural parity and required files, but it does not prove truthful behavior.
- A skill can pass validation while still getting its verification semantics wrong, bypassing shared helpers, misreporting diagnostics, or drifting from expected author conventions.
- `apps/node/src/contracts/skills.ts` currently supports only `node_text_matches` as declared verification. That narrow declared-verification surface increases the importance of explicit author guidance about when to declare verification at all and when to leave proof in checkpoints or diagnostics instead.

### Where durable guidance appears to be teaching authors today

- Public docs teach the contract.
- Example skills teach the shape.
- PR review teaches the mistakes authors keep repeating.
- Existing findings files teach the hard-earned lessons after the fact.

That combination is workable for maintainers, but it is not yet a crisp authoring system.

## 7. Shared issues and dependencies

### Runtime skill discovery versus prompt-skill discovery

- Runtime skills and authoring prompt-skills are separate concepts with separate install and discovery flows.
- That separation is correct architecturally, but it raises the discoverability bar for host agents. A host agent can find installed runtime skills after install, yet still lack a clear authored path for creating a missing one.

### Install and bundling implications

- Any new first-party authoring workflow that should be available to host agents will need to fit the existing authoring-skills installation path: copy into `~/.clawperator/authoring-skills/`, then symlink into agent discovery directories.
- The observed absence of a repo-root `authoring-skills/` source directory in this checkout is important to resolve before making packaging assumptions in later work.

### Repo-boundary ownership

- `clawperator` is the right home for runtime contracts, install behavior, and canonical runtime docs.
- `../clawperator-skills` is the right home for repo-local author guidance that should be encountered while editing skills, especially generated-index expectations, helper reuse expectations, and contribution hygiene.
- Install-distributed authoring skills are the right home for procedural workflows that a host agent can invoke directly.

### Self-test and proving expectations

- The docs repeatedly expect self-test and compare-baseline behavior, but the enforcing mechanisms are spread across authoring docs, examples, and review history.
- The current system has a proving philosophy. It does not yet have one compact proving checklist in the authoring repo where contributors will naturally look first.

## 8. Recurrent lessons from PR history and existing findings

The PR-history review and the prior findings file were consistent with each other. The failure modes are not anecdotal noise. They are recurring authorship problems.

### Truthful verification and verification-state semantics

- PR 27 included review feedback that a screenshot-verified skill must not claim `node_text_matches` if the proof path does not actually establish that contract.
- The prior findings file also highlights verification-state drift and the need to distinguish verified, failed, and indeterminate outcomes honestly.
- This lines up directly with the wrapper behavior in `runSkill.ts`, which can return `SKILL_VERIFICATION_INDETERMINATE` when a declared verification claim is not proved.

### Generated index drift

- Both PR 27 and PR 29 contained review pressure to regenerate committed index artifacts alongside registry changes.
- `../clawperator-skills/scripts/generate_skill_indexes.sh` makes this a real repo contract, but authors still miss it often enough that it remains a recurring review category.

### Helper reuse versus copy-paste

- PR 27 and PR 29 both surfaced helper-reuse issues, including package-resolution helpers and entity-decoding or normalization logic that should have been shared instead of duplicated.
- The Google Home replay example already demonstrates the preferred shared-helper approach via `skills/utils/common.js`.

### Diagnostics truthfulness

- PR 27 review pushed back on diagnostics that referenced deleted artifacts or implied healthy runtime state despite failure conditions.
- PR 29 review pushed back on dumping raw execution failures into the emitted `SkillResult` instead of providing truthful summaries.
- The prior findings file echoes the same point: diagnostics are part of the skill contract and must describe reality, not convenience.

### Parser ambiguity and robustness

- Both PRs surfaced fragile parsing and argument-handling problems, including flag parsing that could silently capture the wrong value and entity-decoding gaps that missed common forms.
- The prior findings file likewise calls out parser ambiguity and image robustness as recurring sources of false confidence.

### Privacy hygiene

- The PR review set reinforces that privacy hygiene is not limited to committed code. Validation notes and PR metadata can also leak real device serials or local paths.
- This matches the repo rules in both repos, but the repeated appearance of the issue means the rule is not currently embedded deeply enough in the author workflow.

## 9. Design options and tradeoffs

### Option 1: Keep recording-first and extend `skill-author-by-recording`

This keeps one front door and preserves the strongest current workflow. It also reduces packaging sprawl. The downside is that it asks one skill to own both "become ready to record" and "prove the reusable result," which are different problems. That risks burying discovery concerns inside a workflow whose current strength is precisely that it is evidence-first and opinionated about the proving phase.

### Option 2: Add a sibling discovery-oriented authoring skill

This gives host agents a clearer place to start when route knowledge is missing. It would better match the natural-language request shape and make pre-recording work explicit. The downside is another top-level surface to teach and install. It also requires a careful handoff back into recording and proving so that discovery work does not masquerade as a finished reusable skill.

### Option 3: Add helper tooling only, without a new top-level workflow

This has the lowest surface-area cost. Better helpers, better scaffold output, or better docs could improve the story without adding a new prompt-skill. The downside is that the hardest problem here is orchestration, not just missing primitives. A host agent still has to discover the right order and decision rules itself.

### Option 4: Hybrid workflow with explicit discovery and explicit proving phases

This matches the observed reality best. Some flows are already understood well enough to go straight into recording. Others, like the Netflix scenario, need route discovery before a recording can be trusted. The tradeoff is complexity: the workflow boundary has to be explicit, the handoff has to be documented, and the repo ownership has to stay clear.

## 10. Recommended direction

### Recommended direction for Track A

Prefer a hybrid authorship model rather than a pure recording-first or pure discovery-first model. The evidence in this pass points to recording and compare-baseline as the right proving back half, but not always as the right first move. For unfamiliar app routes, the system should support an explicit discovery phase before recording.

For surface shape, the safer direction is to keep `skill-author-by-recording` specialized around recording, evidence retention, replay-versus-orchestrated choice, and proving. The discovery-first behavior should be introduced as a clearly separate phase, whether that ends up as a sibling authoring skill or another explicit front-end surface. The important recommendation is the boundary, not the final naming.

Owner surfaces:

- `clawperator`: define the authoritative workflow boundary between discovery and proving, and keep runtime contract truthfulness central.
- Install-distributed authoring skills: provide the host-agent-invokable workflow surface that can branch between discovery and recording.

### Recommended direction for Track B

Treat guidance as a co-location problem, not just a content problem. The main repo should remain canonical for runtime contracts, CLI/API semantics, and environment rules. The sibling `../clawperator-skills` repo should gain the repo-local guidance authors actually need while editing skills, especially around:

- truthful verification
- helper reuse
- generated index regeneration
- self-test expectations
- privacy hygiene in code, artifacts, and PR notes
- deciding personalized-local versus shared-general scope

Owner surfaces:

- `clawperator`: keep contract definitions and public runtime docs canonical.
- `../clawperator-skills`: own the author-facing checklist, contribution guidance, and repaired local guidance links near the skills themselves.
- Install-distributed authoring skills: reinforce the procedural workflow and point authors at the right canonical docs, rather than trying to replace repo-local guidance entirely.

## 11. Recommended split for future task packs

This should split into two task packs.

### Task pack A: agent-assisted skill drafting workflow

Scope should cover:

- host-agent entry from a natural-language request
- discovery of existing runtime skills versus missing-skill authorship
- explicit discovery-before-recording behavior for unfamiliar routes
- handoff into recording, baseline retention, replay-or-orchestrated choice, and first proving pass
- install-distributed authoring-skill implications

Primary owner surfaces:

- `clawperator`
- install-distributed authoring skills

### Task pack B: skill creation guidance and repo-surface hardening

Scope should cover:

- repairing broken or missing guidance surfaces in `../clawperator-skills`
- co-locating the author checklist where skill contributors work
- making repeated PR-review lessons durable and discoverable
- clarifying generated-index, helper reuse, verification, and privacy expectations
- keeping boundary ownership explicit between main repo docs and skills-repo guidance

Primary owner surfaces:

- `../clawperator-skills`
- `clawperator` docs where contract cross-reference needs to stay canonical

## 12. Open questions

- Is the missing repo-root `authoring-skills/` directory in this checkout a local checkout mismatch, a packaging artifact, or evidence that the current packaged-authoring-skills source of truth has moved?
- For unfamiliar app routes, what is the minimum discovery output that is good enough to justify recording rather than continuing exploratory work?
- Should the future agent entrypoint present "shared reusable skill" versus "personalized-local skill" as an explicit early decision?
- Is `node_text_matches` enough as the only declared verification kind for the kinds of reusable skills the project now wants to author, or should later work assume richer declared verification eventually matters?
- What is the best durable home in `../clawperator-skills` for author guidance: repaired `docs/` pages, `AGENTS.md`, a contributor checklist, or a combination?
- How should host agents distinguish "I should run an installed skill now" from "I should enter the authorship workflow now" without confusing runtime-skill discovery and prompt-skill discovery?
