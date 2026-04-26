# `SkillResult` Contract Survey - Across All Skills

**Date:** 2026-04-26
**Skills inspected:** 14 skill scripts that emit `[Clawperator-Skill-Result]`
**Skills repo:** `../clawperator-skills/skills/`

This document classifies the issues from `findings-claude.md` as universal, partial, or isolated, and surfaces new issues visible only across the full corpus.

---

## Quick Reference: Which Skills Have a Top-Level `result` Field

| Skill | `result` field? | Where is the answer? |
|---|---|---|
| `com.solaxcloud.starter.get-battery` | YES - `{ batteryLevelText, batteryLevel, unit, displayText }` | `result` (good) |
| `com.android.vending.install-app` | YES - `{ appTitle, installState, selectedResult }` | `result` (good) |
| `com.android.vending.search-app` | Non-standard `results` (plural, not in schema) | `results` top-level |
| `com.amazon.mShop.android.shopping.search-products` | NO | `diagnostics.results` (wrong location) |
| `com.google.android.apps.chromecast.app.get-climate-replay` | NO | `diagnostics.climate` (wrong location) |
| `com.globird.energy.get-yesterday-usage-cost-replay` | NO | `checkpoints[1].evidence.text` |
| `com.google.android.apps.chromecast.app.set-temperature-replay` | NO | `terminalVerification.observed.text` |
| `com.google.android.apps.chromecast.app.set-power-replay` | NO | `terminalVerification.observed.text` |
| `com.netflix.mediaclient.set-my-list-state-replay` | NO | `terminalVerification.observed.text` |
| `au.com.polyaire.airtouch5.set-zone-state` | NO | `terminalVerification.observed.text` |
| `com.solaxcloud.starter.set-discharge-to-limit-replay` | NO | `terminalVerification.observed.text` |
| `com.solaxcloud.starter.set-discharge-to-limit-orchestrated` | NO | harness - defers to replay |
| `com.google.android.apps.chromecast.app.control-hvac-orchestrated` | NO | harness - defers to agent |
| `au.com.polyaire.airtouch5.set-*` (shared lib) | NO | `terminalVerification.observed.text` |

---

## Universal Issues (All or Nearly All Skills)

### U-1: Finding 1 from findings-claude.md - Frame duplication in JSON mode

**Scope: CLI/runtime, not skill-specific.**

All skills are affected equally. The `[Clawperator-Skill-Result]` frame plus raw JSON are always present in `output` when the CLI runs in JSON mode. No skill can opt out. This is a bug in `skills.ts:547`, not in any individual skill script.

### U-2: Finding 2 from findings-claude.md - No top-level `result` field

**Scope: 12 of 14 skills.**

Only `get-battery` and `install-app` populate a top-level `result` field in the emitted SkillResult. All other 12 skills bury the answer in checkpoints, terminalVerification, or diagnostics. The two skills that do have a `result` field demonstrate the pattern works cleanly - agents can read `skillResult.result` directly without iteration.

This is the most widespread gap across the corpus.

### U-3: Finding 3 from findings-claude.md - Overlapping answer channels

**Scope: All read and setter skills.**

Every skill that produces a verifiable output places the answer in both `terminalVerification.observed` and the final checkpoint's `evidence`. On setter skills, the two values are identical. On read skills, one may be raw (e.g. `"-$3.10"`) and the other labeled (e.g. `"GloBird yesterday usage cost: -$3.10"`). No skill documents which one is canonical.

---

## New Issues Visible Only Across the Full Corpus

### N-1: High - `diagnostics` used as the primary result carrier by two skills

**Affected:**
- `com.google.android.apps.chromecast.app.get-climate-replay` - the climate object (device name, power state, temperature, mode, fan speed) is at `skillResult.diagnostics.climate`. This is the primary output of the skill and the most structurally complex answer in the corpus.
- `com.amazon.mShop.android.shopping.search-products` - the structured product list is at `skillResult.diagnostics.results`.

**Why this is a problem.** `diagnostics` is documented and designed as internal-state context: runtime health, warnings, hints, paths taken. An agent scanning the contract for "where is the result?" has no reason to look in `diagnostics`. An agent that skips diagnostics (reasonable given the field name and intended purpose) silently misses the entire output for these two skills.

