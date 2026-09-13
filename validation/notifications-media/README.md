# Notification/media fixture

The shell-permission-protected fixture is a separate test APK
(`com.clawperator.fixture.media`). It plays generated local MP4 content using
MediaPlayer and publishes a MediaSession. Its private JSON sample records actual
player position independently from reports, power transitions and control counts.
Killing the Operator therefore does not kill the evidence source. The fixture is
not packaged in either Operator variant and requires no personal account.

Build the matching CLI, Operator and fixture from the repository root:

```sh
npm --prefix apps/node run build
./gradlew :app:assembleDebug :notification-media-fixture:assembleDebug
```

Provision the selected emulator through `operator setup`, install the fixture APK
from `validation/notifications-media/fixture/build/outputs/apk/debug/`, and grant
its `android.permission.POST_NOTIFICATIONS` on API 33+. Then run:

```sh
python3 validation/notifications-media/run.py --device <device_serial> --output /tmp/notification-proof --secure-lock --controls
python3 validation/notifications-media/ingress-shade.py --device <device_serial> --output /tmp/notification-proof/ingress
python3 validation/notifications-media/first-unlock.py --device <device_serial> --output /tmp/notification-proof/first-unlock
```

Requirements: adb, Python 3, ffmpeg with H.264/AAC encoders, and a controlled
emulator without an existing credential. The extended speed proof requires API
23+; offline service tests cover API 21 and 28. The first-unlock proof reboots the
selected emulator and requires a platform with credential-encrypted user storage.
Both credential tests remove their temporary PIN in cleanup. The locked matrix
also restores the original accessibility settings.

The basic run tests actual pause/play, 1x/2x reports, buffering and unknown
positions, then freezes a PLAYING report while actual playback stops and resumes.
It queries beyond the readiness-cache TTL with independent power-event counters.
HTTP and typed-helper results are compared with the fixture. `--secure-lock`
adds CLI, background doctor and generic MCP reads, actually unbound accessibility,
notification post/update/removal, permission revocation, reconnection and Operator
process recovery. `--controls` covers ambiguity, unsupported/expired handles,
ignored commands and session replacement during a postcondition wait. A new run
restarts only the fixture, so repeated runs do not require reinstallation.

`ingress-shade.py` uses SystemUI's independent state dump to check an open shade.
It directly exercises Android broadcast ingress with accessibility unavailable,
proving mixed lists in both orders and UI-only lists fail without a partial prefix.
`first-unlock.py` checks specific CLI/doctor/MCP errors before first unlock.
Each script retains completed evidence on failure. Never infer actual playback
from an extrapolated position or infer no transient wake from endpoint state alone.

Normal CI runs offline Node/Android tests. The notifications-media workflow is
manual (`workflow_dispatch`) and runs this live sequence. It is not a PR/push
emulator job. Real browser compatibility is separate: `browser/index.html` uses
native audio controls and displays HTMLAudioElement.currentTime. Serve it with a
generated local `tone.wav`; it does not fabricate MediaSession reports.
