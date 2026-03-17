# Task: Agent Onboarding and Product Legibility

## Goal

Make Clawperator easy for a cold-start agent to discover, understand, trust,
and use productively without prior Clawperator-specific knowledge.

This plan treats the recent real-world evaluation in the local
`install-test-2` workspace and the corresponding Claude session export as the
input evidence. The work is intentionally biased toward agent onboarding, while
still keeping human readers in mind: complete, precise, reachable docs are
part of the trust signal for both audiences.

The landing page is not the primary focus here. The main priority is the
agent-facing docs, runtime contracts, and skill-authoring workflow behind it.

---

## Product outcome we want

A capable general-purpose agent should be able to do all of the following from
the public website and docs, without hidden tribal knowledge:

1. Understand the brain/hand model and execution loop quickly.
2. Install the CLI and operator with a predictable recovery path.
3. Find a complete, copy-pasteable first successful execution example.
4. Learn the action contracts, selector strategy, result semantics, and error
   handling without reading TypeScript declarations.
5. Explore an unknown Android app with a reliable observe-decide-act loop.
6. Turn that exploration into a reusable private skill with documented
   structure, conventions, and validation guidance.

---

## Guiding principles

- Optimize for cold-start agent success, not insider familiarity.
- Prefer authoritative docs and contract clarity over aspirational copy.
- Fix broken entrypoints before adding new sophistication.
- Distinguish operational docs from design/rationale docs so primary agent
  paths do not sound internal or architecture-heavy.
- Preserve the brain/hand boundary: Clawperator is a neutral actuator, not a
  policy engine for what user inputs are acceptable to enter.
- Reduce trial-and-error where a concrete example or explicit caveat would
  remove it.
- Separate "document current behavior accurately" from "change the runtime to
  improve the behavior", but plan both.
- Keep landing/docs/generated artifacts in sync so public links stay valid.

---

## Source findings to address

The evaluation surfaced six clusters of issues:

1. Public docs discoverability and reachability
2. Missing end-to-end onboarding examples for agents
3. Underdocumented payload, selector, action, timeout, and result semantics
4. Misleading or trust-breaking runtime behavior (`close_app`,
   `scroll_until`, overlays, validate-only gap)
5. Weak skill-authoring documentation and tooling
6. Install and multi-device recovery gaps

This plan groups those into phased implementation so we can land value
incrementally and keep commits reviewable.

---

## Progress snapshot

Status as of `2026-03-17`:

- Phase 0: complete
- Phase 1: complete
- Phase 2: complete
- Phase 3: mostly complete
- Phase 4: mostly complete
- Phase 5: mostly complete
- Phase 6: partially complete

Major work already landed:

- Restored the docs information architecture and public entrypoints so the core
  agent docs are reachable and linked correctly.
- Added a cold-start [Agent Quickstart](../../docs/agent-quickstart.md) and a
  dedicated canonical [Snapshot Format](../../docs/snapshot-format.md) page.
- Preserved and relocated the real-device snapshot examples into the dedicated
  snapshot page, then reduced duplicate long-form snapshot prose elsewhere.
- Renamed and repositioned internal-sounding design material so operational
  docs are the primary entrypoint.
- Clarified the neutral actuator model, including around usernames, passwords,
  and other user-provided inputs.
- Expanded contract docs for selectors, execution status, error handling,
  environment variables, timeout budgeting, device/package targeting, and
  Android navigation patterns.
- Fixed `close_app` semantics in the Node execution path so successful
  force-stop behavior is reflected as a successful step result.
- Added `TARGET_FOUND` semantics for `scroll_until` and support for
  `clickAfter` when a target becomes visible.
- Added best-effort overlay metadata to snapshot results.
- Added `clawperator execute --validate-only`.
- Softened the install flow for multi-device environments so host setup can
  complete before per-device finish commands are printed.
- Added `clawperator skills new <skill_id>`.
- Added `clawperator skills validate <skill_id>` and
  `clawperator skills validate --all`.
- Added explicit screenshot path support with
  `clawperator observe screenshot --path <file>`.
- Improved skill-wrapper failure handling so partial stdout and stderr are
  preserved on timeouts and non-zero exits.

Recent implementation commits in this repo:

