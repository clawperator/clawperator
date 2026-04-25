# Handshake Optimization Problem Summary

Date: 2026-04-26

## Product Goal

The ideal caller experience is that agents can repeatedly call the normal
`clawperator` CLI/API surface and get fast responses. Requiring agents or skills
to switch to `clawperator serve` for performance is useful but not ideal:

- existing replay skills often shell out to `clawperator exec`
- direct ad hoc agent calls usually invoke the CLI
- moving every caller to HTTP/serve would require skill rewrites or new agent
  conventions

`serve` is still valuable, but the product goal is broader: make ordinary
`clawperator` calls faster wherever possible.

## Current Latency Shape

Recent Node-side I/O work removed the obvious logcat overhead, but the readiness
handshake remains a major floor. The full proactive readiness probe currently
costs roughly `~410ms` on the measured happy path because it performs a
broadcast-plus-logcat `doctor_ping` round trip before the real command.

One-shot CLI process startup also has a cost. Prior measurements put Node CLI
startup and module load around `~80ms`. That matters, but it is smaller than
the readiness handshake and Android snapshot traversal costs.

## Why A Serve-Only Cache Is Not Enough

An in-process readiness cache helps persistent `serve` mode because multiple
commands share one Node process. It does not materially help ordinary one-shot
CLI calls because each invocation starts with an empty in-memory cache.

Most current replay-style skills also do not benefit from an in-process cache
because their scripts commonly call `clawperator exec` through child processes.
Each nested exec is another one-shot CLI process.

So an in-process cache is a useful optimization for persistent-process agent
loops, but it is not the full answer for direct CLI/API calls or many existing
skills.

## Solution Families

### 1. Transparent Persistent Daemon Behind The CLI

Keep `clawperator` as the user-facing command, but make each CLI invocation a
thin client to a per-user local runtime:

- CLI starts or connects to a local daemon
- daemon holds readiness cache, device state, and possibly logcat/session state
- CLI sends the command to the daemon over a local socket or loopback API
- daemon executes the command and returns the normal result shape

This preserves the "just call `clawperator`" UX while giving the implementation
the persistence benefits of `serve`.

Tradeoffs:

- best long-term UX
- larger lifecycle/security/versioning design
- must handle stale daemons, logs, socket permissions, and branch-local builds

### 2. Cross-Process Readiness Cache

Persist recent readiness state in a small local file, likely under
`~/.clawperator/`, keyed by resolved device serial and operator package.

This lets one-shot CLI processes skip the full proactive handshake when a recent
successful readiness result exists.

Tradeoffs:

- simpler than a daemon
- helps direct CLI calls and replay skills
- stale state risk is higher because the cache cannot observe USB disconnects,
  adb restarts, screen locks, or service crashes except reactively
- requires short TTLs and strict invalidation on failures

### 3. Cheap Host-Side Readiness Probe

Replace or precede the full `doctor_ping` with cheaper host-side adb checks on
the CLI hot path, such as screen or keyguard state from Android system services.

Tradeoffs:

- helps every CLI call without persistence
- can catch obvious not-ready states cheaply
- cannot fully prove accessibility service/operator health
- weaker proactive diagnostics unless paired with fallback probing

### 4. Reactive Readiness Diagnostics

Do not run the expensive proactive handshake on the happy path. Send the command
directly, then run the full readiness probe only when the command fails or times
out so the user still gets a classified diagnostic.

Tradeoffs:

- potentially saves the full `~410ms` handshake on every healthy CLI call
- broad benefit across direct CLI calls and replay skills
- changes first-failure behavior: the first command after a readiness transition
  may fail reactively before diagnostics are refined
- timeout values and post-failure diagnosis must be designed carefully

### 5. Hybrid Cheap Probe Plus Reactive Diagnostics

Use a cheap host-side probe to catch obvious not-ready states, skip the full
`doctor_ping` on the happy path, and run full diagnostics only after command
failure.

This may be the best near-term CLI-oriented path:

- broad benefit for ordinary `clawperator` calls
- avoids requiring skills to use `serve`
- preserves stronger diagnostics after failures
- limits proactive checks to cheap evidence

Tradeoffs:

- still a behavior change from always-full proactive readiness
- needs a clear diagnostic contract and live-device validation matrix

### 6. CLI Auto-Connects To A Background Serve Runtime

This is a daemon variant framed as transparent `serve` reuse:

- `clawperator exec` checks for a matching local background runtime
- starts one if needed
- proxies the command
- user and agent still call normal CLI commands

Tradeoffs:

- preserves current caller UX
- gives `serve`-like persistence
- requires careful version matching, stale server cleanup, and local endpoint
  security

## Recommended Planning Direction

Do not treat a serve-only in-process cache as the whole handshake strategy. It is
a valid optimization for persistent agent loops, but it leaves ordinary CLI calls
and many current skills mostly unchanged.

For broad impact, evaluate these first:

1. hybrid cheap probe plus reactive diagnostics
2. transparent daemon/background runtime behind the CLI
3. cross-process cache only if the stale-state risk can be made acceptably small

Any task pack should explicitly decide whether its goal is:

- persistent-process `serve` speed only
- ordinary one-shot CLI speed
- replay skill speed
- all of the above

Those are different products with different acceptable tradeoffs.
