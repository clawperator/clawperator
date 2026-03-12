# EM Verification Pass: Scroll API

## Scope
Review target: `claude/inspiring-pare`
Goal: Perform a critical EM-level verification of the scroll API implementation, docs, Node contracts, and related skills.

## What I verified
1. **Code & Contract Inspection:** Reviewed `TaskUiScopeDefault.kt`, `UiActionEngine.kt`, Node API contracts, and validation logic.
2. **Builds & Tests:** Ran Android unit tests, Node tests, and built both projects successfully.
3. **Smoke Tests:** Executed `./scripts/clawperator_smoke_scroll.sh` on an emulator (`<device_id>`). The test correctly navigates Settings, reaches the bottom edge, scrolls back up to the top, and strictly matches the initial UI signature.
4. **Skills Verification:** Executed the Settings-related skill in the sibling repo (`../clawperator-skills/skills/com.android.settings.capture-overview`) against the live emulator to ensure it produces the expected `TEXT_BEGIN`/`TEXT_END` and `SCREENSHOT|path=...` markers without failing strict validation.
5. **Documentation Audit:** Cross-checked `docs/node-api-for-agents.md` against the actual runtime limits enforced in `validateExecution.ts` and the Kotlin enums.

## Findings

Claude's fixes were accurate and the branch is now highly stable. 

### Confirmed Fixes (from Claude's pass)
- **`scrollOnce` signature fallback:** Empty containers now correctly return `edge_reached` instead of misclassifying as `moved`.
- **Node Contract:** `TARGET_FOUND` was properly removed from `scroll_until` exports.
- **Smoke script:** The `clawperator_smoke_scroll.sh` script is reliable. It explicitly targets the correct RecyclerView and parses XML output robustly via a node helper.
- **Settings skill:** The skill works flawlessly against the current Clawperator contract. It correctly drives the UI, emits the `RESULT|...` line, and writes the screenshot to disk as promised.

### Additional Verification Checks
- **Container Loss Handling:** I verified how `scrollLoop` handles a container disappearing mid-loop (e.g., from an app navigating away). It catches the `IllegalStateException` and returns `EDGE_REACHED`. Crucially, this behavior is already explicitly called out to agents in `docs/node-api-for-agents.md` under the "Current runtime caveat" section, meaning agents will not be misled.
- **Validation Bounds:** `validateExecution.ts` properly catches out-of-bounds parameters for both `scroll` and `scroll_until` (e.g., `maxScrolls` within `[1, 200]`).

## Follow-up Work (Separate PRs)
I agree with Claude's assessment that these should not block the current PR. They are distinct issues that warrant their own scope:

1. **Improve container auto-detection heuristics:** "First scrollable node" is brittle on nested layouts like Samsung Settings (where a `ScrollView` wraps a `RecyclerView`).
2. **Introduce `CONTAINER_LOST` termination reason:** Distinguish true edge exhaustion from mid-loop container loss in `scrollLoop()`. While currently documented as falling back to `EDGE_REACHED`, a distinct error state would allow agents to explicitly detect app navigation drift.
3. **Scrub legacy `format` in `clawperator-skills`:** A global sweep of the skills repository is needed to remove any remaining usages of the deprecated `snapshot_ui.params.format`, which now triggers `EXECUTION_VALIDATION_FAILED` due to the new strict schema.

## Conclusion
The branch correctly implements the standalone `scroll` and bounded `scroll_until` actions. The testing and documentation gaps are resolved. The code is ready for merge.