# Skill Authorship Findings - Compiled

Prepared: 2026-04-19
Scope: findings pass only. No implementation, no task packs, no new runtime skills.

## Executive summary

Clawperator already has a strong evidence-first authoring workflow once the team
has decided to create a skill. The current front door,
[`skill-author-by-recording`](../../../.agents/skills/skill-author-by-recording/SKILL.md),
is concrete, honest about replay versus orchestrated tradeoffs, requires a
self-test, and keeps the result inspectable through retained evidence and
`SkillResult`.

The bigger gap is earlier in the flow. For a request like:

> "Make a Clawperator skill that opens Netflix, searches for House of Cards,
> and adds it to My List."

the current system can truthfully tell a host agent that no installed runtime
skill exists, but it does not give the agent a first-class next step. Today the
path from "no skill found" to "we should author one" is under-specified. That
forces the agent to improvise route discovery, scope, recording readiness, and
the first truthful skill shape.

The second gap is durable guidance. The strongest contract and design docs live
in `clawperator`, but the place where contributors actually land and harden
runtime skills is `../clawperator-skills`. That repo currently has a thinner
local author index, broken README-linked docs in this checkout, and repeated PR
review patterns around verification drift, generated index drift, helper
duplication, diagnostics truthfulness, parser ambiguity, and privacy hygiene.
The split is not wrong by design, but it forces authors to context-switch at
exactly the moments where they make their worst mistakes.

**Verdict:** keep the two follow-up problems separate for execution, but not
for analysis.

- One shared findings pass is the right shape.
- The follow-up should split into three packs:
  - **Pack 0**: shared prerequisite to repair broken surfaces and tighten
    mechanical guardrails.
  - **Pack A**: agent-assisted skill drafting and the discovery-to-proving
    workflow.
  - **Pack B**: durable skill creation guidance and repo-surface hardening.
- Pack 0 must land first. Pack A and Pack B can then proceed concurrently, but
  both depend on Pack 0's validator and doc-surface repairs.

## Scope and method

This synthesis merges:

- [findings-claude.md](./findings-claude.md)
- [findings-codex-1.md](./findings-codex-1.md)
- [findings-codex-2.md](./findings-codex-2.md)

Approach:

- Kept only the highest-signal points.
- Deduplicated overlapping observations.
- Resolved conflicts where local verification was possible.
- Preserved tradeoffs where the right answer is still a design decision.
- Restored concrete contract details (env vars, injection rules, precedence
  chains) that downstream task packs will need verbatim.

## Definitions

These terms recur throughout the document and are load-bearing for both
tracks. They are pinned here so downstream task packs do not re-derive them.

| Term | Meaning in this document |
| --- | --- |
| **Discovery** | Any agent-driven work that happens *before* a recording is started. In scope: reading the installed runtime registry, running live UI probes (`clawperator snapshot`, short screenshot loops) on the target app, reviewing prior recordings and findings, reading first-party Clawperator docs. Out of scope for this document: general web research, reading external product docs. |
| **Proving** | The workflow that turns captured evidence into a real skill plus a passing self-test. Proving is done when: `skill.json` parses, `validateSkill` passes, the declared contract (if any) verifies, and the self-test exits clean against a physical or emulated device. |
| **Truthfulness** | Three concrete sub-claims that must all hold at runtime: (a) `SkillResult.status` reflects reality, (b) emitted diagnostics strings do not reference state that is no longer true, (c) a non-null declared `contract.verification` is actually provable by the runtime's declared matcher path. |
| **Personalized-local skill** | A skill whose correct behavior depends on a specific user's account, device, or environment. Example: "set kitchen zone to cool on my AirTouch." Not shipped in the public skills registry. |
| **Shared-general skill** | A skill whose correct behavior is reproducible across users given the same app version. Example: "open Netflix and search for a title." Eligible for the public skills registry. |
| **Host agent** | The outermost agent surface the user talks to. Canonical host in this document is **OpenClaw on Telegram**. Variants are local-shell agents (Codex, Claude Code) running on the user's box. These variants have different affordances: Telegram cannot run `adb`; local shells can. Where behavior differs, this is called out. |
| **Evidence** | Recording exports (`skills/<id>/references/compare-baseline.export.json`), live snapshots, and validator output. Not: scratch notes, unverified agent claims. |
| **Recording-first** | Authoring workflow where evidence capture (recording) precedes skill drafting. The current default. |
| **Discovery-first** | Authoring workflow where a bounded discovery pass precedes recording, because the agent does not yet know enough about the app route to record usefully. |