- `4faa8bf` `docs(onboarding): add quickstart and snapshot reference`
- `4d4d984` `docs(api): clarify runtime caveats and setup guidance`
- `abbcf08` `fix(runtime): normalize close app results`
- `b4dbb00` `fix(scroll): add target-found termination support`
- `23cbbb6` `docs(skills): surface skill authoring contract`
- `a8fb8f6` `feat(skills): scaffold local skill templates`
- `2961b47` `feat(snapshot): surface overlay metadata`
- `980bda9` `docs(reference): add execution and device model guides`
- `c353a77` `fix(install): soften multi-device completion flow`
- `a262f85` `docs(reference): add agent error handling guide`
- `c3c4c6d` `feat(cli): add execute validate-only mode`
- `e8246f1` `docs(ai): add navigation patterns guide`
- `3c507e9` `feat(scroll): allow scroll_until to click visible targets`
- `84e1b72` `fix(skills): preserve partial output on wrapper failures`
- `79ac4c0` `docs(reference): add skill wrapper recovery guidance`
- `a831d0d` `docs(reference): add timeout budgeting guide`
- `8a5b650` `feat(observe): support explicit screenshot paths`
- `a7916c6` `feat(skills): add validate command`
- `ae303b2` `feat(skills): add registry-wide validation`

Matching docs-only progress also landed in the sibling
`../clawperator-skills` repository for skill authoring guidance.

Main gaps still worth addressing:

- deeper exploration-to-skill ergonomics beyond scaffolding and validation
- any remaining docs rough edges or drift discovered during broader review
- higher-level runtime ergonomics that reduce round-trips further without
  weakening determinism

---

## Phase 0: Baseline audit and source-of-truth alignment

**Status:** Complete

### Why first

Before changing behavior or docs, we need one explicit map from each reported
finding to the owned source file, generated output, validation command, and
public surface affected.

### Scope

- Cross-map the findings from:
  - the local `install-test-2/findings.md`
  - the local `install-test-2/docs-findings.md`
  - the corresponding Claude session export for that evaluation
- Identify current authored docs sources for each broken or missing public page.
- Confirm which issues are:
  - docs-only
  - runtime-only
  - install-only
  - docs + runtime combined

### Deliverables

- This plan
- A follow-up implementation checklist derived from this plan, if needed

### Exit criteria

- Every reported issue has a clear home in source before implementation begins.

### Suggested commit boundary

- `docs(tasks): add phased agent onboarding plan`

---

## Phase 1: Restore public docs as a trustworthy entrypoint

**Status:** Complete

### Objective

Fix the practical "agents cannot self-onboard from the website" problem first.

### Scope

- Verify and fix docs-site routing, generated page paths, redirects, and link
  expectations for:
  - `reference/api-overview/`
  - `reference/cli-reference/`
  - `design/operator-llm-playbook/`
  - `getting-started/first-time-setup/`
  - any referenced error or guide pages
- Verify that the landing-site links point to working docs-host URLs.
- Verify that `llms.txt` and `llms-full.txt` point to valid, intended
  resources.
- Audit the public information architecture so operational docs are the primary
  linked entrypoints for agents and design/rationale docs are clearly secondary.
- Add deployment-surface validation so future broken doc links are caught
  before merge or immediately after deploy.

### Likely source areas

- `sites/docs/mkdocs.yml`
- `sites/docs/source-map.yaml`
- `docs/index.md`
- `sites/docs/static/`
- `sites/landing/app/`
- `sites/landing/public/`

### Deliverables

- Working docs paths on `docs.clawperator.com`
- Link audit fixes on public surfaces
- Clear separation between primary operational entrypoints and secondary
  design/rationale material
- A repeatable validation step for docs reachability

### Validation

- `./scripts/docs_build.sh`
- local inspection of generated docs paths
- targeted live-surface verification for docs URLs after deployment

### Suggested commit boundary

- `fix(docs): restore agent-facing docs entrypoints`

---

## Phase 2: Create a true cold-start agent quickstart

**Status:** Complete

### Objective

Give agents one canonical path from "I just found Clawperator" to "I ran a real
successful command and know what to do next."

### Scope

- Add a dedicated agent quickstart authored for cold-start use.
- Add or reserve a dedicated snapshot-format page as a first-class companion
  entrypoint for agents, not just a subsection inside broader API docs.
- Make that snapshot-format page the single authored source of truth for
  snapshot structure and parsing guidance, with all other docs linking to it
  instead of carrying competing long-form copies.
- Include a complete worked example with:
  - snapshot
  - execution payload
  - result envelope
  - next-step interpretation
- Make the quickstart the primary agent entrypoint in docs and machine-facing
  indexes.
