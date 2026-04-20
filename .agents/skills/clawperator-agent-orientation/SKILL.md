---
name: clawperator-agent-orientation
description: Get an unfamiliar agent operational with Clawperator in a few minutes by checking readiness, choosing the correct front door, and routing to the canonical docs for runtime skills, MCP, snapshots, clicks, and direct execution.
---

# Clawperator Agent Orientation

Use this skill when the current host can access Clawperator, but the agent is
not yet confident about how to get started truthfully.

This is a first-run orientation and routing skill. It should get the agent from
"I know Clawperator is installed" to "I know which surface to use next and
which canonical docs to trust."

## What This Skill Owns

- verify the local host is ready to use
- choose the correct front door for the next step
- point the agent to the canonical docs for the chosen path
- give the shortest useful command sequence for a cold start

## What This Skill Does Not Own

- do not become a second source of truth for API contracts
- do not replace `https://docs.clawperator.com/host-agents/`
- do not replace `skill-author-by-agent-discovery`
- do not replace `skill-author-by-recording`
- do not run an unbounded discovery or authoring workflow inside this skill

## Required Reading During Use

Read these canonical docs and reuse their current contracts:

- `https://docs.clawperator.com/host-agents/`
- `https://docs.clawperator.com/setup/`
- `https://docs.clawperator.com/quickstart/`
- `https://docs.clawperator.com/api/overview/`
- `https://docs.clawperator.com/api/snapshot/`
- `https://docs.clawperator.com/api/mcp/`

Use the docs above as the source of truth. This skill should route to them, not
restate them in full.

## Workflow

### 1. Verify readiness first

Run:

```bash
clawperator doctor --json
```

Continue only when:

- exit code is `0`
- `criticalOk` is `true`

If readiness fails, stop and route the user to `setup.md` / the public setup
page rather than guessing.

### 2. Choose the correct front door

Use this decision table:

| Situation | Start here |
| --- | --- |
| You need to discover or run an installed app-specific workflow | `clawperator skills` |
| Runtime-skill discovery found no relevant match and you need the truthful zero-results route | `skill-author-by-agent-discovery` |
| Discovery returned `proceed_to_recording`, or the app route is already well understood and now needs a proving workflow | `skill-author-by-recording` |
| The host already supports stdio MCP and wants registered tools | `clawperator mcp serve` |
| You already know the exact direct action or payload you want | raw CLI / local API via quickstart and API overview |

### 3. Call out the critical commands

For first-run orientation, point to these commands before deeper detail:

```bash
clawperator devices
clawperator snapshot --json
clawperator click --text "Settings" --json
clawperator skills list --json
clawperator agent-skills list --json
```

If the host wants MCP, add:

```bash
clawperator mcp serve
```

### 4. Explain the operating loop briefly

Keep the explanation short:

1. Observe with `snapshot` or runtime-skill discovery.
2. Decide whether the next step is runtime skills, agent-skills, MCP, or raw actions.
3. Act with the smallest truthful command surface.

### 5. End with one clear next step

Do not dump every possible path. Finish by naming the single next command or
doc page the agent should use now.

## First 5 Commands

Use this as the default cold-start checklist when the host is ready:

```bash
clawperator doctor --json
clawperator devices
clawperator snapshot --json
clawperator skills list --json
clawperator agent-skills list --json
```

## Output Style

When using this skill:

- be concise
- name the chosen front door explicitly
- link to the canonical public doc page for that route
- if the next job is zero-results routing, name
  `skill-author-by-agent-discovery` directly
- if the next job is proving from a known route, name
  `skill-author-by-recording` directly
