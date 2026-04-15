# Task: Authoring Skills Install And Discovery

Created: 2026-04-16

## Problem

Clawperator now has a first-party authoring skill in the main repo:

- `.agents/skills/skill-author-by-recording/`

The public docs already position this skill as the preferred front door for
recording-driven skill authoring, but the product install flow does not give it
any installation, discovery, or lifecycle story.

Today `install.sh` and `clawperator skills install` handle runtime skills only:

- runtime skills are cloned from `clawperator-skills`
- runtime skills are installed under `~/.clawperator/skills/`
- runtime skill discovery is driven by `CLAWPERATOR_SKILLS_REGISTRY`

That flow does not help Claude Code, Codex, or any other agent discover
first-party authoring skills.

## Critical Distinction

There are two different categories of skills and they must remain separate:

1. Runtime skills
   - live in `clawperator-skills`
   - are executed by Clawperator through the Node runtime
   - are registry-backed and install to `~/.clawperator/skills/`
   - have `skill.json`, `scripts/run.js`, `applicationId`, and `intent`

2. Authoring skills
   - live in the main `clawperator` repo under `.agents/skills/`
   - are agent programs (SKILL.md = agent system prompt) consumed by Claude
     Code, Codex, or similar AI agent runtimes
   - have no `skill.json`, no `scripts/run.js`, no `applicationId`
   - are not runtime registry entries and must not be folded into
     `skills-registry.json`

Any solution that tries to merge authoring skills into the runtime skills
registry crosses the wrong product boundary.

## Current Gap

Installing Clawperator does not currently make `skill-author-by-recording`
usable in a normal agent session.

A developer who ran `curl install.sh | bash`, opened a Claude Code or Codex
session in a different directory, and wants to use `skill-author-by-recording`
has no supported path. The skill only works today when the AI agent session is
running from inside the clawperator repo, where `.agents/skills/` is present.

If an authoring skill is only copied into a Clawperator-owned folder such as:

- `~/.clawperator/authoring-skills/`

that still does not make the skill discoverable unless the target agent
actually scans or is pointed at that folder.

This is the key product issue:

- storage is not discovery
- canonical location is not enough
- if Claude Code or Codex are not aware of the install location, the skill is
  effectively invisible

We cannot expect users to manually write prompts like:

```text
Use [$skill-author-by-recording](</Users/<local_user>/.clawperator/authoring-skills/skill-author-by-recording/SKILL.md>) to draft a new clawperator skill.
```

That is too path-aware, too brittle, and not a credible end-user story.

## Product Requirement

The desired UX is:

- install Clawperator
- open the supported agent
- first-party Clawperator authoring skills are already discoverable and usable

Not:

- install Clawperator
- separately install authoring skills
- manually locate a filesystem path
- manually inject that path into prompts

The product should make authoring skills available as part of "install
Clawperator", not as a separate mental model the user has to discover later.

## Explicit Success Criteria

The intended end state for this work is:

- a user runs `curl -fsSL https://clawperator.com/install.sh | bash`
- the install flow sets up runtime skills as it does today
- the install flow also installs first-party authoring skills from the main
  Clawperator repo
- the install flow wires those authoring skills into supported agent discovery
  locations
- when the user next opens Claude Code or Codex, supported first-party
  Clawperator authoring skills are already available without any separate manual
  install step

In other words:

- "install Clawperator" must be sufficient
- there should be no separate "install authoring skills" step for the user
- there should be no requirement to manually paste authoring-skill filesystem
  paths into prompts

### Agent-install ordering

A user may install Clawperator before they have installed Claude Code or Codex.
`install.sh` must handle this by unconditionally creating the agent discovery
directories (`~/.claude/skills/`, and the Codex equivalent) and placing the
symlinks regardless of whether the agent is currently installed. When the user
later installs Claude Code or Codex, those agents find the directories already
populated and the skills are immediately available.

`clawperator authoring-skills update` must also re-run wiring for the same
reason: a user who installs an agent after Clawperator can rerun it once to
confirm everything is in place without re-running the full install script.

## Constraints

- Authoring skills must remain separate from runtime skills.
- The canonical source of first-party authoring skills must remain the main
  `clawperator` repo, not `clawperator-skills`.
- The solution must not assume there will only ever be one authoring skill.
- The solution must treat Claude Code and Codex as equal first-class targets
  today; both already consume these skills (SKILL.md is Claude Code-readable,
  `agents/openai.yaml` is Codex-readable).
