# Operator LLM Playbook (Definitive)

This is the canonical reference for LLM-driven automation in ActionTask.

Use this doc for:
- running the app through `ACTION_AGENT_COMMAND`
- authoring new app navigation recipes
- integrating recipes with OpenClaw skills
- understanding runtime components and naming

---

## 1) Runtime components (production)

These are **runtime** components (not debug-only):

- `actiontask.operator.runtime.OperatorCommandService`
- `actiontask.operator.runtime.OperatorCommandReceiver`

They own broadcast ingress for:
- `app.actiontask.operator.ACTION_AGENT_COMMAND`
- `app.actiontask.operator.ACTION_LOG_UI`
- `app.actiontask.operator.ACTION_RUN_TASK` (legacy/manual)

---

## 2) Command ingress contract

### Reliability rule (required)
For app automation commands, default to:
1. `close_app`
2. `open_app`
3. wait for stabilization
4. add small post-navigation settle delays (~500–1500ms) before critical reads/clicks

This avoids writing recipes against transient resumed UI states and intermediate screens where controls are visible but not fully hydrated yet.

Send commands via Android broadcast with `payload` JSON:

```bash
adb shell am broadcast \
  -a app.actiontask.operator.ACTION_AGENT_COMMAND \
  -p app.actiontask.operator.development \
  --es payload '{"commandId":"cmd-1","taskId":"task-1","source":"operator","timeoutMs":90000,"actions":[{"id":"s1","type":"snapshot_ui","params":{"format":"ascii"}}]}' \
  --receiver-foreground
```

### Required fields
- `commandId: string`
- `taskId: string`
- `source: string`
- `actions: []`

### Recommended fields
- `timeoutMs: long` (bounded)

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
Use screenshots alongside UI-tree logs when building or debugging recipes.

```bash
# Capture current device screen to local file
adb exec-out screencap -p > ./tmp/ui-check.png
```

Why this matters:
- UI trees can be noisy/abstract in Compose/React Native/Expo apps.
- Screenshots help confirm what is actually visible vs merely present in the tree.
- Best practice is to pair every selector change with at least one screenshot check.

---

## 3) Recipe system (PII-safe)

Store recipes under:

- `ui-trees/<applicationId>/recipe.md`
- optional executable templates like `ui-trees/<applicationId>/*-plan.template.json`

### Recipe rules
1. **No PII** (no personal names, addresses, account emails).
2. Use variables for user-specific labels:
   - `{{AC_TILE_NAME}}`
   - `{{ROOM_LABEL}}`
3. Include stable selectors first (`resourceId`), text matching second.
4. Include fallback matching strategy.
5. Document known fragile points and waits.

### Existing examples
- `ui-trees/com.google.android.apps.chromecast.app/recipe.md`
- `ui-trees/com.google.android.apps.chromecast.app/ac-status-plan.template.json`
- `ui-trees/com.theswitchbot.switchbot/recipe.md`

---

## 4) Skill integration pattern (OpenClaw)

Skills should be thin orchestration wrappers around operator commands/plans.

### Suggested structure
- `skills/<skill-name>/SKILL.md`
- call ActionTask script/broadcast
- parse result
- report concise structured output

### Current skill set
- `home-get-bedroom-temperature`
- `home-get-aircon-status`
- `home-set-aircon`

### Usage guidance
- Prefer recipe/template-backed execution (not giant inline JSON in SKILL text).
- Prefer command-level operations (`ac:status`, `ac:on`, `ac:off`) for stability.
- Validate by reading post-action state whenever changing device state.

---

## 5) New recipe authoring checklist

When adding a new app flow:

1. **Always start from a fresh app session**: close app, then open app (do not rely on resumed state).
2. Capture UI state (`ACTION_LOG_UI` or `snapshot_ui`).
3. Capture an ADB screenshot to verify the visible UI matches the tree snapshot.
4. Identify robust selectors (resource IDs first).
5. Create `ui-trees/<appId>/recipe.md` with variable placeholders.
6. Add a `*-plan.template.json` for repeatable execution.
7. Add/adjust script wrapper if needed.
8. Wire command parser/executor only if introducing a new semantic command.
9. Add/extend tests for parsing and fallback logic.
10. Verify on device end-to-end (including at least one close→open run).
11. Update this playbook if conventions changed.

---

## 6) AC commands + device name behavior

`ac:status`, `ac:on`, and `ac:off` support device label selection via `device_name`.

Matching strategy:
1. preferred: provided `device_name` (or default `AirTouch AC 1`)
2. fallback: `Master, Thermostat`

For state changes (`ac:on`/`ac:off`):
- run precheck status
- toggle only if needed
- verify final power state

---

## 7) Backward compatibility policy

- Keep action names and payload shape stable.
- Keep command aliases stable unless formally deprecated.
- If changing selector strategy, keep fallback behavior and document migration here.

---

## 8) Where to update docs

- Architecture/migration detail: `docs/migrate-to-agent-controlled.md`
- Canonical LLM/operator usage: `docs/operator-llm-playbook.md` (this file)
- App-specific navigation knowledge: `ui-trees/<appId>/...`
