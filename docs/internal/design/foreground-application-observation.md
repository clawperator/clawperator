# Foreground application observation

`ForegroundApplicationObserver` is the reusable Android application-identity
source. It is registered as one Koin singleton, independent of recording,
Node execution, and snapshot capture. It does not resolve application metadata
or render templates. Consumers collect `observe(displayId)` and cancel their
collection when they no longer need updates. The default display ID is 0;
consumers on another display must pass that display's ID.

## State and resolution policy

The flow starts with `ForegroundApplicationState.Unavailable` until a successful
current-window read establishes `Available(packageName, displayId)`. Its first
delivered value can be either state.
Unavailable is a current state, not a request to reuse the last package.
Repeated equal states are suppressed per collector. Pending delivery is
conflated: a slow consumer receives the latest state instead of a backlog of
obsolete application identities. A fresh subscription does
not replay cached application identity.

Resolution reads accessibility window metadata and the package on current
application roots, without traversing child nodes or capturing a hierarchy:

1. A locked keyguard yields unavailable.
2. Restrict windows to the requested display. On API 30 and later, use
   `windowsOnAllDisplays`; older platforms support only default display 0.
3. Exclude input-method windows and the exact Operator-owned overlay identity
   supplied by `OperatorOverlayIdentity`. Do not exclude the entire Operator
   package: its ordinary activity is an eligible application.
4. If any remaining active or input-focused window is not `TYPE_APPLICATION`,
   report unavailable. This prevents a current system panel, split divider,
   window control, or unrelated accessibility overlay from revealing an app
   underneath as current. Merely visible, inactive system bars do not block it.
5. Prefer the unique input-focused application window. If none is focused,
   accept the unique active application window. Input focus takes precedence
   over a different application's active flag, which can lag during switching.
   Accessibility focus and visual stacking alone are not application identity.
6. Read the selected root's nonblank package. Missing roots, conflicting focus,
   no eligible current window, and read exceptions produce unavailable. Never
   fall back to an arbitrary visible/background application or event package.

Home and recents can report the launcher when it owns a verified application
window. An application-type permission dialog can report the permission
controller's package. A system-type panel reports unavailable. There is no
package-name denylist and no assumption that every system-owned UI is a panel.

This policy is separate from public snapshot foreground metadata, which still
uses `rootInActiveWindow`. `UiTreeInspectorAndroid` and its public contracts are
unchanged. An observer identity is not evidence that a snapshot captured that
same application, and snapshot semantics must not be inferred from this flow.

## Events, lifetime, and concurrency

`OperatorAccessibilityService` forwards existing accessibility ingress and its
connection/destruction callbacks. Its runtime mask now includes
`TYPE_WINDOWS_CHANGED`, and it explicitly requests interactive windows. The
XML declaration also includes window-change events. Existing recording event
handling remains in place.

Reconciliation is triggered by windows changed, window state changed, view
focused, clicked, text changed, and window content changed. Event package names
are never used as identity. In particular, split-screen focus can change
without a launch or a view-focus event; window-change ingress is essential.

All observer lifecycle and registration mutations run on the main dispatcher.
Collection can start on any dispatcher. Collectors share one read per requested
display per reconciliation. Reads use the attached service, never a separately
looked-up service that could belong to another connection.

Every new request, attachment, detachment, or final unsubscribe invalidates the
previous generation and cancels its job. Before publishing, a read checks both
the generation and service identity. Even a read that ignores cancellation
cannot publish after being superseded. A delayed destruction callback from an
old service cannot detach its replacement. Detach emits unavailable; existing
collectors survive reconnection and receive a fresh read. Cancellation removes
the subscriber, and closed channels cannot deliver late results.

Unavailable reads get at most two retries, after 100 ms and another 250 ms.
This allows a transient null root to recover without requiring another event.
Retries stop on success or cancellation. After exhaustion the state stays
unavailable until another relevant event or connection/subscription change.
There is no continuous polling. With no subscribers there are no observer
window/root reads or retries. The existing service can still do its unrelated
recording and debug work.

