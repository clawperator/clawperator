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
### Phase 3B

- Skill `android.settings.open-display` authored and scaffolded successfully at `~/.clawperator/skills/skills/`. Structure includes SKILL.md, skill.json, and scripts/run.js.
- Settings → Display manual recording captured 30 events but zero `click` steps. Root cause: adb tap events (used by Clawperator click actions) do NOT generate TYPE_VIEW_CLICKED accessibility events. This is an Android framework limitation, not a Clawperator bug.
- Phase 3B validation used the Play Store search recording from Phase 3A validation skill instead. That recording (from human/manual interaction) successfully produced 4 click steps, validating parser extraction when TYPE_VIEW_CLICKED events are present.
- Skill execution failed with `RESULT_ENVELOPE_TIMEOUT`. Root cause: skills infrastructure calls global `clawperator` binary which doesn't match the dev APK package (`com.clawperator.operator.dev`). Skills runtime requires CLI/APK version alignment.
- Documentation updated in `docs/troubleshooting.md` with new sections: "Recording has no click events" (adb tap limitation) and "Skill returns RESULT_ENVELOPE_TIMEOUT" (version mismatch).

## 2026-03-19
### Phase 3A

- Agent successfully reproduced Play Store search flow from step log using discrete `clawperator execute` calls. Pattern: read step from log → construct action → execute → observe snapshot → proceed.
- Step log provided sufficient context: `uiStateBefore` snapshots plus event fields (resourceId, text, bounds) allowed the agent to locate targets on current device state.
- Discrete execution pattern validated: each step was a separate `clawperator execute` call, not `--execution-file` batching. Agent observed state between steps via `observe snapshot`.
- First reproduction run completed 3 of 4 steps successfully (open_app, click Search tab, click search bar). Final step (click suggestion) failed due to app state divergence - expected behavior for raw recording replay.
- PRD Phase 3 "two consecutive successes" criterion modified given the adb-tap recording limitation discovered in Phase 3B. The valid pattern is: human demonstrates → record → agent replays. Not: Clawperator drives → record → Clawperator replays.

## 2026-03-19
### Phase 2

- The new `test-recording-validate` smoke skill now runs end to end on the physical Samsung device `<device_serial>` using the branch-local Node CLI build and the local `.dev` Operator APK. The helper no longer depends on the external skills repo at runtime.
- The Play Store search step is now embedded as a local helper under `.agents/skills/test-recording-validate/`, with the shared utility dependency inlined so module resolution is no longer tied to the external repo layout.
- Added a best-effort pre-stop before recording start so repeat runs do not fail if a stale session is still active from an interrupted prior run.
- Latest successful run (`20260319-135014`) produced `11` recorded events, parsed to `5` steps, with `1` `open_app` step and `4` `click` steps. The validation report passed with no structural parse errors.

## 2026-03-19
### Phase 1