- Ensure `llms-full.txt` includes the exact same concrete examples, not just
  prose.

### Required content

- Brain vs hand mental model
- Observe-decide-execute-return loop
- Exact required execution fields:
  - `commandId`
  - `taskId`
  - `source`
  - `expectedFormat`
  - `timeoutMs`
  - `actions`
- Explanation of overall envelope status vs per-step success

### Likely source areas

- `docs/node-api-for-agents.md`
- `docs/index.md`
- potentially a new authored doc under `docs/`
- generated docs via the docs-generation workflow
- `sites/docs/static/llms.txt`
- `sites/docs/static/llms-full.txt` or the generator inputs that produce it

### Deliverables

- New quickstart page
- Snapshot-format page linked directly from the quickstart
- Updated docs index and machine-readable entrypoints
- Complete runnable examples visible in both rendered docs and `llms-full.txt`

### Validation

- docs regeneration
- docs build
- manual copy-paste sanity check of examples against current CLI

### Suggested commit boundary

- `docs(onboarding): add cold-start agent quickstart`

---

## Phase 3: Close the documentation contract gaps

**Status:** Mostly complete

### Objective

Make the docs sufficient for an agent to use Clawperator correctly without
reading source or discovering behavior by failed execution.

### Scope

- Review all public docs for language that implies Clawperator itself decides
  whether certain user inputs, such as usernames, passwords, email addresses,
  or other credentials, are acceptable to enter.
- Correct any wording that turns the actuator into a policy-maker. The intended
  contract is:
  - the brain agent decides what workflow to perform on the user's behalf
  - Clawperator provides deterministic UI interaction primitives to carry out
    those decisions
  - credential entry is neither specially endorsed nor specially forbidden by
    Clawperator itself
- Keep the security/privacy guidance focused on repository hygiene,
  documentation examples, and safe defaults for this codebase, without
  overstating product-level restrictions on what an agent may ask the actuator
  to type on a user's own device.
- Review titles and nav placement for internal-sounding docs so agents are not
  nudged toward architecture/rationale material before operational docs.
- Rename or reposition documents whose current titles imply internal design
  notes more than agent-usable guidance. A likely candidate is the current
  `Clawperator Node Runtime and API Design` document, which may belong as
  secondary rationale material under a clearer title such as runtime
  architecture or execution-model rationale.
- Add a dedicated snapshot-format reference page covering the structure returned
  by snapshot surfaces, especially `snapshot_ui`.
- Move the existing long-form snapshot-output material and real-device example
  captures out of the general API doc into that dedicated page, preserving the
  examples rather than rewriting them from scratch.
- Document that the hierarchy is modeled after Android UI Automator output, but
  is not a byte-for-byte copy, and call out where agents must not assume exact
  upstream parity.
- Document the snapshot envelope placement and the fields agents should rely on
  most when parsing and matching.
- Include an annotated real snapshot example with field-by-field guidance on:
  - what is familiar from UI Automator
  - what Clawperator normalizes or changes
  - what is stable enough for selectors
  - what is auxiliary or unstable
- Reduce other docs to concise summaries plus links:
  - quickstart links to the dedicated snapshot page
  - API overview links to the dedicated snapshot page
  - playbook keeps only operational guidance and short reminders
  - troubleshooting keeps only failure-mode guidance
- Ensure design/rationale docs remain available for deeper context, but are not
  presented as the default docs path for first-time agent use.
- Expand action reference coverage and caveats:
  - `clickType`
  - `scroll_until` parameters and termination semantics
  - `scroll_and_click` scope and limitations
  - `open_uri` supported formats and non-supported cases
  - `close_app` caveat or deprecation guidance depending on runtime decision
- Add a selector strategy reference:
  - NodeMatcher stability ranking
  - AND semantics examples
  - fallback guidance when `resourceId` is absent
- Add timeout policy documentation:
  - valid range
  - practical recommendations
  - failure semantics
- Add a first-class result-envelope explanation:
  - execution status
  - step success
  - recoverable vs non-recoverable patterns
- Add environment variable documentation:
  - `CLAWPERATOR_INSTALL_APK`
  - `CLAWPERATOR_SKILLS_REGISTRY`
  - any other supported install/runtime variables surfaced by code
- Add multi-device workflow documentation and recovery guidance.
- Add or fix an error reference with agent-action guidance for each important
  error class.

### Likely source areas

