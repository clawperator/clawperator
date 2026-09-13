# Notification/media fixture

The debug-only, shell-permission-protected fixture plays generated local MP4
content using MediaPlayer and publishes a MediaSession. Its private JSON sample
records actual player position independently from the report, with screen state
and screen-on/off broadcast counters. No personal accounts or downloaded media
are required. The fixture source is compiled into the debug Operator only.

Build the matching CLI/APK and provision the selected emulator using operator
setup, then run from the repository root:

```sh
python3 validation/notifications-media/run.py --device <device_serial> --output /tmp/notification-proof --secure-lock --controls
```

Requirements: adb, Python 3, ffmpeg with H.264/AAC encoders, and the matching debug
Operator. The run starts a controlled activity, tests pause/play, freezes its
published PLAYING report while pausing actual playback, turns off the screen, and
queries beyond the readiness-cache TTL. It retains all completed command evidence
on failure. Screen-on counters must remain unchanged during observation.

The harness also compares HTTP `/execute` and the typed helper with the frozen
player report. Normal CI runs Node and Android offline tests. The notifications-media workflow
is manual, not a PR/push emulator job. This fixture proof is not by itself the
entire task-pack matrix or real-browser compatibility evidence; record those
separately. Do not claim actual playback from an extrapolated position.

`--secure-lock` runs all three reads, background doctor and generic MCP while
securely locked/off, repeats with accessibility disabled and after the cache TTL,
and restores accessibility and removes its temporary PIN. It refuses physical
devices. Use only on a controlled emulator with no existing credential.
`--controls` adds same-package ambiguity, unsupported controls, expired handles,
ignored commands and replacement during a postcondition wait. Replacement is the
last test and releases the original fixture session; reinstall before repeating
that extended sequence. Neither flag is required for the basic stale-report proof.
