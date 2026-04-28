# Problem Summary: OpenClaw Skips Clawperator Bundled-Skill Symlinks

## Summary

OpenClaw does not currently discover Clawperator's first-party bundled host-agent skills through the generic `~/.agents/skills` discovery path. The installed entries in `~/.agents/skills` are symlinks to `~/.clawperator/bundled-skills`, and OpenClaw rejects them because the resolved target escapes the configured `~/.agents/skills` root.

This is separate from the repeatable personal wrapper-skills work. Personal wrapper skills should still be real directories under `~/.agents/skills`. The problem here is that Clawperator's own installed bundled-skills bridge is invisible to OpenClaw when exposed as symlinks.

## Observed Behavior

Running:

```bash
openclaw skills list --eligible --json
```

prints warnings before the JSON payload:

```text
[skills] Skipping escaped skill path outside its configured root: source=agents-skills-personal root=~/.agents/skills reason=symlink-escape requested=~/.agents/skills/clawperator-agent-orientation resolved=~/.clawperator/bundled-skills/clawperator-agent-orientation
[skills] Skipping escaped skill path outside its configured root: source=agents-skills-personal root=~/.agents/skills reason=symlink-escape requested=~/.agents/skills/clawperator-skill-author-by-agent-discovery resolved=~/.clawperator/bundled-skills/clawperator-skill-author-by-agent-discovery
[skills] Skipping escaped skill path outside its configured root: source=agents-skills-personal root=~/.agents/skills reason=symlink-escape requested=~/.agents/skills/clawperator-skill-author-by-recording resolved=~/.clawperator/bundled-skills/clawperator-skill-author-by-recording
[skills] Skipping escaped skill path outside its configured root: source=agents-skills-personal root=~/.agents/skills reason=symlink-escape requested=~/.agents/skills/clawperator-upgrade resolved=~/.clawperator/bundled-skills/clawperator-upgrade
```

Running:

```bash
openclaw skills info clawperator-agent-orientation
```

also prints the same warnings and then fails:

```text
Skill "clawperator-agent-orientation" not found. Run `openclaw skills list` to see available skills.
```

By contrast, a real directory under `~/.agents/skills` resolves correctly:

```bash
openclaw skills info home-garage-door-control
```

returns:

```text
home-garage-door-control - Ready
Source: agents-skills-personal
Path: ~/.agents/skills/home-garage-door-control/SKILL.md
```

## Affected Skills

The affected entries are symlinks in `~/.agents/skills`:

```text
~/.agents/skills/clawperator-agent-orientation -> ~/.clawperator/bundled-skills/clawperator-agent-orientation
~/.agents/skills/clawperator-skill-author-by-agent-discovery -> ~/.clawperator/bundled-skills/clawperator-skill-author-by-agent-discovery
~/.agents/skills/clawperator-skill-author-by-recording -> ~/.clawperator/bundled-skills/clawperator-skill-author-by-recording
~/.agents/skills/clawperator-upgrade -> ~/.clawperator/bundled-skills/clawperator-upgrade
```

Each target exists and has a valid `SKILL.md`:

```text
~/.clawperator/bundled-skills/clawperator-agent-orientation/SKILL.md
~/.clawperator/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md
~/.clawperator/bundled-skills/clawperator-skill-author-by-recording/SKILL.md
~/.clawperator/bundled-skills/clawperator-upgrade/SKILL.md
```

The targets are not missing. The issue is OpenClaw's symlink escape policy.

## Why This Matters

Clawperator's docs and CLI help tell host agents to start with these bundled skills in specific situations:

- `clawperator-agent-orientation`: first-run orientation for an unfamiliar host.
- `clawperator-upgrade`: whole-product upgrade route after explicit upgrade intent.
- `clawperator-skill-author-by-agent-discovery`: zero-results front door when runtime-skill discovery finds no relevant match.
- `clawperator-skill-author-by-recording`: proving workflow after discovery or when the route is already known.

If OpenClaw cannot discover these names as AgentSkills, then OpenClaw-hosted agents lose the intended first-party guided workflow. They can still inspect `~/.clawperator/AGENTS.md` or run `clawperator bundled-skills list`, but the prompt-skill trigger surface is broken for OpenClaw.

## Repo Evidence

The Clawperator repo currently intends to create these discovery symlinks.

`docs/skills/authoring.md` says:

