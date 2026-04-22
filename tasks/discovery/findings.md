# Task: OpenClaw Low-Guidance Discovery Findings

Created: 2026-04-22

## Summary

An OpenClaw agent completed a real task through the Clawperator API with little
handholding, but it took a slower and more brittle path than it should have.

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

## Verification Notes

Claims in this document have been checked against the current code and docs.
Key findings from that check:

- `docs/api/navigation.md` already explicitly says "Neither `open_app` nor
  `open_uri` proves that the target screen is ready." That statement is present
  and correct.
- `docs/quickstart.md` describes the Observe-Decide-Act loop clearly, but
  lacks a prominent explicit warning against guessing selectors before
  snapshotting.
- `docs/host-agents.md` is a comprehensive routing guide and references
  `clawperator-agent-orientation` extensively.
- The top-level CLI help, `clawperator skills --help`, and
  `clawperator bundled-skills --help` all already reference
  `clawperator-agent-orientation` prominently. The gap is not in those
  commands; it is in individual raw-route commands (`exec`, `snapshot`,
  `click`, etc.) which carry no orientation reminder.
- `docs/api/selectors.md` documents the full `NodeMatcher` contract but
  provides no guidance on which fields tend to be most stable in practice.
- No existing doc covers launcher paging behavior, when `scroll` will fail on
  a home-screen workspace, or how to reliably reach an app when the launcher
  is the starting surface.

## Low-Hanging Fruit

These are the changes that appear realistic to ship soon without changing core
runtime semantics. Each item is a docs or help-text addition only.

### 1. Add a "never guess selectors" callout to quickstart

`docs/quickstart.md` has the Observe-Decide-Act loop and good examples, but it
does not contain an explicit warning against guessing selectors.

An agent reading the quickstart can still conclude "I'll try a text guess first
and see what happens." The fix is a short prominent callout - not a new
section, just a visible rule near the top of the automation loop description:

- snapshot before every action that needs a target
- derive selectors only from the current snapshot output
- guessed labels fail correctly; that is not a Clawperator bug

`docs/api/navigation.md` already has the strong statement about `open_app` not
proving app readiness. That page does not need changes for this item.

### 2. Add launcher and home-screen navigation guidance

No existing doc covers the launcher as a special-case surface. The discovery
run hit this directly:

- `scroll` against the Samsung launcher workspace returned `CONTAINER_NOT_SCROLLABLE`
- launcher pages appear in snapshot XML but do not expose a generic scrollable container
- direct `open_app` was more reliable than any launcher traversal attempt

`docs/api/navigation.md` should add a short "Launcher and home-screen
navigation" section covering:

- when paged launchers do not expose a scrollable container to Clawperator
- why direct `open_app` is the preferred path for installed apps
- how overlay windows (choosers, permission prompts) can affect
  `wait_for_navigation` outcome even when the target package ultimately
  reaches the foreground

This is a docs addition only. No runtime changes needed.

### 3. Add selector stability guidance to selectors.md

`docs/api/selectors.md` documents the full `NodeMatcher` contract but gives
no recommendation on which fields to prefer when multiple options are
available. Agents currently learn selector stability by trial and error.

Add a short "Choosing a stable selector" section to `docs/api/selectors.md`
with the priority order that emerged from the discovery run:

1. Android framework `resourceId` (most stable, not app-version-specific)
2. `contentDescEquals` (good for icon buttons and labeled controls)
3. `textEquals` or `textContains` (reliable for visible labels, brittle for
   localized or dynamically generated text)
4. App-specific opaque numeric resource IDs (last resort; version-fragile)

Also note that Compose-heavy app trees often expose fewer stable `resourceId`
values and more opaque internal IDs, making `contentDesc` and visible text
more important for those apps.

### 4. Add orientation reminder to individual raw-route command help

The top-level help, `clawperator skills --help`, and
`clawperator bundled-skills --help` already mention `clawperator-agent-orientation`
clearly. The gap is that individual raw-route commands do not carry that
reminder.

An agent that skips `clawperator --help` and goes directly to
`clawperator exec --help` or `clawperator snapshot --help` gets no pointer to
orientation or to the observe-first pattern.

Low-cost fix: add a short orientation note to the help text for `exec` and
`snapshot` (the two most likely entry points for an agent going raw). The note
does not need to be long - one line pointing to
`clawperator bundled-skills list` and `clawperator-agent-orientation` is
enough.

This is a registry.ts help-text addition only.

## Enhancements

These ideas seem valuable, but they are not the low-hanging-fruit changes for
this round.

### 1. Improve `wait_for_navigation` diagnostics

The most confusing runtime case from the discovery run was:

- `wait_for_navigation` returned `NAVIGATION_TIMEOUT`
- `last_package` in the result already showed the target app
- a follow-up `snapshot_ui` confirmed the target app was foregrounded

That leaves too much interpretation work to the caller. The public result
should better explain:

- final foreground package at timeout
- whether the target package was seen during the wait window
- whether an overlay, chooser, or transient window likely interfered
- whether failure was package mismatch vs. node mismatch vs. readiness timeout

This requires changes to the `waitForNav` action result shape and is more
than a docs-only cleanup.

### 2. Add a canonical current-device-status surface

A compact `clawperator status --json` command (or equivalent MCP tool) that
returns:

- is the device awake
- is it locked
- which app is foregrounded
- current snapshot (optional, on request)

This would help raw-CLI agents pick a safe first move and reduce blind
exploration around lock screens, launcher state, and wrong-foreground-app
assumptions. A bundled skill alone is not enough here because an agent that
misses orientation may also miss a helper skill. The canonical command should
come first; a skill wrapper can follow.

This requires a new CLI command and Android runtime support.

## Practical Conclusion

For the near term, focus on the low-hanging-fruit bucket:

1. add a prominent "never guess selectors" callout to quickstart
2. document launcher and home-screen navigation patterns in navigation.md
3. add selector stability priority guidance to selectors.md
4. add a one-line orientation pointer to exec and snapshot command help

The enhancement ideas are still worthwhile but belong in a separate product
planning pass.
