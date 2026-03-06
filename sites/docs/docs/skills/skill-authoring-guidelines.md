# Skill Authoring Guidelines (v0.1 PoC)

## Core Doctrine: Generic Actuator

**Clawperator is the Hand; the Agent is the Brain.**

1.  **Generic Interface:** The clawperator CLI/Node API knows nothing about specific apps. It only executes Execution JSON payloads.
2.  **External Logic:** All app-specific logic (selectors, navigation flows, data parsing) MUST live in this clawperator-skills repository.
3.  **Plain Node.js (.js):** Skills should primarily be authored in Plain Node.js (.js scripts). This ensures a lightweight, high-performance environment with zero compilation overhead.
4.  **Migrating from Bash:** New skills MUST be authored in Node.js. Existing Bash-based skills SHOULD be migrated when they require significant updates or grow in complexity. Prefer opportunistic migration over big-bang rewrites.

---

## 1. The Deterministic Lifecycle (Close-Sleep-Open)

To ensure a predictable starting state, every skill MUST follow this sequence as its first set of actions:

```json
[
  { "id": "close", "type": "close_app", "params": { "applicationId": "com.example" } },
  { "id": "wait_close", "type": "sleep", "params": { "durationMs": 1500 } },
  { "id": "open", "type": "open_app", "params": { "applicationId": "com.example" } },
  { "id": "wait_open", "type": "sleep", "params": { "durationMs": 8000 } }
]
```

*   **Why Close?** Apps often cache state (previous searches, deep-linked tabs). Force-closing ensures the app starts on its true Home screen.
*   **How it works:** The **Clawperator Node CLI** automatically intercepts close_app actions and performs a genuine adb shell am force-stop **before** dispatching the command to the device.
*   **Why the 1.5s Sleep?** Android needs a moment to fully clean up the process after a force-stop before it can be reliably reopened.
*   **Why the 8s Sleep?** 8 seconds is a conservative default for slow-to-initialize apps (e.g. retail). Treat this as a guideline: tune `durationMs` per app for reliability, keeping it consistent across that app's skills.

---

## 2. Navigating Decoy UI Elements

Many apps use fake UI elements on the home screen that act as triggers for the real interaction.

*   **The Search Bar Trap:** Often, the search bar on a home screen is just a TextView or Button styled to look like a field. Clicking it navigates to a new screen or opens an overlay with the real EditText.
*   **Strategy:** 
    1.  click the decoy bar (often identifiable by textContains: Search).
    2.  sleep for 1-2s.
    3.  enter_text into the real field (identifiable by role: textfield or a specific resourceId).

---

## 3. Selector Strategy

1.  **resourceId is King:** Always prefer resourceId (e.g., com.woolworths:id/search_src_text). It is the most stable selector across device locales.
2.  **textEquals for Buttons:** Use textEquals for precise matches on menu items or specific labels.
3.  **Avoid Coordinates:** Never use raw x,y coordinates. They break across different screen resolutions and aspect ratios.

---

## 4. Reliable Node.js Patterns

*   **Safe Payloads:** Use Node.js to build Execution objects as native literals and JSON.stringify() them to avoid shell escaping issues.
*   **Robust Parsing:** Never assume XML attribute order in UI snapshots. Use attribute-independent regex: 
    `const match = line.match(/^(?=[^>]*\bresource-id="[^"]*target_id")(?=[^>]*\btext="([^"]*)")[^>]*>/);`
*   **Error Handling:** Check `execFileSync` errors for `e.stdout` and `e.stderr` (converted from Buffers to strings) to provide meaningful failure messages.

---

## 5. Compliance and Security (Blocked Terms)

**CRITICAL:** To protect user privacy and project integrity, the following must NEVER be hardcoded in scripts or documentation:

1.  **Personal Paths:** Never include /Users/name/. Use relative paths or temporary directories.
2.  **Device Serials:** Never hardcode your physical device ID. Pass the device ID as a command-line argument.
3.  **PII:** Use placeholders like Person or AC_TILE_NAME for any user-specific data.

**Validation Command:**

grep -rE "Users/|[0-9A-Fa-f]{16}" .


---

## 6. Mandatory Metadata

Every Execution payload sent by a skill MUST include:
*   **expectedFormat**: Must be "android-ui-automator".
*   **timeoutMs**: Set a realistic timeout (e.g., 90000 for complex flows).
