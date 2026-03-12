# Follow-up items from press_key implementation

Gaps and observations identified during GAP-05 implementation. Items are ordered by
actionability.

---

## ITEM-01: Document press_key service-unavailable failure mode in node-api-for-agents.md

**Status:** Closed (2026-03-12)

**Gap:** The existing `press_key` behavior note said it "throws a hard config error if the
service is unavailable" but did not explain what that means for the agent at the envelope
level. An agent submitting `[click, press_key back, snapshot_ui]` gets `status: "failed"`
with zero step results - not a per-step `success: false` it can branch on.

**Resolution:** Updated `press_key` behavior note in `docs/node-api-for-agents.md` to
explicitly state that an unavailable accessibility service produces a top-level
`status: "failed"` envelope with no `stepResults`, and directs agents to
`clawperator doctor` for diagnosis.

---

## ITEM-02: Add explicit comment in validateExecution.ts explaining doctor_ping exclusion

**Status:** Open

**Gap:** `UiAction.DoctorPing` exists in the Android sealed interface and is parseable
by `AgentCommandParser`, but `doctor_ping` is absent from `supportedTypes` in
`validateExecution.ts` and from `CANONICAL_ACTION_TYPES` in `aliases.ts`. Without a
comment, a future contributor seeing it in the Android code might try to expose it
through the Node API, not realizing the design intent.

**Context:** `doctor_ping` is intentional internal-only. The `doctor` command bypasses
`validateExecution` entirely - it builds the payload manually and calls
`broadcastAgentCommand` directly. Agents submitting via `execute` correctly get
`EXECUTION_ACTION_UNSUPPORTED`. This is by design.

**Fix:** Add a short comment in `validateExecution.ts`'s `supportedTypes` array
(and optionally in `aliases.ts`) marking `doctor_ping` as intentionally excluded from
the public agent API, and explaining which internal path uses it.

---

## ITEM-03: Scan other modules for commonTest source set exclusion

**Status:** Closed - no other affected modules found

**Gap identified during implementation:** `operator.gradle.kts` was missing
`src/commonTest/kotlin` from its test source set, silently excluding parser tests.

**Audit result (2026-03-12):** All other modules with `srcDirs` definitions were
checked. No other module has a `src/commonTest/kotlin` directory without a
corresponding `srcDirs` entry. The operator module was the only affected module and
was fixed as part of this PR.

---

## ITEM-04: CLI shorthand for press_key

**Status:** Future / low priority

**Gap:** The `action` CLI subcommand family (`action open-app`, `action click`,
`action type`, etc.) has no shorthand for `press_key`. Agents using the CLI
interactively must fall back to `execute --execution` for navigation actions.

**Deferred:** Adding a new `action press-key --key <back|home|recents>` subcommand
requires changes to the CLI command registry and help text. Low urgency since the
`execute` path works. Revisit when adding other `action` shorthands.
