# Clawperator

Clawperator is an Android operator runtime app for LLM-controlled device automation.

## Current State
This repository is the post-migration Clawperator runtime:
- Android-first runtime shell app
- Single activity
- Controlled by OpenClaw/agent command ingress
- Legacy ActionTask migration plans removed from active docs

## Run Locally
From repo root:

```bash
./gradlew :app:assembleDebug
./gradlew testDebug
./gradlew :app:installDebug
adb shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity
```

## Notes
- Firebase/FCM backend and ingestion paths were removed in migration Slice 3.1.

## Key Docs
- `docs/operator-llm-playbook.md`
- `docs/project-overview.md`
