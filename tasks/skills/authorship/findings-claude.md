# Clawperator Skill Authorship — Findings

Prepared: 2026-04-19
Scope: findings pass only. No implementation, no task packs, no new skills.
Anchor scenario: an OpenClaw-style host receives a Telegram request to "make a
Clawperator skill that opens Netflix, searches for House of Cards, and adds it
to My List." The host has a coding agent but may not have live device access
in-session.

---

## 1. Executive Summary

Clawperator has one front door for creating a runtime skill:
`skill-author-by-recording`, an install-distributed authoring skill that
requires a human to record a real device flow. The runtime, contracts,
registry, scaffold, validator, and recording/compare pipeline behind it are
well-grounded in code. The authoring *workflow* and the durable *quality bar*
around it are not.

Two distinct tracks are tangled in today's state:

1. **Agent-drafted skill workflow (Track A)**. The product assumes a developer
   at a workstation with a phone. The OpenClaw/Telegram anchor case — where the
   host receives a natural-language request, has no skill for the app, and
   cannot record a flow in-band — has no intended route. An agent drafting from
   that request today would either force a recording-first detour, fabricate a
   skill without evidence, or stop at discovery with no next step.

2. **Skill creation guidance (Track B)**. The durable drafting rules that came
   out of real PR hardening (PR 27 and PR 29 in `clawperator-skills`, plus the
   local findings file at `~/.clawperator/findings/skill-drafting/findings.md`)
   are scattered across five surfaces and are not enforced. The skills repo
   README links to five guidance docs that do not exist. The validator does
   not check the skill-category convention, and a skill with
   `clawperator-skill-type: script` shipped despite review pointing out the
   type is unrecognised.

Recommendation: split the follow-up into two task packs, one per track, with a
small shared dependency (a validator/index-drift fix and a docs-link repair)
that lands first. Keep recording-first as the default authoring shape. Add an
explicit sibling path for agent-driven discovery. Do not collapse the two into
one skill — the inputs, the ownership, and the trust boundary differ.

---

## 2. Scope and Method

**In scope.** Grounded walk-through of the current authorship story across
runtime, authoring, host-agent, and repo surfaces. Evaluation of the anchor
scenario against existing code. Extraction of reusable lessons from PR review
history. Recommendation on whether to split or bundle follow-up work.

**Out of scope.** Implementation diffs. Authoring new runtime skills. Writing
`plan.md` or `work-breakdown.md`. Running `$task-author`.

**Method.**

1. Read all required sources listed in `tasks/skills/authorship/prompt.md`
   directly, verifying claims against code rather than memory.
2. Inspect `apps/node/src/contracts/{skills,skillResult}.ts`,
   `apps/node/src/domain/skills/{runSkill,validateSkill,scaffoldSkill,copyAuthoringSkills}.ts`,
   and the install-flow functions in `sites/landing/public/install.sh`.
3. Walk one replay example
   (`com.google.android.apps.chromecast.app.get-climate-replay`) and one
   orchestrated example
   (`com.google.android.apps.chromecast.app.control-hvac-orchestrated`) to
   ground the two shapes.
4. Fetch review comments on `clawperator-skills` PR 27 and PR 29 via `gh api
   repos/clawperator/clawperator-skills/pulls/<N>/comments` and extract reusable
   authoring lessons (not a PR summary).
5. Separate current-state facts from recommendations throughout.
6. Keep repo boundaries explicit: `clawperator` (runtime, validator, contracts,
   public docs, packaged authoring skills); `clawperator-skills` (runtime
   skills, generated indexes, shared helpers, AGENTS rules); install-distributed
   authoring skills landing at `~/.clawperator/authoring-skills/` plus shared
   agent-discovery dirs.

---

## 3. Verified Source Map

Direct-from-code anchors. File paths are relative to the current
`clawperator` repo root unless otherwise noted.