## Anchor scenario walkthrough

Pinned here so every downstream pack works from the same concrete trace.

> User on Telegram: "Make a Clawperator skill that opens Netflix, searches for
> House of Cards, and adds it to My List."

Current behavior, hop by hop:

1. **Telegram surface receives the message.** OpenClaw is the host agent. It
   cannot run `adb` or `clawperator` directly; it must shell to a coding agent
   on the user's box.
2. **OpenClaw routes to a local coding agent** (Codex or Claude Code). That
   agent has file-system access, `adb`, and the `clawperator` CLI.
3. **The coding agent checks the runtime registry.** In practice this is
   `clawperator skills list --json`, which resolves the registry through the
   precedence chain defined in
   [apps/node/src/adapters/skills-repo/localSkillsRegistry.ts](../../../apps/node/src/adapters/skills-repo/localSkillsRegistry.ts).
   No Netflix skill is installed. The agent now knows "no installed skill
   solves this."
4. **The agent must now decide: author a skill.** Today, the front door it
   discovers (via `~/.clawperator/AGENTS.md` and the symlinked authoring-skill
   directories) is
   [`skill-author-by-recording`](../../../.agents/skills/skill-author-by-recording/SKILL.md).
   That skill is written for the case where the author already knows the app
   route and is ready to record.
5. **Gap surfaces here.** The agent has no route knowledge, no installed
   recording artifacts for Netflix, no decision on personalized-local versus
   shared-general, and no bounded way to do discovery before recording.
6. **Downstream consequences.** Even if the agent powers through and records
   something, the first PR is highly likely to hit the recurring failure
   patterns enumerated below (verification drift, helper bypass, diagnostics
   truthfulness), because the author had no checklist on the skills-repo side
   to consult before opening the PR.

This is the concrete shape that Track A and Track B together must close. Pack
A targets steps 3-5. Pack B targets step 6.

## Verified current-state map

### Core source-of-truth surfaces

| Area | Primary sources | What they establish |
| --- | --- | --- |
| Runtime skill contract | [apps/node/src/contracts/skills.ts](../../../apps/node/src/contracts/skills.ts), [apps/node/src/contracts/skillResult.ts](../../../apps/node/src/contracts/skillResult.ts), [apps/node/src/domain/skills/runSkill.ts](../../../apps/node/src/domain/skills/runSkill.ts) | Registry shape, declared verification, `SkillResult`, terminal frame parsing, trusted source injection |
| Authoring workflow | [docs/skills/authoring.md](../../../docs/skills/authoring.md), [skill-author-by-recording](../../../.agents/skills/skill-author-by-recording/SKILL.md) | Recording-first front door, self-test requirement, replay/orchestrated choice, compare-baseline rules |
| Host-agent path | [docs/host-agents.md](../../../docs/host-agents.md), [docs/internal/design/agent-host-integration.md](../../../docs/internal/design/agent-host-integration.md), [sites/landing/public/install.sh](../../../sites/landing/public/install.sh) | Installed discovery route favors runtime-skill lookup first |
| Runtime skill author surface | [../../../../clawperator-skills/AGENTS.md](../../../../clawperator-skills/AGENTS.md), [../../../../clawperator-skills/README.md](../../../../clawperator-skills/README.md), [../../../../clawperator-skills/scripts/generate_skill_indexes.sh](../../../../clawperator-skills/scripts/generate_skill_indexes.sh) | Skills-repo rules, layout, and generated-index contract |
| Prior hardening evidence | `~/.clawperator/findings/skill-drafting/findings.md`, PR 27, PR 29 | Repeated authoring failure patterns are real and recurring |

### Ownership by surface

| Surface | Owns | Does not own |
| --- | --- | --- |
| `clawperator` | runtime contracts, CLI/API, validator, install flow, public docs, packaged authoring skills | shipped runtime skill packages |
| `../clawperator-skills` | runtime skill folders, generated registry/indexes, examples, repo-local contribution surface | runtime wrapper semantics, install behavior |
| install-distributed authoring skills | prompt-side workflows an agent can invoke directly | durable runtime-skill guidance as the only source of truth |

### Concrete authoring-contract trapdoors