- `docs/node-api-for-agents.md`
- `docs/troubleshooting.md`
- `docs/first-time-setup.md`
- `docs/design/operator-llm-playbook.md`
- `docs/reference/node-api-doctor.md`
- generated docs outputs

### Deliverables

- Contract-complete public docs for current shipped behavior
- Dedicated snapshot-format documentation that agents can rely on directly
- No duplicated authored long-form snapshot spec spread across multiple docs
- Clear doc naming and placement that distinguishes how to use the product from
  why the product is designed the way it is
- Brain/hand wording that makes Clawperator's neutral actuator role explicit,
  including around credential entry and other user-provided inputs
- Fewer hidden requirements and fewer "discover by failure" moments

### Validation

- docs regeneration
- docs build
- targeted CLI help and source spot-checks for contract accuracy

### Suggested commit boundary

- `docs(api): document current runtime contracts for cold-start agents`

### Progress notes

- Completed:
  - dedicated snapshot-format reference page
  - quickstart and API cross-linking to the snapshot page
  - clearer distinction between operational docs and design/rationale docs
  - neutral actuator wording across the key docs
  - selector, timeout, execution-model, environment-variable, and
    error-handling references
  - `open_uri`, `scroll_until`, `close_app`, and snapshot metadata caveats in
    public docs
  - skill authoring and validation guidance in both repos
- Remaining:
  - continue broad doc review for any smaller contract gaps or stale wording
  - decide whether any additional reference pages should be split out as the
    docs corpus grows

---

## Phase 4: Fix trust-breaking runtime behavior and missing diagnostics

**Status:** Mostly complete

### Objective

Reduce the cases where the product claims determinism but the observable
behavior is misleading, incomplete, or silently broken.

### Scope

- Decide and implement the `close_app` path:
  - either make it work reliably in the execution path
  - or remove/deprecate it from the supported action surface
- Improve `scroll_until` semantics:
  - add a target-found signal if feasible
  - otherwise ensure current result semantics are explicit and machine-usable
- Evaluate agent-visible overlay/dialog detection:
  - snapshot metadata
  - explicit warning field
  - or another deterministic signal
- Add a validation-only path for execution payloads if feasible.
- Review install-script and doctor behavior around multi-device partial success
  and recovery commands.
- Review output consistency around `doctor --format json`, `--json`, and pretty
  output expectations.

### Likely source areas

- `apps/node/src/`
- `apps/android/`
- `scripts/install.sh`
- relevant tests in Node and Android modules
- docs that describe the affected behavior

### Deliverables

- Resolved or explicitly narrowed `close_app` contract
- Improved `scroll_until` contract and results
- Better overlay awareness or clearly documented limitations
- Optional `--validate-only` support if implementation cost is reasonable
- Better install recovery for multi-device environments

### Validation

- `npm --prefix apps/node run build && npm --prefix apps/node run test`
- `./gradlew :app:assembleDebug`
- `./gradlew testDebugUnitTest`
- relevant smoke scripts for changed runtime paths
- device or emulator verification for changed UI/runtime behavior

### Suggested commit boundaries

- `fix(runtime): resolve close-app contract`
- `feat(api): improve targeted scroll diagnostics`
- `fix(install): improve multi-device recovery guidance`

### Progress notes

- Completed:
  - `close_app` now normalizes successful Node-side force-stop behavior into a
    successful step result
  - `scroll_until` emits `TARGET_FOUND`
  - `scroll_until` can optionally click the target once visible
  - snapshot overlay metadata is surfaced
  - `execute --validate-only` exists
  - install flow now handles multi-device end states more gracefully
- Remaining:
  - evaluate whether any more overlay or dialog diagnostics should be surfaced
  - continue reviewing for any other trust-breaking result-shape mismatches

---

## Phase 5: Improve the skill-authoring path from exploration to reuse

**Status:** Mostly complete

### Objective

Make private skill creation a documented and supported workflow rather than a
convention-discovery exercise.

### Scope

- Add a dedicated "Creating Private Skills" guide.
- Document:
  - directory structure
  - `skill.json` schema and field meanings
  - `SKILL.md` conventions
  - private skill registration/discovery
  - artifacts concepts and when to use them
- Improve official guidance for robust skill scripts:
  - timeout strategy
  - parsing `execFileSync` failures safely
  - expected markers, outputs, and artifacts
- Evaluate tooling improvements:
  - `skills scaffold`
  - better validation or dry-run support
  - reusable examples/templates

### Likely source areas