| Area | File | What it verifies |
| --- | --- | --- |
| Registry entry shape | [apps/node/src/contracts/skills.ts](apps/node/src/contracts/skills.ts) | `SkillEntry`, `SkillAgentConfig`, `SkillContract`, `node_text_matches` matcher with `{placeholder}` render |
| Emitted frame shape | [apps/node/src/contracts/skillResult.ts](apps/node/src/contracts/skillResult.ts) | `SKILL_RESULT_FRAME_PREFIX = "[Clawperator-Skill-Result]"`, `SKILL_RESULT_CONTRACT_VERSION = "1.0.0"`, `source` must NOT be emitted by the skill |
| Runtime parsing and trusted verification | [apps/node/src/domain/skills/runSkill.ts](apps/node/src/domain/skills/runSkill.ts) | trusted arg resolution, trusted-input matcher render, declared-contract verification outcome, timeout `120000`, orchestrated env injection |
| Validator scope | [apps/node/src/domain/skills/validateSkill.ts](apps/node/src/domain/skills/validateSkill.ts) | registry parity minus `agent`, contract input schemas, orchestrated harness presence, dry-run payload validity — **no `clawperator-skill-type` check** |
| Scaffold output | [apps/node/src/domain/skills/scaffoldSkill.ts](apps/node/src/domain/skills/scaffoldSkill.ts) | `run.js` uses literal `"clawperator"` binary, optional `--recording-context` copies export as `recording-context.json`, default `contract` is empty-inputs/null-goal/null-verification |
| Registry resolution | [apps/node/src/adapters/skills-repo/localSkillsRegistry.ts](apps/node/src/adapters/skills-repo/localSkillsRegistry.ts) | explicit path > `CLAWPERATOR_SKILLS_REGISTRY` > cwd `skills/skills-registry.json` > `~/.clawperator/skills/skills/skills-registry.json` |
| Authoring-skills install and bundling | [apps/node/src/domain/skills/copyAuthoringSkills.ts](apps/node/src/domain/skills/copyAuthoringSkills.ts), [apps/node/src/cli/commands/authoringSkills.ts](apps/node/src/cli/commands/authoringSkills.ts) | target `~/.clawperator/authoring-skills/`, managed symlinks into `~/.claude/skills/`, `~/.codex/skills/`, `~/.agents/skills/` |
| Install-time host wiring | [sites/landing/public/install.sh:544](sites/landing/public/install.sh), [sites/landing/public/install.sh:1067](sites/landing/public/install.sh), [sites/landing/public/install.sh:1146](sites/landing/public/install.sh) | runs `clawperator authoring-skills install`, writes `~/.clawperator/AGENTS.md`, appends a `CLAWPERATOR_SHARED_AGENT_BRIDGE` block to `~/.agents/AGENTS.md` |
| Packaged authoring skills today | `apps/node/authoring-skills/` | only one skill is distributed today: `skill-author-by-recording` |
| Recording lifecycle and compare | [docs/api/recording.md](docs/api/recording.md) | start → stop → pull → export → compare; export is canonical authoring evidence |
| Runtime env contract for orchestrated | [docs/api/environment.md](docs/api/environment.md), runSkill.ts env injection | `CLAWPERATOR_SKILL_PROGRAM`, `CLAWPERATOR_SKILL_INPUTS`, `CLAWPERATOR_SKILL_AGENT_CLI`, `CLAWPERATOR_SKILL_AGENT_CLI_PATH`, `CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS`, `CLAWPERATOR_SKILL_ID`, `CLAWPERATOR_DEVICE_ID` |
| Host-agent route | [docs/host-agents.md](docs/host-agents.md) | discovery order: `skills for-app` → `skills search` → `skills get` → `skills run`; MCP is not the first discovery surface |
| Replay example | `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/` | `run.js` is 352 lines of deterministic logic; `contract.verification` is `null`; uses shared `resolveClawperatorBin`/`resolveOperatorPackage` from `utils/common.js` |
| Orchestrated example | `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/` | `run.js` is a 1096-line harness; `SKILL.md` is the runtime agent program; `skill.json.agent.cli = "codex"`, `timeoutMs = 300000`; `contract.verification.kind = "node_text_matches"` with matcher `{value}` |
| Skills-repo rules | `../clawperator-skills/AGENTS.md` | thin: purpose, brain/hand model, skill categories, 5-step validation checklist, privacy rules |
| Index generator | `../clawperator-skills/scripts/generate_skill_indexes.sh` | writes `skills/skills-registry.json`, `skills/generated/manifest.json`, `skills-index.{min.json,jsonl}`, `by-app/*.json`, `by-prefix/*.json` |
| Authoring workflow today | [.agents/skills/skill-author-by-recording/SKILL.md](.agents/skills/skill-author-by-recording/SKILL.md) | 622-line workflow: record → evidence → scaffold → author → one self-test → own repair loop |
| Existing PR-hardening lessons | `~/.clawperator/findings/skill-drafting/findings.md` | the eight failure patterns this pass must treat as evidence, not anecdote |

**Broken docs surface** (called out because the prompt requires it). The
skills-repo `README.md` advertises five supporting docs:
`docs/usage-model.md`, `docs/skill-development-workflow.md`,
`docs/skill-authoring-guidelines.md`, `docs/device-prep-and-runtime-tips.md`,
`docs/blocked-terms-policy.md`. **None exist.** The `../clawperator-skills/docs/`
directory itself does not exist. `AGENTS.md` in the same repo also references
`docs/blocked-terms-policy.md`. The required-reading list in the prompt
included four of these; they are unavailable and must not be treated as
source of truth.

---

## 4. Current-State Map

### 4.1 What exists end-to-end

1. **Discovery** (host agent side). `clawperator skills for-app <pkg> --json` /
   `skills search --keyword <text> --json` / `skills get <id> --json` /
   `skills list --json`. Install writes `~/.clawperator/AGENTS.md` with a Quick
   Start block plus a generated "Authoring Skills" block pointing at the
   installed authoring skills dir. `~/.agents/AGENTS.md` gets an
   installer-owned bridge block that names the runtime discovery commands.

2. **Runtime execution**. `clawperator skills run <id> --device <serial>
   --operator-package <pkg> [--timeout <ms>] -- <forwarded args>`. The wrapper
   prepends device serial as `argv[2]` when `--device` is set, forwards any
   trailing args after `--`, injects env vars for orchestrated skills, parses
   the terminal `[Clawperator-Skill-Result]` frame (must be the last non-empty
   line pair, `source` must not be present), validates contractVersion, and
   verifies declared `node_text_matches` against trusted invocation inputs.