These are the specific places authors stumble today. Downstream packs should
treat them as verbatim inputs.

**`SkillResult` framed output contract** (from
[apps/node/src/domain/skills/runSkill.ts](../../../apps/node/src/domain/skills/runSkill.ts)):

- Authors emit a single frame suffixed with `[Clawperator-Skill-Result]`
  followed by one JSON object.
- `contractVersion` is `"1.0.0"`.
- **`source` is injected by the runtime.** Authors must **not** emit it. Any
  emitted `source` field is a bug.
- The wrapper returns `skillResult` verbatim; parse failures produce
  `SKILL_RESULT_PARSE_FAILED`.

**Registry resolution precedence** (from
[apps/node/src/adapters/skills-repo/localSkillsRegistry.ts](../../../apps/node/src/adapters/skills-repo/localSkillsRegistry.ts)):

1. explicit `--registry` arg
2. `CLAWPERATOR_SKILLS_REGISTRY` env var
3. cwd-relative `skills/skills-registry.json`
4. `~/.clawperator/skills/skills/skills-registry.json`

`REGISTRY_READ_FAILED` messages name the installed home; authors who set
`CLAWPERATOR_SKILLS_REGISTRY` to a stale path get confusing failures.

**Orchestrated runtime env contract** (from
[apps/node/src/domain/skills/runSkill.ts](../../../apps/node/src/domain/skills/runSkill.ts)):

- `CLAWPERATOR_SKILL_PROGRAM` - orchestrated program body, passed from
  `skill.json`.
- `CLAWPERATOR_SKILL_INPUTS` - JSON object of trusted inputs.
- `CLAWPERATOR_SKILL_AGENT_CLI` - `codex` today; the only orchestrated agent.
- `CLAWPERATOR_SKILL_AGENT_CLI_PATH`, `CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS`.
- `CLAWPERATOR_SKILL_ID`, `CLAWPERATOR_DEVICE_ID`.

This is the contract Track A must honor if agent-drafted skills land as
orchestrated.

**Device id passing convention** (from the CLI wrapper): when `--device <serial>`
is passed, the wrapper prepends the serial as `argv[2]` to the child. Forwarded
args land after that. Authors who hand-parse positional args must honor this
shape.

**Authoring-skill installation surface** (from
[apps/node/src/domain/skills/copyAuthoringSkills.ts](../../../apps/node/src/domain/skills/copyAuthoringSkills.ts)
and [sites/landing/public/install.sh](../../../sites/landing/public/install.sh)):

- Packaged authoring skills install to `~/.clawperator/authoring-skills/`.
- Symlinks wire them into `~/.claude/skills/`, `~/.codex/skills/`, and
  `~/.agents/skills/`.
- `install.sh` writes `~/.clawperator/AGENTS.md` and a
  `CLAWPERATOR_SHARED_AGENT_BRIDGE:START/END` block in `~/.agents/AGENTS.md`.
- Any new packaged authoring skill from Pack A needs to honor all three wiring
  points or agents will not discover it.

### Scaffold versus exemplar divergence

[apps/node/src/domain/skills/scaffoldSkill.ts](../../../apps/node/src/domain/skills/scaffoldSkill.ts)
produces a `run.js` that uses the literal string `"clawperator"` when invoking
the CLI. Exemplar skills in `../clawperator-skills` instead import
`resolveClawperatorBin` from `skills/utils/common.js`, which honors
`CLAWPERATOR_BIN` and the sibling build. This means:

- The scaffold silently disagrees with every exemplar on a load-bearing
  helper.
- Skills drafted from scratch start one PR-review cycle behind skills drafted
  by copying an exemplar.

Pack 0 should fix the scaffold to match exemplar practice.

### Validator coverage gaps

[apps/node/src/domain/skills/validateSkill.ts](../../../apps/node/src/domain/skills/validateSkill.ts)
currently checks structural shape: registry entry, script presence, manifest
fields. It does **not** check:

- `clawperator-skill-type` frontmatter on `SKILL.md` (grep returns no
  matches).
- Declared `contract.verification` semantic alignment with the actual proof
  path.
- Generated index freshness against `skills-registry.json`.
- `SkillResult.source` omission in author-emitted frames.

Every one of these gaps maps to a recurring PR review comment. Pack 0 should
pick the low-risk subset to promote to mechanical checks.

### Resolved source conflicts

