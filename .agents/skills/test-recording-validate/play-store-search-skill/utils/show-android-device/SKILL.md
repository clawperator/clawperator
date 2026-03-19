---
name: utils.show-android-device
description: Launch scrcpy for a connected Android device in read-only mode for observation during automation runs.
---

Launches `scrcpy` in detached, read-only mode (`--no-control`) so the mirrored window cannot send touch/keyboard input.

Run:

```bash
cd "$(git rev-parse --show-toplevel)"
./skills/utils/show-android-device/scripts/launch_scrcpy_readonly.sh
```

Optional (target specific device):

```bash
./skills/utils/show-android-device/scripts/launch_scrcpy_readonly.sh <device_id>
```

Prerequisites:

- `adb` installed and available on `PATH`
- `scrcpy` installed and available on `PATH`
- at least one connected Android device (`adb devices`)

Output:

- Success: `Launched scrcpy in read-only mode for device <id>`
- Failure: descriptive dependency/device error