3. **Scaffold**. `clawperator skills new <skill.id> --recording-context <export>`
   creates `SKILL.md`, `skill.json`, `scripts/run.js`, `scripts/run.sh` and
   copies the export to `recording-context.json`. The generated `run.js` uses
   the literal string `"clawperator"` as the binary.

4. **Validate**. `clawperator skills validate <id> [--dry-run]` checks file
   existence, registry parity of `skill.json` (excluding `agent`), contract
   input schemas, orchestrated harness presence, and dry-run artifact payloads.
   It does *not* run the skill, *not* check `clawperator-skill-type`, and *not*
   check that generated indexes are in sync.

5. **Authoring entry**. `skill-author-by-recording` is the one packaged
   authoring skill today. It is recording-first, requires a plain-language
   goal, derives `skill_id` after the export, defaults to `-replay` unless the
   user explicitly asks for orchestrated or evidence shows replay would be
   untruthful, and will not call the pass done until one self-test has been
   run and the `SkillResult` inspected. It owns the repair loop.

6. **Compare**. `clawperator recording compare --baseline <baseline.export.json>
   --result <skills-run.json>` supports `literal_match`, `semantic_match`,
   `outcome_matches_path_differs`, `baseline_drift`, etc. The retained
   sanitized baseline is stored at
   `skills/<id>/references/compare-baseline.export.json` and is NOT listed in
   `skill.json.artifacts`.

### 4.2 Repo-boundary ownership

- **`clawperator`**: contracts, runtime wrapper, validator, CLI, public docs,
  landing install.sh, packaged authoring skills (`apps/node/authoring-skills/`
  with only `skill-author-by-recording`), and the `docs-build`/`docs-author`
  repo-local skills.
- **`../clawperator-skills`**: runtime skills, shared helpers (`utils/common.js`
  with `resolveClawperatorBin`/`resolveOperatorPackage`), generated registry
  and indexes, thin `AGENTS.md`, broken README doc links, blocked-terms hook.
- **`~/.clawperator/authoring-skills/`** + `~/.claude/skills/`,
  `~/.codex/skills/`, `~/.agents/skills/`: install targets for authoring
  skills, managed as symlinks back to the installed copy.
- **`~/.clawperator/findings/skill-drafting/findings.md`**: user-local, not
  in any repo. Contains the most concrete drafting lessons currently written
  down. Explicitly recommends moving its content into
  `clawperator-skills/AGENTS.md`.

### 4.3 What an OpenClaw/Telegram host sees today

1. Host receives: "Make a Clawperator skill that opens Netflix, searches for
   House of Cards, and adds it to My List."
2. Host reads `~/.clawperator/AGENTS.md` and/or `~/.agents/AGENTS.md`. Both
   point at `clawperator skills for-app <pkg>` / `skills search --keyword`.
3. `skills search --keyword netflix --json` returns an empty list (no Netflix
   skill is installed today).
4. `skills for-app com.netflix.mediaclient --json` also returns empty.
5. The `AGENTS.md` files do not say what to do next. The public host-agent
   docs (`docs/host-agents.md`) assume discovery succeeds.
6. If the host pivots to the authoring side, it finds
   `skill-author-by-recording` listed under `~/.claude/skills/`,
   `~/.codex/skills/`, or `~/.agents/skills/`. That skill's non-negotiable
   rules require a plain-language goal plus a **human performing the flow on
   device** during a live `recording start`/`recording stop` pair.
