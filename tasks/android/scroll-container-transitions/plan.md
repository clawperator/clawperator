# Preserve scroll scope across eligibility transitions

R11, follow-up to R6. Status: planned. One implementation PR.

## Outcome

A scroll container that remains present but ceases to report `scrollable` must not be diagnosed as disappeared. A bounded search must recognize a target revealed by its accepted gesture within the original valid scope, without switching container identity or replaying the gesture.

## Observed failure

At main `a44ad0bf`, Android 15/API 35 Settings has an outer `com.android.settings:id/settings_homepage_container` and inner `com.android.settings:id/main_content_scrollable_container`. Initially both are scrollable. Header collapse changes the outer node's scrollable flag to false while its ID and bounds remain present. The inner node remains scrollable.

`scroll-until down --text 'Display & touch' --click` fails with `CONTAINER_LOST`, an accepted gesture receipt and `container_identity_changed`, although the destination row is visible. Selecting the outer container explicitly reproduces the failure. A separate strict click followed by a wait for `Brightness level` succeeds. This is a confirmed current behavior; ID/bounds alone are not proof of platform identity.

## Contract and scope

- Separate original scope identity, current scroll eligibility, and progress comparability. Preserve platform identity where available; observation paths alone are not handles.
- Re-observe the target after an accepted gesture. When the original scope is identifiable, a now-visible unique target in that scope can satisfy the search even if that scope stopped being scrollable. `scroll_and_click` may perform its requested click once; it must not repeat the scroll to recover evidence.
- If the target remains absent, stay bounded and report a truthful existing outcome where possible. Define/document any necessary additive reason rather than calling eligibility loss disappearance or silently moving to another container.
- Preserve strict ambiguity and descendant-scoping rules. Actual disappearance/replacement and unavailable hierarchy must still fail honestly; do not compare unrelated nodes to manufacture movement.
- Preserve receipts, prior steps, cancellation and timeout bounds. Address `scroll`, `scroll_until`, `scroll_and_click`, and shared bounded loops as affected by the same resolution logic.
- Do not special-case Settings resource IDs in production code, weaken strict matching, or change screenshot/media behavior.

## Ownership and dependencies

R4/R5/R6 are merged, including R6 in `a44ad0bf` (PR #278). Implementation is independent of R12/R13. The final combined hierarchy release proof also needs their preparation and transport work; another pack's unresolved failure must not be relabeled a pass.

Sources:

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`: `scrollNode`, `scrollTarget`, `scrollOnceForTarget`, `sameScrollContainer`, `scrollLoop`.
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`: public outcome and receipt mapping.
- `apps/android/shared/test/src/test/kotlin/`: regression fixtures for task execution and scrolling.
- `validation/sensitive-hierarchy-access/run.py`: real platform reproduction; coordinate harness edits with R12.

Update `docs/api/actions.md` and `docs/internal/design/action-result-diagnostics.md` with final semantics and validation limits. Follow `.agents/skills/docs-author/SKILL.md` and the docs-build skill for public documentation. This pack does not authorize release publication.
