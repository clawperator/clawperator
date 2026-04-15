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

That flow does not help Codex, Claude, or any other agent discover first-party
authoring skills.

## Critical distinction

There are two different categories of skills and they should remain separate:

1. Runtime skills
   - live in `clawperator-skills`
   - are executed by Clawperator through the Node runtime
   - are registry-backed and install to `~/.clawperator/skills/`

2. Authoring skills
   - live in the main `clawperator` repo
   - are agent programs consumed by Codex, Claude, or similar tools
   - are not runtime registry entries and must not be folded into
     `skills-registry.json`

Any solution that tries to merge authoring skills into the runtime skills
registry crosses the wrong product boundary.

## Current gap

Installing Clawperator does not currently make `skill-author-by-recording`
usable in a normal agent session.

If an authoring skill is only copied into a Clawperator-owned folder such as:

- `~/.clawperator/authoring-skills/`

that still does not make the skill discoverable unless the target agent
actually scans or is pointed at that folder.

This is the key product issue:

- storage is not discovery
- canonical location is not enough
- if Codex or Claude are not aware of the install location, the skill is
  effectively invisible

We cannot expect users to manually write prompts like:

```text
Use [$skill-author-by-recording](</Users/<local_user>/.clawperator/authoring-skills/skill-author-by-recording/SKILL.md>) to draft a new clawperator skill.
```

That is too path-aware, too brittle, and not a credible end-user story.

## Product requirement

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
- The canonical source of first-party authoring skills should remain the main
  `clawperator` repo, not `clawperator-skills`.
- The solution should not assume there will only ever be one authoring skill.
- The solution should support the current Codex-oriented workflow while leaving
  room for additional agent integrations later.
- Some current `SKILL.md` files reference repo-local paths; global installation
  requires those references to be replaced with published docs URLs or another
  portable source.

## Recommendation

Use a two-layer model:

1. Canonical install location:
   - install first-party authoring skills to
     `~/.clawperator/authoring-skills/`

2. Agent discovery wiring:
   - during Clawperator install, automatically wire supported authoring skills
     into agent-native discovery locations
   - for Codex, this likely means exposing the installed skills under
     `~/.codex/skills/`
   - if Claude or another agent later has a supported skill-discovery location,
     wire that too

This keeps Clawperator ownership clean while still solving the real problem:
agent discovery.

## Why this direction

Using `~/.clawperator/authoring-skills/` as the canonical store is cleaner than
making Codex's private folder the source of truth.

But canonical storage alone is not enough. The install flow must also wire the
skills into the folders that supported agents actually read.

So the right model is:

- canonical Clawperator-owned storage
- automatic agent-specific exposure

This gives the product a clean internal model while preserving a simple user
experience:

- "install Clawperator" should handle runtime skills and authoring skills
- supported agents should discover the authoring skills without path-copying

## Non-recommendations

Do not:

- merge authoring skills into the runtime `skills` registry
- store authoring skills only in `~/.clawperator/authoring-skills/` without any
  agent integration layer
- require users to invoke authoring skills by manually pasting filesystem paths
- move first-party authoring skills into `clawperator-skills`

## Likely implementation surfaces

- `sites/landing/public/install.sh`
- a new Node CLI surface for authoring-skills install/update/list, or a closely
  related bootstrap path
- docs clarifying runtime skills versus authoring skills
- `SKILL.md` files that currently depend on repo-local relative paths
- any agent-specific wiring needed for Codex now and other agents later

## Immediate prerequisite

Before any global install story is considered complete, authoring-skill
`SKILL.md` references that currently assume a local repo checkout should be
made portable. Published docs URLs are the most likely current answer.