7. A Telegram user does not have a recording session in a chat. The host
   either defers the request ("please run this command on a device with
   Netflix installed..."), fabricates a skill without evidence (would
   violate the workflow's truthfulness rules), or stops.

The scenario is not broken by bugs. It is out of the assumed product shape.

---

## 5. Track A Findings — Agent-drafted skill workflow

### 5.1 How an agent would go from user request to first working draft today

Today's flow assumes a workstation with a device. The agent is expected to be
an IDE agent (Codex/Claude Code) co-located with the dev environment. The flow
is: user states goal → close target apps → `recording start` → **human
performs the flow** → `recording stop`/`pull`/`export` →
`skills new --recording-context <export>` → author replay or orchestrated →
`skills validate` → one `skills run` self-test → inspect `SkillResult` → own
repair loop until verified. See
[.agents/skills/skill-author-by-recording/SKILL.md](.agents/skills/skill-author-by-recording/SKILL.md)
for the full rules.

### 5.2 What works well for agents

- **One entrypoint.** `skill-author-by-recording` is easy to invoke and the
  decision table (replay-first unless orchestrated is requested or clearly
  more truthful) is explicit.
- **Strong contracts to author against.** `SkillResult` is versioned and
  validated; `skill.json.contract.{inputs,goal,verification}` gives a clear
  place to declare machine-checkable behaviour; the runtime refuses to parse
  a frame that includes `source`, forcing authors to emit only what they know.
- **Mandatory self-test.** The workflow refuses to call the pass done without
  one run of the authored skill and a `SkillResult` inspection. That pressure
  keeps draft skills from shipping un-run.
- **Repair loop ownership.** The authoring skill explicitly tells the agent to
  stay focused on the created skill during self-test failures and to use the
  orchestrated debug bundle (`agent-stderr.log`, `agent-stdout.log`,
  `prompt.txt`, `run-metadata.json`) in priority order.
- **Artifact contract.** The retained sanitized baseline lives at
  `skills/<id>/references/compare-baseline.export.json` and is deliberately
  kept out of `skill.json.artifacts`; `compare` can consume the saved
  `skills run --json` wrapper as the `--result` input.

### 5.3 What is too hard to discover, too underspecified, or too brittle

- **No route when discovery returns empty.** `docs/host-agents.md` lists
  `skills for-app`/`skills search`/`skills get`/`skills run` but stops there.
  When the search is empty, the host has no structured next step back to
  authoring. The `CLAWPERATOR_SHARED_AGENT_BRIDGE` block written into
  `~/.agents/AGENTS.md` also stops at runtime discovery
  (see [sites/landing/public/install.sh:1181](sites/landing/public/install.sh)).
- **No explore-first authoring path.** `skill-author-by-recording` requires a
  recording. There is no sibling "agent-discovery" skill and no CLI verb to
  produce agent-captured route evidence in lieu of a human recording.
- **The scaffold hardcodes `"clawperator"`.** `scaffoldSkill.ts` writes
  `run.js` that invokes the literal binary `"clawperator"` regardless of
  `CLAWPERATOR_BIN`. The shared helper `resolveClawperatorBin` in
  `../clawperator-skills/skills/utils/common.js` — which the runtime docs in
  `docs/skills/runtime.md` describe as the preferred resolution — is not used
  by scaffolded skills. Authors must remember to replace this themselves.
- **Authoring-skill discovery vs runtime-skill discovery are siblings, not
  bridged.** A host knows how to list runtime skills but not that authoring
  skills exist at `~/.clawperator/authoring-skills/` (unless it reads the
  "Authoring Skills" block in `~/.clawperator/AGENTS.md` that the installer
  writes conditionally).
- **Scaffold default for `contract.verification` is `null`.** That is
  intentional and aligned with the PR-hardening lesson from the findings
  file, but the docs do not flag loudly enough that declaring a non-null
  verification is a trust claim the runtime will enforce. PR 27 shipped with
  `node_text_matches` declared on a screenshot-verified skill (see §8).
- **`SKILL.md` frontmatter `clawperator-skill-type` is a naming convention
  only.** `validateSkill.ts` does not check it. The AirTouch set-zone-state
  skill still ships with `clawperator-skill-type: script` despite `replay`
  and `orchestrated` being the only canonical values.

### 5.4 Current role of `skill-author-by-recording` — and where it stops

It owns: the recording session, the retained baseline, the replay-vs-orchestrated
recommendation, scaffolding, one self-test, the repair loop, and surfacing
artefacts.

It does not own:
- **Probing**. There is no agent-discovery phase before recording. The skill
  assumes the user already knows the flow end-to-end.
- **Remote-agent scenarios**. It cannot be driven by an OpenClaw host over a
  chat surface with no co-located device session.
- **Cross-skill coordination**. It explicitly says "do not wander into
  unrelated skills in the repo" during repair. Cold-start authoring without
  a recording is outside that scope by design.

### 5.5 What an agent would struggle with

- **Turning a NL request into a skill id with no recording.** Deriving
  `applicationId` and intent requires either an export (the app package is
  observed in the recording) or an exec-probe phase. The anchor case has
  neither.
- **Producing trustworthy verification without recording evidence.** The
  scaffold defaults `verification` to `null`; the workflow discourages
  inventing a matcher; but an agent without a recording has no baseline to
  fall back on.
- **Choosing replay vs orchestrated cold.** The decision table is driven by
  recording evidence. Without evidence, the only defensible choice is
  orchestrated — the NL-request shape almost forces it — but the default
  decision table still starts at replay-first.
- **Maintaining `SKILL.md`/`skill.json`/`scripts`/emitted `SkillResult`
  alignment.** PR review repeatedly catches this (§8). The runtime enforces
  it hard at verification time; the validator enforces part of it statically;
  the authoring rules assume a recording and a human who can reconcile.

### 5.6 Recording-first as the front door — still right?

Mostly. Recording-first produces the most truthful first draft for the
dev-workstation scenario, which is still the dominant authoring path. The
problem is not that recording-first exists. The problem is that it is the
*only* documented entrypoint. Adding an explicit sibling — not replacing the
front door — is the right move.

### 5.7 Truthfulness, testing, UX risks of explore-first

- **Truthfulness.** Without a recording, terminal verification has no trusted
  baseline. The authoring skill would have to (a) require an exec-probe trace
  the runtime accepts as evidence, (b) mandate that the first draft is an
  orchestrated skill where the runtime agent can verify against fresh-session
  state reads, or (c) accept that the draft is personalized/local-only until
  a real recording is added.
- **Testing.** The same mandatory-self-test rule from the recording workflow
  should apply. If the draft cannot complete one `skills run` self-test that
  emits a truthful `SkillResult`, the pass is not done. This avoids the
  category of PR failures where `skills validate` passes but the skill never
  actually ran end-to-end.
- **UX.** The Telegram-style host needs a clear "you are getting a provisional
  local-only skill; run it once on a device before trusting it" message. A
  host that silently promotes a cold-authored skill to shared inventory will
  ship bad skills fast.

---

## 6. Track B Findings — Skill creation guidance

### 6.1 Are current docs and repo guidance sufficient?

No. The public `clawperator` docs cover runtime and authoring contracts well
(`docs/skills/overview.md`, `authoring.md`, `development.md`, `runtime.md`,
`api/recording.md`, `api/environment.md`). They answer "what shape must a
skill be?". They do not answer "what has gone wrong in past authoring that
you must not repeat?"

The `clawperator-skills` repo is the natural home for drafting guardrails.
Today it is thin: `AGENTS.md` lists a 5-step validation checklist, a
brain/hand rationale, skill-category names, and privacy rules. It points to
five docs under `docs/` that do not exist.

### 6.2 What guidance is missing or not discoverable enough

From PR review and the local findings file, the durable rules the repo does
not currently carry are:

- `contract.verification: null` is the default; declare a non-null matcher
  only when the runtime can actually prove it through the declared matcher
  path. Screenshot-verified skills must leave it null.
- Generated indexes under `skills/generated/*` plus `skills-registry.json`
  must be regenerated in the same change as any skill add, rename, or
  metadata update. `scripts/generate_skill_indexes.sh` is the authoritative
  tool.
- Use shared helpers from `skills/utils/common.js` (`resolveOperatorPackage`,
  `resolveClawperatorBin`) rather than reimplementing env/default precedence.
- Diagnostics must be true at emit time: do not reference paths already
  deleted, do not let stale success state leak into failure diagnostics.
- Named flags win over positional fallback parsing. Positional fallbacks must
  skip tokens that belong to another option.
- Distinguish runtime-execution failure from post-action verification failure
  in `SkillResult.diagnostics` rather than collapsing both to `unknown`.
- Privacy scrubbing applies to code **and** PR body **and** retained
  artifacts **and** commit messages.
- `clawperator-skill-type` values must be `replay` or `orchestrated` only.
- Image/parser code (PNG decoders, price regexes, entity decoders) needs
  explicit bounds and entity-coverage — PR 27 and PR 29 each landed this
  class of bug.
- Helper duplication across scripts (e.g. `decodeXmlEntities`,
  `normalizeWhitespace` reimplemented per skill) should live in
  `skills/utils/`.

### 6.3 Where the durable guidance should live

Primary home: `../clawperator-skills/AGENTS.md`. Reasons:

- The failures are skills-repo-shaped (metadata, indexes, shared helpers,
  diagnostics, privacy hygiene), not runtime-shaped.
- The findings file explicitly names this as its target home.
- `AGENTS.md` is the file agents read when they `cd` into the skills repo.

Secondary homes:

- A repaired or newly-authored `../clawperator-skills/docs/skill-authoring-guidelines.md`
  (the README promises it today).
- `docs/skills/authoring.md` in the main repo should link back to the
  skills-repo AGENTS.md as the "runtime skill drafting guardrails" entry.
- The validator should enforce the small number of mechanical rules that can
  be mechanised (`clawperator-skill-type` whitelist; optional: generated-index
  freshness check at validate-all time).

### 6.4 What best practices should be mandatory for authors

- One static validation pass (`skills validate <id> --dry-run --json`) plus
  one live `skills run` self-test for side-effecting skills with a runnable
  path.
- Terminal verification text must come from a fresh-session reread when the
  app state can change based on ordering; do not trust the in-place controller
  after an action.
- For orchestrated skills, `SKILL.md` is the runtime agent program;
  `scripts/run.js` is a thin harness; app-specific navigation and verification
  policy stay in `SKILL.md`.
- Keep `skill.json.contract.inputs`, `SKILL.md` examples, forwarded wrapper
  args, and emitted `SkillResult.inputs` named-input-aligned.
- Never import contracts or helpers through absolute local filesystem paths
  in runtime skill scripts (`scaffoldSkill.ts` callers must override the
  scaffold default `"clawperator"`).

---

## 7. Shared Issues and Dependencies

1. **Install and bundling implications.** Today's `copyAuthoringSkills.ts`
   installs every packaged authoring skill into `~/.clawperator/authoring-skills/`
   and symlinks each into `~/.claude/skills/`, `~/.codex/skills/`, and
   `~/.agents/skills/`. Any new authoring skill (e.g. a sibling
   `skill-author-by-agent-discovery`) would be picked up automatically by that
   flow. `install.sh` would conditionally append it to the "Authoring Skills"
   block in `~/.clawperator/AGENTS.md`. No install-shape change is required.
2. **Host-agent discovery after install.** The `~/.agents/AGENTS.md` bridge
   block written by the installer names runtime discovery commands only. If
   authoring becomes a first-class host concern (Track A scenario), that
   block needs a second-half entry ("when no runtime skill matches, start
   here"). Today it does not.
3. **Runtime skill discovery vs prompt-skill discovery.** The two must stay
   separate. Runtime skills = `clawperator skills <subcommand>`. Prompt/
   authoring skills = shared agent-discovery dirs. `docs/internal/design/agent-host-integration.md`
   already insists on this separation; any new authoring workflow must not
   blur it.
4. **Validation expectations vs self-test expectations.** `skills validate`
   is static. It does not and should not run the skill. The authoring
   workflow's "one self-test" rule is what turns a valid skill into a
   believed-working skill. New authoring surfaces inherit that rule; they
   must not claim success on validate alone.
5. **Repo-boundary ownership.** Contracts, validator, and public docs stay in
   `clawperator`. Runtime skills and drafting guardrails stay in
   `clawperator-skills`. Packaged authoring skills stay in
   `apps/node/authoring-skills/` and install out via `copyAuthoringSkills`.
   Any new work that straddles (e.g., validator enforcement of skill-type
   convention used by skills repo) needs coordinated PRs — the
   `CLAUDE.md` `Skills` section already requires lockstep updates when
   contracts change.

---

## 8. Recurrent Lessons from PR History and Existing Findings

Extracted from `gh api repos/clawperator/clawperator-skills/pulls/27/comments`,
`gh api repos/clawperator/clawperator-skills/pulls/29/comments`, and
`~/.clawperator/findings/skill-drafting/findings.md`. These are reusable
authoring lessons, not a PR summary.

1. **Contract drift between declared and actual verification.** PR 27 shipped
   `contract.verification.kind = "node_text_matches"` with matcher `{state}`
   on a skill that verifies via screenshot classification. Reviewer flagged
   it both in `skill.json` and `skills-registry.json`. **Rule:** declare
   `node_text_matches` only when terminal verification can actually be
   proved by the runtime's declared matcher render; otherwise `null`. The
   findings file names this as pattern #1.

2. **Generated-index drift.** Both PR 27 and PR 29 shipped a new registry
   entry without regenerating `skills/generated/manifest.json`,
   `skills-index.min.json`, `skills-index.jsonl`, or the affected `by-app/`
   and `by-prefix/` shards. **Rule:** any skill add/rename/metadata change
   must rerun `scripts/generate_skill_indexes.sh` and commit the result in
   the same change. The findings file names this as pattern #2.

3. **Shared helper bypass.** PR 27 hardcoded
   `process.env.CLAWPERATOR_OPERATOR_PACKAGE || "com.clawperator.operator"`
   instead of using `resolveOperatorPackage()` from `utils/common.js`.
   **Rule:** reuse shared helpers for operator-package and clawperator-binary
   resolution unless there is a specific reason not to. Deviations must be
   justified in the commit message.

4. **Diagnostics truthfulness gaps.** PR 27 had two failure modes:
   diagnostics advertised `runDir` paths that had been deleted (or would be
   deleted) by cleanup; failure diagnostics inherited `runtimeState:
   "healthy"` from the success path. **Rule:** diagnostics must reflect
   state-at-emit-time; cleanup failures must not convert a successful
   outcome into a failed one; success-path state must not leak into
   failure diagnostics. The findings file names this as pattern #4.

5. **Parser ambiguity in positional fallbacks.** PR 27's `parseRequestedState`
   treated any positional `on`/`off` token as the desired state even if it
   was another flag's value. **Rule:** explicit named flags first; positional
   fallback parses only after named resolution and must skip tokens that
   belong to a named flag. The runtime itself applies the same rule in
   `runSkill.ts`'s `resolvePositionalFallbackArgs`.

6. **Verification state semantics.** PR 27 collapsed screenshot-verification
   mismatch into a generic failure; reviewer wanted the distinction between
   "device work succeeded, verification mismatched" and "device work failed"
   preserved. **Rule:** `SkillResult.diagnostics.runtimeState` should stay
   truthful in both branches; do not re-inject `runtimeState: healthy` into
   a failed result.

7. **Privacy hygiene extends to PR metadata.** PR 27 included a real zone
   label, a device id, and a local path in the PR body. The code was
   scrubbed; the metadata was not. **Rule:** apply the same scrub to PR
   body, commit messages, comments, and retained artifacts. The findings
   file names this as pattern #8.

8. **Image/parser correctness.** PR 27: PNG decoder accepted `width=0/
   height=0`; `averageRgba` divided by `count=0`. PR 29: `PRICE_PATTERN`
   truncated 4+ digit prices without comma separators; `decodeXmlEntities`
   missed `&#39;` and `&#x27;`. **Rule:** decoders and parsers in runtime
   skill scripts must validate inputs explicitly; shared helpers should own
   entity coverage. The findings file names this as pattern #6.

9. **Skill-category typing is a convention, not a type system.** PR 27
   shipped `clawperator-skill-type: script`; reviewer pointed out this is
   not a recognised value (only `replay` and `orchestrated` are). The skill
   merged anyway; the value is still `script` today. **Rule (product gap,
   not just authoring):** validator should refuse unknown category values
   or at minimum warn.

10. **Helper duplication across skills.** PR 29's `decodeXmlEntities` and
    `normalizeWhitespace` were reimplemented in both `amazon_parser.js` and
    `search_amazon_products.js` with the same semantics. **Rule:** extract
    shared parser helpers into `skills/utils/` and import. Avoids the
    divergence-on-edit failure mode.

11. **Dead code and unused imports.** PR 27 imported `resolveClawperatorBin`
    but never used it. PR 29 declared `MAX_RESULTS` unused and had a `submit`
    parameter never set true. **Rule:** strip unused imports/branches before
    PR; they confuse reviewers about which resolution path is live.

12. **Usage docs vs script usage must agree.** PR 29's `SKILL.md` showed
    `[query]` as optional but the script required it. **Rule:** treat
    `SKILL.md`, `skill.json.contract.inputs`, script arg-parsing, and
    emitted `SkillResult.inputs` as one surface. The authoring skill
    already names this as a non-negotiable, but it is not enforced.

13. **Cleanup semantics.** PR 27 cleaned up temp dirs only on success;
    failure paths leaked `clawperator-airtouch-zone-*` dirs. **Rule:** make
    cleanup best-effort and run it in a `finally` (or explicitly in both
    branches); cleanup failures must not convert success to failure.

The eight patterns from the findings file and the thirteen lessons above
overlap heavily. The findings file is the better starting point because it
is already organised for reuse.

---

## 9. Design Options and Tradeoffs

### Option 1 — Recording-first only; status quo
**Keep** `skill-author-by-recording` as the only authoring front door.
- Pros: one mental model; no new install-shape work; avoids mode confusion.
- Cons: the OpenClaw/Telegram anchor case stays unsupported; an agent with no
  live device cannot draft a skill; no path for bootstrap when no skill exists
  for the target app.

### Option 2 — Extend `skill-author-by-recording` with an agent-discovery branch
Add rules and sub-workflow inside the existing skill for "no recording
available; agent probes first."
- Pros: single-name discoverability; shared repair loop; no duplication of
  scaffold/validate/self-test rules.
- Cons: the skill is already ~620 lines and highly prescriptive; the decision
  tree widens; the ownership boundary ("this skill owns authoring from a
  recording" — see §5.4) stops being honest; test surface grows.

### Option 3 — Sibling `skill-author-by-agent-discovery`
Add a second packaged authoring skill with the same validation/self-test
discipline but different evidence inputs (exec traces, snapshots, live
probing) and a different NL-request-to-skill-id flow.
- Pros: clean ownership split; aligns with the two runtime-skill shapes
  (`-replay`, `-orchestrated`); each skill stays small enough to audit;
  `copyAuthoringSkills` picks it up without install-shape changes.
- Cons: two authoring skills to discover; the decision rule between them
  must be explicit and written into the AGENTS bridge block; extra
  maintenance surface.

### Option 4 — Helper tooling without a new authoring skill
Add CLI verbs: `clawperator skills probe <applicationId>` to produce a
structured route-evidence artefact; `clawperator skills new --no-recording
--goal <text> --application-id <pkg>` to scaffold without an export.
- Pros: leverages CLI discoverability; keeps authoring skills surface small;
  scales to future skill shapes without new skills.
- Cons: lacks the rails a prompt-skill provides; agents need explicit
  instructions on safe use; the truthfulness/repair-loop discipline must be
  re-authored somewhere else.

### Option 5 — Hybrid (recommended)
Keep `skill-author-by-recording` as the default. Add a sibling
`skill-author-by-agent-discovery` (Option 3) AND expose one new CLI verb
(Option 4) that agent-discovery uses to produce trusted route evidence.
Route from `AGENTS.md` based on context: on-workstation-with-device →
recording-first; host-without-device or no-recording-possible →
agent-discovery.
- Pros: covers both the workstation and the Telegram paths; keeps each
  authoring skill narrowly scoped; adds one surgical CLI verb rather than
  bolting exploration onto the existing skill.
- Cons: more moving pieces; decision rule must be correct; host-agent
  documentation needs a second lane.

---

## 10. Recommended Direction

Adopt **Option 5 (hybrid)** with the following shape.

**Track A — Agent-drafted skill workflow.**

1. Package a sibling `skill-author-by-agent-discovery` authoring skill.
   Evidence source: exec-probe traces, snapshots, and (optionally) a retained
   agent-transcript. Scope: default to `-orchestrated` authoring because the
   NL-request-cold shape effectively requires live-state verification;
   recommend `-replay` only when probing has produced a deterministic enough
   route. Reuses the same scaffold → validate → one self-test → repair loop
   from the recording workflow.
2. Add one CLI verb for safe probing: e.g. `clawperator skills probe
   --application-id <pkg> --goal <text> --device <serial>` that emits a
   structured route-evidence JSON compatible with `skills new
   --recording-context <file>` (or add a second `--probe-context` flag).
   Rationale: reuse the existing scaffold entrypoint; don't fork it.
3. Update `docs/host-agents.md` and the `CLAWPERATOR_SHARED_AGENT_BRIDGE`
   block in `~/.agents/AGENTS.md` to name the authoring route when
   discovery returns empty, and to distinguish on-workstation-with-device
   from remote-agent-without-device cases.
4. Keep `skill-author-by-recording` as-is in its current decision table,
   but add a one-paragraph "if you do not have device access in-session,
   see sibling skill" pointer at the top.

**Track B — Skill creation guidance.**

1. Migrate the content of `~/.clawperator/findings/skill-drafting/findings.md`
   into `../clawperator-skills/AGENTS.md` as mandatory drafting guardrails
   (the findings file itself recommends this).
2. Either create the five guidance docs the skills-repo README advertises
   (`usage-model`, `skill-development-workflow`, `skill-authoring-guidelines`,
   `device-prep-and-runtime-tips`, `blocked-terms-policy`) OR remove the
   promises. Prefer creating at least `skill-authoring-guidelines.md` so the
   reader has a landing page; consolidate the rest into AGENTS.md.
3. Add a mechanical enforcement layer for the rules that can be enforced:
   - `validateSkill.ts` refuses `clawperator-skill-type` values outside
     `{replay, orchestrated}` (warn for now, error after one release).
   - `skills validate-all` or a new `--check-generated-indexes` flag recomputes
     generated index hashes and fails when stale (the generator already writes
     `sha256` manifests, so the check is cheap).
4. Cross-link `docs/skills/authoring.md` → skills-repo `AGENTS.md` → back.

**Shared prerequisite.** Fix the two documentation breakages called out in
§3: the skills-repo README doc-list and the `clawperator-skill-type` gap.
These are small, should land first, and unblock the two tracks.

---

## 11. Recommended Split for Future Task Packs

Split into **two task packs plus one small shared prerequisite**.

**Pack P0 — Shared prerequisites (small, lands first).**
- Repair or remove skills-repo README promises for `docs/*.md`.
- Move `~/.clawperator/findings/skill-drafting/findings.md` content into
  `../clawperator-skills/AGENTS.md`.
- Add `clawperator-skill-type` whitelist in `validateSkill.ts`.
- Optional: generated-index freshness check in `skills validate-all`.
- Owners: `clawperator` and `../clawperator-skills`.

**Pack A — Agent-drafted skill workflow (Track A).**
- Package `skill-author-by-agent-discovery` authoring skill in
  `apps/node/authoring-skills/`.
- Add `clawperator skills probe` (or an equivalent `skills new` flag) and
  wire it as trusted route evidence for the new authoring skill.
- Update `docs/host-agents.md` and the install-time bridge block with the
  "when discovery returns empty" lane.
- Self-test coverage on at least one anchor app (Netflix is a reasonable
  choice given the anchor scenario).
- Owners: `clawperator` main repo (runtime, CLI, public docs, packaged
  authoring skill); install-distributed authoring skills surface.

**Pack B — Skill creation guidance (Track B).**
- Bulk out `../clawperator-skills/AGENTS.md` with the PR-hardening lessons
  from §8 (not summaries — reusable rules).
- Author `../clawperator-skills/docs/skill-authoring-guidelines.md` as the
  canonical landing page the README promises.
- Cross-link from `docs/skills/authoring.md`.
- Consider (soft) enforcement: lint rule for shared-helper reuse, regex
  coverage for entity decoders, positional-parse safety.
- Owners: `../clawperator-skills` primarily; `clawperator` only for the
  cross-link update.

**Why split rather than bundle.** The two packs have different owners, land
on different repos, and move at different cadences. Track A touches runtime
contracts and install surfaces; Track B is documentation and linting.
Bundling them into one pack would invite scope creep and would slow down
whichever track the reviewer is less comfortable with. Shared prerequisites
are small enough to live in P0 without tangling the two.

---

## 12. Open Questions

These are the questions a tech lead or EM should answer before scheduling.

1. **Priority of the Telegram/OpenClaw anchor.** Is agent-drafted cold
   authoring (Track A) a near-term product need, or is it a medium-term
   enabler? If the latter, P0 + Track B first; Track A later.
2. **Who authors `skill-author-by-agent-discovery`?** The skill itself is
   substantial (another ~500-line SKILL.md plus harness). Is there appetite
   for a sibling skill, or should Track A ship behind a hidden CLI verb and
   one doc page?
3. **Should the runtime validator enforce `clawperator-skill-type`?** A
   whitelist is trivial to add; the cost is a one-time migration of older
   skills that still use unsuffixed ids or wrong frontmatter. Is that
   acceptable?
4. **Should `skill.json` gain a first-class `sourceKind` field?**
   (`recording-derived` | `agent-discovered` | `assisted-from-nearby-patterns`.)
   This would let `SkillResult.source` reflect authoring provenance and
   would make the Track A sibling more honest about its evidence class.
5. **What should the "discovery returned empty" route look like in
   `~/.agents/AGENTS.md`?** The bridge block is installer-owned and
   overwritten each install. Decide once and encode it.
6. **Does `clawperator skills probe` belong as a top-level CLI verb, or
   should it be a `skills new` sub-behaviour?** The top-level verb is more
   discoverable; a sub-behaviour keeps surface area small.
7. **Scaffold binary fix.** Should `scaffoldSkill.ts` stop writing the
   literal `"clawperator"` into `run.js` and instead use
   `resolveClawperatorBin` from `skills/utils/common.js` (or inline the
   equivalent logic)? This is a one-line fix with durable payoff.
8. **Truthfulness floor for agent-discovered drafts.** Should cold-authored
   skills be explicitly marked `personalized-local` until a human records a
   run, or should one successful self-test be sufficient to consider them
   shared?
9. **Sibling-skill truthfulness sharing.** If both `-replay` and
   `-orchestrated` exist for an app, should the agent-discovery workflow be
   allowed to consult the replay sibling as "assisted from nearby patterns",
   matching the disclosure the recording workflow already uses?
10. **Skills-repo docs stale-or-missing status.** The five README-promised
    docs have been missing long enough that other surfaces reference them.
    Is the resolution to create them (slow), delete the promises (fast), or
    redirect them into `AGENTS.md` (compromise)?
