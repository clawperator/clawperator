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

## Most Actionable Improvements

### 1. Make the snapshot-driven loop impossible to miss

The docs already contain the right ingredients, but the most important
operational rule should be much louder:

- `open_app` is a trigger, not proof of stable arrival
- never guess selectors when a fresh snapshot is available
- use `act -> snapshot -> derive selector -> act`

Priority docs surfaces:

- `docs/quickstart.md`
- `docs/api/navigation.md`
- CLI help in `apps/node/src/cli/registry.ts`

### 2. Improve `wait_for_navigation` diagnostics

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

### 3. Add first-class guidance for launcher and overlay behavior

The launcher was a repeated source of confusion during the run.

Clawperator docs should explicitly cover:

- when to prefer direct `open_app`
- when launcher paging does not map to generic `scroll`
- how overlays and transitional windows can affect navigation waits and
  snapshots

### 4. Add clearer guidance for Compose-heavy app trees

The discovery task succeeded in Netflix, but the hierarchy was noisy. The docs
should more clearly recommend selector preference order for noisy app trees:

1. Android framework `resourceId`
2. `contentDesc`
3. visible text
4. app-specific opaque numeric ids only when necessary

### 5. Make host-agent orientation easier to discover

The repo already has good orientation material and the
`clawperator-agent-orientation` bundled skill. The issue exposed here was that
an unfamiliar agent still did not reliably start there.

This points to a discoverability gap more than a missing-content gap.

High-value places to reinforce it:

- top-level CLI help
- install follow-up guidance
- raw-route guidance in the host-agent docs

## Assessment Of A Possible `clawperator-current-device-status` Surface

It is reasonable to consider a surface that answers the question:

- is the device awake
- is it locked
- which app is foregrounded
- what does the current snapshot show

This would help raw-CLI agents pick a safe first move and reduce blind
exploration around lock screens, launcher state, and wrong-foreground-app
assumptions.

However, this does not appear to be the primary fix for the discovery findings.
The main issue was still discoverability and mental model.

Recommendation:

- if this capability is added, prefer a canonical `clawperator status --json`
  command or MCP tool first
- define it as a compact structured diagnostic surface
- optionally add a bundled skill later as a thin wrapper around that canonical
  command

A bundled skill alone is probably not enough, because an agent that misses
`clawperator-agent-orientation` may also miss another helper skill.

## Practical Conclusion

The highest-leverage improvements are:

1. make the golden snapshot-driven loop much more prominent
2. make navigation failures explain themselves better
3. document launcher, overlay, and Compose realities as first-class agent
   guidance

Only after those should we strongly consider adding a dedicated current-status
command or helper surface.