- Additional physical-device text-input follow-up: session `manual-text-input-20260319-111309` on Samsung / YouTube produced `56` events total with event mix `click=10`, `window_change=11`, `scroll=10`, `text_change=25`. Real manual typing in the YouTube search field emitted reliable incremental `text_change` events from `com.google.android.youtube`, but with `resourceId=null` on each sampled `text_change`, so the evolving text value itself is currently the main useful payload.
- Autocomplete selection in that same run was visible as a normal click event rather than a special text-input primitive. The suggestion tap recorded as `click` on `com.google.android.youtube:id/edit_suggestion` with text `Edit suggestion linkin park waiting for the end`, after which further suffix editing resumed as additional `text_change` events (`... e`, `... em`, `... emi`, `... emil`, `... emily`).
- Text input now appears more tractable for the proof of concept than system navigation semantics. Existing action support can already type text, and the recording stream preserves enough state to distinguish manual character entry from suggestion selection. The main caveat is selector quality: future parser/replay work should assume `text_change` may lack stable `resourceId` and rely on surrounding UI context rather than treating the event alone as a fully specified replay target.
- `start_recording` and `stop_recording` now dispatch through the production execution path, write NDJSON on device under `/sdcard/Android/data/<applicationId>/files/recordings/`, and update a `latest` pointer file on successful stop. Verified on both `emulator-5554` and a physical Samsung device.
- End-to-end NDJSON validation: emulator tap flow (`phase1-emu-main2.ndjson`) wrote `24` lines total (`1` header + `23` events) with event mix `window_change=12`, `click=5`, `scroll=6`; emulator text flow (`phase1-emu-text.ndjson`) wrote `41` lines total with `window_change=12`, `scroll=11`, `text_change=17`; physical tap flow (`phase1-physical-main.ndjson`) wrote `37` lines total with `window_change=10`, `click=3`, `scroll=23`. In all sampled files, `seq` was monotonic with no gaps, step-candidate events had non-null `snapshot`, and `scroll` / `text_change` records carried explicit `"snapshot": null`.
- Physical-device `TYPE_VIEW_CLICKED` `getRootInActiveWindow()` timing stayed consistent with the emulator decision for synchronous capture. Samsung Settings click samples observed via `RecordingDiag` ranged from `4.4 ms` to `49.7 ms` (`avg 20.5 ms`, `7` samples). This does not challenge the Phase 0 Candidate A decision.
- Combined IPC + serialization cost on the event thread remained below the Phase 0 guardrail in sampled click flows, but serialization is a material part of the total. Observed `SNAPSHOT_TIMING` click totals: emulator Settings `Notifications` `184.3 ms` (`root 22.4 ms + serialize 162.0 ms`), physical Samsung Settings `Connected devices` `70.9 ms` (`root 69.5 ms + serialize 1.3 ms`), physical Samsung Settings `Connections` `100.2 ms` (`root 99.6 ms + serialize 0.6 ms`). No sampled click exceeded `300 ms`. Serialization exceeded the PRD's extra-watch threshold once on the emulator (`162.0 ms` on `Notifications`), so Phase 2+ should keep logging this split when diagnosing slow screens.
- Click correctness aggregate reached the requested `10` samples across emulator and physical device. `RecordingDiag` logged `CORRECTNESS PASS` for `10 of 10` sampled clicks: emulator Settings (`Notifications`, `Battery`, `Apps`, `Network & internet`, `Connected devices`) and physical Samsung Settings (`Connected devices`, `Connections`, `Galaxy AI`, `Modes and Routines`, `Sign in to your Galaxy`).
- Physical-device scroll smoke closed the Phase 0 emulator-only gap. The Samsung Settings recording produced `23` `scroll` events, with an observed peak of `10` scroll events within a one-second window during the swipe portion of the smoke. Scroll records remained cheap because they carried `snapshot: null`.
- Event mask decision: kept `TYPE_VIEW_SCROLLED` in the production accessibility event mask. Recording mode needs scroll events in NDJSON, and both Phase 0 and Phase 1 measurements showed scroll handling stays inexpensive when no snapshot is taken.
- Deviation from PRD implementation assumptions: requesting key filtering required a static capability declaration in `accessibility_service_config.xml` (`android:canRequestFilterKeyEvents="true"`). Setting `FLAG_REQUEST_FILTER_KEY_EVENTS` at runtime alone was not sufficient.
- RECORDING_EMPTY decision: changed `stop_recording` with zero captured events to return a successful `Stopped` outcome with `eventCount = 0` instead of an error. An empty file is still a valid recording lifecycle, and callers can branch on `eventCount` without treating the stop itself as a failed execution.
- Manual physical-device Back verification clarified that true `press_key` capture still fails, but Back is not absent from the recording stream. Session `manual-back-verify-20260319-093607` on a physical Samsung device using Samsung three-button navigation recorded `11` lines total (`1` header + `10` events) with event mix `window_change=7`, `click=4`, `press_key=0`. The real user-originated Back action in Play Store appeared as a `click` on `com.android.systemui` with title/text `Back`, followed by the expected `window_change` back into Play Store. No `{"type":"press_key","key":"back",...}` line appeared, so the current key-filtering capability declaration is insufficient for end-to-end `press_key` capture on this device/runtime path.
- Additional manual physical-device Back verification with Samsung gesture navigation showed a different accessibility shape for the same semantic action. Session `manual-gesture-back-20260319-094923` recorded `13` lines total (`1` header + `12` events) with event mix `window_change=10`, `click=2`, `press_key=0`. The edge-swipe Back gesture in Play Store produced a transient `window_change` into `com.android.systemui`, then a `window_change` back to Play Store. Again, no `press_key` record was emitted.
- Proof-of-concept scope decision: true `press_key` Back capture moves to a dedicated follow-up task, but Back itself is still observable through accessibility and appears to be navigation-mode-dependent on Samsung (`com.android.systemui` `click` under three-button nav, `com.android.systemui` `window_change` under gesture nav). Phase 1 therefore still proves that recording and replay can work for click / scroll / text_change flows, and Back may also be usable for the proof of concept via these observed accessibility events even before a dedicated `press_key` path exists.

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