## Live evidence

Verified on 2026-09-19 using the requested **Pixel 10 Pro Fold AVD**, identified
by the emulator console AVD name and `hw.device.name=pixel_10_pro_fold` before
targeting its discovered serial. Its generic Android model string alone does
not identify the hardware profile. The image was Android 37.2 Google APIs Play
Store, ARM64 with 16 KB pages, unfolded on display 0 at 2076 x 2152.

The matching debug APK was built and installed. A bounded, privileged debug
activity, `ForegroundObservationProofActivity`, collected the production
observer inside Android after the activity itself finished. No recording was
started. Branch-local Node commands explicitly selected the discovered device
and `com.clawperator.operator.dev` for setup, overlay set/clear, and snapshot
verification. They did not poll or drive foreground changes. Shell launches,
key events, taps, and real soft-key taps exercised Android input independently.

| Scenario | Expected and observed |
| --- | --- |
| Initial collection | Unavailable, then current verified application |
| Two visible panes | Settings and Chrome alternated correctly for 10 normal and 12 rapid taps, with no app launch commands during the run |
| Final timing run | Another 20 alternating Settings/Chrome taps all matched; 8 slower and 12 rapid switches, approximately 270 ms apart in the rapid segment |
| Input in either pane | Settings search (`com.google.android.settings.intelligence`) and Chrome received soft-key input; focus followed both directions while the IME remained visible |
| Keyboard and Operator panel | Neither `com.google.android.inputmethod.latin` nor the touch-through Operator overlay replaced the focused application |
| Home and recents | `com.google.android.apps.nexuslauncher` while its application window owned focus |
| Split entry/exit | Transient unavailable during window replacement, then the verified focused application; returning through recents and ordinary app switching also updated |
| Notification shade | Unavailable while the shade owned active/focus, then the underlying application after collapse |
| Permission dialog | `com.google.android.permissioncontroller` for Chrome's application-type notification permission dialog; no stale Chrome identity |
| Screen off and lock screen | Unavailable, including while the visible non-credential keyguard was shown; fresh application identity after unlock |
| Service reconnect | Same consumer emitted unavailable on service destruction and launcher identity after reattachment; final reconnect resolved 37 ms after connection callback |

For the final 20-switch run, **event-to-observation latency was 103-107 ms**.
The pre-tap marker-to-observation interval was 151-172 ms; this includes shell
input overhead and is a different measurement. Event timestamps and consumer
timestamps both use Android uptime. The existing service notification timeout
is 100 ms. These are measurements, not a delivery deadline or instantaneous
update guarantee. Startup, animations, root reads, main-thread load, and debug
diagnostics can take substantially longer; earlier Chrome first-run transition
logs included delays over one second.

After adding latest-state conflation for slow consumers, the final APK passed
another four ordinary Chrome/Settings switches. Event-to-observation intervals
were 109-118 ms, but input-marker intervals ranged from 298 to 1856 ms. This
follow-up encountered a 32-second cold activity launch and unrelated Android
hardware-service crashes in the emulator logs. Attempts made before the debug
consumer and accessibility service were confirmed running are excluded. The
slow-consumer backlog behavior itself is covered by the controlled regression
test; the live consumer deliberately collects promptly.

Raw local evidence consists of monotonic logcat, expected-input markers,
consumer transitions, accessibility/window dumps, screenshots, setup state,
and a generated `final-focus.json`. The final report links its local directory;
private device identifiers and raw device evidence are not committed.
Independent window dumps confirmed input focus during the slower sequences.
`validation/foreground-observation/analyze.py` compares a selected marker prefix
with observed transitions and reports both latency measures. It fails when a
labelled transition is missing; it does not certify that a tap actually landed
in the intended pane. Its parser regression tests run in the validation CI suite.

### Limits and failed input attempts

