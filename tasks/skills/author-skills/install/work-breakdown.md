# Authoring Skills Install and Discovery Work Breakdown

Parent plan: `tasks/skills/author-skills/install/plan.md`

## Executive Summary

2 PRs, 5 phases. PR-1 (Phases 1-2) delivers the Node foundation: SKILL.md
portability fix, npm package scaffolding, Node CLI implementation, and unit
tests. PR-2 (Phases 3-5) delivers install.sh wiring, doctor staleness check,
and docs updates. PR-2 has a hard merge gate on PR-1 being merged AND the
updated npm package published, because install.sh calls `clawperator
authoring-skills install` which must exist in the installed CLI. Phases 1 and 2
are complete on `skills/author-skills-install-pr1`. Phase 3 is next once PR-1
is merged and the updated npm package is published.

## Status

| Item | Value |
| --- | --- |
| State | PR-1 complete locally; PR-2 blocked pending merge + npm publish |
| Total PRs | 2 |
| Total phases | 5 |
| Completed | 1, 2 |
| Remaining | 3, 4, 5 |
| Current / Next | Phase 3 |
| Blockers | PR-1 merge and updated npm package publish |

## Hard Rules

- Do not start PR-2 (Phases 3-5) until PR-1 is merged and the updated npm
  package is published. install.sh calls `clawperator authoring-skills install`;
  that subcommand must exist in the installed CLI first.
- Do not duplicate wiring logic in install.sh. All copy and symlink logic lives
  in `clawperator authoring-skills install`. install.sh calls that command.
- Do not use symlinks from `~/.clawperator/authoring-skills/` to the npm
  package. Use copies. Symlinks into a globally installed npm package break when
  nvm switches Node versions.
- Do use symlinks from agent discovery dirs to `~/.clawperator/authoring-skills/`.
- Create `~/.claude/skills/` and `$CODEX_HOME/skills` (if `CODEX_HOME` is set)
  else `~/.codex/skills/` unconditionally in the `install` command. Do not gate
  on whether the agent is installed.
- Phase 2 must include unit tests for `copyAuthoringSkills.ts` and
  `authoringSkills.ts`. Do not defer tests.
- Phase 4 must include unit tests for the new doctor check. Do not defer tests.
- Do not edit `sites/docs/.build/` directly. Use the `docs-build` skill.
- One commit per logical step. Do not batch unrelated changes.
- If the plan and the current code conflict, trust the code. Flag the deviation
  before proceeding.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| # | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/skills/author-skills/install/plan.md` | Stable contract, scope, decision rules |
| 2 | `tasks/skills/author-skills/install/problem-summary.md` | Full background, rationale, why-not section |
| 3 | `apps/node/src/domain/skills/skillsConfig.ts` | Existing config constant pattern to extend |
| 4 | `apps/node/src/cli/commands/skills.ts` | CLI command pattern - `cmdSkillsInstall`, `cmdSkillsUpdate`, `cmdSkillsList` as shape exemplars |
| 5 | `apps/node/src/cli/registry.ts` | Where and how to register the new `authoring-skills` command group |
| 6 | `apps/node/src/domain/doctor/DoctorService.ts` | Where to add the new doctor check and in what order |
| 7 | `apps/node/src/domain/doctor/checks/hostChecks.ts` | Doctor check shape: `DoctorCheckResult`, `id`, `status`, `fix`, `evidence` |
| 8 | `apps/node/src/test/unit/skills.test.ts` | Test file pattern: tmpdir isolation, fixture approach, import style |
| 9 | `.agents/skills/skill-author-by-recording/SKILL.md` | The file to fix in Phase 1; Required Reading section is the target |
| 10 | `apps/node/package.json` | Current `files` array - confirm before adding `"authoring-skills/"` |
| 11 | `sites/landing/public/install.sh` | Function structure and where to add `setup_authoring_skills_via_cli()` |
| 12 | `sites/docs/mkdocs.yml` | Verify published URL paths for `docs/api/recording.md`, `docs/skills/authoring.md`, `docs/skills/overview.md`, `docs/internal/design/skill-design.md` before writing URLs into SKILL.md |
| 13 | `.agents/skills/docs-author/SKILL.md` | Use for Phase 5 docs work |

