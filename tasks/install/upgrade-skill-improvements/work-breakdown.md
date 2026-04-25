# Upgrade Skill PATH Handling Improvements Work Breakdown

Parent plan: `tasks/install/upgrade-skill-improvements/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 performs the authored bundled-skill wording update in
`SKILL.md` and `agents/openai.yaml`. Phase 2 runs focused validation, checks
whether docs or generated surfaces need regeneration, and commits the completed
task. Both phases use the `default` tier because the work is bounded but the
wording affects host mutation routing.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Read the required files in order before editing.
- Preserve `tasks/install/upgrade-skill-improvements/findings.md` as the review
  source. Do not rewrite the accepted findings during implementation.
- Do not add `--output json` to the upgrade skill examples as a required agent
  parsing step. JSON is already the CLI default.
- Do not edit `install.sh`, Node CLI behavior, doctor behavior, Android
  behavior, or generated docs unless the implementation uncovers a direct
  source-of-truth contradiction.
- Keep `install.sh` recovery-only in the upgrade skill. Do not make it the
  primary path.
- Keep `agents/openai.yaml` aligned with the meaning of `SKILL.md`; it should
  summarize the workflow, not become a second full workflow document.
- Do not edit `sites/docs/.build/` or `sites/docs/site/` by hand.
- If implementation changes authored public docs, use
  `.agents/skills/docs-author/SKILL.md` and run `./scripts/docs_build.sh`.
- One commit per phase is preferred. Do not batch unrelated code or installer
  work into this task.
- If a planned step appears to require product behavior changes, stop and
  escalate instead of expanding this wording task.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/install/upgrade-skill-improvements/plan.md` | Stable contract and boundaries |
| `tasks/install/upgrade-skill-improvements/findings.md` | Accepted findings and excluded JSON-output finding |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Main authored skill to tighten |
| `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` | Condensed OpenAI metadata to keep aligned |
| `docs/internal/design/agent-host-integration.md` | Source for host-agent PATH and shell-rc caveat |
| `docs/internal/design/installer-architecture.md` | Source for installer versus CLI ownership boundary |
| `sites/landing/public/install.sh` | Current installer behavior and Homebrew/npm discovery context |
| `apps/node/src/test/unit/bundledSkillsPack.test.ts` | Packaging guard for bundled skills |
| `apps/node/src/test/unit/bundledSkills.test.ts` | Install/list behavior for bundled skills |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Tighten `clawperator-upgrade` PATH classification and npm gate | 1, 2 | default, default | none |

## Phase 1: Tighten Upgrade Skill Instructions

### Agent Tier

default

### Goal

Update the authored upgrade skill so agents classify PATH-related command
failures before choosing `install.sh` recovery and include `npm` in the
CLI-first viability gate.

### Files or Surfaces To Change

- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
- `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`

### Steps

1. Add a new PATH-discovery step before the current CLI reachability recovery
   rule. The step must tell agents to capture the current `PATH` and run:

   ```bash
   printf 'PATH=%s\n' "$PATH"
   command -v clawperator || true
   command -v node || true
   command -v npm || true
   command -v java || true
   command -v adb || true
   command -v brew || true
   ```

2. Add macOS Homebrew probing guidance before declaring Homebrew absent:

   ```bash
   /opt/homebrew/bin/brew --version
   /usr/local/bin/brew --version
   ```

3. Add the rule that when Homebrew is found outside `PATH`, the agent should
   activate the discovered Homebrew environment for the current command
   sequence before retrying:

   ```bash
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

   Use the matching `/usr/local/bin/brew shellenv` when that is the discovered
   Homebrew path.

4. Add `npm -v` to the CLI-first prerequisite checks beside `node -v` and
   `java -version`.
5. State explicitly that exit code `127` means command-not-found in the current
   shell and must be classified before reporting that the host lacks the tool.
6. Keep the current multi-device doctor rules. Do not loosen the ready/blocking
   decision table.
7. Add an explicit note that `--output json` is not required for the examples
   because JSON is the CLI default. Do not add redundant JSON flags to the
   command snippets.
8. Update `agents/openai.yaml` so the default prompt includes the PATH
   classification and `npm` gate in compact form.
9. Reread both changed files and verify the YAML still uses a single valid
   string for `default_prompt`.

### Acceptance Criteria

- `SKILL.md` tells agents to run PATH discovery before `install.sh` recovery.
- `SKILL.md` includes common macOS Homebrew absolute-path probes.
- `SKILL.md` includes `npm` in CLI-first prerequisite checks.
- `SKILL.md` preserves the CLI-first upgrade sequence and recovery-only
  installer rule.
- `SKILL.md` does not require `--output json`.
- `agents/openai.yaml` is aligned with the changed workflow.

### Validation

```bash
git diff --check -- apps/node/bundled-skills/clawperator-upgrade/SKILL.md apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml
```

### Expected Commit

```text
docs(skills): tighten upgrade PATH discovery
```

## Phase 2: Validate Packaging and Docs Impact

### Agent Tier

default

### Goal

Prove the bundled-skill wording remains packaged and discoverable, then update
only the docs or generated outputs that are actually affected by the authored
skill change.

### Files or Surfaces To Change

- `apps/node/src/test/unit/bundledSkillsPack.test.ts` only if packaging tests
  prove they need an update
- `docs/` only if authored public docs need to mention the broader PATH rule
- `sites/docs/.build/` and `sites/docs/site/` only through docs regeneration if
  authored docs changed
- `tasks/install/upgrade-skill-improvements/findings.md` only for a short
  correction note if implementation discovers an accepted finding was wrong

### Steps

1. Run the focused bundled-skill tests first:

   ```bash
   npm --prefix apps/node run test -- bundledSkillsPack
   npm --prefix apps/node run test -- bundledSkills
   ```

   If the test runner does not support file-name filtering in this form, run
   the full Node test command instead and record that in the final response.

2. Run the Node build:

   ```bash
   npm --prefix apps/node run build
   ```

3. Search for public or generated surfaces that quote the upgrade skill wording:

   ```bash
   rg -n "PATH discovery|clawperator-upgrade|npm -v|brew shellenv|/opt/homebrew/bin/brew" docs sites apps/node/src -g '!sites/docs/site/**' -g '!sites/docs/.build/**'
   ```

4. If authored docs under `docs/` need a small update, use
   `.agents/skills/docs-author/SKILL.md`, edit only the authored source, and run:

   ```bash
   ./scripts/docs_build.sh
   ```

5. If no authored docs are changed, do not run docs generation just to create
   churn.
6. Run final whitespace validation:

   ```bash
   git diff --check
   ```

7. Commit the completed phase if Phase 1 was not already committed. If Phase 1
   was committed separately and Phase 2 changes docs or tests, commit Phase 2
   separately.

### Acceptance Criteria

- Relevant bundled-skill packaging tests pass, or the full Node test suite runs
  successfully if focused filtering is unavailable.
- Node build passes.
- No stale `agents/openai.yaml` prompt remains.
- No generated docs are hand-edited.
- If public docs change, docs build passes.
- `git diff --check` passes.

### Validation

```bash
npm --prefix apps/node run test -- bundledSkillsPack
npm --prefix apps/node run test -- bundledSkills
npm --prefix apps/node run build
git diff --check
```

Run this only if authored docs changed:

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
test(skills): validate upgrade skill packaging
```

If Phase 2 only runs validation and creates no file changes, do not create an
empty commit. Report the validation results in the final response instead.
