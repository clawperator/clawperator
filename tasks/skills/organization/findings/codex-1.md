# Skills Organization Findings

Date: 2026-04-22
Author: Codex

## Scope

Review the current state of:

- repo-local internal skills under `.agents/skills/`
- packaged public host-facing skills currently exposed through `clawperator agent-skills`
- the four shipped helper skills:
  - `clawperator-agent-orientation`
  - `clawperator-upgrade`
  - `skill-author-by-agent-discovery`
  - `skill-author-by-recording`

The goal of this pass was to answer:

- whether these four public skills belong in `.agents/skills`
- where they should live instead
- whether `agent-skills` is still the right name
- whether the two `skill-author-by-*` names should be renamed and re-frontmattered to associate them more explicitly with Clawperator

## Executive Summary

The repo already contains the right architectural direction, but it is only half-finished.

The packaged public skills do not truly live in `.agents/skills` anymore. The install and packaging flow for `clawperator agent-skills` already copies from `apps/node/agent-skills`, not from `.agents/skills`:

- source resolution points at `apps/node/agent-skills` in `apps/node/src/domain/skills/copyAgentSkills.ts:42`
- the install target is `~/.clawperator/agent-skills/` in `apps/node/src/domain/skills/skillsConfig.ts:8`
- the installer calls `clawperator agent-skills install` and treats those skills as a packaged first-party surface in `sites/landing/public/install.sh:563`

So the main problem is no longer "these public skills need to move out of `.agents/skills`." The deeper problem is:

1. the repo currently has duplicate copies of the same four public skills in both `.agents/skills/` and `apps/node/agent-skills/`
2. the naming of the public surface is still muddy
3. the two authoring helper names are under-branded relative to the other two
4. the docs currently mix three different concepts:
   - runtime app skills from `clawperator-skills`
   - packaged public host-helper skills shipped with Clawperator
   - repo-internal maintenance skills for developing this repo

My recommendation is:

1. make `apps/node/agent-skills/` the only source of truth for the four packaged public skills
2. remove their duplicate copies from `.agents/skills/`
3. rename `skill-author-by-agent-discovery` to `clawperator-skill-author-by-agent-discovery`
4. rename `skill-author-by-recording` to `clawperator-skill-author-by-recording`
5. update frontmatter for all four packaged skills to explicitly mark them as first-party Clawperator host-helper skills
6. replace the umbrella term `agent-skills` in docs with a clearer product term, while keeping CLI compatibility unless you intentionally want a breaking rename

## Current State

### 1. There are currently three distinct skill categories

The code and docs already imply three different categories, but the repo structure does not make them obvious enough.

Category A: runtime app skills

- live in the sibling `clawperator-skills` repo
- are registry-driven through `clawperator skills ...`
- are documented as a separate surface from packaged host helpers in `docs/skills/overview.md:34`

Category B: packaged first-party host-helper skills

- install into `~/.clawperator/agent-skills/`
- are symlinked into `~/.claude/skills/`, `~/.codex/skills/`, and `~/.agents/skills/`
- are managed by `clawperator agent-skills install|update|list`
- are explicitly described as packaged first-party skills in `docs/skills/authoring.md:101`

Category C: repo-internal maintenance skills

- live in `.agents/skills/`
- support docs, release, eval, task, and repo workflows
- are not part of the public product surface

This conceptual split is healthy. The problem is that the filesystem layout still blurs Category B and Category C.

### 2. The packaged public skills already have a dedicated package path

This is the most important factual finding.

The shipped `clawperator agent-skills` flow is already wired to `apps/node/agent-skills`, not `.agents/skills`:

- packaged source resolution: `apps/node/src/domain/skills/copyAgentSkills.ts:42`
- install copy loop: `apps/node/src/domain/skills/copyAgentSkills.ts:336`
- CLI help presents them as packaged first-party skills: `apps/node/src/cli/registry.ts:267`
- doctor validates the installed set as a packaged first-party surface: `apps/node/src/domain/doctor/checks/hostChecks.ts:630`

That means `apps/node/agent-skills/` is already the correct home if the goal is "these are tied to the public Clawperator install and versioned with the app."

### 3. The repo still carries duplicate copies under `.agents/skills`

The same four skills also exist in:

- `.agents/skills/clawperator-agent-orientation/`
- `.agents/skills/clawperator-upgrade/`
- `.agents/skills/skill-author-by-agent-discovery/`
- `.agents/skills/skill-author-by-recording/`

