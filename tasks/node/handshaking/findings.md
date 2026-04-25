# Handshaking Findings

Date: 2026-04-25
Surface: Node snapshot execution preflight and readiness checks

## Summary

Handshake optimization is still in scope for snapshot latency work, but it should not be the first implementation step. The current handshake path is expensive and likely worth redesigning, but there are still enough product, contract, and diagnostic questions that this work should proceed as a dedicated planning and implementation effort rather than being folded into the immediate low-hanging-fruit I/O changes.

This file captures the main unknowns and planning questions that should be answered before writing a task pack for handshake implementation.

## Current Handshake Context

The current snapshot path performs an interactive-readiness handshake before the actual snapshot command:

- `ensureInteractiveAutomationReady`
- `probeInteractiveState`
- `runDoctorPingCommand`
- `waitForResultEnvelope`

This is effectively a full broadcast-plus-logcat round trip before the main command path. Measured cost on the current Samsung device is about `~410ms` on the happy path.

## Why This Was Split Out

The handshake is probably worth changing, but the right change is not yet locked:

- caching may help `serve` mode but not one-shot CLI very much
- replacing the probe with a cheaper host-side check may improve latency but degrade diagnostics
- removing the proactive handshake entirely may speed up the hot path but could worsen user-visible failure behavior

Because of that, this should be planned as its own step instead of being implemented opportunistically during the immediate I/O cleanup work.

## Unknowns And Questions To Resolve

### 1. What problem the handshake is actually solving today

We know it checks whether the device is "interactive enough to proceed," but that bundles several distinct failure modes:

- screen off
- locked device
- user not unlocked
- accessibility service not running
- operator reachable but not healthy

Before implementation, we need to decide which of these must still be detected proactively and which can become reactive failures on the real command path.

### 2. What error quality we are unwilling to lose

The current handshake is expensive, but it likely provides better diagnostics than a raw command failure. We need to define the expected behavior:

- preserve current diagnostics as closely as possible
- preserve only the most important user-facing cases
- accept degraded diagnostics in exchange for a faster hot path

Without that decision, an implementing agent could optimize away behavior we still care about.

### 3. What should happen in one-shot CLI mode vs persistent `serve` mode

A short-TTL cache is a strong optimization in `serve` mode and a weak one in one-shot CLI mode. We need an explicit product decision:

- optimize mainly for persistent-process agent loops
- optimize both CLI and serve
- accept that CLI remains materially slower than serve

That choice affects whether caching is sufficient or whether we also need a cheaper non-broadcast probe.

### 4. What should invalidate a cached ready state

If a "ready" result is cached, the invalidation rules need to be deterministic. Some obvious invalidators:

- timeout
- `SERVICE_UNAVAILABLE`
- broadcast failure
- device change
- operator package change

Less obvious cases still need a decision:

- app switch
- screen turning off mid-session
- USB reconnect
- adb server restart

The task pack should not leave cache invalidation to implementer judgment.

### 5. Whether a cheaper probe is trustworthy enough

A host-side probe such as `dumpsys power` is attractive because it is much cheaper than a full broadcast-plus-logcat round trip. But it may not capture all of the blockers the current handshake detects:

- it may tell us screen state
- it may not tell us accessibility-service readiness
- it may not tell us whether the operator can actually execute commands

So we need to decide whether a cheaper probe is:

- a full replacement
- a warm-path shortcut
- advisory only, before falling back to the current handshake

### 6. Whether readiness should be checked before every command type

Snapshot/read actions and mutating actions may not need the same safety posture. The task pack should explicitly decide whether handshake behavior is:

- universal
- action-type-specific
- mode-specific

Without that, an implementing agent may apply one rule everywhere.

### 7. How much live-device validation is required

This is the most important planning question. Unit tests are necessary, but handshake changes are also about real device states. We should decide which live states must be validated before calling the work done:

- screen on, unlocked, service healthy
- screen off
- locked screen
- accessibility disabled or operator unavailable

If we do not define that up front, the work can pass tests while still regressing the real UX.

## Decisions To Lock Before Writing The Task Pack

These are the decisions that should be made before converting this into an implementation task pack:

1. **Hot-path policy**
   Optimize the happy path for persistent-process usage, while keeping one-shot CLI behavior correct even if less improved.

2. **Handshake strategy**
   Do not remove handshake logic entirely in the first pass. Replace "always full broadcast probe" with a tiered approach only after the contract is decided:
   - cached recent-ready state when valid
   - otherwise cheaper host-side probe if sufficient
   - full probe only when needed

3. **Diagnostic preservation**
   Preserve explicit user-facing failures for:
   - device not interactive
   - accessibility service unavailable
   - operator or package unavailable

4. **Invalidation rules**
   Define cache invalidation rules exhaustively in the task pack.

5. **Validation matrix**
   Require both unit tests and a small live-device validation matrix for the blocked states above.

## EM-Level Recommendation

The handshake does not need to stay deferred forever, but it does need one planning pass before it becomes an execution phase. The gap is not that the code path is unknown. The gap is that we have not yet locked the product and contract decisions around:

- what readiness guarantees we want
- what diagnostics we need to preserve
- where caching is acceptable
- what live validation proves the change is safe

That makes this a good candidate for a dedicated planning-and-implementation task rather than an opportunistic optimization bundled into the immediate snapshot I/O cleanup.
