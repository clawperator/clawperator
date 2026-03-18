# Record Feature - Implementation Progress

This file is for implementation findings, plan deviations, and cross-phase decisions discovered during development. It is not a diary and it is not final documentation.

**Write here when:**
- Phase 0 measurements produce concrete numbers
- An assumption in the PRD turns out to be wrong
- A design decision diverges from the plan (capture the actual choice and why)
- An edge case appears in real recordings that the plan did not anticipate
- A constraint from an existing system affects what Phase 2 or 3 can do
- Something is deferred or deprioritized - note what and what it unblocks

**Do not write here:**
- Polished prose or explanations of already-documented design
- Status updates ("working on X")
- Intentions ("next I will...")
- Things that belong in `docs/` or the PRD once settled

**Format:** Date, phase, bullet findings. Short. Operational.

---

## Template

```
## YYYY-MM-DD
### Phase N

- [finding or decision]
- [deviation from plan and actual choice made]
- [impact on next phase if any]
```

---

<!-- Entries below this line, newest first -->

## 2026-03-19
### Phase 0

- Added debug-only `RecordingDiagnosticHook` on the Android AccessibilityService path. It logs event rates, per-event handler wall time, `getRootInActiveWindow()` timing for `TYPE_VIEW_CLICKED` and `TYPE_WINDOW_STATE_CHANGED`, interrupt timestamps, and click snapshot correctness to logcat under `RecordingDiag`.
- Flow 1 baseline tap navigation on `emulator-5554` / Settings: `TYPE_VIEW_CLICKED=2`, `TYPE_WINDOW_STATE_CHANGED=5`, `KEYCODE_BACK=0 observed`. `getRootInActiveWindow()` timings: `TYPE_VIEW_CLICKED min/avg/max = 55.4/56.6/57.7 ms`, `TYPE_WINDOW_STATE_CHANGED min/avg/max = 0.9/7.9/17.3 ms`. Snapshot correctness: `2 of 2 sampled clicks had the clicked element present in the snapshot`. Delivery warnings: none observed. Caveat: adb-driven back presses navigated correctly but did not surface `onKeyEvent()`, so Phase 0 captured no `KEYCODE_BACK` timing samples on the emulator.
- Flow 2 scroll-heavy on `emulator-5554` / Settings: observed `TYPE_VIEW_SCROLLED` peak rates of `2.58/s` during repeated fling-and-settle, `5.11/s` during sustained slow up/down scrolling, and `6.97/s` during the fastest fling burst. `TYPE_VIEW_SCROLLED` handler wall time across the flow: `min/avg/max = 1.3/11.3/459.6 us` over `78` samples. Delivery warnings: none observed.
- Flow 3 rapid text input used the allowed substitute path because adb-driven input into Play Store search did not emit `TYPE_VIEW_TEXT_CHANGED` on this setup. Substitute: `com.google.android.settings.intelligence/.modules.search.SearchActivity` on `emulator-5554`, focused `EditText`, 24-character query. Normal typing (`250 ms` inter-key): peak `TYPE_VIEW_TEXT_CHANGED` rate `3.76/s`. Fast typing via adb (`50 ms` inter-key) coalesced updates and peaked at `2.91/s`; a zero-gap attempt collapsed further and was discarded. `TYPE_VIEW_TEXT_CHANGED` handler wall time across the accepted flow: `min/avg/max = 2.4/18.7/146.4 us` over `25` samples. Delivery warnings: none observed.
- Decision row: "`getRootInActiveWindow()` consistently under 300ms for step-candidate events at human interaction speed" -> `APPLIES` (`TYPE_VIEW_CLICKED max 57.7 ms`, `TYPE_WINDOW_STATE_CHANGED max 17.3 ms` in Flow 1).
- Decision row: "`getRootInActiveWindow()` exceeds 300ms or causes delayed event delivery warnings" -> `DOES NOT APPLY` (`max 57.7 ms`; no delivery warnings observed in Flows 1-3).
- Decision row: "Scroll event throughput saturates the handler even without snapshots" -> `DOES NOT APPLY` (`TYPE_VIEW_SCROLLED peak 6.97/s`; handler `avg 11.3 us`; no delivery warnings observed).
- Decision row: "`TEXT_CHANGED` events at realistic typing speed cause measurable handler delay" -> `DOES NOT APPLY` (`TYPE_VIEW_TEXT_CHANGED normal peak 3.76/s`; handler `avg 18.7 us`, `max 146.4 us`; no delivery warnings observed).
- Decision row: "For click events, snapshot frequently reflects the post-navigation state rather than the pre-click state" -> `DOES NOT APPLY` (`2/2` sampled clicks contained the clicked element in the captured snapshot).
- Final decision: `Candidate A - Synchronous capture on event thread`. Phase 0 measurements stayed well below the 300 ms viability threshold and click correctness was `2/2`, so there is no evidence-based reason to pay the async timing-window cost in Phase 1.