Their `SKILL.md` contents match the packaged copies sampled under `apps/node/agent-skills/`.

This duplication creates avoidable risk:

- edits can land in the wrong tree
- one copy can drift from the packaged copy
- agents exploring `.agents/skills` may incorrectly treat shipped public skills as repo-internal maintenance skills
- the current layout weakens the distinction the docs are trying to teach

### 4. The product already treats these as a first-party install surface

This is not just a docs convention.

The install script:

- runs `clawperator agent-skills install`
- records the installed directory
- writes onboarding guidance that explicitly names these four skills

Evidence:

- install hook: `sites/landing/public/install.sh:563`
- generated local guidance includes the four packaged skills and their roles: `sites/landing/public/install.sh:1131`

So your instinct is right that these need a "real dedicated path" tied to Clawperator. That path already exists in practice: `apps/node/agent-skills/`.

## Findings

### Finding 1: These four public skills should not continue to be treated as `.agents/skills` residents

I agree with the core concern.

If a skill is:

- shipped by the Node package
- installed by `install.sh`
- version-checked by doctor
- presented as part of the public host-agent onboarding story

then it should not live primarily in the repo's internal maintenance skill tree.

`.agents/skills/` should be reserved for repository-local development workflows. That aligns with the current AGENTS guidance and makes the repo easier to reason about.

### Finding 2: Moving them to a new repo-root `agent-skills/` directory is plausible, but `apps/node/agent-skills/` is a better fit

You mentioned possibly moving them to `agent-skills/` at repo root.

That would be cleaner than `.agents/skills/`, but I would still prefer `apps/node/agent-skills/` for these reasons:

1. it reflects ownership by the Node package and install surface
2. it already matches the package copy logic
3. it makes the coupling to CLI version, doctor checks, install behavior, and public onboarding explicit
4. it avoids introducing a third source root during cleanup

Unless there is a strong packaging or authoring reason to move them again, I would not add a new repo-root `agent-skills/` directory now. I would standardize on the path the product already uses.

### Finding 3: The current term `agent-skills` is accurate but overloaded

The term is not wrong, but it now has two problems:

1. it is generic enough that users may confuse it with any agent-discovered skill directory
2. it does not clearly distinguish "Clawperator host-helper skills" from "runtime app skills"

Today the docs have to repeatedly explain:

- runtime skills live under `clawperator skills`
- agent-skills are separate host-agent helpers

That repetition is a signal that the name is doing only partial work.

### Finding 4: The two `skill-author-by-*` names are inconsistent with the rest of the first-party public set

`clawperator-agent-orientation` and `clawperator-upgrade` are clearly first-party.

`skill-author-by-agent-discovery` and `skill-author-by-recording` are not.

On a machine with many installed skills, those two names:

- are hard to attribute at a glance
- look like generic local skills rather than Clawperator-owned helpers
- are more likely to collide conceptually with unrelated skills from other systems

I agree with the proposed prefixing direction.

### Finding 5: The current frontmatter is under-specified for public packaged ownership

The current frontmatter in these files only declares:

- `name`
- `description`

Examples:

- `apps/node/agent-skills/clawperator-agent-orientation/SKILL.md:1`
- `apps/node/agent-skills/skill-author-by-recording/SKILL.md:1`

That is enough for a basic skill file, but not enough for a public packaged Clawperator surface that you want users and host agents to identify confidently.

Even if no parser consumes richer metadata yet, the frontmatter should still declare ownership more explicitly.

## Recommendations

### Recommendation 1: Establish one source of truth

Keep these four public packaged skills in:

- `apps/node/agent-skills/`

Then remove their duplicate copies from:

- `.agents/skills/`

After that, update any repo docs that still imply the public packaged copies live under `.agents/skills/`.

Practical rule:

- `apps/node/agent-skills/` = public first-party packaged host-helper skills
- `.agents/skills/` = repo-internal maintenance skills only

### Recommendation 2: Rename the public surface in docs first, CLI second

I would separate terminology from command compatibility.

Short term:

- keep the CLI noun `agent-skills` for compatibility
- stop using it as the primary human-facing category label in docs

Preferred docs/product label:

- `host-helper skills`

Why this label works:

- it distinguishes them from runtime app skills
- it explains their job without implying they are generic skills from any system
- it fits the current docs language around "host agents" and "host-agent helpers"

Other viable labels:

- `host-agent skills`
- `packaged host skills`
- `Clawperator host skills`

I would avoid:

- `authoring skills`
  - too narrow, because orientation and upgrade are not authoring
- `agent-skills`
  - too implementation-shaped and too generic
- `system skills`
  - too broad and likely to collide with host/runtime conventions elsewhere

My recommendation:

- docs/product term: `Clawperator host-helper skills`
- CLI compatibility noun for now: `agent-skills`

If you later want a CLI rename, add an alias first rather than hard-breaking.

### Recommendation 3: Prefix all four public packaged skill ids with `clawperator-`

I agree with the prefixing goal.

Proposed set:

- `clawperator-agent-orientation`
- `clawperator-upgrade`
- `clawperator-skill-author-by-agent-discovery`
- `clawperator-skill-author-by-recording`

Why keep `skill-author` in the last two ids:

- preserves continuity with the current conceptual workflow
- keeps the authoring relationship legible
- avoids inventing new metaphors during the same migration

I would not shorten them to something like `clawperator-discovery` and `clawperator-recording` because that loses meaning and will make docs less self-explanatory.

### Recommendation 4: Tighten frontmatter for explicit Clawperator association

At minimum, update all four packaged skills so their frontmatter and first paragraph visibly reinforce:

- first-party Clawperator ownership
- packaged/public status
- role as host-helper skills rather than runtime app skills

Suggested frontmatter additions, assuming the current skill loader tolerates extra keys:

```yaml
---
name: clawperator-skill-author-by-recording
description: ...
owner: Clawperator
surface: host-helper-skill
distribution: packaged-first-party
product: clawperator
---
```

If you prefer to avoid introducing new metadata keys before formalizing a schema, then at least:

- keep `name` prefixed with `clawperator-`
- rewrite `description` so it starts with `Clawperator first-party ...`
- add a short opening sentence in the body that says it is a packaged Clawperator host-helper skill

### Recommendation 5: Clean up the docs taxonomy explicitly

The docs should define the three categories in one place and then reuse that vocabulary everywhere:

1. runtime skills
   - app/task skills from `clawperator-skills`
   - discovered via `clawperator skills ...`
2. host-helper skills
   - first-party packaged helpers installed with Clawperator
   - managed via `clawperator agent-skills ...` until or unless the CLI noun is renamed
3. internal repo skills
   - `.agents/skills/`
   - repo maintenance only

Right now the docs explain this implicitly, but not with one stable taxonomy.

## Suggested Naming Decision

If you want one recommendation rather than several options, this is mine:

- keep runtime app skills as `skills`
- rename the docs-facing concept `agent-skills` to `host-helper skills`
- keep the command `clawperator agent-skills` for now as a compatibility command group
- move all packaged source-of-truth content to `apps/node/agent-skills/`
- rename the two unprefixed skill ids to:
  - `clawperator-skill-author-by-agent-discovery`
  - `clawperator-skill-author-by-recording`

This gives you:

- a clean repo structure
- a clean conceptual split
- stronger first-party attribution on disk
- lower collision risk in shared skill directories
- no need to do a risky command-surface rename in the same change

## Migration Shape

I would do this in two phases.

### Phase 1: Source-of-truth and branding cleanup

1. Treat `apps/node/agent-skills/` as canonical.
2. Delete the four duplicate copies from `.agents/skills/`.
3. Rename the two unprefixed packaged skill directories and `name:` fields.
4. Update installer text, doctor expectations, CLI help text, validation harnesses, and tests.
5. Update public docs to use the chosen taxonomy.

### Phase 2: Optional CLI noun cleanup

If you still dislike `agent-skills` after the structural cleanup:

1. introduce a new alias command group such as `clawperator host-skills`
2. keep `clawperator agent-skills` as a supported alias
3. shift docs toward the new noun
4. remove the old noun only in a deliberate breaking-release window, if ever

## Bottom Line

Your core instinct is correct, but the repo is closer to the target state than it first appears.

These four public skills already have a dedicated Clawperator-owned home in `apps/node/agent-skills/`. The cleanup now is to finish the separation:

- stop duplicating them under `.agents/skills/`
- brand all four as unmistakably Clawperator-owned
- adopt clearer docs terminology than the overloaded phrase `agent-skills`

If you want the smallest high-value next step, it is this:

1. declare `apps/node/agent-skills/` canonical
2. remove the four duplicate `.agents/skills/` copies
3. rename the two `skill-author-by-*` ids to `clawperator-skill-author-by-*`
4. update docs to describe these as `Clawperator host-helper skills`