- The missing `../clawperator-skills/docs/*` files are a real gap in this
  checkout. `README.md` advertises local docs such as
  `docs/skill-development-workflow.md`, `docs/skill-authoring-guidelines.md`,
  and `docs/device-prep-and-runtime-tips.md`, but those files are absent. Pack
  0 must decide whether to restore, consolidate, or remove the README
  promises. This finding is foundational; do not start Pack B without it
  resolved.
- The packaged authoring-skills source path is **not** a root-level mismatch.
  [`copyAuthoringSkills.ts`](../../../apps/node/src/domain/skills/copyAuthoringSkills.ts)
  resolves to `apps/node/authoring-skills/`, and in this checkout that
  directory exists and contains a symlinked `skill-author-by-recording` entry.

## Current-state synthesis

### What already works well

- The recording-first authoring workflow is unusually concrete.
- The runtime contract is strict and well documented in `clawperator`.
- Replay and orchestrated are treated as equally legitimate maintained shapes.
- `recording export` is clearly treated as evidence, not as the runtime
  program.
- The retained compare baseline has a defined home:
  `skills/<id>/references/compare-baseline.export.json`.
- The current workflow requires a self-test and keeps the repair loop inside
  the authored skill instead of calling the job done after scaffolding.

### What fails closed today

- The host-agent discovery route is good at answering "what can I run now?"
  and weak at answering "what should I do when nothing exists yet?"
- In the anchor scenario, the runtime discovery path returns zero installed
  skills and offers no authored next step.
- There is no first-class discovery phase for unfamiliar app routes before
  recording.
- The raw scaffold path is materially weaker than the exemplar authoring
  workflow, and specifically diverges on `resolveClawperatorBin`.
- The validator does not mechanically enforce the conventions authors most
  often break.

## Track A: agent-drafted skill workflow

### Synthesis

The current front door,
[`skill-author-by-recording`](../../../.agents/skills/skill-author-by-recording/SKILL.md),
is the right **proving** workflow, not the full **discovery-to-authoring**
workflow.

That distinction matters:

- It is strong once a team knows a new skill should be authored now.
- It is weaker at helping an agent become ready to record in the first place.

For unfamiliar flows, the missing step is not "better scaffolding." It is a
discovery and routing phase (see Definitions) that helps the agent answer:

- does an existing runtime skill already solve this request?
- is the result likely personalized-local or shared-general?
- is the route understood well enough to record now?
- is replay or orchestrated the truthful first proving shape? (For cold-start
  agent-drafted skills with no recording yet, orchestrated may be the more
  honest first shape; see Tradeoffs.)

### High-signal gaps

- No first-class discovery phase before recording.
- No documented "zero results, now author" path in host-facing guidance.
- No packaged sibling authoring skill for discovery-first work.
- Raw scaffold output is not strong enough to serve as the agent's front
  door, and diverges from exemplar helper usage.
- Discovery itself has runtime cost: adb traffic, screenshots, possible
  account-side activity. No bounded budget is defined today.
- Risk of authoring-skill namespace collision. Any new Track A skill shares
  discovery surface with `$task-author` and the existing recording skill;
  naming, decision flow, and discovery order must be explicit.

### Compiled recommendation

Use a **hybrid model**.

- Keep recording-first as the default proving workflow.
- Add an explicit discovery-first phase for unfamiliar or cold-start requests.
- Keep the boundary clear: discovery decides whether and how to author; the
  proving workflow turns evidence into a real skill plus self-test.

The exact surface should stay open for Pack A:

- likely candidates are a sibling authoring skill,
- a discovery-oriented CLI probe,
- or a combination of both.

The key recommendation is the phase boundary, not the exact naming.

## Track B: skill creation guidance

### Synthesis

Guidance exists, but it is fragmented across surfaces that don't coordinate.

- `clawperator` contains the strongest contract and design guidance.
- `../clawperator-skills` is where contributors actually author and harden
  runtime skills.
- The skills repo currently lacks a strong local author checklist and, in
  this checkout, advertises missing docs in its README.

The split is not wrong by design. The skills repo cannot vendor the entire
contract surface from `clawperator`, and `clawperator` should not own shipped
skill folders. But authors today learn the quality bar from a mix of:

- main-repo contract docs,
- exemplar skills,
- PR review comments,
- and private or local findings such as
  `~/.clawperator/findings/skill-drafting/findings.md`.

