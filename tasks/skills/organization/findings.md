# Skills Organization Findings

Date: 2026-04-22
Author: Claude (Opus 4.7)

## Scope

- repo-local internal skills under `.agents/skills/`
- the four packaged public skills:
  - `clawperator-agent-orientation`
  - `clawperator-upgrade`
  - `skill-author-by-agent-discovery`
  - `skill-author-by-recording`

Goals:

- decide whether those four skills should stay under `.agents/skills/`
- decide how to brand them on disk
- decide whether `agent-skills` is still the right umbrella name
- decide whether `skill-author-by-*` should be prefixed

## TL;DR

1. The four public skills do not belong under `.agents/skills/`, which should
   be repo-internal maintenance skills only.
2. `apps/node/agent-skills/` does not hold duplicate copies. It holds
   **symlinks** into `.agents/skills/`, flipped to hydrated copies only during
   `npm pack`. The cleanup is not deduplication - it is choosing where the
   real files live.
3. Both `skill-author-by-*` ids should be prefixed with `clawperator-`.
4. The frontmatter on all four should be tightened so these read unambiguously
   as first-party Clawperator artifacts.
5. **Decision: rename `agent-skills` to `bundled-skills` everywhere it
   surfaces** (CLI noun, on-disk package dir, install dir, doctor check id,
   docs). `agent-skills` violates three of the Node API design principles.
   Full reasoning in
   [Finding 4](#finding-4-agent-skills-is-the-wrong-external-name-rename-to-bundled-skills).
   A stronger option (fold under `clawperator skills`) was considered and
   deferred because the scope is too invasive for the current round.

Preferred end state for the on-disk layout:

- Real files live at `apps/node/bundled-skills/<skill>/` (no symlinks).
- `.agents/skills/` contains only repo-internal maintenance skills.
- `prepack`/`postpack` gymnastics in
  [apps/node/scripts/agentSkillsPack.mjs](../../../../apps/node/scripts/agentSkillsPack.mjs)
  become unnecessary and can be removed.

## Current State (verified, not assumed)

The four public skills exist under `.agents/skills/` as the source-of-truth
directories. `apps/node/agent-skills/` contains four **symlinks** pointing
back at those sources:

```
apps/node/agent-skills/clawperator-agent-orientation ->
  ../../../.agents/skills/clawperator-agent-orientation
apps/node/agent-skills/clawperator-upgrade ->
  ../../../.agents/skills/clawperator-upgrade
apps/node/agent-skills/skill-author-by-agent-discovery ->
  ../../../.agents/skills/skill-author-by-agent-discovery
apps/node/agent-skills/skill-author-by-recording ->
  ../../../.agents/skills/skill-author-by-recording
```

The packaging flow compensates:

- [apps/node/package.json:19-26](../../../../apps/node/package.json) includes
  `agent-skills/` in `files`
- [apps/node/scripts/agentSkillsPack.mjs](../../../../apps/node/scripts/agentSkillsPack.mjs)
  runs `prepack`/`postpack` to swap symlinks for hydrated directory copies
  during `npm pack`, then restore them after
- [apps/node/src/domain/skills/copyAgentSkills.ts:43](../../../../apps/node/src/domain/skills/copyAgentSkills.ts)
  reads from `../../../agent-skills` relative to the built dist - which works
  both for the published package (where the dir is a real copy) and for
  in-repo runs (where symlinks resolve to `.agents/skills/`)

This is clever, but it is the source of the confusion this review is
addressing. The symlink-and-swap keeps two narratives alive at once:

- "these are .agents/skills entries" (what you see when you browse the repo)
- "these are Node-package-owned public artifacts" (what actually ships)

Both stories can't both be primary. Pick one and retire the other.

The install contract itself is healthy and unambiguous:

- installer calls `clawperator agent-skills install`
  ([install.sh:563](../../../../sites/landing/public/install.sh))
- target dir on the user's machine is `~/.clawperator/agent-skills/`
- symlinks are fanned out into `~/.claude/skills/`, `~/.codex/skills/`, and
  `~/.agents/skills/`
- doctor validates the installed state under `host.agent-skills.staleness`

## Findings

### Finding 1: The source-of-truth location is the problem, not the count of files

The symlinks guarantee the byte content is identical in-repo, so drift
between the two trees is not the current risk. The risk is taxonomic: the
files *look* like they live in the repo-internal skills directory, which
implies "skills for developing this repo." They are not. They are skills
that ship to the user.

Any contributor opening the repo in an editor today will see the public
skills under `.agents/skills/` and reasonably assume they are internal dev
tooling, not shipped product. The cleanup is about correcting that signal.

### Finding 2: Move the source-of-truth to `apps/node/bundled-skills/` and delete the symlinks

`apps/node/` should own these as real directories, not as a packaging
staging area fed by symlinks. Reasons, ranked:

1. **Packaging already points there.** `copyAgentSkills.ts` already resolves
   from `apps/node/agent-skills/`. Making the files real there eliminates a
   conditional behavior ("in-repo vs published tarball") that is currently
   absorbed by the `prepack`/`postpack` script.
2. **Version coupling is explicit.** These skills ship with the CLI. Locating
   them inside the CLI package makes the coupling visible in the file tree.
3. **The `prepack`/`postpack` hack goes away.** Fewer moving parts in the
   release pipeline.
4. **`.agents/skills/` regains a clean meaning:** repo-internal maintenance
   workflows, nothing else.

A top-level `agent-skills/` at repo root was considered. It is defensible,
but it adds a third skill tree at the repo root alongside `.agents/skills/`
and the sibling `../clawperator-skills` repo. Three skill roots at the same
visual level will invite future confusion. `apps/node/bundled-skills/` has
the advantage of being unambiguously owned by one package.

**One concession to the top-level idea:** if these need to be highly visible,
add a short README at the repo root that points at
`apps/node/bundled-skills/` and explains the three skill categories. That
addresses the discoverability concern without adding a third directory.

### Finding 3: Prefix both `skill-author-by-*` ids with `clawperator-`

The asymmetry in the current set -

- `clawperator-agent-orientation`
- `clawperator-upgrade`
- `skill-author-by-agent-discovery`        <- unbranded
- `skill-author-by-recording`              <- unbranded

- is visible to any agent listing `~/.claude/skills/`. On a machine with
dozens of unrelated skills, two of Clawperator's four look like generic
"skill author" tooling that could have come from anywhere.

Proposed final ids:

- `clawperator-agent-orientation`        (no change)
- `clawperator-upgrade`                  (no change)
- `clawperator-skill-author-by-agent-discovery`
- `clawperator-skill-author-by-recording`

Do **not** shorten to `clawperator-skill-discovery` or `clawperator-record`.
The full phrase preserves the conceptual pairing ("author by X") and keeps
the ids self-documenting.

Note on migration: the skill ids are also referenced in docs and install-time
generated agent guides (see
[install.sh:1131](../../../../sites/landing/public/install.sh) and
[docs/skills/authoring.md:115](../../../../docs/skills/authoring.md)). These
need to be updated in lockstep.

### Finding 4: `agent-skills` is the wrong external name. Rename to `bundled-skills`.

Measured against
[docs/internal/design/node-api-design-guiding-principles.md](../../../../docs/internal/design/node-api-design-guiding-principles.md),
`agent-skills` fails three principles on the external CLI surface:

1. **Guessability (Principle 1).** An agent that read one sentence about
   Clawperator would never type `clawperator agent-skills`. It would type
   `clawperator skills install`, hit the *runtime* skills namespace, and be
   wrong on the first attempt. The docs already have to write
   "Agent-skills are separate from runtime skills"
   ([docs/host-agents.md:70](../../../../docs/host-agents.md)) - that
   disambiguation sentence *is* the smell Principle 1 warns about.
2. **Implementation leak (Principle 10).** "Agent-skills" names the
   *discovery mechanism* (the generic `~/.agents/skills/` fan-out directory),
   not the product identity. The name tells an agent how we deliver, not what
   the thing is. Principle 10 says external names should describe what the
   agent wants, not how Clawperator arranges itself internally.
3. **Familiar vocabulary (Principle 3).** Nothing in Playwright, adb, gh, or
   npm trains an agent to reach for "agent-skills." The term is meta
   ("skills for agents, used by an agent") in a way no other CLI the agent
   has seen uses.

The term also visually collides with the generic `~/.agents/skills/` path the
installer writes into. Product noun and filesystem convention are the same
word.

Candidate replacement terms, ranked:

| Term | For | Against |
|---|---|---|
| **bundled skills** | Plain-English; means "ships with the product"; distinct from runtime app skills; pairs with "bundled dependencies" mental model agents already have | Slightly generic on its own |
| first-party skills | Industry-standard | A bit jargon-y for docs |
| host-helper skills | Matches "host agent" vocabulary | Obscure; "helper" is soft |
| host skills | Short | Overloaded with "host agent" / "host OS" |
| operator skills | Evokes Clawperator | Collides with the operator APK concept |

**Decision: `bundled-skills`.** It says the thing, matches the
"bundled-dependencies" pattern agents already know from npm, and does not
fight any existing Clawperator vocabulary.

#### Alternative considered and deferred: fold under `clawperator skills`

The strongest move against the "two skill namespaces" problem is to unify:
one `clawperator skills` namespace, with a `--type bundled|runtime` dimension
where the distinction matters. An agent trying to install *anything*
skill-shaped would land on the right command first try. That is what
Principle 1 actually points at.

This option was surfaced in the EM verdict and explicitly deferred because:

- `clawperator skills install` today means "install the runtime-skill
  registry from the sibling repo." Folding in bundled changes that semantics
  and every consumer of it (install.sh, doctor, docs, tests).
- The conflation risk needs dedicated thinking - the two categories have
  different versioning, different sources of truth, and different failure
  modes. Mixing them under one namespace without a crisp output story
  produces a worse UX than two well-named namespaces.
- Scope: the current round is about getting the files, names, and
  frontmatter right. Command-surface unification is a separate project with
  its own migration and its own doctor-check renames.

**Position for a future round:** revisit `clawperator skills` unification
after `bundled-skills` has landed and stabilized. If it still looks right
then, do it as a deliberate breaking-release project with alias support.

#### What changes, and what stays

Rename everywhere the external surface uses the term:

- CLI noun: `clawperator agent-skills` -> `clawperator bundled-skills`
- package dir: `apps/node/agent-skills/` -> `apps/node/bundled-skills/`
- install dir: `~/.clawperator/agent-skills/` -> `~/.clawperator/bundled-skills/`
- doctor check id: `host.agent-skills.staleness` -> `host.bundled-skills.staleness`
- env var: `CLAWPERATOR_AGENT_SKILLS` -> `CLAWPERATOR_BUNDLED_SKILLS`
- docs vocabulary: "agent-skills" -> "bundled skills"

Backwards compatibility during the rename:

- accept `clawperator agent-skills` as a silent parser alias for at least one
  release (Principle 4: "Accept Synonyms")
- `CLAWPERATOR_AGENT_SKILLS` env var stays honored as a fallback
- the old doctor check id emits a one-time redirect message, not a hard
  break, for at least one release

Internal names are lower stakes and can trail: `copyAgentSkills.ts`,
`AGENT_SKILLS_INSTALL_DIR` in install.sh, test filenames, etc. Rename them
in the same PR if cheap, otherwise as follow-up. Do not, however, let new
code land that parrots `agent-skills` after this change.

### Finding 5: Frontmatter should declare first-party ownership

Currently the four skill frontmatters only set `name` and `description`. That
is fine for the Claude Code / Codex loaders, but it is not enough to make the
files self-describing when someone finds one of them on a user's machine.

Minimal ownership additions that do not require schema changes:

```yaml
---
name: clawperator-skill-author-by-recording
description: Clawperator first-party bundled skill. Create or update a Clawperator skill from a fresh phone recording. ...
---
```

The key is in the `description`: lead with **"Clawperator first-party
bundled skill"** (or "Clawperator bundled skill"). This is the text agent
loaders surface in skill listings, so it is where attribution pays off most.

Only add new frontmatter keys (`owner`, `surface`, `distribution`) if the
skill loader either consumes them or demonstrably tolerates them without
warnings. Do not introduce new keys speculatively.

Also fix the body: the first paragraph of each SKILL.md should open with a
sentence that names Clawperator explicitly. Three of the four already do -
`skill-author-by-agent-discovery` is the weakest on this front.

## Naming Decision Matrix

Pulling the naming questions into one view:

| Question | Current | Decision |
|---|---|---|
| Where do the 4 real files live? | `.agents/skills/` (symlinked into `apps/node/agent-skills/`) | `apps/node/bundled-skills/` only; remove symlinks |
| Skill ids | two have `clawperator-` prefix, two do not | all four prefixed with `clawperator-` |
| Product category label (in docs) | "agent-skills" | "bundled skills" |
| CLI noun | `clawperator agent-skills` | `clawperator bundled-skills` (accept `agent-skills` as silent alias for one release) |
| Install directory | `~/.clawperator/agent-skills/` | `~/.clawperator/bundled-skills/` |
| Doctor check id | `host.agent-skills.staleness` | `host.bundled-skills.staleness` |
| Env var | `CLAWPERATOR_AGENT_SKILLS` | `CLAWPERATOR_BUNDLED_SKILLS` (old name honored as fallback) |

Rationale for doing the CLI/install-dir rename in this round instead of
deferring it: a docs-only rename would leave the docs talking about
"bundled skills" while the CLI still prints "Agent-skills setup complete."
That mismatch is exactly the kind of implementation-detail leak Principle 10
warns against, and users would see two different names for one thing. Rename
the whole surface, with backwards-compat aliases.

## Suggested Migration Order

Phase 1 - physical relocation and de-symlinking:

1. `git mv` each of the four skill directories from `.agents/skills/` to
   `apps/node/bundled-skills/`. Use `git mv` so history follows.
2. Delete the symlinks that currently live in `apps/node/agent-skills/`, then
   remove the now-empty `apps/node/agent-skills/` directory.
3. Remove `apps/node/scripts/agentSkillsPack.mjs` and its `prepack`/`postpack`
   wiring from `apps/node/package.json`. Update the `files` array to list
   `bundled-skills/` instead of `agent-skills/`.
4. Update the source-dir resolution in
   [copyAgentSkills.ts](../../../../apps/node/src/domain/skills/copyAgentSkills.ts)
   to point at `../../../bundled-skills`.
5. Run `./validation/install/test_install.sh` and
   `npm --prefix apps/node test` to confirm the install flow and doctor
   checks still pass.

Phase 2 - skill id prefixes and frontmatter:

1. Rename directories:
   - `skill-author-by-agent-discovery` -> `clawperator-skill-author-by-agent-discovery`
   - `skill-author-by-recording` -> `clawperator-skill-author-by-recording`
2. Update the `name:` frontmatter field in each renamed SKILL.md.
3. Update every reference in the repo to the old two names:
   - `install.sh` (generated agent guide block near line 1131)
   - `docs/skills/authoring.md` (tables listing the four names)
   - `docs/host-agents.md` (routing language)
   - any internal design docs
   - validation harnesses under `validation/install/`
4. Update the four skill descriptions to open with
   "Clawperator first-party bundled skill."
5. Tighten the first paragraph of `skill-author-by-agent-discovery`'s body to
   name Clawperator explicitly.

Phase 3 - external surface rename `agent-skills` -> `bundled-skills`:

1. Rename the CLI command group. The new primary name is
   `clawperator bundled-skills`. Register `agent-skills` as a silent alias
   in the CLI parser (Principle 4).
2. Rename the install directory target:
   `~/.clawperator/agent-skills/` -> `~/.clawperator/bundled-skills/`.
   Keep a one-release transition that accepts the old path when it already
   exists, migrates it, and emits a one-line notice.
3. Rename the env var `CLAWPERATOR_AGENT_SKILLS` ->
   `CLAWPERATOR_BUNDLED_SKILLS`. Honor the old name as a silent fallback.
4. Rename the doctor check id
   `host.agent-skills.staleness` -> `host.bundled-skills.staleness`.
   Emit a one-time "renamed to" hint on the old id for at least one release.
5. Update CLI help text, JSON output field names (where agent-facing), and
   every docs page to use "bundled skills" as the category label.
6. Internal code rename (best-effort in the same PR):
   - `apps/node/src/domain/skills/copyAgentSkills.ts` file and exported
     symbols
   - `install.sh` variables (`AGENT_SKILLS_*` -> `BUNDLED_SKILLS_*`)
   - test file names under `apps/node/src/test/unit/`
7. Run the full validation suite:
   `./validation/install/test_install.sh`,
   `npm --prefix apps/node test`, doctor run on a clean host.

All three phases should land together or in tight succession. Splitting them
across releases creates a window where external names and internal state
disagree - which is worse than the current situation.

## Risks and Open Questions

1. **`.agent-skills-pack-state.json`.** If any release was interrupted
   mid-`npm pack`, a stale state file may exist. Check before deleting the
   pack script, or at least confirm no CI job relies on it.
2. **CLI registry help strings.**
   [apps/node/src/cli/registry.ts](../../../../apps/node/src/cli/registry.ts)
   references these skill names in help output. Check during Phase 2 and
   again during Phase 3.
3. **Install-time generated agent guide.** The text that install.sh writes
   into `~/.clawperator/agent-guide.md` names these four skills and their
   roles. Update in the same PR that renames them, otherwise users on
   the old and new names will both exist in the wild briefly.
4. **Sibling skills repo independence.** This migration does not touch
   `../clawperator-skills`. That repo stays as the runtime app skills home.
   Worth a one-line note in the bundled-skills docs reaffirming the split.
5. **Evals and validation scripts.** `evals/specs/android-version/prompt-skill.md`
   and `validation/install/README.md` both reference the agent-skills term.
   They should follow the same terminology as the docs.
6. **Alias lifetime.** `agent-skills` as a silent CLI alias should be kept
   through one release and then removed in a clearly-called-out breaking
   change. Accepting it forever re-creates the two-names problem we are
   fixing.
7. **External tooling pinning to the old install path.** If any downstream
   script or agent guide pins `~/.clawperator/agent-skills/` directly, it
   will need to move with the rename. The Phase 3 migration step that
   accepts the old path for one release should cover most cases, but worth
   scanning `clawperator-skills` and any private user configs before
   merging.

## Bottom Line

Today there are no duplicate files, only symlinks. Measured against the Node
API design principles, `agent-skills` fails guessability, leaks
implementation, and relies on unfamiliar vocabulary - so the name gets
replaced, not preserved.

Committed moves for this round:

1. Move real files to `apps/node/bundled-skills/`; retire the symlinks and
   the pack script.
2. Prefix the two unprefixed skill ids with `clawperator-`.
3. Rewrite the four descriptions to open with
   "Clawperator first-party bundled skill."
4. Rename the external surface from `agent-skills` to `bundled-skills`
   everywhere it shows up (CLI, install dir, env var, doctor check, docs),
   with `agent-skills` accepted as a silent alias for one release.

Deferred for a future, scoped round:

- Fold `bundled-skills` and the runtime `skills` namespaces into a single
  `clawperator skills` group with a type dimension. Revisit once the rename
  above has stabilized.