- `docs/`
- `../clawperator-skills/docs/`
- skill-related CLI code in `apps/node/src/`
- example skills if we need canonical reference fixtures

### Deliverables

- Skill authoring guide sufficient for a cold-start agent
- Optional scaffolding or validation tooling if prioritized

### Validation

- docs regeneration/build
- skill-related CLI tests if tooling changes land
- smoke-check against at least one private-skill workflow

### Suggested commit boundaries

- `docs(skills): document private skill authoring`
- `feat(skills): add scaffolding for private skills`

### Progress notes

- Completed:
  - dedicated skill authoring documentation in `../clawperator-skills/docs/`
  - documented `skill.json`, registry model, artifacts, wrapper behavior, and
    timeout guidance
  - `skills new <skill_id>`
  - `skills validate <skill_id>`
  - `skills validate --all`
- Remaining:
  - evaluate whether artifact or script dry-run tooling is worth adding
  - evaluate whether exploration-to-skill capture tooling belongs in this
    effort or a later roadmap item

---

## Phase 6: Agent productivity optimizations and higher-level ergonomics

**Status:** Partially complete

### Objective

After the public surface is trustworthy and the core contracts are explicit,
reduce round-trips and friction for real agent workflows.

### Scope

- Evaluate higher-level actions for common navigation patterns:
  - top-level scroll-to-and-click compound action
  - better page-list targeting defaults
- Evaluate richer progress or streaming surfaces where they materially improve
  agent control loops.
- Evaluate snapshot adjunct metadata that helps generic agents recover from
  popups, overlays, or transitions.
- Review whether a recorder or other exploration-to-skill accelerator belongs
  in roadmap or implementation now.

### Deliverables

- Prioritized ergonomic improvements based on real agent loop cost
- At least one concrete reduction in common round-trip count if feasible

### Validation

- focused runtime tests
- real-device smoke workflow on unknown-app navigation

### Suggested commit boundaries

- separate per capability; do not bundle with baseline docs repair

### Progress notes

- Completed:
  - top-level `scroll_until` now supports immediate click-on-visible-target
  - snapshot overlay metadata reduces some unknown-UI recovery ambiguity
  - explicit screenshot output paths reduce file-handling friction
- Remaining:
  - determine whether a broader top-level scroll-to-and-click primitive is
    still needed beyond the current `clickAfter` support
  - determine whether streaming or recorder-style ergonomics justify the
    implementation cost

---

## Recommended implementation order

1. Phase 1 - restore docs reachability and public trust
2. Phase 2 - add cold-start quickstart and runnable examples
3. Phase 3 - fill current-behavior contract gaps
4. Phase 4 - fix trust-breaking runtime/install mismatches
5. Phase 5 - document and improve skill authoring
6. Phase 6 - add higher-level ergonomics after the foundation is stable

This ordering is deliberate:

- broken docs block onboarding immediately
- examples eliminate the largest trial-and-error tax
- contract clarity should precede new feature expansion
- runtime fixes should land once docs can describe them accurately
- skill tooling is most valuable after the exploration path is legible

---

## Cross-cutting requirements for every implementation phase

- Update authored docs in the same change as behavior changes.
- Regenerate `sites/docs/docs/` via the docs-generation workflow when required.
- Keep landing links, `llms.txt`, and `llms-full.txt` aligned with the docs
  host.
- Prefer narrow, reviewable commits per phase or sub-phase.
- Validate both machine-facing and human-facing surfaces.
- Do not leave known caveats undocumented while code is still in transition.

---

## Suggested success metrics

We should consider this effort successful when a fresh agent can:

1. Start from `clawperator.com` and `docs.clawperator.com` without hitting dead
   links for core agent resources.
2. Produce a valid first execution payload from docs alone.
3. Understand the result envelope and recover correctly from step-level
   failures.
4. Discover current limitations like `close_app`, `scroll_until`, and
   multi-device handling from docs instead of failed experiments.
5. Create a private skill from documented conventions without reverse
   engineering existing examples.

---

## Out of scope for the first implementation pass

- Large landing-page marketing rewrites
- Broad architectural refactors not directly tied to onboarding friction
- New autonomy/planning logic inside Clawperator itself
- Documentation that promises behavior before implementation exists

---

## Notes

- `tasks/` is an intentional temporary planning area. Durable conclusions from
  implementation should be migrated into the proper docs and source comments as
  work lands.
- If this plan changes significantly during execution, update this file in a
  narrow follow-up commit rather than silently diverging from it.
