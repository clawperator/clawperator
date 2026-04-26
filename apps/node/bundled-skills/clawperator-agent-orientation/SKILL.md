---
name: clawperator-agent-orientation
description: Clawperator first-party bundled skill. First-run orientation for unfamiliar agents. Verifies host readiness, routes to the correct front door (runtime skills, bundled-skills, MCP, or raw CLI), and ends with one canonical doc link.
---

# Clawperator Agent Orientation

Use this skill when the current host can access Clawperator, but the agent is
not yet confident about how to get started truthfully.

This is a first-run orientation and routing skill. It should get the agent from
"I know Clawperator is installed" to "I know which surface to use next and
which canonical docs to trust."

## Machine-Readable Docs

The full Clawperator documentation is available in machine-readable form:

- `https://docs.clawperator.com/llms.txt` - docs index with key page links
- `https://docs.clawperator.com/llms-full.txt` - complete compiled documentation

Use these instead of parsing the HTML docs site.

## What This Skill Owns

- verify the local host is ready to use Clawperator
- distinguish runtime skills, bundled-skills, MCP, and raw CLI without blurring their boundaries
- choose the correct front door for the agent's next step
- end with one canonical doc link for the chosen route

## What This Skill Does Not Own

- do not restate API contracts or action parameters in full
- do not replace `https://docs.clawperator.com/host-agents/` as the source of truth
- do not replace runtime-skill discovery with a generic inventory dump
- do not replace `clawperator-skill-author-by-agent-discovery`
- do not replace `clawperator-skill-author-by-recording`
- do not run an unbounded discovery or authoring workflow inside this skill

## Workflow

### 1. Verify readiness first

Run:

```bash
clawperator doctor
```

Continue only when:

- exit code is `0`
- `criticalOk` is `true`

If `criticalOk` is `false`, stop immediately. Tell the agent to finish setup
at `https://docs.clawperator.com/setup/` before continuing. Do not guess or
attempt a workaround.

Then identify the target device before any device-touching probe:

```bash
clawperator devices
```

If more than one device is connected, choose one serial and carry
`--device <device_serial>` through every later command that talks to the
device. Do not rely on implicit device selection.

### 2. Choose one front door, not several

Use this decision table:

| Situation | Start here |
| --- | --- |
| You are trying to solve a user-facing app workflow and want an installed runtime skill first | `clawperator skills for-app <package_id>` or `clawperator skills search --keyword <text>` |
| Runtime-skill discovery found no relevant match and you need the truthful zero-results route | `clawperator-skill-author-by-agent-discovery` |
| Discovery returned `proceed_to_recording`, or the app route is already well understood and now needs a proving workflow | `clawperator-skill-author-by-recording` |
| The host already supports stdio MCP and wants registered tools | `clawperator mcp serve` |
| You already know the exact direct action or payload you want | raw CLI / local API via quickstart |

Runtime skills and bundled-skills are different surfaces:

- `clawperator skills ...` is for installed runtime app workflows
- `clawperator bundled-skills ...` is for host-agent helpers around Clawperator itself
- `clawperator-skill-author-by-agent-discovery` is the zero-results route after runtime-skill discovery found no relevant match
- `clawperator-skill-author-by-recording` is the proving workflow after discovery says to record, or when the route is already well understood

### 3. Run the smallest truthful first probe for that route

Do not run every surface "just to look around". Use one route-specific probe:

| Chosen route | First probe |
| --- | --- |
| runtime skills with known package id | `clawperator skills for-app <package_id>` |
| runtime skills with only user-language terms | `clawperator skills search --keyword <text>` |
| zero-results authoring route | `clawperator bundled-skills list` |
| proving workflow | `clawperator bundled-skills list` |
| MCP | `clawperator mcp serve` |
| raw CLI / direct actions | `clawperator snapshot --device <device_serial>` |

Rules:

- do not start runtime-skill discovery with `clawperator skills list` unless the real task is inventory
- do not inspect `clawperator bundled-skills list` before runtime-skill discovery unless the route is already known to be authoring
- do not start `clawperator mcp serve` unless the host has already chosen MCP as the transport
- for the raw CLI route, use `snapshot` as the first observe step before attempting direct actions
- for authoring routes, prefer daemon-backed polling with observable UI
  readiness conditions over arbitrary fixed sleeps

### 4. Explain the operating loop in one sentence

Clawperator observes with `snapshot`, decides using runtime skills or direct
actions, and acts on the device with the smallest truthful command surface.

### 5. End with one explicit next step

Name one command or one URL - not a taxonomy. Examples of good endings:

- "Your next step is `clawperator skills for-app <package_id>`."
- "Runtime-skill discovery returned zero matches. Use `clawperator-skill-author-by-agent-discovery` next. See `https://docs.clawperator.com/host-agents/`."
- "The route is already known. Use `clawperator-skill-author-by-recording` next. See `https://docs.clawperator.com/skills/authoring/`."
- "Your host wants MCP tools. Start `clawperator mcp serve` and use `https://docs.clawperator.com/api/mcp/`."
- "You are ready for raw actions. See `https://docs.clawperator.com/quickstart/`."

Use the routing table from Step 2 to pick the single correct ending.

## Output Style

Be concise. Name the chosen front door explicitly and end with one link:

| Chosen front door | End with this link |
| --- | --- |
| `clawperator skills` | `https://docs.clawperator.com/host-agents/` |
| `clawperator-skill-author-by-agent-discovery` | `https://docs.clawperator.com/host-agents/` |
| `clawperator-skill-author-by-recording` | `https://docs.clawperator.com/skills/authoring/` |
| `clawperator mcp serve` | `https://docs.clawperator.com/api/mcp/` |
| raw CLI / direct actions | `https://docs.clawperator.com/quickstart/` |