## PR / Phase Plan

| PR | Branch | Purpose | Phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `skills/authoring-skills-install-p1` | Node foundation | 1, 2 | fast (Ph1), default (Ph2) | none |
| PR-2 | `skills/authoring-skills-install-p2` | Wiring + doctor + docs | 3, 4, 5 | default, default, default | PR-1 merged + npm published |

---

## Phase 1: SKILL.md Portability and npm Package Scaffolding

### Agent Tier

fast

### Goal

Replace repo-local Required Reading paths in `SKILL.md` with portable URLs, and
create the npm package structure that will carry authoring skill files.

### Files or Surfaces to Change

- `.agents/skills/skill-author-by-recording/SKILL.md` - Required Reading section
- `apps/node/authoring-skills/` - new directory with one symlink
- `apps/node/package.json` - add `"authoring-skills/"` to files array

### Steps

1. Read `sites/docs/mkdocs.yml` and confirm the published URL for each of the
   four docs paths currently in SKILL.md's Required Reading:
   - `docs/api/recording.md`
   - `docs/skills/authoring.md`
   - `docs/skills/overview.md`
   - `docs/internal/design/skill-design.md`

   For any path that is in the mkdocs nav, derive the published URL by replacing
   `docs/` with `https://docs.clawperator.com/` and dropping the `.md` suffix.
   For any path not in the mkdocs nav, use the GitHub main-branch URL:
   `https://github.com/clawperator/clawperator/blob/main/<path>`.

2. Use the GitHub main-branch URL for both TypeScript files:
   - `apps/node/src/contracts/skillResult.ts` ->
     `https://github.com/clawperator/clawperator/blob/main/apps/node/src/contracts/skillResult.ts`
   - `apps/node/src/domain/skills/runSkill.ts` ->
     `https://github.com/clawperator/clawperator/blob/main/apps/node/src/domain/skills/runSkill.ts`

3. Edit the "Required Reading During Use" section of `SKILL.md` to replace all
   six local paths with the URLs derived in steps 1-2. Keep the section heading
   and introductory sentence. Change only the path strings.

4. Create `apps/node/authoring-skills/` and add one relative symlink:
   ```bash
   mkdir apps/node/authoring-skills
   ln -s ../../.agents/skills/skill-author-by-recording \
       apps/node/authoring-skills/skill-author-by-recording
   ```
   The symlink target is relative, resolving from inside `apps/node/authoring-skills/`.
   Verify that the symlink resolves to a directory containing `SKILL.md`.

5. Edit `apps/node/package.json` to add `"authoring-skills/"` to the `files`
   array. The array currently is:
   ```json
   ["dist/", "!dist/test/**", "!dist/**/*.map", "README.md", "LICENSE"]
   ```
   Add `"authoring-skills/"` as the last entry before the closing bracket.

6. Confirm npm would include the files by running:
   ```bash
   npm --prefix apps/node pack --dry-run 2>&1 | grep authoring-skills
   ```
   Expect lines listing files from `authoring-skills/skill-author-by-recording/`.

### Acceptance Criteria

Mechanical:
- `git diff .agents/skills/skill-author-by-recording/SKILL.md` shows no local
  repo paths remaining in the Required Reading section (no `docs/` or `apps/`
  relative paths)
- `ls -la apps/node/authoring-skills/skill-author-by-recording` is a symlink
- `readlink apps/node/authoring-skills/skill-author-by-recording` outputs a
  relative path into `.agents/skills/`
- `test -f apps/node/authoring-skills/skill-author-by-recording/SKILL.md` passes
- `grep '"authoring-skills/"' apps/node/package.json` returns a match
- `npm --prefix apps/node pack --dry-run 2>&1 | grep "authoring-skills/skill-author-by-recording/SKILL.md"` returns a match

Human review:
- All six Required Reading entries now have full HTTPS URLs
- URLs match actual published or GitHub main-branch paths for each file
- No other content in `SKILL.md` changed

### Validation

