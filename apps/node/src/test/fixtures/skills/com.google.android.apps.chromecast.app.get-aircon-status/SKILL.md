---
name: com.google.android.apps.chromecast.app.get-aircon-status
description: Read Google Home air conditioner status (power/mode/indoor temp) on Android using ActionTask generic agent actions. Use when asked for current aircon status.
---

Use the skill-local script:

```bash
cd "$(git rev-parse --show-toplevel)"
AC_TILE_NAME="YOUR_AC_TILE_NAME" ./skills/com.google.android.apps.chromecast.app.get-aircon-status/scripts/get_aircon_status.sh
```

Optional custom card label:

```bash
./skills/com.google.android.apps.chromecast.app.get-aircon-status/scripts/get_aircon_status.sh app.actiontask.operator.development "YOUR_AC_TILE_NAME"
```

Expected output:

`AC status (...): power=<...>, mode=<...>, indoor_temp=<...>`

Prerequisite:
- Ensure `adb` is installed and available on `PATH`.
