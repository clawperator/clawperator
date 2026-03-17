# getScreenDimensions stub in UiTreeInspectorAndroid

## Summary

`UiTreeInspectorAndroid.getScreenDimensions` always returns `Pair(0, 0)`.
It was introduced as a stub when the hierarchical UI tree build path was
added and has never been implemented.

File: `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeInspectorAndroid.kt`
Lines: ~115-123

```kotlin
private fun getScreenDimensions(service: AccessibilityService): Pair<Int, Int> =
    try {
        // For now, return 0,0 as screen dimensions are not easily accessible
        // from AccessibilityService. This can be enhanced later if needed.
        Pair(0, 0)
    } catch (e: Exception) {
        // Fallback to 0,0 if screen dimensions can't be determined
        Pair(0, 0)
    }
```

## Current impact

None. `screenWidth` and `screenHeight` are passed into `buildUiTree` but the
tree builder uses them only for offscreen detection. With both set to 0 the
detection is effectively disabled, so all nodes are treated as on-screen.
Scroll and snapshot behavior are unaffected in practice because:

- `scrollLoop` in `TaskUiScopeDefault` calls `filterOnScreenOnly` via
  `currentUiTreeFiltered()`, which relies on the filtered tree - not raw
  screen dimensions from this function.
- Snapshot output dumps the raw accessibility hierarchy regardless.

## What a real implementation should do

`AccessibilityService` does not expose `getDisplayMetrics` directly, but
screen dimensions are reachable via:

```kotlin
val wm = service.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
val metrics = WindowMetrics (API 30+) or DisplayMetrics (pre-30)
```

Example (API 30+):
```kotlin
val wm = service.getSystemService(WindowManager::class.java)
val bounds = wm?.currentWindowMetrics?.bounds
return if (bounds != null) Pair(bounds.width(), bounds.height()) else Pair(0, 0)
```

For pre-30 compatibility a `DisplayMetrics` fallback is needed.

## Why implement it

Accurate screen dimensions would allow `buildUiTree` to reliably mark
nodes outside the visible viewport as offscreen, which would make:

- `scroll_until` target detection more accurate on layouts where
  off-screen descendants leak into the raw hierarchy dump
- Future offscreen-aware filtering tighter without relying solely on
  the `filterOnScreenOnly` post-pass

## Prerequisites

- Confirm the `buildUiTree` `screenWidth`/`screenHeight` contract with the
  offscreen-detection logic in the accessibility layer before implementing.
- Add a unit test for the no-dimensions fallback path to prevent regression.