- `~/.clawperator/bundled-skills/` is the canonical bundled-skills store.
- `~/.agents/skills/` receives symlinks into the canonical store for generic agent runtimes.
- `clawperator bundled-skills install` copies packaged first-party bundled skills into `~/.clawperator/bundled-skills/` and recreates discovery symlinks for Claude Code, Codex, and generic agents.

`apps/node/src/cli/registry.ts` help for `clawperator bundled-skills install` says:

```text
- Copies packaged first-party bundled skills to ~/.clawperator/bundled-skills/
- Symlinks each installed skill into ~/.claude/skills/, the Codex skills dir, and ~/.agents/skills/
```

`apps/node/src/domain/skills/copyBundledSkills.ts` creates those symlinks with `symlink(targetPath, linkPath, ...)`.

Unit tests in `apps/node/src/test/unit/bundledSkills.test.ts` assert that the `~/.agents/skills/<skill>` entry is a symlink pointing at the installed bundled-skill directory.

So the current Clawperator behavior is intentional from the Clawperator side, but incompatible with OpenClaw's current `~/.agents/skills` symlink policy.

## Distinction From Runtime Skills

This is not about Clawperator runtime skills under `~/.clawperator/skills/skills`.

Runtime skills should remain CLI-discovered through:

```bash
clawperator skills list
clawperator skills search --keyword "<term>"
clawperator skills get <skill_id>
clawperator skills run <skill_id>
```

The broken symlink issue affects Clawperator bundled host-agent skills under `~/.clawperator/bundled-skills`, which are intended to be usable as agent prompt skills.

## Likely Fix Directions

There are several possible fixes. They should be evaluated against OpenClaw's security model and Clawperator's install/update model.

### Option 1: Copy real directories into `~/.agents/skills`

Change Clawperator bundled-skills install/update so the generic agents discovery target receives real directories instead of symlinks, at least for OpenClaw-compatible installations.

Pros:

- Works with OpenClaw's current no-escape policy.
- Keeps OpenClaw skill scanning simple.

Cons:

- Creates duplicate installed content.
- Requires update logic to keep copied directories fresh.
- Must avoid overwriting user-managed skills.

### Option 2: Teach OpenClaw to trust this specific symlink root

OpenClaw could allow symlinks from `~/.agents/skills/<name>` to `~/.clawperator/bundled-skills/<same-name>` as an explicitly trusted root.

Pros:

- Preserves Clawperator's existing canonical-store-plus-symlink model.
- Avoids duplicate files.

Cons:

- Requires OpenClaw changes.
- Needs careful security review so symlink escapes are not broadly re-enabled.

### Option 3: Add `~/.clawperator/bundled-skills` as an OpenClaw skill source

OpenClaw could support an extra configured skill directory for Clawperator bundled skills.

Pros:

- Avoids symlink escape entirely.
- Keeps canonical bundled-skill store visible.

Cons:

- Requires config/install wiring.
- May not help other generic agents that only scan `~/.agents/skills`.

### Option 4: Install a real bridge skill under `~/.agents/skills`

Instead of symlinking every bundled skill, install one real Clawperator bridge/orientation skill under `~/.agents/skills` that points to `clawperator bundled-skills list` and the canonical bundled-skill store.

Pros:

- Smallest filesystem footprint.
- Works with OpenClaw's current scanner.
- Avoids duplicating all bundled skills.

Cons:

- Individual bundled-skill names such as `clawperator-agent-orientation` still would not trigger directly unless the bridge aliases them.
- Less ergonomic than first-class skill discovery for each bundled skill.

## Validation For A Future Fix

After any fix, these should work without symlink-escape warnings:

```bash
openclaw skills list --eligible --json
openclaw skills info clawperator-agent-orientation
openclaw skills info clawperator-upgrade
openclaw skills info clawperator-skill-author-by-agent-discovery
openclaw skills info clawperator-skill-author-by-recording
```

Expected behavior:

- no `reason=symlink-escape` warnings for these skills
- each skill appears in the OpenClaw skills list
- each `skills info` command reports the skill as found and ready, or reports only real dependency/config readiness problems

## Open Questions

- Is OpenClaw intentionally rejecting all symlink escapes for security, or should trusted installer-managed symlink roots be supported?
- Should Clawperator change its generic agents installation strategy from symlink to copy?
- Should `clawperator doctor` or `clawperator bundled-skills list` detect this OpenClaw-specific incompatibility?
- Does OpenClaw have a supported `skills.load.extraDirs` or equivalent config surface that can include `~/.clawperator/bundled-skills` directly?
- Should the fix live in Clawperator, OpenClaw, or both?