That is workable for maintainers. It is not a clean authoring system, and
the recurring PR patterns are evidence of the friction.

### High-signal gaps

- Skills-repo README advertises missing local docs.
- `AGENTS.md` in `../clawperator-skills` is thinner than the current review
  burden demands: 5-step checklist plus privacy rules, with no coverage of
  the 13 PR-hardening lessons below.
- The validator does not replace author guidance. It proves structural
  shape, not truthfulness sub-claims (see Definitions).
- Some conventions remain unenforced, such as the `clawperator-skill-type`
  convention on `SKILL.md` frontmatter.
- `skill-migration.md` in `../clawperator-skills` is a mixed-status audit log
  whose role under the new guidance system is unclear. Pack B must decide:
  active, superseded, or dead.

### Compiled recommendation

Treat guidance as a **co-location problem**, not just a content problem.

- Keep runtime contracts and public docs canonical in `clawperator`.
- Move runtime-skill drafting guardrails closer to authors in
  `../clawperator-skills`, with a single-source pointer back to
  `clawperator` contract docs so the two do not drift.
- Repair or remove the broken README-promised docs.
- Promote repeated PR-hardening lessons into durable, repo-local guidance.

## Recurring failure patterns

Each pattern is tagged by which task pack owns it.

### 1. Verification drift [Pack B]

Skills declare verification stronger than what they actually prove. Most
visible when `contract.verification` claims `node_text_matches` but the real
proof path is screenshot-based, heuristic, or otherwise indirect. Fix belongs
in `clawperator-skills` guidance; could be promoted to a validator rule in
Pack 0 if feasible.

### 2. Generated index drift [Pack 0]

Registry changes made without regenerating `skills/generated/*`. The
generator script already makes this contract concrete, but authors still
miss it. Mechanical freshness check is a Pack 0 candidate.

### 3. Shared helper bypass [Pack B]

Authors duplicate logic that should come from shared helpers, especially
`resolveOperatorPackage` and parsing/decoding helpers. Pack B checklist;
scaffold fix in Pack 0 removes the largest source (starter `run.js`
disagreeing with exemplar).

### 4. Diagnostics that overstate reality [Pack B]

Review repeatedly catches success/failure messages that reference deleted
files, inherit stale runtime state across a failure boundary, or dump raw
stdout/stderr as `error.message`. Pack B rule.

### 5. Parser ambiguity and robustness [Pack B]

Argument parsing, HTML entity decoding, PNG header parsing, and price/numeric
parsers are a recurring source of fragile behavior and false confidence.
Concrete PR instances include `PRICE_PATTERN` truncating four-digit prices,
`decodeXmlEntities` missing `&#39;` and `&#x27;`, PNG decoder accepting zero
width/height, and `averageRgba` dividing by zero on empty regions. Pack B
rules plus exemplar fixes.

### 6. Privacy hygiene outside code [Pack B]

Real device ids, labels, and local paths leak into examples, validation
notes, and PR metadata. Code is eventually scrubbed; metadata often is not.
Pack B rule, tied to privacy-hygiene checklist.

## Risk register

Second-order risks the packs must address explicitly.

| Risk | Triggering scenario | Why it matters | Track |
| --- | --- | --- | --- |
| Gated-content auth | Netflix login state, session cookies, subscription gate | Agent may record or probe against a logged-out surface and produce a skill that silently fails for other users. Also: exported recordings may embed session tokens. | A |
| Account-side side effects | "Add to My List" mutates a real user account; rate-limited endpoints | Discovery probes and self-tests should not spray side effects across accounts. Replay on a shared-general skill that mutates state needs opt-in semantics. | A |
| Credential leakage in recordings | Exported recording frames contain entered text, pasted tokens | Recording export is evidence; it ships to reviewers. Privacy pass must precede any PR. | A + B |
| Authoring-skill namespace collision | Adding a discovery skill alongside `$task-author` and `skill-author-by-recording` | Agents pick the wrong front door; discovery order in `AGENTS.md` matters. | A |
| Contract drift between repos | `clawperator` evolves `SkillResult` contract; `clawperator-skills` guidance lags | Guidance becomes a lie; authors follow it and ship broken skills. | B |
| PR-review burden scaling with Track A success | Agent drafts five Netflix-like skills/week | Track A's success ceiling is bounded by Track B's checklist coverage. Both packs must absorb this coupling. | A + B |