```bash
# Verify SKILL.md has no local required-reading paths
grep -n "^\- \`docs/\|^\- \`apps/" \
    .agents/skills/skill-author-by-recording/SKILL.md
# Expect: no output

# Verify symlink
ls -la apps/node/authoring-skills/skill-author-by-recording
test -f apps/node/authoring-skills/skill-author-by-recording/SKILL.md && echo "OK"

# Verify npm pack includes the files
npm --prefix apps/node pack --dry-run 2>&1 | grep authoring-skills
```

### Expected Commit

```text
feat(skills): add SKILL.md portability fix and npm package scaffolding for authoring skills
```

---

## Phase 2: Node CLI Implementation and Unit Tests

### Agent Tier

default

### Goal

Implement the `authoring-skills` CLI command group and the `copyAuthoringSkills`
domain module. Add unit tests that prove the install, update, and list behaviors
without requiring a live filesystem outside of tmpdir isolation.

### Files or Surfaces to Change

- `apps/node/src/domain/skills/skillsConfig.ts` - add constant
- `apps/node/src/domain/skills/copyAuthoringSkills.ts` - new module
- `apps/node/src/cli/commands/authoringSkills.ts` - new CLI command
- `apps/node/src/cli/registry.ts` - register command group
- `apps/node/src/test/unit/authoringSkills.test.ts` - new test file

### Steps

1. Add `DEFAULT_AUTHORING_SKILLS_DIR` to `skillsConfig.ts`:
   ```ts
   export const DEFAULT_AUTHORING_SKILLS_DIR = join(homedir(), ".clawperator", "authoring-skills");
   ```
   Add it after `DEFAULT_SKILLS_DIR`. No other changes to the file.

2. Create `apps/node/src/domain/skills/copyAuthoringSkills.ts`. This module:
   - Locates the authoring-skills source directory relative to `import.meta.url`.
     The compiled output is at `dist/domain/skills/copyAuthoringSkills.js`.
     From that location, `../../../authoring-skills/` traverses up through
     `dist/domain/skills/` -> `dist/domain/` -> `dist/` -> package root, landing
     at the `authoring-skills/` directory at the package root. Use
     `resolve(dirname(fileURLToPath(import.meta.url)), "../../../authoring-skills")`
     and verify the resolved path exists before proceeding. Model the resolution
     pattern on `getSiblingBuildPath()` in `skillsConfig.ts`, which resolves a
     sibling path relative to the compiled module.
   - Scans the source directory for subdirectories containing `SKILL.md` using
     directory scanning (no manifest file).
   - Copies each discovered skill directory to `~/.clawperator/authoring-skills/<skill-name>/`
     using recursive copy. Overwrites existing files.
   - Writes `~/.clawperator/authoring-skills/version.txt` containing the CLI
     version string from `getCliVersion()`.
   - Creates agent discovery directories unconditionally:
     - `~/.claude/skills/`
     - `$CODEX_HOME/skills` if `CODEX_HOME` is set, else `~/.codex/skills/`
   - Symlinks `~/.claude/skills/<skill-name>` -> `~/.clawperator/authoring-skills/<skill-name>/`
   - Symlinks `$CODEX_HOME/skills/<skill-name>` (if `CODEX_HOME` is set) else
     `~/.codex/skills/<skill-name>` -> `~/.clawperator/authoring-skills/<skill-name>/`
   - Removes stale symlinks in agent dirs that no longer have a corresponding
     installed skill (handles skill removal).
   - Returns a result object: `{ ok: true, skills: string[], installedDir: string,
     agentDirs: string[] }` on success, or `{ ok: false, code: string, message: string }`
     on failure.

3. Create `apps/node/src/cli/commands/authoringSkills.ts`. Commands:
   - `install`: calls `copyAuthoringSkills()`, prints installed skill names and
     the `CLAWPERATOR_AUTHORING_SKILLS` env hint if set. Returns JSON or pretty
     formatted output following the existing `formatSuccess`/`formatError` pattern.
   - `update`: same as install - re-copies and re-wires. Safe to run multiple
     times. The output message should say "updated" rather than "installed" to
     distinguish the intent.
   - `list`: reads `~/.clawperator/authoring-skills/`, lists subdirectories with
     a `SKILL.md` file, and prints each name alongside the absolute path to its
     `SKILL.md`. If the directory does not exist, prints a helpful message
     suggesting `clawperator authoring-skills install`.
   Use the `formatSuccess`/`formatError` pattern from `skills.ts`. Do not
   invent a different output shape.