**Root cause.** Both skills produce structured data that doesn't fit cleanly in `terminalVerification.observed.text`. The `json` evidence kind would work, but authors instead reached for `diagnostics` as an untyped overflow bag.

**Smallest fix.** Both skills should move their primary output into a top-level `result` field (see U-2). `diagnostics.climate` becomes `result: { climate: {...} }`. `diagnostics.results` becomes `result: { items: [...] }`. The diagnostics field retains only genuinely diagnostic content.

**Backward-compatibility risk.** Agents or orchestrators currently reading `diagnostics.climate` or `diagnostics.results` would need to update. These are non-contract fields, so the risk is limited to known consumers.

### N-2: High - `terminalVerification.observed` used as the result carrier for structured data

**Affected:**
- `com.google.android.apps.chromecast.app.get-climate-replay` - `terminalVerification.observed` is `{ kind: "json", value: climate_object }`. The full structured climate object is embedded in a verification artifact.
- `com.android.vending.search-app` - `terminalVerification.observed` is `{ kind: "json", value: results_array }`.

**Why this is a problem.** `terminalVerification` is a proof artifact: "did the declared matcher pass?" Embedding the primary output inside the observed field of a verification struct is semantically wrong. An agent reading the contract will correctly understand `terminalVerification` as verification status and may not extract the structured value from it. For the two skills above, the only machine-parseable structured output is inside a verification field.

**Contrast.** `set-temperature-replay` correctly uses `terminalVerification.observed.text` to carry a simple scalar ("24") for verification. The `json` kind in `observed` is a separate pattern that conflates verification with result delivery.

**Smallest fix.** Move the structured value to a top-level `result` field. `terminalVerification.observed` can then refer to it by reference or carry a simple human-readable summary for the matcher check.

### N-3: Medium - `results` (plural) at the top level is a non-contract extension

**Affected:**
- `com.android.vending.search-app` - emits `results: [...]` at the root of the SkillResult JSON.

**Why this is a problem.** The `SkillResult` schema (`skillResult.ts:97-108`) does not define a `results` field. The CLI runtime accepts it because schema validation only runs on the *emitted* frame, and extra fields pass Zod's `passthrough` behavior. But an agent reading the contract from docs or the type definition has no reason to know `results` exists at this location for this skill. It's effectively a private convention invisible to the general contract.

**The Play Store and Amazon inconsistency.** `search-app` (Play) puts results at `root.results`. `search-products` (Amazon) puts results inside `diagnostics.results`. Two search skills with the same conceptual output use entirely different locations. An agent trying to use both skills would need separate knowledge of each.

**Smallest fix.** Standardize on a top-level `result` field (consistent with U-2 fix). `search-app` moves its `results` array under `result.items`. `search-products` moves `diagnostics.results` to the same location.

### N-4: Medium - `get-climate-replay` places the primary answer in three separate locations

**Affected:** `com.google.android.apps.chromecast.app.get-climate-replay` only.

The climate object appears at:
1. `skillResult.diagnostics.climate` (structured, object)
2. `skillResult.checkpoints[2].evidence.value` (JSON kind, same object)
3. `skillResult.terminalVerification.observed.value` (JSON kind, same object)

Three copies of the same structured data in three different locations with three different semantics. An agent has to know which one to trust and which fields within each are stable. This is the worst single-skill case in the corpus.

**Root cause.** The skill was authored with a rich checkpoint structure and verification proof, then the climate object was also put in diagnostics for agent convenience. The result is triple-redundancy with no documented canonical location.

**Smallest fix.** One `result: { climate: {...} }` field replaces all three. Checkpoint evidence can reference it; terminalVerification can use a simple text summary for the matcher.

### N-5: Medium - Checkpoint construction patterns are inconsistent across skills

Two distinct patterns exist:

**Map/state-machine pattern** (pre-populated with `"skipped"`, then updated):
- `set-temperature-replay`, `set-power-replay`, `set-discharge-to-limit-replay`, `get-climate-replay`
- Emits all declared checkpoints including skipped ones - gives a complete audit trail

**Push-based pattern** (empty array, appended as the skill progresses):
- `install-app`, `search-app`, `search-products`, `set-my-list-state-replay`, `set-zone-state`, `get-battery`
- Only emits checkpoints that were reached - later checkpoints are absent on failure

