# Clawperator

<img src="docs/img/clawperator-logo.png" width="200" height="200" alt="Clawperator logo" />

Clawperator is an Android operator runtime app for LLM-controlled device automation.

## Current State
This repository is the post-migration Clawperator runtime:
- Android-first runtime shell app
- Single activity
- Controlled by OpenClaw/agent command ingress

## Run Locally
From repo root:

```bash
./gradlew :app:assembleDebug
./gradlew testDebug
./gradlew :app:installDebug
adb shell am start -n com.clawperator.operator.dev/clawperator.activity.MainActivity
```

## Key Docs
- `docs/operator-llm-playbook.md`
- `docs/project-overview.md`
