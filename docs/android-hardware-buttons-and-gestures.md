# Android Hardware Buttons And Gestures

This document captures runtime findings about how Android system navigation is exposed through accessibility during recording. It is a branch-local working reference for the Record proof of concept and will be updated as more physical-device tests are run.

The main question is not just "did Back happen?", but "what accessibility evidence do we get when Back or Home happens under different navigation modes, and is that evidence strong enough to reconstruct replayable intent?"

## Current Scope

These findings are based on Phase 1 recording work on:

- a physical Samsung Android device
- `com.clawperator.operator.dev`
- Play Store flows used as the manual test surface

This document currently covers:

- Samsung three-button navigation
- Samsung gesture navigation
- Google Play emulator gesture navigation
- successful Back navigation
- cancelled Back gesture navigation
- Home / launcher transitions as observed incidentally during those runs

This document does not yet claim behavior is universal across:

- Pixel / AOSP gesture navigation
- OEM skins other than Samsung
- third-party launchers
- Recents / app-switcher replayability
- long-press or predictive-back-specific variants

## High-Level Findings

- True `press_key` recording for Back is still not working end to end on the tested Samsung device.
- Back is nevertheless observable through accessibility.
- The observed accessibility shape depends on the system navigation mode.
- Samsung three-button Back appears as a `click` on `com.android.systemui`.
- Samsung gesture Back appears as a transient `window_change` into `com.android.systemui`.
- Google Play emulator gesture Back matches the Samsung gesture pattern in the current samples.
- A successful gesture Back and a cancelled gesture Back are distinguishable in the current samples.
- Home is also observable through accessibility, but not as `press_key`.

## Core Conclusion So Far

The current implementation does not yet support a normalized semantic `press_key/back` event on this device path.

However, the proof of concept is in a better place than that statement alone suggests:

- system navigation actions are still entering the recording stream
- they may be inferable as semantic navigation intent
- that inference currently appears to be mode-dependent and OEM-dependent

The immediate engineering problem is therefore:

- not "Back is missing"
- but "Back is present in non-normalized accessibility shapes"

## Test Inventory

### 1. Samsung Three-Button Navigation - Successful Back

Session:

- `manual-back-verify-20260319-093607`

Manual flow:

1. Leave Clawperator.
2. Open Play Store.
3. Dismiss Play Pass popup.
4. Open account menu.
5. Press Samsung three-button Back.

Observed event mix:

- `window_change=7`
- `click=4`
- `press_key=0`

Key sequence excerpt:

```text
0  click          com.android.systemui             "Home"
1  window_change  com.sec.android.app.launcher     "One UI Home"
2  click          com.sec.android.app.launcher     "Play Store"
3  window_change  com.android.vending              "Play Store"
8  window_change  com.android.vending              "Account and settings. Dialogue"
9  click          com.android.systemui             "Back"
10 window_change  com.android.vending              "Play Store"
```

Interpretation:

- The Samsung three-button Back action was captured.
- It was not captured as `press_key`.
- It appeared as a `click` on `com.android.systemui` with title/text `Back`.
- The follow-up `window_change` back into Play Store strongly suggests this click represents a completed Back navigation.

### 2. Samsung Gesture Navigation - Successful Back

Session:

- `manual-gesture-back-20260319-094923`

Manual flow:

1. Leave Clawperator.
2. Open Play Store.
3. Open account dialog.
4. Perform successful edge Back gesture.

Observed event mix:

- `window_change=10`
- `click=2`
- `press_key=0`

Key sequence excerpt:

```text
8  click          com.android.vending              null
9  window_change  com.android.vending              "Account and settings. Dialogue"
10 window_change  com.android.systemui             "android.view.View"
11 window_change  com.android.vending              "Play Store"
```

Interpretation:

- The successful gesture Back was captured.
- It was not captured as `press_key`.
- It was not captured as a System UI `click`.
- Instead, it appeared as a transient `window_change` into `com.android.systemui`, followed by a `window_change` back to the app's prior screen.

### 3. Samsung Gesture Navigation - Cancelled Back Gesture

Session:

- `manual-gesture-back-cancel-20260319-095545`

Manual flow:

1. System briefly entered Recents.
2. Return home.
3. Open Play Store.
4. Open account dialog.
5. Start edge Back gesture and cancel it before completion.

Observed event mix:

- `window_change=6`
- `click=2`
- `scroll=1`
- `press_key=0`

Key sequence excerpt:

```text
6 click          com.android.vending              null
7 window_change  com.android.vending              "Account and settings. Dialogue"
8 window_change  com.android.systemui             "android.view.View"
```

Interpretation:

- The cancelled gesture still produced a transient `window_change` into `com.android.systemui`.
- Unlike the successful gesture sample, there was no follow-up `window_change` back to `com.android.vending` `Play Store`.
- In the current samples, this is the clearest observable distinction between successful and cancelled gesture Back.

### 4. Google Play Emulator Gesture Navigation - Successful Back

Session:

- `emu-mainline-nav-20260319-100206`

Manual flow:

1. Start on launcher.
2. Open Play Store.
3. Open account dialog.
4. Perform successful gesture Back.

Observed event mix:

- `window_change=4`
- `click=2`
- `press_key=0`

Key sequence excerpt:

