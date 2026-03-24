# Phase 4: Help, Errors, and Polish

**Objective:** Finalize the developer and agent experience through help text rewrite, error message improvements, and HTTP API route updates.

**Precondition:** Phase 5B (wait-for-nav, read-value, exec rename) has landed. All earlier phases complete. All tests passing.

**Context:** This phase is critical for agent discovery. An agent encountering Clawperator for the first time should be able to:
- Run `clawperator --help` and understand available commands at a glance
- Run `clawperator <command> --help` and learn how to invoke that command
- Receive clear, actionable error messages that guide them toward the correct invocation
- Use the HTTP API routes intuitively without consulting old docs

---

## Deliverable 1: Help Text Rewrite

Help text is **content and formatting only**—no infrastructure changes. The registry at `apps/node/src/cli/registry.ts` is already help-driven; we are updating what it contains.

### 1.1 Global Options Flag Order and Grouping

**File:** `apps/node/src/cli/index.ts` (specifically `generateTopLevelHelp()` function)

**What to change:**
- Flip flag order so canonical names lead:
  - `--device <id>` (primary) before `--device-id <id>` (legacy alias)
  - Apply this pattern to all aliases
- Parenthesize or remove legacy flag names in help output
- Reorganize command listing into functional groups (not alphabetical):
  1. **Device Interaction:** snapshot, screenshot, click, type, read, scroll, open, press, back, new Phase 5 commands (wait-for-nav, read-value, exec)
  2. **Device Management:** devices, doctor, emulator, packages
  3. **Execution & Automation:** exec, skills, serve
  4. **Recording:** recording, record
  5. **Setup & Diagnostics:** operator, grant-device-permissions, version, help

**Verification:**
- `clawperator --help` shows new group structure
- Group descriptions are clear (1–2 lines per group)

### 1.2 Per-Command Help Updates

**File:** `apps/node/src/cli/registry.ts`

**What to change:**
1. Update `summary` field for each command (1-line description shown in top-level help)
2. Update `help` field for each command (full help text shown by `--help`)
3. All Phase 5 new commands (wait-for-nav, read-value, exec) must have polished, complete help
4. Selector flags (e.g., `--text`, `--id`, `--index`) must be clearly documented with examples
5. Format synonyms as: "Also accepted as: <synonym1>, <synonym2>"
6. Examples in help text use simplest form (no JSON payloads)

**Specific commands to audit (minimum):**
- click, type, read, screenshot, snapshot, scroll, open, press, back
- wait-for-nav, read-value, exec (new in Phase 5)
- doctor, devices, operator

**Example of well-formatted help:**
```
click — Tap a UI element by selector or coordinates

Usage:
  clawperator click --text "Login" [--device <id>]
  clawperator click --id "btn_submit" [--device <id>]
  clawperator click --coordinate 100 200 [--device <id>]

Selector flags (choose one):
  --text <string>        Click element with matching visible text
  --id <string>          Click element with matching resource ID
  --coordinate <x> <y>   Click at exact coordinates (pixels)
  --class-name <string>  Click first element of matching class
  --xpath <string>       Click element matching XPath expression

Also accepted as: --device-id

Options:
  --timeout <ms>         Max time to wait for element (default: 10000)
  --json                 Output as JSON

Examples:
  clawperator click --text "Submit"
  clawperator click --id "login_button" --device <device_serial>
```

**Verification:**
- `clawperator click --help` shows all selector options with examples
- `clawperator read --help` clearly documents --read-text, --read-value, --read-all
- `clawperator wait-for-nav --help` shows usage pattern
- At least 5 commands show this polish level

### 1.3 Documentation Updates

**Files:**
- `docs/node-api-for-agents.md` — update CLI examples to use new help format
- Any generated site docs (run `./scripts/docs_build.sh` after changes)

**What to change:**
- CLI examples should use new canonical flag names where shown
- Reference new help output in agent guidance sections
- If a page shows old `--device-id`, update to `--device` (note alias availability)

---

## Deliverable 2: Error Message Improvements

Improve diagnostics and guidance. Errors should point toward solutions, not just describe the problem.

### 2.1 Wrong Flag Suggestions

**File:** `apps/node/src/cli/index.ts` (flag parsing logic)

**What to implement:**
- When user provides unrecognized flag, compute string similarity to known flags
- Suggest the closest match if similarity > 0.75 (Levenshtein distance ratio)
- Example user input: `clawperator click --body "text"` (meant `--text`)
- Expected output: `Error: unrecognized flag '--body'. Did you mean '--text'?`

**Implementation approach:**
- Import or implement Levenshtein distance function (see below)
- Wrap flag parsing to catch unrecognized flags
- For each unknown flag, compute distance to all known flags (global + command-local)
- If best match has distance > threshold, suggest it; otherwise just say "unrecognized"