**Why this matters.** An agent iterating `checkpoints` to find a specific id gets different behavior: Map-based skills always have the id present (with `status: "skipped"`), push-based skills may not have it at all. An agent checking `checkpoints.find(c => c.id === "terminal_state_verified")` gets `undefined` on early failure with push-based skills, and `{ status: "skipped" }` on Map-based skills. These require different null-handling logic.

**Smallest fix.** Document the two patterns explicitly. Long term, standardize on Map/state-machine pattern to guarantee all declared checkpoint ids are always present in the output.

### N-6: Low - `diagnostics` is conditionally absent on `set-discharge-to-limit-replay`

**Affected:** `com.solaxcloud.starter.set-discharge-to-limit-replay` only.

`buildSkillResult` does not include `diagnostics` in its return value. The field is attached later only when `diagnostics.warnings.length > 0`:

```js
const result = buildSkillResult(status, terminalVerification);
if (diagnostics.warnings.length > 0) {
  result.diagnostics = diagnostics;
}
```

On a clean run with no warnings, `diagnostics` is absent from the emitted SkillResult. On a run with warnings, it is present. An agent checking `result.skillResult.diagnostics?.warnings` gets `undefined` on success and an array on partial failure.

**Smallest fix.** Include `diagnostics` unconditionally in `buildSkillResult`, defaulting to `{ warnings: [] }` when there are none.

### N-7: Low - Netflix `terminalVerification.expected === observed` on success

**Affected:** `com.netflix.mediaclient.set-my-list-state-replay` only.

On success, the emitted frame sets both `expected` and `observed` to the identical string: `"${title} :: My List state=${desiredState}"`. This defeats the purpose of having separate expected and observed fields - the verification shows no contrast between what was anticipated and what was actually read from the device.

This is a consequence of the skill reading the state from a snapshot and encoding it the same way for both sides. The `observed` field should contain what the device actually reported; `expected` should be what the skill declared it was looking for.

**Smallest fix.** Set `expected` to a generic description (e.g. `"${title} :: My List toggled to ${desiredState}"`) and `observed` to the actual snapshotted state text.

---

## Summary: What Is Isolated vs. Universal

| Finding | Scope | Skills |
|---|---|---|
| Frame duplication in JSON mode (F1) | **Universal** - CLI bug | All 14 |
| No top-level `result` field (F2) | **Near-universal** | 12 of 14 |
| Overlapping answer channels (F3) | **Universal** for skills with output | ~12 |
| `output` field undefined for JSON (F4) | **Universal** - CLI | All 14 |
| `diagnostics` as result carrier (N-1) | **Isolated** | get-climate, search-amazon |
| `terminalVerification.observed` carries structured data (N-2) | **Isolated** | get-climate, search-play |
| Non-contract `results` field at root (N-3) | **Isolated** | search-play only |
| Answer in three locations (N-4) | **Isolated** | get-climate only |
| Inconsistent checkpoint construction (N-5) | **Semi-universal** | ~half the skills |
| `diagnostics` conditionally absent (N-6) | **Isolated** | discharge-replay only |
| `expected === observed` on success (N-7) | **Isolated** | netflix only |

---

## Most Actionable Fixes, in Order

1. **CLI fix (F1)**: Strip the frame from `output` in JSON mode - one line in `skills.ts`. All consumers benefit immediately.
2. **Contract fix (F2)**: Add `result?: SkillCheckpointEvidence | null` to `SkillResult` schema. Then:
   - `get-climate-replay`: move `diagnostics.climate` to `result`
   - `search-products`: move `diagnostics.results` to `result.items`
   - `search-app`: move root `results` to `result.items`
   - All read skills: populate `result` with their primary scalar or object answer
3. **Skill fix (N-1 + N-4)**: `get-climate-replay` is the worst single case. Fixing that skill first collapses three overlapping locations into one and moves the answer out of `diagnostics`.
4. **Skill fix (N-6)**: `set-discharge-to-limit-replay` - include `diagnostics` unconditionally.
5. **Skill fix (N-7)**: `set-my-list-state-replay` - differentiate `expected` from `observed`.
6. **Convention fix (N-5)**: Document the two checkpoint construction patterns and pick one as canonical for new skills.
