# Findings From `press_key` Review

This document captures the important review findings from the Claude implementation
of GAP-05 (`press_key`) after static review, local validation, and live device/API
testing on 2026-03-12.

The goal is to preserve the useful lessons from the review, not to keep a stale
implementation checklist around.

---

## Summary

The `press_key` feature is now working end to end for:

- `back`
- `home`
- `recents`

It validates correctly in the Node API, parses into typed Android actions,
executes through `OperatorAccessibilityService`, and is usable through both the
CLI and the HTTP `/execute` API.

The review also surfaced several places where the runtime and docs did not fully
match the assumptions an agent would naturally make.

---

## What The Review Found

### 1. Missing accessibility service originally timed out instead of failing clearly

My expectation from the plan and docs was:

- if the operator accessibility service is unavailable, the command should fail
  immediately and deterministically

What actually happened before the review fix:

- `OperatorCommandReceiver` logged the missing service and returned early
- no canonical `[Clawperator-Result]` envelope was emitted
- the Node side waited until timeout
- the agent saw a timeout-shaped failure instead of a clear configuration error

This was a real "API betrayed my assumption" moment. The docs implied a hard
failure path, but the runtime behavior looked like transport flakiness.

This has now been fixed by emitting a canonical failed envelope immediately when
the service is unavailable.

---

### 2. The Android tests originally did not cover the contract that matters most

The initial Android tests only covered:

- the hard-failure path when the service was unavailable

They did **not** cover:

- `press_key` success
- soft OS rejection via `GLOBAL_ACTION_FAILED`

That left the most important contract behavior unprotected.

The review introduced a small dispatcher seam so the JVM tests can now verify:

- success result shape
- failed step result shape for `GLOBAL_ACTION_FAILED`
- hard failure for unavailable service

This feels like the right long-term seam as well. It keeps Android-specific
global-action wiring out of the tests without changing the user-facing contract.

---

### 3. The HTTP API needed explicit `press_key` integration coverage

The feature had strong unit coverage, but the serve-mode HTTP layer did not have
targeted integration tests for:

- `press_key` validation failure behavior
- `key_press` alias acceptance at `/execute`

From an agent perspective, the HTTP surface matters as much as the internal
validation layer.

This is now covered in the Node integration suite.

---

### 4. The public docs were stale even after the source docs were updated

The authored docs in `docs/node-api-for-agents.md` had been updated, but the
generated public docs under `sites/docs/docs/` had not been regenerated.

That meant:

- the source of truth was correct
- the public docs site content was still behind

This is easy to miss in review if you only inspect authored docs.

The public docs were regenerated as part of the review follow-up.

---

## Runtime Findings From Live Testing

The feature was tested through the real Node HTTP API against the attached
Android device using the debug receiver package.

Observed working behavior:

- `press_key home` returned `success: true` and landed on launcher/home UI
- `press_key recents` returned `success: true` and showed overview/recent-apps UI
- `press_key back` returned `success: true`

Validation behavior was also confirmed:

- missing `params.key` -> `EXECUTION_VALIDATION_FAILED`
- unsupported key such as `volume_up` -> `EXECUTION_VALIDATION_FAILED`
- uppercase `BACK` -> accepted (Node validation normalizes key case with `.toLowerCase()` before matching)
- alias `key_press` -> accepted and normalized to `press_key`

---

## Agent-Usability Notes

### 1. Single-flight behavior is good, but it should be treated as part of the contract

During live testing, overlapping `/execute` requests for the same device returned:

- `EXECUTION_CONFLICT_IN_FLIGHT`

This is good behavior. It makes the API more deterministic for agents.

But it is also something an agent must know in advance, because otherwise a
parallel planner may mistake it for a transient device issue.

The docs now call this out explicitly.

---

### 2. Receiver package selection is easy to get wrong for debug builds

During testing, `doctor` defaulted to the release receiver package while the
reviewed implementation was being exercised through the debug package:

- release: `com.clawperator.operator`
- debug: `com.clawperator.operator.dev`

This is not a bug by itself, but it is a sharp edge for local testing and agent
automation.

Without explicitly setting `receiverPackage`, it is easy to validate the wrong
APK and then draw the wrong conclusion about the feature under review.

The docs now mention this more directly in the `press_key` examples.

Potential future improvement:

- make debug/release package targeting more visible in doctor output or serve-mode
  examples

---

### 3. `press_key` is still intentionally narrow

The implemented key set is:

- `back`
- `home`
- `recents`

That is the correct shape for this slice. It matches Android accessibility global
actions and keeps the actuator contract deterministic.

But from an agent perspective, there is still a functional gap:

- there is no first-class way to send non-global keys like `enter`, `search`,
  `volume_up`, or `volume_down`

That limitation is intentional, but it is worth recording as a remaining API gap
rather than pretending the hardware/system key problem is fully solved.

Potential future improvement:

- introduce a separate follow-up primitive for raw key events, with explicit
  transport and platform constraints

---

## Things That Still Feel Missing

These are not blockers for this PR, but they are the main "next gaps" the review
surfaced.

### 1. No structured top-level error taxonomy for configuration failures inside the receiver

The receiver now emits a canonical failed envelope when the accessibility service
is unavailable, which is much better than timing out.

But the top-level failure is still a free-form reason string, not a stable,
enumerated error code dedicated to that condition.

Potential future improvement:

- introduce a stable top-level error code for missing operator accessibility
  service, so agents can branch on it reliably

---

### 2. No direct API for checking operator readiness scoped to a receiver package

`clawperator doctor` is useful, but review work showed that readiness checks can
be misleading if the caller forgets to point at the same receiver package being
tested.

Potential future improvement:

- make package-scoped readiness checks easier to invoke and harder to misuse

---

### 3. No first-class machine-readable examples in the API docs for more actions

Adding concrete request/response examples for `press_key` made the feature much
easier to verify and reason about.

That suggests a broader docs improvement:

- more actions should probably have real request/response examples in the agent
  guide, not just param tables

---

## Bottom Line

The reviewed implementation was close, but runtime verification showed that the
feature was not truly PR-ready until the following were fixed:

1. canonical failure envelope on missing accessibility service
2. Android coverage for `press_key` success and soft failure
3. HTTP integration coverage for `press_key`
4. regenerated public docs with concrete examples

Those follow-ups are now complete, and this findings file is intended to capture
the reasoning so future reviewers do not need to rediscover the same edge cases.
