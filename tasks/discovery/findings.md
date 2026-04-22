# Task: OpenClaw Low-Guidance Discovery Findings

Created: 2026-04-22

## Summary

An OpenClaw agent was able to complete a real task through the Clawperator API
with little handholding, but it took a slower and more brittle path than it
should have.

The most important finding is that the main problem was not missing core
capability. The core primitives were sufficient. The larger gap was:

- discoverability of the correct starting surface
- clarity of the mental model for raw UI automation
- runtime diagnostics when navigation results are ambiguous

Once the agent shifted to a snapshot-driven loop, the task became
straightforward.

## What The Discovery Run Showed

The raw-API route worked best when driven as:

1. act
2. snapshot
3. derive the next selector from the snapshot
4. act again

The agent lost time when it treated Clawperator like a generic imperative UI
bot and made assumptions such as:

- `open_app` success implies the app is fully ready
- guessed text labels are good enough without snapshot confirmation
- launcher surfaces behave like generic scrollable containers

In practice:

- `snapshot_ui` was the most reliable source of truth
- exact selectors derived from the current snapshot were stable
- `wait_for_navigation` was useful, but some timeout outcomes were still too
  ambiguous for a blind agent

## Low-Hanging Fruit

These are the changes that appear realistic to ship soon without changing core
runtime semantics.

### 1. Make the snapshot-driven loop impossible to miss

The docs already contain the right ingredients, but the most important
operational rule should be much louder:

- `open_app` is a trigger, not proof of stable arrival
- never guess selectors when a fresh snapshot is available
- use `act -> snapshot -> derive selector -> act`

Priority surfaces:

- `docs/quickstart.md`
- `docs/api/navigation.md`
- `docs/host-agents.md`

### 2. Add first-class guidance for launcher and overlay behavior

The launcher was a repeated source of confusion during the run.

Clawperator docs should explicitly cover:

- when to prefer direct `open_app`
- when launcher paging does not map to generic `scroll`
- how overlays and transitional windows can affect navigation waits and
  snapshots

This is mostly a documentation and examples problem, not a missing-primitive
problem.

### 3. Add clearer guidance for Compose-heavy app trees

The discovery task succeeded in Netflix, but the hierarchy was noisy. The docs
should more clearly recommend selector preference order for noisy app trees:

1. Android framework `resourceId`
2. `contentDesc`
3. visible text
4. app-specific opaque numeric ids only when necessary

This should live in the selector and quickstart guidance so agents do not need
to learn it by trial and error.

### 4. Make host-agent orientation easier to discover

The repo already has good orientation material and the
`clawperator-agent-orientation` bundled skill. The issue exposed here was that
an unfamiliar agent still did not reliably start there.

This points to a discoverability gap more than a missing-content gap.

High-value reinforcement points:

- top-level CLI help
- `clawperator skills --help`
- install follow-up guidance
- raw-route guidance in `docs/host-agents.md`

### 5. Improve CLI discovery cues for raw-route users

For agents that have already chosen the raw CLI route, the CLI should make the
next truthful move easier to find.

Useful low-cost tweaks include:

- reminding users in help text that unfamiliar hosts should start with
  `clawperator-agent-orientation`
- making the raw route point more directly to the observe-first workflow
- surfacing the distinction between runtime skills, bundled skills, MCP, and
  raw CLI more consistently in help output

## Enhancements

These ideas seem valuable, but they are not the low-hanging-fruit changes for
this round.

### 1. Improve `wait_for_navigation` diagnostics

The most confusing runtime case from the discovery run was:

- `wait_for_navigation` failed with `NAVIGATION_TIMEOUT`
- `last_package` suggested the target app had already been reached
- a follow-up snapshot confirmed the target app was actually foregrounded

That leaves too much interpretation work to the caller.

The public result should better explain:

- final foreground package
- whether the target package was seen during the wait
- whether the expected node was ever matched
- whether an overlay, chooser, or transient window likely interfered

This is a real product improvement, but it is more than a docs-only cleanup.

### 2. Add a canonical current-device-status surface

It is reasonable to consider a surface that answers the question:

- is the device awake
- is it locked
- which app is foregrounded
- what does the current snapshot show

This would help raw-CLI agents pick a safe first move and reduce blind
exploration around lock screens, launcher state, and wrong-foreground-app
assumptions.

Recommendation:

- if this capability is added, prefer a canonical `clawperator status --json`
  command or MCP tool first
- define it as a compact structured diagnostic surface
- optionally add a bundled skill later as a thin wrapper around that canonical
  command

A bundled skill alone is probably not enough, because an agent that misses
`clawperator-agent-orientation` may also miss another helper skill.

## Practical Conclusion

For the near term, we should focus on the low-hanging-fruit bucket:

1. make the golden snapshot-driven loop much more prominent
2. document launcher, overlay, and Compose realities more explicitly
3. improve CLI and docs discoverability around orientation and skills

The enhancement ideas are still worthwhile, but they should be treated as
follow-up product work rather than part of the immediate cleanup pass.