## Tradeoffs and tensions

These are not resolved. Packs must call out which side of each they land on.

- **Truthfulness rules vs. time-to-first-skill.** Strict declared-verification
  rules push authors toward `verification: null` as the safe default. That
  preserves truthfulness but weakens the runtime guarantee operators rely on.
  Pack B must decide whether to raise the bar on declared verification, or
  accept `null` as normal and strengthen `SkillResult.status` truthfulness
  instead.
- **Co-location vs. contract drift.** Moving runtime-skill guidance into
  `../clawperator-skills` solves the context-switch problem but creates a
  drift surface when `clawperator` contracts evolve. Pack B must define
  ownership plumbing (single-source pointer, PR checklist cross-reference, or
  generated guidance) before committing to colocation.
- **Drafting speed vs. review burden.** Track A succeeding at fast drafting
  increases Track B's review load. These packs are coupled on throughput, not
  just on taxonomy.
- **Orchestrated vs. replay as the cold-start default.** Current guidance
  says replay-first. But for agent-drafted skills with no prior recording
  (the anchor scenario), orchestrated is arguably the more honest first
  shape: there is no deterministic script to replay. Pack A must decide
  whether to recommend orchestrated for cold-start authoring or require
  recording capture before any skill shape is chosen.
- **Discovery runtime cost.** A discovery phase extends live adb and
  screenshot contact with the target app before authoring begins. Battery,
  privacy artifacts, and account-side activity are all non-zero. Pack A
  should bound the discovery phase (max snapshots, max duration, no-mutation
  rule).
- **Extend vs. hybrid for the authoring-skill surface.** Extending
  `skill-author-by-recording` with discovery behavior keeps the agent's
  decision tree flat but lengthens the skill (currently 622 lines) and mixes
  two phases in one file. A sibling skill keeps each phase focused but
  requires the agent to route correctly between them. Pack A must pick and
  justify.

## Design options and verdict

| Option | Summary | Verdict | Reasoning |
| --- | --- | --- | --- |
| Recording-first only | Keep `skill-author-by-recording` as the only front door | Reject | Anchor scenario demonstrates the agent needs route knowledge before recording; recording-first assumes that knowledge. |
| Extend `skill-author-by-recording` | Add discovery behavior inside the existing skill | Defer | Workable, but mixes two phases in one 622-line skill and blurs the proving boundary. Pack A may still choose this if the discovery phase is narrow enough; Pack A owns the tradeoff. |
| Helper tooling only | Add docs or CLI probes, no new front-door skill | Reject | Does not solve host-agent routing. Agents on Telegram cannot discover CLI probes without a prompt-skill pointer. |
| Hybrid (sibling discovery skill plus recording skill) | Separate discovery and proving workflows; both packaged authoring skills | Prefer | Best fit for the phase boundary. Matches the anchor scenario's actual shape. Creates namespace-collision risk (see Risk register) that Pack A must manage. |

### Why hybrid wins

- It preserves the strongest part of the current system instead of replacing
  it.
- It matches the actual problem shape: unfamiliar flows need discovery
  before recording, but still need an evidence-first proving pass afterward.
- It allows cleaner ownership:
  - Pack A focuses on workflow routing and host-agent UX.
  - Pack B focuses on durable guidance and quality bar.

## Pack 0: shared prerequisite

### Scope

Mechanical and documentation fixes that unblock Pack A and Pack B. Each item
is narrow enough to land in one reviewable PR.

- Decide and execute on the broken `../clawperator-skills/README.md` doc
  list. Pick one of: (a) restore docs from history if they existed, (b)
  delete the README promises, (c) write placeholder docs that redirect to
  canonical sources, (d) consolidate into `AGENTS.md` or a single local
  index. **Each option is a different PR; pick one.**
- Fix [scaffoldSkill.ts](../../../apps/node/src/domain/skills/scaffoldSkill.ts)
  to emit `resolveClawperatorBin` usage in the generated `run.js`, matching
  exemplar practice.
- Add mechanical checks to
  [validateSkill.ts](../../../apps/node/src/domain/skills/validateSkill.ts):
  `clawperator-skill-type` frontmatter presence and value, and generated-index
  freshness against `skills-registry.json`.
