# Skills Follow-up TODO

This file captures sibling-repo cleanup work that should survive deletion of branch-specific review notes.

## 1. Sweep `clawperator-skills` for legacy `snapshot_ui.params.format`

### Problem

The current Clawperator contract no longer accepts `snapshot_ui.params.format`.

During review, one Settings skill had already drifted and failed strict validation until it was fixed. Additional sibling-repo assets still appear to use the old payload shape and are likely to fail for the same reason.

### Why it matters

- Skills can fail immediately with `EXECUTION_VALIDATION_FAILED`.
- Skill docs and examples can mislead agents into sending invalid payloads.
- A partial cleanup is risky because some skills may appear healthy while others remain broken under the same contract drift.

### Expected follow-up scope

Run a dedicated sweep in `../clawperator-skills` to:

- find all uses of legacy `snapshot_ui.params.format`
- update artifacts, scripts, examples, and `SKILL.md` docs to the current contract
- verify each touched skill against the current Clawperator runtime
- confirm expected output markers and screenshot/text artifacts still match the documented behavior

### Known examples previously identified

- `skills/com.globird.energy.get-usage/scripts/get_globird_usage.js`
- `skills/com.globird.energy.get-usage/artifacts/usage.recipe.json`
- `skills/com.solaxcloud.starter.get-battery/artifacts/battery.recipe.json`

This list may not be exhaustive. Re-scan the whole skills repo rather than fixing only the known examples.

### Verification standard

Do not treat "script exited 0" as sufficient.

For each touched skill, verify:

- current payload shape matches validator expectations
- documented inputs are still correct
- documented outputs are actually emitted
- screenshot and text capture paths still work when promised
- no stale examples remain in docs or artifacts
