# Skill Authoring Guidelines

## Core doctrine

**Clawperator is the hand. The agent is the brain.**

1. **Generic interface:** The Clawperator CLI and Node API know nothing about
   specific apps. They execute structured Clawperator payloads.
2. **External logic:** App-specific selectors, navigation flows, parsing, and
   fallback logic belong in skills.
3. **Prefer plain Node.js:** New skills should usually be authored in plain
   `.js` scripts. This keeps setup light and avoids a build step.
4. **Bash is legacy-compatible:** Existing shell skills are still valid, but
   prefer Node.js when creating new skills or doing major rewrites.

---

## 1. Deterministic baseline state

To ensure a predictable starting state, most app skills should begin with a
close-sleep-open sequence:

```json
[
  { "id": "close", "type": "close_app", "params": { "applicationId": "com.example" } },
  { "id": "wait_close", "type": "sleep", "params": { "durationMs": 1500 } },
  { "id": "open", "type": "open_app", "params": { "applicationId": "com.example" } },
  { "id": "wait_open", "type": "sleep", "params": { "durationMs": 8000 } }
]
```

- **Why close first:** Apps often preserve prior navigation state, cached
  searches, or half-completed flows.
- **How it works today:** The Clawperator Node CLI intercepts `close_app` and
  issues `adb shell am force-stop` before dispatching the execution to Android.
- **Why the short sleep:** Android needs a moment to finish process teardown
  before the reopen is reliable.
- **Why the longer open sleep:** Cold app startup is often the slowest part of
  a flow. Tune `durationMs` per app for reliability.

Use judgment. Some skills should not force-close if the intent depends on
preserving user state.

---

## 2. Skill folder layout

Use `clawperator skills new <skill_id>` for the fastest path to a valid starter
skill. It creates the folder, starter files, and registry entry for you.

You can still create a skill manually if needed.

Minimal layout:

```text
skills/<skill_id>/
  SKILL.md
  skill.json
  scripts/
    run.js
```

Optional layout:

```text
skills/<skill_id>/
  SKILL.md
  skill.json
  scripts/
    run.js
  artifacts/
    example.recipe.json
```

Recommended conventions:

- Use one folder per reusable intent.
- Keep selectors, parsing logic, and output formatting inside the skill folder.
- Keep helper modules local to the skill unless they are broadly reusable.

---

## 3. `skill.json` contract

Each skill should have a `skill.json` file and a matching entry in the local
skills registry.

Current fields:

| Field | Required | Meaning |
| :--- | :--- | :--- |
| `id` | Yes | Globally unique skill identifier. Usually `<applicationId>.<intent>`. |
| `applicationId` | Yes | Android package primarily targeted by the skill. |
| `intent` | Yes | Short action label such as `capture-overview` or `get-aircon-status`. |
| `summary` | Yes | One-sentence description shown in discovery output. |
| `path` | Yes | Skill folder path relative to the skills repo root. |
| `skillFile` | Yes | Human-readable doc path, usually `skills/<skill_id>/SKILL.md`. |
| `scripts` | Yes | Script entrypoints relative to the skills repo root. `clawperator skills run` prefers `.js`, then `.sh`, then the first listed script. |
| `artifacts` | Yes | Optional deterministic `.recipe.json` templates relative to the skills repo root. Use `[]` when none exist. |

Example:

```json
{
  "id": "com.android.settings.capture-overview",
  "applicationId": "com.android.settings",
  "intent": "capture-overview",
  "summary": "Open Android Settings, capture a UI snapshot, and save an ADB screenshot path.",
  "path": "skills/com.android.settings.capture-overview",
  "skillFile": "skills/com.android.settings.capture-overview/SKILL.md",
  "scripts": [
    "skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh"
  ],
  "artifacts": []
}
```

---

## 4. Registry and private skill discovery

`clawperator skills list`, `skills get`, `skills search`, `skills validate`,
and `skills run` all read from one local registry JSON file.

Current runtime behavior:

- The registry path comes from `CLAWPERATOR_SKILLS_REGISTRY` when set.
- If the env var is unset, the CLI falls back to the local
  `skills/skills-registry.json` path for the current checkout or install.
- The runtime currently supports one registry path at a time.
- The runtime does not currently support multiple registries or a remote URL as
  the registry source.

A private skill becomes discoverable only after:

1. Its folder exists.
2. The configured registry JSON includes an entry for it.

If `clawperator skills list` cannot see your new skill, verify:

- `echo $CLAWPERATOR_SKILLS_REGISTRY`
- the registry file exists at that path
- the `skills[]` entry uses the correct relative `path`
- `skillFile`, `scripts`, and `artifacts` point at real files

Before a live device run, use:

```bash
clawperator skills validate <skill_id>
```