- Migrate the high-value rules from
  `~/.clawperator/findings/skill-drafting/findings.md` into a durable
  repo-surface home. Default home: `../clawperator-skills/AGENTS.md`.
- Decide the role of `../clawperator-skills/skill-migration.md`. Active,
  superseded, or dead. Document the decision.

### Non-goals

- No new authoring skills.
- No changes to runtime contracts.
- No Pack A or Pack B content.
- No rewrites of `docs/skills/authoring.md`.

### Acceptance criteria

- Every link in `../clawperator-skills/README.md` resolves.
- `scaffoldSkill.ts` output, when run through `validateSkill`, passes
  without modification, and its `run.js` matches exemplar helper usage by
  grep.
- `validateSkill` rejects a skill with missing or invalid
  `clawperator-skill-type`.
- `validateSkill` (or a CI check) rejects a registry change that was not
  accompanied by a regenerated index.
- `../clawperator-skills/AGENTS.md` contains the migrated rules, with
  concrete negative examples for each.

### File touchpoints

- `../clawperator-skills/README.md`
- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/skill-migration.md` (decision documented)
- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/test/...` (regression coverage for the new validator rules)
- Possibly `../clawperator-skills/scripts/generate_skill_indexes.sh` or a
  new CI-side freshness check

### Rollback

Each item is a separate PR. Any one can be reverted without affecting the
others. The scaffold fix is the only item that affects existing users; revert
is a one-line change.

### Dependencies

- Blocks Pack A (scaffold fix, authoring-skill namespace clarity).
- Blocks Pack B (`AGENTS.md` migration is the foundation Pack B builds on).
- Has no upstream dependencies.

## Pack A: agent-assisted skill drafting

### Scope

- Design the discovery phase for unfamiliar skill requests, with a bounded
  runtime cost.
- Define the handoff from discovery into recording/proving.
- Define the host-agent route when runtime discovery returns zero matches,
  including the Telegram-to-local-shell hop.
- Decide authoring-skill surface: sibling packaged skill, CLI probe, or both.
- Handle install-distributed authoring-skill implications if a new skill is
  packaged.
- Decide orchestrated vs. replay default for cold-start agent-drafted skills.
- Resolve namespace and discovery-order issues with `$task-author` and
  `skill-author-by-recording`.

### Non-goals

- Not authoring the Netflix skill itself. Pack A produces the workflow that
  an agent uses to author it; the Netflix skill is a separate, post-Pack-A
  deliverable.
- Not building a general-purpose task planner. Discovery is bounded to
  Clawperator-adjacent surfaces (see Definitions).