- Some current SKILL.md files reference repo-local paths; global installation
  requires those references to be replaced with published docs URLs or another
  portable source before any global install story is complete.

## Recommendation

Use a two-layer model:

1. Canonical install location:
   - bundle authoring skill files (SKILL.md, `agents/openai.yaml`, etc.) inside
     the npm package under `authoring-skills/`
   - during install, copy those files out of the installed npm package to
     `~/.clawperator/authoring-skills/` and write a `version.txt` recording the
     CLI version they came from
   - copies, not symlinks, are used at this layer to avoid fragility from nvm
     version switches (which change the npm global prefix path)

2. Agent discovery wiring:
   - during `install.sh`, symlink each skill from
     `~/.clawperator/authoring-skills/<skill>/` into agent-native discovery
     locations
   - for Claude Code: symlink into `~/.claude/skills/`
   - for Codex: symlink into the correct Codex skill discovery path; verify
     the actual path before implementing (the `agents/openai.yaml` convention
     is known, but the Codex-side directory path needs confirmation)
   - if another agent later has a supported skill-discovery location, wire that
     too using the same canonical source

Symlinks are used at the agent-wiring layer so that `clawperator
authoring-skills update` only needs to refresh the files in
`~/.clawperator/authoring-skills/`; the agent-side symlinks stay valid without
needing to be recreated.

## Why This Direction

Using `~/.clawperator/authoring-skills/` as the canonical store is cleaner than
making any single agent's private folder the source of truth. Clawperator is
agent-agnostic and the canonical home should reflect that.

But canonical storage alone is not enough. The install flow must also wire the
skills into the folders that supported agents actually read.

So the right model is:

- canonical Clawperator-owned storage
- automatic agent-specific exposure via symlinks

This gives the product a clean internal model while preserving a simple user
experience:

- "install Clawperator" should handle runtime skills and authoring skills
- supported agents should discover the authoring skills without path-copying
- after `install.sh`, the user should not need any additional authoring-skill
  install command

## Why Not The Alternatives

Do not merge authoring skills into the runtime `skills` registry: the schema
does not fit (no `applicationId`, no `scripts/run.js`) and the product boundary
is wrong. Runtime skills are Android device automation. Authoring skills are AI
agent programs. Mixing them confuses both categories.

Do not use `~/.claude/skills/` as the primary install target: this couples
Clawperator install to Claude Code and excludes Codex, which is already a
first-class target via `agents/openai.yaml`. Agent-specific wiring is a
secondary step off the canonical store.

Do not store authoring skills only in `~/.clawperator/authoring-skills/`
without wiring: that is just moving the path-copying problem from the user to a
slightly better location. It does not solve the discovery gap.

Do not move first-party authoring skills into `clawperator-skills`: wrong
boundary. The skills repo is for content Clawperator can execute, not for
programs that author that content.

Do not use git sparse checkout from the main clawperator repo as the primary
distribution mechanism: authoring skills are first-party and tightly coupled to
the CLI, so the npm package is already the correct versioned artifact. A
separate git clone introduces a version skew problem - `npm install -g
clawperator@latest` updates the CLI but leaves the git clone at whatever commit
it was at. The npm bundle approach eliminates this gap entirely.

## Implementation Surfaces

Changes needed if this direction is adopted:

**`apps/node/authoring-skills/` (new directory, symlinks only)**
This directory exists solely to make authoring skills visible to npm. Each
entry is a symlink back to the canonical source in `.agents/skills/`:

```
apps/node/authoring-skills/
  skill-author-by-recording -> ../../.agents/skills/skill-author-by-recording/
```

npm follows symlinks when packing, so the actual files are included in the
published tarball. Developers edit only in `.agents/skills/`; no copy or sync
step is needed when a skill changes.

When a new authoring skill is added to `.agents/skills/`, a corresponding
symlink is added here. That is the entire maintenance burden for keeping the
npm package up to date.

**`apps/node/package.json`**
Add `"authoring-skills/"` to the `files` array. The current array is
`["dist/", "!dist/test/**", "!dist/**/*.map", "README.md", "LICENSE"]`. One
line added is the complete change.

**`apps/node/src/domain/skills/skillsConfig.ts`**
Add `DEFAULT_AUTHORING_SKILLS_DIR` (`~/.clawperator/authoring-skills`). No
remote URL constant is needed: the source is the installed npm package, not a
remote repository.

