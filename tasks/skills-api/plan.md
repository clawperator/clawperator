# Skills API Integration Plan

## Context

Clawperator's Node API needs a skills integration layer. Skills are standalone programs that agents invoke directly - they are NOT required to go through the Node API to execute. The Node API's role is **discovery, metadata, and registry management** - helping agents find skills, understand them, and keep them up to date.

A thin `skills run` convenience wrapper is included for agents that prefer a unified interface, but it is not the canonical execution path.

### What already exists

- `skills list` - lists all skills from registry
- `skills get <id>` - returns skill metadata
- `skills compile-artifact <id> --artifact <name> --vars <json>` - compiles recipe template to execution payload
- `skills sync` - **stub** (returns "not implemented")
- Domain layer: `listSkills.ts`, `getSkill.ts`, `compileArtifact.ts`, `syncSkills.ts`
- Contracts: `SkillEntry`, `SkillsRegistry`, error codes
- Adapter: `localSkillsRegistry.ts`
- HTTP server: has `/devices`, `/execute`, `/observe/*`, `/events` - **no skills endpoints**

### What needs to be built

1. **Registry management** - implement `skills install` and `skills update` (replace syncSkills stub)
2. **Enhanced discovery** - search/filter skills by app package, intent, or keyword
3. **Enriched metadata** - skill metadata should include invocation instructions so agents know how to run skills independently
4. **Convenience `skills run`** - thin wrapper that invokes a skill's script via child_process
5. **HTTP endpoints** - expose skills discovery/metadata via the serve API
6. **Tests** - unit tests for new functionality

---

## 1. Architecture Overview

```
Agent
  |
  |-- Discovery -----> Node API (skills list/get/search)
  |                        |
  |                        +--> localSkillsRegistry.ts --> skills-registry.json
  |
  |-- Invocation -----> Skill scripts directly (standalone)
  |                  OR  Node API `skills run` (convenience)
  |                  OR  `compile-artifact` + `execute` (artifact path)
  |
  |-- Registry mgmt -> Node API (skills install/update)
```

The Node API reads from `skills-registry.json` in the clawperator-skills repo (located via `CLAWPERATOR_SKILLS_REGISTRY` env var or default path `~/.clawperator/skills/skills/skills-registry.json`).

---

## 2. API Surface

### CLI Commands

#### Existing (no changes needed)
- `clawperator skills list` - list all skills
- `clawperator skills get <skill_id>` - get skill metadata
- `clawperator skills compile-artifact <skill_id> --artifact <name> --vars <json>`

#### New Commands

**`clawperator skills search --app <package_id>`**
- Filter skills by target Android application ID
- Optional: `--intent <intent>` to further filter
- Returns matching skills array

**`clawperator skills install`**
- Clones `clawperator-skills` repo to `~/.clawperator/skills/`
- Sets up registry path
- Prints env var export instruction

**`clawperator skills update [--ref <git-ref>]`**
- Pulls latest from skills repo
- Optional ref to pin to a specific version

**`clawperator skills run <skill_id> [--device-id <id>] [--vars <json>] [-- <extra_args>]`**
- Thin wrapper: resolves the skill's primary script from registry, invokes via child_process
- Passes `--device-id` and any extra args to the script
- Captures stdout/stderr, wraps in JSON envelope
- Not the required execution path - just a convenience

### HTTP Endpoints (added to serve.ts)

**`GET /skills`**
- Query params: `?app=<package_id>&intent=<intent>`
- Returns: `{ ok: true, skills: SkillEntry[], count: number }`

**`GET /skills/:skillId`**
- Returns: `{ ok: true, skill: SkillEntry }`
- 404 if not found

**`POST /skills/:skillId/run`** (convenience)
- Body: `{ deviceId?: string, vars?: Record<string, string>, args?: string[] }`
- Returns: `{ ok: true, skillId: string, output: string, exitCode: number, durationMs: number }`

---

## 3. Skill Loading Strategy

No changes to loading strategy. The existing `localSkillsRegistry.ts` handles:
- Reading from `CLAWPERATOR_SKILLS_REGISTRY` env var or default path
- Parsing `skills-registry.json`
- Finding skills by ID

The `skills install` command will clone the repo to `~/.clawperator/skills/` and the registry will be at `~/.clawperator/skills/skills/skills-registry.json`.

---

## 4. Result Envelope for `skills run`