**Levenshtein distance snippet (if not available):**
```typescript
function levenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator);
    }
  }
  return track[s2.length][s1.length];
}

function similarityRatio(s1: string, s2: string): number {
  const dist = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (dist / maxLen);
}
```

**Verification:**
- `clawperator click --body "text"` suggests `--text`
- `clawperator read --txt "value"` suggests `--text`
- Typo flags with no good match still produce clear "unrecognized" error

### 2.2 Missing Selector Error

**File:** `apps/node/src/cli/` error handler functions (search for `makeMissingSelectorError`)

**What to change:**
- When selector is required (e.g., click, read, scroll) but not provided, show full list of accepted flags with an example
- Pattern: Use existing `makeMissingSelectorError()` output (already implemented in Phase 3)
- Ensure all commands that require a selector use this pattern

**Example output:**
```
Error: click requires exactly one selector flag.

Selector options:
  --text <string>        Click element with matching visible text
  --id <string>          Click element with matching resource ID
  --coordinate <x> <y>   Click at exact coordinates (pixels)

Example:
  clawperator click --text "Login"
```

**Verification:**
- `clawperator click` (no args) shows full selector list and example
- `clawperator read` (no args) shows selector list
- Error message is actionable (user can copy-paste example and fill in values)

### 2.3 Multi-Device Without --device

**File:** Error handler for `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`

**What to change:**
- When multiple devices are connected and command does not specify `--device`, list connected devices
- Suggest retry command with `--device <serial>`
- Show device info (serial, type if known)

**Example output:**
```
Error: Multiple devices found. You must specify --device <serial>.

Connected devices:
  <device_serial_1> (physical, Android 12)
  emulator-5554 (emulator, Android 13)

Retry with:
  clawperator snapshot --device <device_serial_1>
```

**Implementation approach:**
- Catch multi-device error in main CLI handler
- Call `clawperator devices` or equivalent to list connected devices
- Format as shown above
- Keep error clear and copy-paste-friendly

**Verification:**
- With 2+ devices, running `clawperator snapshot` shows device list
- Suggested command includes chosen device serial

### 2.4 Validation Errors

**File:** Various validation handlers in `apps/node/src/cli/` and action validators

**What to change:**
- When a parameter fails validation, include task-oriented hint, not just schema path
- Example bad: `Invalid value at instance.timeout: must be integer`
- Example good: `Invalid --timeout value: must be between 100 and 600000ms`

**Commands to audit (minimum):**
- timeout values (must be positive, usually with min/max bounds)
- coordinate values (must be valid pixels)
- container selectors (must be valid xpath if provided)
- count values (must be positive integers)

**Verification:**
- `clawperator click --timeout -100` says `--timeout must be >= 100ms`, not a schema error
- `clawperator scroll --coordinate 9999 9999` says coordinates out of bounds (if applicable)

### 2.5 Consistent Error Format (Optional Polish)

**File:** Error handlers across codebase

**What to change (optional):**
- Audit handlers that return pre-stringified JSON (e.g., `makeMissingSelectorError()`)
- Optionally unify so all structured errors respect output format:
  - Without `--json`: pretty-printed error message
  - With `--json`: structured JSON with `error`, `message`, `suggestion` fields
- Note: This is polish; core error improvements (2.1–2.4) are required

---

## Deliverable 3: Update HTTP API Routes

Align HTTP API with the new CLI surface. The HTTP API is alpha/unstable with zero external consumers—rename routes for consistency.

### 3.1 Route Migrations

**File:** `apps/node/src/cli/serve.ts`

**What to change:**
- `POST /observe/snapshot` → `POST /snapshot`
- `POST /observe/screenshot` → `POST /screenshot`
- Request and response body schemas **do not change**—only route paths

**Implementation:**
```typescript
// Before:
app.post('/observe/snapshot', (req, res) => { ... })
app.post('/observe/screenshot', (req, res) => { ... })

// After:
app.post('/snapshot', (req, res) => { ... })
app.post('/screenshot', (req, res) => { ... })
```

**Unchanged routes:**
- `POST /execute`
- `GET /devices`
- Skill routes
- Emulator routes

### 3.2 Verification

**Tests:**
- HTTP API integration tests for `/snapshot` and `/screenshot` validate new routes work
- Optional: add test that old routes return 404 or redirect
- Smoke tests still pass (already updated for Phase 2)

**Curl examples (test manually):**
```bash
# Test new route
curl -X POST http://localhost:8000/snapshot \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "<device_serial>"}'

# Test new route
curl -X POST http://localhost:8000/screenshot \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "<device_serial>"}'
```

