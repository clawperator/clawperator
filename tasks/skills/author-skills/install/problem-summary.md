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
   - install first-party authoring skills to `~/.clawperator/authoring-skills/`
   - clone the `.agents/skills/` subtree from the main clawperator GitHub repo
     using git sparse checkout so only the authoring skill files are pulled,
     not the full Android source tree

2. Agent discovery wiring:
   - during Clawperator install, automatically wire supported authoring skills
     into agent-native discovery locations via symlinks (not copies)
   - for Claude Code: symlink each skill from
     `~/.clawperator/authoring-skills/<skill>/` into `~/.claude/skills/`
   - for Codex: symlink into the correct Codex skill discovery path; verify
     the actual path before implementing (the `agents/openai.yaml` convention
     is known, but the Codex skill directory path needs confirmation)
   - if another agent later has a supported skill-discovery location, wire that
     too using the same canonical source

Symlinks are preferred over copies so that `clawperator authoring-skills
update` automatically propagates to all wired agent locations without needing
to re-run each agent's wiring step.

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

## Implementation Surfaces

Changes needed if this direction is adopted:

**`apps/node/src/domain/skills/skillsConfig.ts`**
Add `AUTHORING_SKILLS_REPO_URL` (main clawperator GitHub repo),
`DEFAULT_AUTHORING_SKILLS_DIR` (`~/.clawperator/authoring-skills`).

**`apps/node/src/domain/skills/syncAuthoringSkills.ts` (new)**
Clone or sparse-checkout `.agents/skills/` from the main clawperator repo,
similar in shape to `syncSkills.ts`. Verify the registry file exists after sync
(the authoring skills dir should contain a `skills-index.json` or equivalent
manifest rather than reusing the runtime registry schema).

**`apps/node/src/cli/commands/authoringSkills.ts` (new)**
Commands: `install`, `update`, `list`. `install` clones and wires. `update`
fast-forwards and re-wires. `list` scans the installed dir and prints the
available authoring skill names and SKILL.md paths.

**`apps/node/src/cli/registry.ts`**
Register the new `authoring-skills` command group.

**`sites/landing/public/install.sh`**
Add `setup_authoring_skills_via_cli()` after the existing
`setup_skills_via_cli()` step. Include agent-specific wiring (symlinks to
`~/.claude/skills/` when Claude Code is detected, Codex path when Codex is
detected). Print installed paths in the final summary.

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
install path, and how to run `clawperator authoring-skills install`.

**`docs/skills/overview.md`**
Clarify that `clawperator skills` and `skills-registry.json` cover runtime
skills only. Authoring skills are a separate category with a separate install
and a separate CLI surface.

## Immediate Prerequisite

Before any global install story is considered complete, authoring-skill SKILL.md
references that currently assume a local repo checkout must be made portable.
Published docs URLs are the correct answer. The SKILL.md portability fix must
ship before or in the same change as any install plumbing, not as a follow-on.

## Open Question

Confirm the exact Codex skill discovery path before implementing that wiring.
The `agents/openai.yaml` format in `skill-author-by-recording` confirms Codex
is a first-class target, but the Codex-side directory path for auto-loading
skills needs to be verified against current Codex documentation or behavior
before the wiring step is written.