**`apps/node/src/domain/skills/copyAuthoringSkills.ts` (new)**
Locate the authoring skills source inside the installed npm package (relative
to `import.meta.url`), copy each skill directory to
`~/.clawperator/authoring-skills/`, and write `version.txt` with the current
CLI version. No git operations required. Discovery of available skills uses
directory scanning for subdirectories containing SKILL.md; no manifest file
is needed.

**`apps/node/src/cli/commands/authoringSkills.ts` (new)**
Commands: `install`, `update`, `list`. `install` clones and wires. `update`
fast-forwards and re-wires. `list` scans the installed dir and prints the
available authoring skill names and SKILL.md paths.

These commands are useful as internal plumbing and for repair/update flows, but
they should not become a required extra step for the normal first-time install
experience. The primary path should still be `install.sh`.

**`apps/node/src/cli/registry.ts`**
Register the new `authoring-skills` command group.

**`sites/landing/public/install.sh`**
Add `setup_authoring_skills_via_cli()` after the existing
`setup_skills_via_cli()` step. Include agent-specific wiring (symlinks to
`~/.claude/skills/` when Claude Code is detected, Codex path when Codex is
detected). Print installed paths in the final summary.

This is the key product behavior change:

- `install.sh` itself should leave the user with supported authoring skills
  ready in supported agents
- no follow-up manual install step should be required

**`~/.clawperator/AGENTS.md` template in `install.sh`**
Add a section pointing agents to the installed authoring skills location and
naming available skills.

**`.agents/skills/skill-author-by-recording/SKILL.md` and any future authoring
skill SKILL.md files**
Replace repo-local relative paths in the "Required Reading" section with
published docs site URLs (`https://docs.clawperator.com/...`). This is a
prerequisite: without it, globally installed authoring skills will reference
paths that do not exist outside the repo.

**`docs/skills/authoring.md`**
Add an "Authoring Skills Install" section explaining the product distinction,
install path, and that a normal Clawperator install should already make the
supported authoring skills available. Any `clawperator authoring-skills ...`
commands should be documented as maintenance or repair flows, not as the
expected first-run path.

**`docs/skills/overview.md`**
Clarify that `clawperator skills` and `skills-registry.json` cover runtime
skills only. Authoring skills are a separate category with a separate install
and a separate CLI surface.

## Immediate Prerequisite

Before any global install story is considered complete, authoring-skill SKILL.md
references that currently assume a local repo checkout must be made portable.
Published docs URLs are the correct answer. The SKILL.md portability fix must
ship before or in the same change as any install plumbing, not as a follow-on.

## Versioning

### Stance

Authoring skills do not need their own version scheme. Their version is the
Clawperator CLI version. When the CLI is at v1.2.0, the authoring skills are
the ones that shipped with v1.2.0. No separate authoring-skill version number
is needed.

### The npm update gap

`npm install -g clawperator@latest` updates the CLI binary but does not
automatically refresh the authoring skills that were copied to
`~/.clawperator/authoring-skills/` during a prior install. The user then has a
CLI at v1.2.0 with authoring skills copied from v1.0.0.

The bundle-and-copy model described in the Recommendation section is the
correct response to this: because the source is always the installed npm
package, `clawperator authoring-skills update` is a fast local copy with no
network request needed. The staleness is visible via `clawperator doctor`, and
the fix is one command.

### Staleness detection

`clawperator doctor` should include a check that compares the CLI version
against the version recorded in `~/.clawperator/authoring-skills/version.txt`.
If they differ, the check warns and surfaces the fix:

```
clawperator authoring-skills update
```

`authoring-skills update` re-copies from the current npm package and re-runs
agent wiring. It is a fast local operation because no network request or git
clone is needed: the source is already on disk in the installed npm package.

### Deferral scope

The auto-update gap is a known limitation for now. The priority is:

1. ship the install story (bundle in npm, copy on install, agent wiring)
2. add the doctor staleness check

Automatic triggering of `authoring-skills update` on CLI upgrade (e.g., via
npm post-install hook) can be added later once the basic flow is stable.

## Open Questions

**Codex skill discovery path:** Confirm the exact Codex-side directory path for
auto-loading skills before implementing that wiring. The `agents/openai.yaml`
format in `skill-author-by-recording` confirms Codex is a first-class target,
but the directory path needs to be verified against current Codex documentation
or behavior.