```typescript
interface SkillRunResult {
  ok: true;
  skillId: string;
  output: string;      // stdout from script
  exitCode: number;
  durationMs: number;
}

interface SkillRunError {
  ok: false;
  code: string;        // SKILL_NOT_FOUND, SKILL_SCRIPT_NOT_FOUND, SKILL_EXECUTION_FAILED
  message: string;
  skillId?: string;
  exitCode?: number;
  stderr?: string;
}
```

---

## 5. Implementation Steps

### Step 1: Implement `syncSkills` (replace stub)
**Files:**
- `apps/node/src/domain/skills/syncSkills.ts` - replace stub with real git clone/pull
- `apps/node/src/contracts/skills.ts` - add error codes: `SKILLS_SYNC_FAILED`, `SKILLS_GIT_NOT_FOUND`

**Logic:**
- Check `git` is available via `which git`
- If `~/.clawperator/skills/` doesn't exist: `git clone https://github.com/clawpilled/clawperator-skills.git ~/.clawperator/skills/`
- If it exists: `git -C ~/.clawperator/skills/ pull`
- If `ref` provided: `git -C ~/.clawperator/skills/ checkout <ref>`
- Validate `skills-registry.json` exists after clone
- Use `child_process.execFile` directly (not ProcessRunner)

**Constants:**
- `SKILLS_REPO_URL = "https://github.com/clawpilled/clawperator-skills.git"`
- `DEFAULT_SKILLS_DIR = join(homedir(), ".clawperator", "skills")`
- Add to a new `apps/node/src/domain/skills/skillsConfig.ts`

### Step 2: Add `skills install` and `skills update` CLI commands
**Files:**
- `apps/node/src/cli/commands/skills.ts` - add `cmdSkillsInstall()`, `cmdSkillsUpdate(ref)`
- `apps/node/src/cli/index.ts` - wire up `install` and `update` subcommands in the skills dispatcher

**Behavior:**
- `cmdSkillsInstall()` calls `syncSkills("main")`, prints env var instruction
- `cmdSkillsUpdate(ref)` calls `syncSkills(ref || "main")`
- Both return JSON result via `formatSuccess`/`formatError`

### Step 3: Add `skills search` command
**Files:**
- `apps/node/src/domain/skills/searchSkills.ts` (new) - filter skills by app, intent, keyword
- `apps/node/src/cli/commands/skills.ts` - add `cmdSkillsSearch()`
- `apps/node/src/cli/index.ts` - wire up `search` subcommand

**Logic:**
```typescript
export async function searchSkills(
  query: { app?: string; intent?: string; keyword?: string },
  registryPath?: string
): Promise<SearchSkillsResult | SearchSkillsError>
```
- Filter `registry.skills` by `applicationId`, `intent`, or substring match on `summary`
- Reuse `loadRegistry` from localSkillsRegistry

### Step 4: Add `skills run` convenience command
**Files:**
- `apps/node/src/domain/skills/runSkill.ts` (new) - invoke skill script via child_process
- `apps/node/src/cli/commands/skills.ts` - add `cmdSkillsRun()`
- `apps/node/src/cli/index.ts` - wire up `run` subcommand

**Logic:**
1. Load registry, find skill by ID
2. Resolve primary script path (first entry in `skill.scripts[]`)
3. Resolve absolute path from registry location + script relative path
4. Verify script file exists
5. Spawn script via `child_process.execFile("node", [scriptPath, ...args])`
6. Pass device-id and vars as args
7. Capture stdout/stderr with timeout
8. Return `SkillRunResult` or `SkillRunError`

**New error codes:**
- `SKILL_SCRIPT_NOT_FOUND` - script file doesn't exist
- `SKILL_EXECUTION_FAILED` - script exited non-zero
- `SKILL_EXECUTION_TIMEOUT` - script exceeded timeout

### Step 5: Add HTTP endpoints for skills
**Files:**
- `apps/node/src/cli/commands/serve.ts` - add `/skills`, `/skills/:skillId`, `/skills/:skillId/run` routes

**Implementation:**
- `GET /skills` - calls `listSkills()` or `searchSkills()` based on query params
- `GET /skills/:skillId` - calls `getSkill()`
- `POST /skills/:skillId/run` - calls `runSkill()`
- Follow existing error handling pattern from serve.ts

### Step 6: Update CLI help text
**Files:**
- `apps/node/src/cli/index.ts` - update HELP constant with new subcommands

