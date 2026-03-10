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

- `com.clawperator.operator.runtime.OperatorCommandService`
- `com.clawperator.operator.runtime.OperatorCommandReceiver`

They own broadcast ingress for:
- **Action Namespace:** `com.clawperator.operator.ACTION_AGENT_COMMAND` (stable)
- **Package Target:** Varies by build (e.g., `com.clawperator.operator` or `com.clawperator.operator.dev`)

---

## 2) Command ingress contract

### Reliability rule (required)
For app automation commands, default to:
1. `close_app`
2. `open_app`
3. wait for stabilization
4. add small post-navigation settle delays (~500–1500ms) before critical reads/clicks

### Required fields
- `commandId: string`
- `taskId: string`
- `source: string`
- **`expectedFormat: "android-ui-automator"`** (Required for v1 compatibility)
- `actions: []`

### Determinism Doctrine
1. **Validation First:** No side effects if the payload is malformed.
2. **Exactly One Envelope:** Every command must emit a `[Clawperator-Result]`.
3. **No Retries:** The runtime never retries a failed step; it reports the failure immediately to the Brain.
4. **Stable IDs:** Correlate `commandId` and `taskId` end-to-end.

---

### Supported action types (current)

| Action type | Key params | Notes |
| :--- | :--- | :--- |
| `open_app` | `applicationId: string` | Launches app by package ID |
| `close_app` | `applicationId: string` | Node runs `adb shell am force-stop` pre-flight; Android step always returns `success: false` (expected) |
| `enter_text` | `matcher: NodeMatcher`, `text: string`, `submit?: boolean` | CLI: `action type`. `submit: true` presses Enter after typing |
| `click` | `matcher: NodeMatcher`, `clickType?: "default"\|"long_click"\|"focus"` | CLI: `action click` |
| `read_text` | `matcher: NodeMatcher` | CLI: `action read`. Result in `data.text` |
| `wait_for_node` | `matcher: NodeMatcher` | CLI: `action wait`. Waits with internal retry |
| `snapshot_ui` | - | CLI: `observe snapshot`. Snapshot content in `data.text` as `hierarchy_xml` |
| `scroll_and_click` | `target: NodeMatcher`, `container?: NodeMatcher`, `direction?`, `maxSwipes?`, `distanceRatio?`, `settleDelayMs?`, `findFirstScrollableChild?` | Scrolls until target is visible, then clicks |
| `sleep` | `durationMs: number` (max 120000) | Pause between steps |

**`enter_text` vs CLI `action type`:** The CLI command is `action type` but the action type field in execution payloads is `enter_text`. These map to the same runtime action. When building execution payloads directly, always use `enter_text`.

**NodeMatcher fields:** `resourceId`, `contentDescEquals`, `textEquals`, `textContains`, `contentDescContains`, `role`. All fields are AND-combined. Prefer `resourceId` when available. Full reference in `docs/node-api-for-agents.md`.

### Visual verification with ADB screenshots (recommended)
Use screenshots alongside UI-tree logs when building/debugging skills.

```bash
adb exec-out screencap -p > ./tmp/ui-check.png
```

---

## 3) Skills-first packaging (PII-safe)

Canonical unit is a skill package, not a standalone recipe file.

### Required structure
Skills are maintained in a dedicated sibling repository: `../clawperator-skills`.
Each skill follows this structure:
- `skills/<applicationId>.<intent>/SKILL.md`
- `skills/<applicationId>.<intent>/scripts/*.sh`

### Nature of Skills
Due to the dynamic nature of mobile apps (A/B tests, server-side flags, unexpected popups), skills are treated as **highly informed context** for the Agent rather than purely deterministic scripts.
- **Agent Responsibility:** The Agent uses skill templates as a baseline, modifying them at runtime to handle personal configurations (variable substitution) or UI drift.

### Rules
1. No PII in committed skill artifacts.
2. Use variables/placeholders for user-specific labels (for example `{{AC_TILE_NAME}}`).
3. Prefer stable selectors first (`resourceId`), text matching second.
4. Keep fallback matching strategy documented in `SKILL.md`.
5. Keep skill-specific scripts/artifacts inside the skill folder.

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

- Skill model/design: `docs/design/skill-design.md`
- Canonical LLM/operator usage: `docs/design/operator-llm-playbook.md` (this file)
- App-specific skill packages: `skills/<applicationId>.<intent>/...`
