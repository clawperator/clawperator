---
name: clawperator-agent-orientation
description: First-run orientation for unfamiliar agents. Verifies host readiness, routes to the correct front door (runtime skills, agent-skills, MCP, or raw CLI), and ends with one canonical doc link.
---

# Clawperator Agent Orientation

Use this skill when the current host can access Clawperator, but the agent is
not yet confident about how to get started truthfully.

This is a first-run orientation and routing skill. It should get the agent from
"I know Clawperator is installed" to "I know which surface to use next and
which canonical docs to trust."

## What This Skill Owns

- verify the local host is ready to use Clawperator
- choose the correct front door for the agent's next step
- end with one canonical doc link for the chosen route

## What This Skill Does Not Own

- do not restate API contracts or action parameters in full
- do not replace `https://docs.clawperator.com/host-agents/` as the source of truth
- do not replace `skill-author-by-agent-discovery`
- do not replace `skill-author-by-recording`
- do not run an unbounded discovery or authoring workflow inside this skill

## Workflow

### 1. Verify readiness first

Run:

```bash
clawperator doctor --json
```

Continue only when:

- exit code is `0`
- `criticalOk` is `true`

If `criticalOk` is `false`, stop immediately. Tell the agent to finish setup
at `https://docs.clawperator.com/setup/` before continuing. Do not guess or
attempt a workaround.

### 2. Choose the correct front door

Use this decision table:

| Situation | Start here |
| --- | --- |
| Your first reasonable guess is an installed app-specific workflow | `clawperator skills` |
| Runtime-skill discovery found no relevant match and you need the truthful zero-results route | `skill-author-by-agent-discovery` |
| Discovery returned `proceed_to_recording`, or the app route is already well understood and now needs a proving workflow | `skill-author-by-recording` |
| The host already supports stdio MCP and wants registered tools | `clawperator mcp serve` |
| You already know the exact direct action or payload you want | raw CLI / local API via quickstart |

### 3. Run the cold-start checklist

Run these commands in order when the host is ready:

```bash
clawperator devices
clawperator snapshot --json
clawperator skills list --json
clawperator agent-skills list --json
```

Add `clawperator mcp serve` only if the host has already chosen the MCP route.

The checklist shows what is connected, what the screen looks like right now,
what runtime skills are installed, and what agent-skills are available. It does
not choose a route - that is Step 2.

### 4. Explain the operating loop in one sentence

Clawperator observes with `snapshot`, decides using runtime skills or direct
actions, and acts on the device with the smallest truthful command surface.

### 5. End with one explicit next step

Name one command or one URL - not a taxonomy. Examples of good endings:

- "Your next step is `clawperator skills for-app <package_id> --json`."
- "Runtime-skill discovery returned zero matches. Use `skill-author-by-agent-discovery` next. See `https://docs.clawperator.com/host-agents/`."
- "You are ready for raw actions. See `https://docs.clawperator.com/quickstart/`."

Use the routing table from Step 2 to pick the single correct ending.

## Output Style

Be concise. Name the chosen front door explicitly and end with one link:

| Chosen front door | End with this link |
| --- | --- |
| `clawperator skills` | `https://docs.clawperator.com/host-agents/` |
| `skill-author-by-agent-discovery` | `https://docs.clawperator.com/host-agents/` |
| `skill-author-by-recording` | `https://docs.clawperator.com/skills/authoring/` |
| `clawperator mcp serve` | `https://docs.clawperator.com/api/mcp/` |
| raw CLI / direct actions | `https://docs.clawperator.com/quickstart/` |