```text
0 click          com.google.android.apps.nexuslauncher  "Play Store"
1 window_change  com.android.vending                    "Play Store"
2 click          com.android.vending                    null
3 window_change  com.android.vending                    "Account and settings. Dialog"
4 window_change  com.android.systemui                   "android.view.View"
5 window_change  com.android.vending                    "Play Store"
```

Interpretation:

- The emulator did not emit `press_key`.
- The successful gesture Back matched the Samsung gesture-navigation pattern.
- A transient `com.android.systemui` `window_change` was followed by a return `window_change` into the app's previous screen.

### 5. Google Play Emulator Gesture Navigation - Cancelled Back Gesture

Session:

- `emu-mainline-nav-cancel-20260319-100404`

Manual flow:

1. Start on launcher.
2. Open Play Store.
3. Open account dialog.
4. Start gesture Back and cancel before completion so the dialog remains open.

Observed event mix:

- `window_change=3`
- `click=2`
- `press_key=0`

Key sequence excerpt:

```text
0 click          com.google.android.apps.nexuslauncher  "Play Store"
1 window_change  com.android.vending                    "Play Store"
2 click          com.android.vending                    null
3 window_change  com.android.vending                    "Account and settings. Dialog"
4 window_change  com.android.systemui                   "android.view.View"
```

Interpretation:

- The cancelled gesture still produced the transient `com.android.systemui` `window_change`.
- Like the Samsung cancelled-gesture sample, it did not produce the follow-up app transition back to Play Store.
- This strengthens the provisional success-vs-cancel discriminator for gesture Back.

## Working Inference Rules

These rules are provisional and based on the current Samsung samples only.

### Three-Button Navigation

Potential semantic Back signal:

- `click` on `com.android.systemui` with title/text `Back`

Completion evidence:

- followed by app `window_change` to the expected prior screen

### Gesture Navigation

Potential semantic Back-start signal:

- `window_change` to `com.android.systemui`

Potential successful Back completion:

- `com.android.systemui` `window_change`
- followed immediately by app `window_change` to the expected prior screen

Potential cancelled Back gesture:

- `com.android.systemui` `window_change`
- no follow-up app `window_change` back to the prior screen

## What We Can Say With Confidence

- `press_key/back` is not the only possible representation of Back in Android accessibility recordings.
- System navigation can be recorded even when the dedicated key path does not fire.
- On Samsung, Back semantics differ between three-button and gesture navigation.
- Successful and cancelled gesture Back appear distinguishable in the current samples on both Samsung gesture navigation and the Google Play emulator.

## What We Cannot Yet Claim

- That these gesture-navigation event shapes generalize to all Pixel or AOSP devices outside the tested Google Play emulator.
- That every successful gesture Back will always produce the same `com.android.systemui` transition pattern.
- That every cancelled gesture Back will always omit the follow-up app transition.
- That replay should directly click observed System UI controls.
- That a single normalized Back heuristic is ready for production.

## Implications For The Record Proof Of Concept

- The proof of concept does not need to block on dedicated `press_key/back` support.
- Non-Back flows are already valid and useful.
- Back may also be POC-usable if replay or post-processing can infer semantic Back from recorded accessibility evidence.
- Gesture Back normalization now has evidence from two surfaces: Samsung gesture navigation and a Google Play emulator.
- Any POC claim should currently be phrased as "Back is observable but not normalized."

## Recommended Near-Term Next Tests

1. Test Home under gesture navigation to determine whether it has a distinct and stable accessibility signature.
2. Test Recents intentionally, not incidentally, to separate Recents-specific transitions from Home/Back transitions.
3. Repeat cancelled gesture Back at least once more on the same Samsung device to check pattern stability.
4. Repeat successful gesture Back on a different screen and app.
5. Repeat three-button Back with a different app and target screen.
6. Test on a physical Pixel or AOSP-style gesture-navigation device if available.

## Candidate Follow-Up Design Directions

These are hypotheses, not settled design decisions.

### Option A - Keep `press_key` As The Semantic Target

- Continue pursuing true `onKeyEvent` capture for Back.
- Treat current System UI observations as fallback diagnostics only.

Pros:

- cleaner schema
- simpler replay contract

Cons:

- may not match how modern Android surfaces navigation in accessibility

### Option B - Normalize Accessibility Evidence Into Semantic Navigation

- Accept that system navigation may surface as clicks or window transitions rather than key events.
- Add post-capture or parse-time normalization that infers semantic Back from observed patterns.

Pros:

- better aligned with what the runtime is actually exposing
- more likely to work across navigation styles

Cons:

- inference logic is more complex
- OEM variation risk is higher

## Open Questions

- Should Home and Back be represented as semantic actions inferred from accessibility evidence rather than raw key events?
- Is the distinction between successful and cancelled gesture Back stable across multiple runs?
- Does predictive Back animation change the observed accessibility signal?
- Does gesture sensitivity or edge region configuration affect the signal?
- Do Pixel devices expose gesture Back differently from Samsung?

## Current Bottom Line

Back is not absent from recordings.

Back is present, but in different accessibility forms depending on navigation mode:

- Samsung three-button Back: `com.android.systemui` `click`
- Samsung gesture Back: transient `com.android.systemui` `window_change`
- Google Play emulator gesture Back: transient `com.android.systemui` `window_change`

The dedicated `press_key` path remains unresolved, but the system-navigation evidence recorded so far is strong enough to justify further testing and likely supports a proof-of-concept path based on inference and normalization.
