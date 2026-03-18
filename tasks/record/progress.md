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
### Phase 1

- `start_recording` and `stop_recording` now dispatch through the production execution path, write NDJSON on device under `/sdcard/Android/data/<applicationId>/files/recordings/`, and update a `latest` pointer file on successful stop. Verified on both `emulator-5554` and a physical Samsung device.
- End-to-end NDJSON validation: emulator tap flow (`phase1-emu-main2.ndjson`) wrote `24` lines total (`1` header + `23` events) with event mix `window_change=12`, `click=5`, `scroll=6`; emulator text flow (`phase1-emu-text.ndjson`) wrote `41` lines total with `window_change=12`, `scroll=11`, `text_change=17`; physical tap flow (`phase1-physical-main.ndjson`) wrote `37` lines total with `window_change=10`, `click=3`, `scroll=23`. In all sampled files, `seq` was monotonic with no gaps, step-candidate events had non-null `snapshot`, and `scroll` / `text_change` records carried explicit `"snapshot": null`.
- Physical-device `TYPE_VIEW_CLICKED` `getRootInActiveWindow()` timing stayed consistent with the emulator decision for synchronous capture. Samsung Settings click samples observed via `RecordingDiag` ranged from `4.4 ms` to `49.7 ms` (`avg 20.5 ms`, `7` samples). This does not challenge the Phase 0 Candidate A decision.
- Combined IPC + serialization cost on the event thread remained below the Phase 0 guardrail in sampled click flows, but serialization is a material part of the total. Observed `SNAPSHOT_TIMING` click totals: emulator Settings `Notifications` `184.3 ms` (`root 22.4 ms + serialize 162.0 ms`), physical Samsung Settings `Connected devices` `70.9 ms` (`root 69.5 ms + serialize 1.3 ms`), physical Samsung Settings `Connections` `100.2 ms` (`root 99.6 ms + serialize 0.6 ms`). No sampled click exceeded `300 ms`. Serialization exceeded the PRD's extra-watch threshold once on the emulator (`162.0 ms` on `Notifications`), so Phase 2+ should keep logging this split when diagnosing slow screens.
- Click correctness aggregate reached the requested `10` samples across emulator and physical device. `RecordingDiag` logged `CORRECTNESS PASS` for `10 of 10` sampled clicks: emulator Settings (`Notifications`, `Battery`, `Apps`, `Network & internet`, `Connected devices`) and physical Samsung Settings (`Connected devices`, `Connections`, `Galaxy AI`, `Modes and Routines`, `Sign in to your Galaxy`).
- Physical-device scroll smoke closed the Phase 0 emulator-only gap. The Samsung Settings recording produced `23` `scroll` events, with an observed peak of `10` scroll events within a one-second window during the swipe portion of the smoke. Scroll records remained cheap because they carried `snapshot: null`.
- Event mask decision: kept `TYPE_VIEW_SCROLLED` in the production accessibility event mask. Recording mode needs scroll events in NDJSON, and both Phase 0 and Phase 1 measurements showed scroll handling stays inexpensive when no snapshot is taken.
- Deviation from PRD implementation assumptions: requesting key filtering required a static capability declaration in `accessibility_service_config.xml` (`android:canRequestFilterKeyEvents="true"`). Setting `FLAG_REQUEST_FILTER_KEY_EVENTS` at runtime alone was not sufficient.
- RECORDING_EMPTY decision: changed `stop_recording` with zero captured events to return a successful `Stopped` outcome with `eventCount = 0` instead of an error. An empty file is still a valid recording lifecycle, and callers can branch on `eventCount` without treating the stop itself as a failed execution.
- Open issue: `KEYCODE_BACK` is still not present in production recordings from adb-driven back navigation, even on the physical device after adding the key-filtering capability declaration. Physical recordings consistently show the resulting `window_change` events but no `press_key` record. Phase 1 therefore has production recording working for click / scroll / text_change, but true back-key capture remains unverified in this autonomous test environment and likely needs a real user or hardware-originated back press to close with confidence.

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