- Chrome first-run onboarding opened its main activity outside the original
  split pair. The measured runs used the settled main activity after re-pairing.
- The IME moves pane geometry. A fixed-coordinate repeated-input attempt hit
  the wrong pane and then a Settings search result. It is retained as failed
  test input, not counted as a passing focus run. Independent window dumps
  agreed with the observer; inspected single-step soft-key input in both panes
  supplied the valid keyboard evidence. Settings search really is a different
  installed package from Settings, not an observer error.
- This AVD initially disabled keyguard. A non-credential lock screen was
  temporarily enabled for the lock check and restored afterward. Credential
  authentication, biometric unlock, vendor lock screens, and physical-device
  timing were not tested.
- Display selection and pre-API-33 service configuration have controlled test
  coverage; live verification used display 0 only. The pre-API-30 reader adapter
  was not live-verified. The emulator exposes two physical
  displays, so screenshots required an explicit SurfaceFlinger display ID.
- Android may batch rapid events and skip intermediate states that no read
  observes. This flow describes sampled current identity, not an exhaustive
  history of every focus transition. Missing platform events can leave an
  observation unchanged until the next relevant event; there is no periodic
  polling fallback.

## Repeating the proof

Build from the repository root with `./gradlew :app:assembleDebug`. Discover the
serial with `adb devices -l`, confirm it with `adb -s <device_serial> emu avd name`,
and install that APK on the explicitly selected emulator. Save accessibility,
notification-listener, notification permission, screen timeout, and keyguard
settings before changing them. Enable the debug service using the branch-local
Node permission command with both device and Operator-package flags.

Start `adb -s <device_serial> logcat -v monotonic` into a local evidence file, then
launch the debug consumer:

```bash
adb -s <device_serial> shell am start \
  -n com.clawperator.operator.dev/clawperator.operator.debug.ForegroundObservationProofActivity \
  --el duration_ms 600000
```

The activity requires Android's `DUMP` permission and exists only in debug
builds. Duration is clamped to 1-600000 ms. Starting it again replaces the old
collection; its timeout cancels collection. `ForegroundObservationProof` logs
states and window evidence; `ForegroundObservationEvent` logs event/ingress
uptime only in debug builds while there is a subscriber.

Open a settled split pair, inspect pane bounds, and mark each intended focus
change before interacting:

```bash
adb -s <device_serial> shell log -t ForegroundExpected \
  focus-0 expected=com.android.chrome
```

Repeat in both directions, including rapid interaction and soft-key input.
Preserve screenshots and window dumps so wrong coordinates cannot masquerade
as observer failures. Analyze the chosen sequence:

```bash
python3 validation/foreground-observation/analyze.py <local_log_file> --prefix focus-
```

Clear the panel, stop the consumer (a 1 ms replacement is sufficient), and
restore saved settings. Do not commit raw device logs or screenshots.

## Automated coverage

`ForegroundApplicationObserverTest` covers selection, split focus in both
directions, keyboard and exact overlay exclusion, system panels, locks, null
and blank packages, ambiguity, display isolation, bounded retries, deduplication,
initial subscription, shared subscriptions, slow-consumer delivery, cancellation, late non-cancellable
reads, and service replacement. A regression test changes panes using only
`TYPE_WINDOWS_CHANGED` while its event package names a keyboard.
`OperatorAccessibilityServiceTest` checks the event mask and interactive-window
flag. Existing recording, overlay, and snapshot tests remain applicable.

Validation commands are run from the repository root, where `gradlew` lives:

```bash
./gradlew :app:assembleDebug :app:testDebugUnitTest \
  :shared:data:operator:testDebugUnitTest :shared:test:testDebugUnitTest
python3 -m unittest discover -s validation/foreground-observation
./scripts/docs_build.sh
```

Unit tests establish controlled selection/lifecycle behavior. They do not
replace live event-delivery, input-focus, keyboard, or keyguard evidence.