4. Register the `authoring-skills` command group in `registry.ts`. Read
   `registry.ts` fully before editing. Follow the exact pattern used for the
   `skills` group. The subcommands are `install`, `update`, `list`.

5. Write `apps/node/src/test/unit/authoringSkills.test.ts`. Use `mkdtemp` to
   isolate all filesystem state under a temp directory per test. Do not write
   to the real `~/.clawperator/` or `~/.claude/` during tests - use injected
   paths or env var overrides. Model the test file structure after
   `apps/node/src/test/unit/skills.test.ts`.

   Required test cases:
   - `copyAuthoringSkills` discovers a skill by finding a subdirectory with
     `SKILL.md` - skill dir is copied to the install target
   - `copyAuthoringSkills` ignores subdirectories without `SKILL.md`
   - `copyAuthoringSkills` writes `version.txt` with the current CLI version
   - `copyAuthoringSkills` creates `~/.claude/skills/` even when it does not
     exist
   - `copyAuthoringSkills` creates the Codex skills dir even when it does not
     exist (test both default path and `CODEX_HOME` env override)
   - `copyAuthoringSkills` places a symlink in `~/.claude/skills/<skill-name>`
     pointing to the installed skill dir
   - `copyAuthoringSkills` is idempotent - running twice does not error and
     result is the same as running once
   - `copyAuthoringSkills` returns an error result when the npm package source
     dir does not exist (simulate missing source)
   - `cmdAuthoringSkillsList` returns a helpful message when install dir does
     not exist

6. Run `npm --prefix apps/node run build` then `npm --prefix apps/node run test`
   and confirm all new tests pass.

### Acceptance Criteria

Mechanical:
- `npm --prefix apps/node run build` exits 0
- `npm --prefix apps/node run test` exits 0 with all new cases passing
- `grep -r "authoring-skills" apps/node/src/cli/registry.ts` returns a match
- `node apps/node/dist/cli/index.js authoring-skills --help` prints subcommands
  (`install`, `update`, `list`)

Human review:
- `copyAuthoringSkills.ts` uses copies (not symlinks) from npm source to
  `~/.clawperator/authoring-skills/`
- Agent dirs are created unconditionally (no `if agent is installed` guard)
- All test cases use tmpdir isolation; no writes to real home directory
- Output format matches the `formatSuccess`/`formatError` pattern from `skills.ts`

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test

