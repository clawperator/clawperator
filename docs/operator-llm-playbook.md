# Operator LLM Playbook (Definitive)

This is the canonical reference for LLM-driven automation in Clawperator.

Use this doc for:
- running the app through `ACTION_AGENT_COMMAND`
- authoring/maintaining skill packages
- integrating skill scripts with OpenClaw
- understanding runtime components and naming

---

## 1) Runtime components (production)

These are runtime components (not debug-only):

- `clawperator.operator.runtime.OperatorCommandService`
- `clawperator.operator.runtime.OperatorCommandReceiver`

They own broadcast ingress for:
- `app.clawperator.operator.ACTION_AGENT_COMMAND`

---

## 2) Command ingress contract

### Reliability rule (required)
For app automation commands, default to:
1. `close_app`
2. `open_app`
3. wait for stabilization
4. add small post-navigation settle delays (~500–1500ms) before critical reads/clicks

Send commands via Android broadcast with `payload` JSON:

```bash
adb shell am broadcast \
  -a app.clawperator.operator.ACTION_AGENT_COMMAND \
  -p com.clawperator.operator.dev \
  --es payload '{"commandId":"cmd-1","taskId":"task-1","source":"operator","timeoutMs":90000,"actions":[{"id":"s1","type":"snapshot_ui","params":{"format":"ascii"}}]}' \
  --receiver-foreground
```

### Required fields
- `commandId: string`
- `taskId: string`
- `source: string`
- `actions: []`

### Supported action types (current)
- `open_app`
- `close_app`
- `sleep`
- `wait_for_node`
- `click`
- `scroll_and_click`
- `read_text`
- `snapshot_ui`

### Visual verification with ADB screenshots (recommended)
Use screenshots alongside UI-tree logs when building/debugging skills.

```bash
adb exec-out screencap -p > ./tmp/ui-check.png
```

---

## 3) Skills-first packaging (PII-safe)

Canonical unit is a skill package, not a standalone recipe file.

### Required structure
- `skills/<applicationId>.<intent>/SKILL.md`
- `skills/<applicationId>.<intent>/scripts/*.sh`

### Optional structure
- `skills/<applicationId>.<intent>/artifacts/*.recipe.json`

### Rules
1. No PII in committed skill artifacts.
2. Use variables/placeholders for user-specific labels (for example `{{AC_TILE_NAME}}`).
3. Prefer stable selectors first (`resourceId`), text matching second.
4. Keep fallback matching strategy documented in `SKILL.md`.
5. Keep skill-specific scripts/artifacts inside the skill folder (not top-level `scripts/`).

---

## 4) Current skill set

- `com.google.android.apps.chromecast.app.get-aircon-status`
- `com.google.android.apps.chromecast.app.set-aircon`
- `com.globird.energy.get-usage`
- `com.solaxcloud.starter.get-battery`
- `com.theswitchbot.switchbot.get-bedroom-temperature`

---

## 5) New skill authoring checklist

1. Start from a fresh app session (`close_app` then `open_app`).
2. Capture `snapshot_ui` and an ADB screenshot.
3. Identify robust selectors (`resource-id` first).
4. Create `skills/<appId>.<intent>/SKILL.md`.
5. Add `scripts/*.sh` deterministic wrapper(s).
6. Add optional `artifacts/*.recipe.json` template(s) if helpful.
7. Validate on device end-to-end.
8. Update this playbook if conventions changed.

---

## 6) Where to update docs

- Skill model/design: `docs/skill-design.md`
- Canonical LLM/operator usage: `docs/operator-llm-playbook.md` (this file)
- App-specific skill packages: `skills/<applicationId>.<intent>/...`