- Not changing runtime contracts.
- Not rewriting `../clawperator-skills/AGENTS.md` (that's Pack B).

### Acceptance criteria

- An agent receiving the anchor scenario, starting from zero, can produce a
  discovery artifact without exceeding the defined discovery budget.
- The discovery artifact is well-defined enough to decide: author now,
  decline with reason, or escalate to human.
- `docs/host-agents.md` documents the zero-results route explicitly.
- If a new packaged authoring skill is added, it is discoverable in all three
  symlinked agent directories and listed in `~/.clawperator/AGENTS.md`.
- The first skill drafted end-to-end through Pack A's workflow passes
  `validateSkill` and the Pack B checklist on first PR submission (signals
  that A and B are coherent).

### File touchpoints

- `.agents/skills/skill-author-by-recording/SKILL.md` (boundary clarification
  with any new sibling skill)
- Possibly `apps/node/authoring-skills/<new-skill>/` (new packaged authoring
  skill)
- `apps/node/src/domain/skills/copyAuthoringSkills.ts` (install wiring, if
  adding a new authoring skill)
- `sites/landing/public/install.sh` (`write_agent_guide` content and symlink
  setup, if adding a new authoring skill)
- `docs/host-agents.md` (zero-results route documentation)
- `docs/skills/authoring.md` (discovery-to-proving handoff documentation)
- `~/.clawperator/AGENTS.md` template (via install.sh)

### Rollback

- Recording-first remains the documented default throughout. If discovery-first
  pilots badly (low pick-up, high false-discovery rate), disable the sibling
  skill in a subsequent release; `skill-author-by-recording` continues to work
  unchanged.
- Install-distributed authoring skill additions are managed by
  `copyAuthoringSkills`; removing a packaged skill is a supported operation.

### Dependencies

- Blocks on Pack 0 (scaffold fix, namespace clarity).
- Does not block Pack B (can run concurrently after Pack 0).
- Concurrent with Pack B. Coordination point: Track A's first end-to-end
  skill is the canonical test case for Track B's checklist.

## Pack B: skill creation guidance

### Scope

- Write the skills-repo author checklist locally, covering each recurring
  failure pattern above with a concrete negative example.
- Restore or consolidate the README-promised `../clawperator-skills/docs/*`
  content, per the Pack 0 decision.
- Codify the 13 PR-hardening lessons into repo-local rules.
- Define the single-source pointer back to `clawperator` contract docs so
  the two surfaces do not drift.
- Clarify ownership boundaries between main-repo docs and skills-repo
  guidance.
- Decide validator mandates: which rules become mechanical
  (`validateSkill` changes, in coordination with Pack 0) vs. checklist-only.

### Non-goals

- Not replacing `clawperator` contract docs.
- Not changing `SkillResult`, runtime wrapper semantics, or install behavior.
- Not imposing new validator rules without Pack 0 coordination. (Pack 0
  owns the mechanical checks; Pack B informs which ones are load-bearing.)
- Not authoring new skills.

### Acceptance criteria

- Every recurring failure pattern in this document has a durable, repo-local
  rule with a concrete negative example.
- `../clawperator-skills/README.md` resolves every advertised doc link (Pack
  0 decision applied here).
- `../clawperator-skills/AGENTS.md` contains the migrated rules from
  `~/.clawperator/findings/skill-drafting/findings.md` and the 13 PR-hardening
  lessons.
- Pack B defines how guidance syncs with `clawperator` contract evolution.
  Acceptable forms: single-source link, generated guidance, or PR-checklist
  cross-reference.
- Pack A's first end-to-end-drafted skill passes the Pack B checklist on
  first PR submission.

### File touchpoints

- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/README.md`
- `../clawperator-skills/docs/` (restored or consolidated per Pack 0)
- `../clawperator-skills/skills/*/SKILL.md` (exemplar updates, if
  checklist references need concrete in-repo examples)
- `docs/skills/authoring.md` (cross-link only; no rewrite)

### Rollback

- Checklist is additive; if a rule is wrong, revert that rule independently.
- No runtime contract changes mean rollback does not affect installed skills.

### Dependencies

- Blocks on Pack 0 (README decision, `AGENTS.md` migration foundation).
- Concurrent with Pack A after Pack 0 lands.
- Coordination point: Pack A's first end-to-end skill is the canonical test
  case for Pack B's checklist coverage.

## Open questions

Grouped by which pack they block.

### Blocks Pack 0

1. README decision: restore, delete, placeholder, or consolidate the missing
   `../clawperator-skills/docs/*` pages? Pick one before Pack B scopes its
   content home.
2. `skill-migration.md` role: active reference, superseded archive, or
   deletable? Pack 0 must document the decision.
3. Scope of the validator mandate: does `clawperator-skill-type` enforcement
   apply to existing skills on a migration window, or only to new skills?

### Blocks Pack A

4. Canonical host agent: commit to OpenClaw-on-Telegram as primary, or
   treat local-shell agents as co-equal first-class? Affects UX decisions in
   `docs/host-agents.md`.
5. Authoring-skill surface: sibling prompt-skill, CLI probe, or both? If
   both, which owns the entrypoint?
6. Discovery budget: max snapshots, max duration, no-mutation guarantee?
7. Cold-start default shape: orchestrated or replay for agent-drafted
   first skills?
8. Namespace and discovery order: how do `$task-author`,
   `skill-author-by-recording`, and any new Track A skill coexist in
   `~/.clawperator/AGENTS.md` without collision?

### Blocks Pack B

9. Verification policy: raise the bar on declared `contract.verification` or
   accept `verification: null` as normal and strengthen
   `SkillResult.status` truthfulness instead?
10. Guidance sync plumbing: single-source link, generated guidance, or
    PR-checklist cross-reference between `clawperator` contract docs and
    `../clawperator-skills` guidance?
11. Durable home: `AGENTS.md`, restored `docs/`, a contributor checklist,
    or a combination?

### Answerable during execution

12. Exact content of the negative examples per checklist rule (can be
    drafted during Pack B execution; no upstream blocker).
13. Whether the Pack A discovery artifact should be JSON, markdown, or
    YAML (authoring choice, not a design gate).