### Step 7: Add unit tests
**Files:**
- `apps/node/src/test/unit/skills.test.ts` - add tests for searchSkills, runSkill
- `apps/node/src/test/unit/syncSkills.test.ts` (new) - test syncSkills with mocked git

**Test coverage:**
- searchSkills: filter by app, intent, keyword, no results
- runSkill: success case (mock script), script not found, non-zero exit
- syncSkills: git not found, clone success, pull success, registry validation
- CLI dispatch: new subcommands route correctly

### Step 8: Build and validate
- `npm --prefix apps/node run build && npm --prefix apps/node run test`
- Manual smoke: `clawperator skills install`, `clawperator skills list`, `clawperator skills search --app com.android.settings`
- Run existing smoke scripts: `./scripts/clawperator_smoke_skills.sh`

---

## 6. Deterministic Skill Example: `com.android.settings.capture-overview`

### Discovery
```bash
clawperator skills search --app com.android.settings --output json
```
```json
{
  "skills": [{
    "id": "com.android.settings.capture-overview",
    "applicationId": "com.android.settings",
    "intent": "capture-overview",
    "summary": "Open Android Settings, capture UI text snapshot, and save an ADB screenshot path.",
    "scripts": ["skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh"]
  }],
  "count": 1
}
```

### Metadata
```bash
clawperator skills get com.android.settings.capture-overview --output json
```

### Direct invocation (agent runs skill independently)
```bash
node ~/.clawperator/skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.js <device_id>
```

### Convenience invocation via Node API
```bash
clawperator skills run com.android.settings.capture-overview --device-id <device_id>
```
```json
{
  "ok": true,
  "skillId": "com.android.settings.capture-overview",
  "output": "Settings Overview captured\nTEXT_BEGIN\n...\nTEXT_END",
  "exitCode": 0,
  "durationMs": 8500
}
```

---

## 7. Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/node/src/domain/skills/syncSkills.ts` | Replace stub with real git clone/pull |
| `apps/node/src/domain/skills/skillsConfig.ts` | **New** - constants (repo URL, default dir) |
| `apps/node/src/domain/skills/searchSkills.ts` | **New** - filter skills by app/intent/keyword |
| `apps/node/src/domain/skills/runSkill.ts` | **New** - invoke skill script via child_process |
| `apps/node/src/contracts/skills.ts` | Add new error codes |
| `apps/node/src/cli/commands/skills.ts` | Add cmdSkillsInstall, cmdSkillsUpdate, cmdSkillsSearch, cmdSkillsRun |
| `apps/node/src/cli/index.ts` | Wire new subcommands, update HELP |
| `apps/node/src/cli/commands/serve.ts` | Add /skills HTTP endpoints |
| `apps/node/src/test/unit/skills.test.ts` | Add tests for search, run |

---

## 8. Risks and Edge Cases

| Risk | Mitigation |
|------|-----------|
| Skills repo not cloned yet | `skills list/get/search` return `REGISTRY_READ_FAILED` with clear message to run `skills install` |
| Skill script path doesn't resolve | Verify file exists before spawn; return `SKILL_SCRIPT_NOT_FOUND` |
| Script hangs or takes too long | Default 120s timeout on child_process; return `SKILL_EXECUTION_TIMEOUT` |
| Git not installed on host | Check `which git` before clone; return `SKILLS_GIT_NOT_FOUND` with install instructions |
| Registry path mismatch after clone | Validate `skills-registry.json` exists at expected path post-clone |
| Script expects clawperator CLI on PATH | Document that `npm install -g clawperator` is a prerequisite; scripts use `runClawperator()` helper which resolves the binary |
| Recursive invocation (skills run calls clawperator CLI) | This is expected behavior - skill scripts already call the CLI. No special handling needed |
| Shell escaping in vars passed to scripts | Pass vars as a single JSON string argument, not individual shell args |

---

## 9. Verification

1. **Build**: `npm --prefix apps/node run build`
2. **Unit tests**: `npm --prefix apps/node run test`
3. **Manual CLI smoke**:
   - `clawperator skills install`
   - `clawperator skills list`
   - `clawperator skills search --app com.android.settings`
   - `clawperator skills get com.android.settings.capture-overview`
   - `clawperator skills run com.android.settings.capture-overview --device-id <id>`
4. **Existing smoke**: `./scripts/clawperator_smoke_skills.sh`
5. **HTTP smoke** (with `clawperator serve` running):
   - `curl http://127.0.0.1:3000/skills`
   - `curl http://127.0.0.1:3000/skills/com.android.settings.capture-overview`
