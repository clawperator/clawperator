# Clawperator

Clawperator is an Android operator runtime app for LLM-controlled device automation.

## Current State
This repository is in active migration from ActionTask to Clawperator.

Target end state:
- Android-first runtime shell app
- Single activity
- Controlled by OpenClaw/agent command ingress
- Legacy ActionTask systems removed unless required for operator execution

Migration plan: `docs/migrate-to-clawperator.md`

## Run Locally
From repo root:

```bash
./gradlew :app:assembleDebug
./gradlew testDebug
./gradlew :app:installDebug
adb shell am start -n app.actiontask.operator.development/actionlauncher.activity.MainActivity
```

## Notes
- `testDebug` currently has inherited baseline failures from pre-migration ActionTask code; tracked in `docs/migrate-to-clawperator.md` and `docs/migration-tracker.md`.
- Firebase/FCM backend and ingestion paths were removed in migration Slice 3.1.

## Key Docs
- `docs/migrate-to-clawperator.md`
- `docs/migration-tracker.md`
- `docs/migrate-to-agent-controlled.md`
- `docs/operator-llm-playbook.md`