This is an integrity check for the registry entry and on-disk files. It does
not exercise the target Android app.

When you want a registry-wide sanity check, use:

```bash
clawperator skills validate --all
```

This validates every configured skill entry in one pass and returns a summary
of any broken paths or metadata mismatches.

For the full explore -> scaffold -> validate -> live-run workflow, see
`skill-development-workflow.md`.

---

## 5. Scripts vs. artifacts

Scripts and artifacts solve different problems.

Use a script when the skill needs:

- branching logic
- retries or fallback behavior
- `snapshot_ui` parsing
- extra host-side steps such as screenshots or file writes
- custom output formatting

Use an artifact when the skill is mostly a deterministic execution template and
you only need variable substitution.

An artifact is a `.recipe.json` file that compiles into a Clawperator execution
payload through `clawperator skills compile-artifact`.

Artifacts are a good fit for:

- stable navigation templates
- fixed execution recipes with a few variables
- deterministic observe or execute flows

Scripts remain the better fit for full workflows.

---

## 6. Navigating decoy UI elements

Many apps use fake home-screen controls that only open the real interaction.

- **Search bar trap:** A home-screen "search bar" is often just a button or
  text view that opens a separate screen with the real text field.
- **Reliable pattern:**
  1. click the decoy
  2. sleep briefly
  3. target the real field by `resourceId` or semantic role

---

## 7. Selector strategy

1. **`resourceId` is best:** Prefer `resourceId` whenever available. It is
   usually the most stable selector across locale changes.
2. **Use exact text selectively:** `textEquals` is useful for stable menu items
   or obvious labels.
3. **Use substring text when needed:** `textContains` is useful for dynamic or
   truncated labels.
4. **Avoid coordinates:** Raw `x,y` targeting is fragile across devices and
   layouts.

---

## 8. Reliable Node.js patterns

- **Safe payloads:** Build execution objects as native JavaScript objects and
  `JSON.stringify()` them.
- **Robust parsing:** Do not assume XML attribute order in snapshots.
- **Structured error handling:** Parse `stdout` and `stderr` from failed
  Clawperator subprocesses before throwing away useful diagnostics.

Recommended pattern:

```js
import { execFileSync } from "node:child_process";

function runClawperator(args, timeoutMs = 120000) {
  try {
    const stdout = execFileSync("clawperator", args, {
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(stdout);
  } catch (err) {
    const stdout = err?.stdout?.toString?.("utf8") ?? "";
    const stderr = err?.stderr?.toString?.("utf8") ?? "";

    if (stdout) {
      try {
        return JSON.parse(stdout);
      } catch {
        // Keep falling through to the explicit error below.
      }
    }

    throw new Error(stderr || err.message || "clawperator command failed");
  }
}
```

Why this matters:

- Long-running scroll or install flows can exceed an overly aggressive
  script-level timeout.
- `execFileSync` may throw even when Clawperator already emitted useful JSON to
  `stdout`.
- Recovering `err.stdout` often preserves the best available structured result.

`clawperator skills run` currently applies a 120000 ms wrapper timeout by
default. Use `--timeout-ms <n>` when a specific run needs a tighter or looser
wrapper budget. Keep your own script timeout at or above the expected flow
duration so the wrapper can return structured output. When the wrapper does fail or time out,
Clawperator preserves partial script `stdout` and `stderr` in the structured
error payload when available.

Start with these rough execution budgets when choosing `timeoutMs` inside a
skill:

- `15000`-`30000` for short single-screen work
- `30000`-`60000` for targeted Settings-style scroll flows
- `60000`-`90000` for multi-screen navigation on real devices
- `90000`-`120000` only for genuinely long bounded flows

When a flow keeps drifting toward the ceiling, split it into multiple
observe-decide-execute rounds instead of pushing every skill toward one large
monolithic execution.

---

## 9. Compliance and security

Never hardcode:

1. personal local paths
2. device serials
3. user PII

Use placeholders such as `<device_id>`, `<person_name>`, or `AC_TILE_NAME`.

Validation command:

```bash
grep -rE "Users/|[0-9A-Fa-f]{16}" .
```

---

## 10. Mandatory execution metadata

Every execution payload sent by a skill must include:

- `expectedFormat`: must be `"android-ui-automator"`
- `timeoutMs`: set a realistic timeout, for example `90000` for complex flows

Also remember:

- `timeoutMs` is execution-wide, not per action.
- The public API currently validates `timeoutMs` in the 1000 to 120000 ms
  range.
- Split very long workflows into multiple executions rather than relying on one
  oversized timeout.
- Use the public timeout budgeting guide when calibrating new skills:
  [Clawperator Timeout Budgeting](https://docs.clawperator.com/reference/timeout-budgeting/).