# Smoke check on the compiled CLI
node apps/node/dist/cli/index.js authoring-skills --help
node apps/node/dist/cli/index.js authoring-skills list
```

### Expected Commits

```text
feat(skills): add DEFAULT_AUTHORING_SKILLS_DIR constant to skillsConfig
```

```text
feat(skills): add copyAuthoringSkills domain module with install and wiring logic
```

```text
feat(skills): add authoring-skills CLI command group (install, update, list)
```

```text
test(skills): add unit tests for copyAuthoringSkills and authoring-skills commands
```

---

## Phase 3: install.sh Integration and AGENTS.md Template

### Agent Tier

default

### Goal

Wire `clawperator authoring-skills install` into `install.sh` so that running
the install script is sufficient to make authoring skills available in Claude
Code and Codex.

### Files or Surfaces to Change

- `sites/landing/public/install.sh`

### Steps

1. Read `sites/landing/public/install.sh` in full before editing.

2. Find the `setup_skills_via_cli()` function. Add a new function
   `setup_authoring_skills_via_cli()` immediately after it. The function:
   - prints a status line (e.g., `echo -e "${BLUE}Setting up authoring skills...${NC}"`)
   - calls `clawperator authoring-skills install`
   - on success, prints the installed authoring-skills dir and the Claude and
     Codex skill dirs so the user sees where the skills landed
   - on failure, prints an error but does not halt the overall install (skills
     install is best-effort; a missing authoring skill does not break the core
     tool)
   Model the function after `setup_skills_via_cli()` in structure and error
   handling pattern.

3. Find where `setup_skills_via_cli()` is called in the main install sequence.
   Call `setup_authoring_skills_via_cli()` immediately after it.

4. Find the `~/.clawperator/AGENTS.md` template block in `install.sh`. Add a
   section pointing the agent to the installed authoring skills:
   ```
   ## Authoring Skills

   First-party Clawperator authoring skills are installed at:
   ~/.clawperator/authoring-skills/

   Available skills:
   - skill-author-by-recording: use this to author a new Clawperator runtime skill
     from a fresh phone recording
   ```
   The exact wording should match what the installed SKILL.md describes. Keep
   it short and agent-actionable.

5. Find the final install summary print block. Add a line reporting the authoring
   skills install location, similar to how the runtime skills registry path is
   reported.

### Acceptance Criteria

Mechanical:
- `grep "setup_authoring_skills_via_cli" sites/landing/public/install.sh` returns
  a function definition and a call site
- `grep "authoring-skills install" sites/landing/public/install.sh` returns a match
- `grep "AGENTS.md" sites/landing/public/install.sh | grep -i "authoring"` returns
  a match (the AGENTS.md template section exists)
- `bash -n sites/landing/public/install.sh` exits 0 (syntax check)

Human review:
- `setup_authoring_skills_via_cli()` calls `clawperator authoring-skills install`
  and does not duplicate any copy or symlink logic
- Failure of this step does not abort the overall install
- AGENTS.md template section names the skill and its location

### Validation

```bash
bash -n sites/landing/public/install.sh