---

## Testing Checklist

Before opening a PR, verify all of the following:

### Help Text
- ✅ `clawperator --help` output shows new command groups (Device Interaction, Device Management, Execution & Automation, Recording, Setup & Diagnostics)
- ✅ `clawperator click --help`, `clawperator read --help`, `clawperator snapshot --help` show selector flags with examples
- ✅ `clawperator wait-for-nav --help` and `clawperator read-value --help` show polished help
- ✅ At least 5 commands show the improved help format

### Error Messages
- ✅ Wrong flag: `clawperator click --body "text"` suggests `--text`
- ✅ Missing selector: `clawperator click` shows full list of selector flags with example
- ✅ Multi-device: With 2+ devices, `clawperator snapshot` lists devices and suggests retry command
- ✅ Validation: `clawperator click --timeout -100` shows helpful bound message, not schema error

### HTTP API Routes
- ✅ `POST /snapshot` works on HTTP API with request/response as before
- ✅ `POST /screenshot` works on HTTP API with request/response as before
- ✅ Old routes (`/observe/snapshot`, `/observe/screenshot`) return 404 or redirect

### Integration
- ✅ `./gradlew app:assembleDebug` and `./gradlew app:testDebugUnitTest` pass
- ✅ `npm --prefix apps/node run build && npm --prefix apps/node run test` pass
- ✅ `./scripts/clawperator_smoke_core.sh` passes
- ✅ `./scripts/clawperator_smoke_skills.sh` passes (if applicable)
- ✅ 575+ unit tests still pass (no regressions)

### Documentation
- ✅ `docs/node-api-for-agents.md` updated with new CLI examples
- ✅ HTTP API route documentation updated
- ✅ Run `./scripts/docs_build.sh` and verify generated docs are correct
- ✅ No orphaned references to `/observe/snapshot` or `/observe/screenshot` in docs

---

## Implementation Order (Recommended)

1. **Start with Help Text (Deliverable 1):**
   - Update `generateTopLevelHelp()` grouping in `apps/node/src/cli/index.ts`
   - Update registry entries in `apps/node/src/cli/registry.ts`
   - Test with `clawperator --help` and spot-check 5+ commands

2. **Then Error Messages (Deliverable 2):**
   - Add Levenshtein function and flag suggestion logic
   - Update missing-selector error handler
   - Add multi-device listing error
   - Improve validation error messages
   - Test with intentional typos and missing args

3. **Finally HTTP Routes (Deliverable 3):**
   - Rename routes in `apps/node/src/cli/serve.ts`
   - Update tests
   - Verify smoke tests pass
   - Update documentation

4. **Documentation (Throughout):**
   - Update `docs/node-api-for-agents.md` as routes change
   - Update CLI examples in agent guidance
   - Run `./scripts/docs_build.sh` before opening PR

---

## Risk Assessment

**Low risk.** UX polish with no behavioral changes:
- Help text is content-only; registry is already help-driven
- Error messages improve UX without changing success paths
- HTTP route renames are safe given alpha status and zero external consumers
- All exit codes and JSON output contracts remain unchanged

---

## Key Constraints

1. **Do not rename commands beyond Phase 5B:** exec, wait-for-nav, read-value are the only recent renames
2. **Do not change HTTP request/response schemas:** Only rename routes
3. **Do not remove or rename global options:** --device, --timeout, --json, etc. remain stable
4. **Keep help generation registry-driven:** No refactor of `generateTopLevelHelp()` logic, only content updates
5. **Preserve exit codes and JSON contract:** All automation, tools, and scripts must still work
6. **All changes must pass existing tests:** No regressions in 575+ unit tests

---

## Expected Outcome

A polished, first-class CLI and HTTP API surface with:
- Clear, discoverable help text organized by functional groups
- Actionable error messages that guide users toward correct invocations
- Consistent, intuitive HTTP API routes
- No breaking changes to command behavior or contracts

An agent encountering Clawperator for the first time should be able to:
1. Run `clawperator --help` and understand what commands do
2. Run `clawperator <command> --help` and learn how to invoke it
3. Make a mistake and receive helpful guidance toward the correct syntax
4. Integrate with the HTTP API using intuitive route names

---

## Deliverable Summary

| Deliverable | Owner | Status |
|---|---|---|
| Help Text Rewrite (Deliverable 1) | (Phase 4 Agent) | In Progress |
| Error Message Improvements (Deliverable 2) | (Phase 4 Agent) | In Progress |
| HTTP API Route Updates (Deliverable 3) | (Phase 4 Agent) | In Progress |
| Testing & Verification | (Phase 4 Agent) | In Progress |
| Documentation Updates | (Phase 4 Agent) | In Progress |
