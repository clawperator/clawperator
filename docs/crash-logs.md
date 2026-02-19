# Crash Logs (Backup Capture)

## Why this exists
ActionTask is intended to run indefinitely on a dedicated, always‑powered Android device. If the process crashes or is killed before Crashlytics uploads, we still need a local record that survives restarts.

## What we added
- A process‑wide uncaught exception handler writes crashes to an **append‑only** file in app storage.
- A minimal “session start” and low‑memory markers are appended for context.
- Crashlytics remains enabled and continues to receive reports.

## Where the backups live
The local crash backup file is stored in internal app storage:
```
files/crash-log.txt
```
Full device path (varies by package):
```
/data/data/<package>/files/crash-log.txt
```

## How to fetch the log (adb)
Replace `<package>` with your app ID (e.g., `actiontask.app`).

View directly:
```bash
adb shell run-as <package> cat files/crash-log.txt
adb shell run-as app.actiontask.operator.development cat files/crash-log.txt
```

Copy to Downloads for easier access:
```bash
adb shell run-as <package> cp files/crash-log.txt /sdcard/Download/crash-log.txt
```

## Notes
- The file is append‑only by design and is **not** pruned or rotated.
- If you don’t see a file yet, it will be created on first write (e.g., on app start or crash).