grep -n "setup_authoring_skills_via_cli" sites/landing/public/install.sh
grep -n "authoring-skills install" sites/landing/public/install.sh
```

### Expected Commit

```text
feat(install): add authoring skills setup step to install.sh
```

---

## Phase 4: Doctor Staleness Check and Unit Tests

### Agent Tier

default

### Goal

Add a `clawperator doctor` check that warns when installed authoring skills are
stale relative to the current CLI version and surfaces the fix command.

### Files or Surfaces to Change

- `apps/node/src/domain/doctor/checks/hostChecks.ts` - add the new check function
- `apps/node/src/domain/doctor/DoctorService.ts` - register the check
- `apps/node/src/contracts/errors.ts` - add error code if no suitable one exists
- `apps/node/src/domain/doctor/docsUrls.ts` - verify if a relevant URL exists
- `apps/node/src/test/unit/` - new or extended test file for the doctor check

### Steps

1. Read `apps/node/src/contracts/errors.ts`. Check whether an existing error code
   covers "authoring skills are stale." If a suitable code exists, use it. If not,
   add `AUTHORING_SKILLS_STALE: "AUTHORING_SKILLS_STALE"` to the error codes map.

2. Add `checkAuthoringSkillsStaleness()` to
   `apps/node/src/domain/doctor/checks/hostChecks.ts`. The function:
   - check id: `"host.authoring-skills.staleness"`
   - If `~/.clawperator/authoring-skills/` does not exist: return `pass` with
     summary "Authoring skills not yet installed." (first install, not an error)
   - If `~/.clawperator/authoring-skills/version.txt` does not exist: return
     `warn` with summary "Authoring skills version file is missing." and fix
     `clawperator authoring-skills update`
   - Read `version.txt`. If it matches `getCliVersion()`: return `pass` with
     summary "Authoring skills are up to date."
   - If it differs: return `warn` with summary
     "Authoring skills (v<file-version>) are outdated (CLI is v<cli-version>)."
     and fix `clawperator authoring-skills update`
   Use `getCliVersion()` from `../../domain/version/compatibility.js` (already
   imported in the existing checks - verify exact import path).
   Include the installed and CLI version in `evidence`.

3. Register the new check in `DoctorService.ts`. Add it to the host checks block,
   after the existing `checkInstalledOrchestratedSkillAgentCliAvailability` call.
   The check does not require a device, so it belongs in the host checks block.

4. Write unit tests for `checkAuthoringSkillsStaleness`. Add a new test file or
   extend an existing host-checks test file. Use tmpdir isolation and inject the
   authoring-skills dir path via a parameter override or module-level injection
   rather than reading from the real home directory.

   Required test cases:
   - authoring-skills dir does not exist -> `pass`
   - authoring-skills dir exists, no `version.txt` -> `warn`
   - `version.txt` matches CLI version -> `pass`
   - `version.txt` differs from CLI version -> `warn` with both versions in output

5. Run `npm --prefix apps/node run build` then `npm --prefix apps/node run test`.

### Acceptance Criteria

Mechanical:
- `npm --prefix apps/node run build` exits 0
- `npm --prefix apps/node run test` exits 0 with new cases passing
- `grep "host.authoring-skills.staleness" apps/node/src/domain/doctor/checks/hostChecks.ts` matches
- `grep "checkAuthoringSkillsStaleness" apps/node/src/domain/doctor/DoctorService.ts` matches

Human review:
- Missing authoring-skills dir is `pass`, not `warn` (first install is normal)
- Warn state includes a concrete fix command (`clawperator authoring-skills update`)
- Unit tests use tmpdir or injected path - no writes to real home dir

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commits

```text
feat(doctor): add authoring skills staleness check
```

```text
test(doctor): add unit tests for authoring skills staleness check
```

---

## Phase 5: Docs Updates

### Agent Tier

default

### Goal

Update `docs/skills/authoring.md` and `docs/skills/overview.md` to document the
install model, `clawperator authoring-skills` commands, and the runtime vs
authoring skill distinction. Regenerate `sites/docs/.build/` and validate.

### Files or Surfaces to Change

- `docs/skills/authoring.md` - add install section
- `docs/skills/overview.md` - add authoring vs runtime clarification
- `sites/docs/.build/` - regenerated via `docs-build` skill
- `sites/docs/site/` - rebuilt via `./scripts/docs_build.sh`

### Steps

Use `.agents/skills/docs-author/SKILL.md` for this phase. Do not hand-edit
`sites/docs/.build/` or `sites/docs/site/`. All content changes go to `docs/`.

1. Add an "Authoring Skills Install" section to `docs/skills/authoring.md`. The
   section must cover:
   - What authoring skills are (AI agent programs, not runtime skills)
   - That `curl install.sh | bash` installs them automatically
   - Where they are installed: `~/.clawperator/authoring-skills/`
   - Where they are wired: `~/.claude/skills/` and `$CODEX_HOME/skills`
     (default `~/.codex/skills/`; the effective path when `CODEX_HOME` is set)
   - `clawperator authoring-skills install` - a repair and manual bootstrap
     command; normal first-time users do not need to run it because `install.sh`
     handles it automatically
   - `clawperator authoring-skills update` - re-copies and re-wires; use after
     `npm install -g clawperator@latest`
   - `clawperator authoring-skills list` - list installed skills and paths
   - `clawperator doctor` - how it checks for staleness
   These commands are maintenance/repair flows, not required first-run steps.
   State that clearly.

2. Update `docs/skills/overview.md` to add a clarification that `clawperator skills`
   and `skills-registry.json` cover runtime skills only. Authoring skills are a
   separate category: AI agent programs that live in `.agents/skills/` and are
   installed separately from runtime skills.

3. Run the `docs-build` skill to regenerate `sites/docs/.build/`.

4. Run `./scripts/docs_build.sh` and confirm it exits 0.

### Acceptance Criteria

Mechanical:
- `grep -i "authoring skills install" docs/skills/authoring.md` returns a match
- `grep "authoring-skills install" docs/skills/authoring.md` returns a match
- `grep "authoring-skills update" docs/skills/authoring.md` returns a match
- `grep "authoring-skills list" docs/skills/authoring.md` returns a match
- `./scripts/docs_build.sh` exits 0

Human review:
- Docs do not over-promise: commands described as maintenance/repair flows, not
  required first-run steps
- `overview.md` makes the runtime vs authoring distinction unambiguous
- No content in `sites/docs/.build/` was hand-edited

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commits

```text
docs(skills): add authoring skills install section to authoring.md
```

```text
docs(skills): clarify runtime vs authoring skills distinction in overview.md
```

```text
docs(build): regenerate docs build for authoring skills install docs
```
