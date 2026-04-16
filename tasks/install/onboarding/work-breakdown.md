# Install Onboarding Agent Discovery Cleanup Work Breakdown

Parent plan: `tasks/install/onboarding/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 fixes runtime discovery ergonomics in the Node CLI:
registry fallback, app-oriented skill lookup, and search quality. PR-2 fixes
install/on-disk onboarding artifacts for OpenClaw-style hosts: runtime-skills
in `~/.clawperator/AGENTS.md`, durable install artifacts, bounded shared-agent
bridge guidance, and docs updates. This pack is intentionally smaller than a
typical multi-phase project and explicitly excludes F6-style skill preflight
contract work.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do not add new `SkillEntry` preflight, `requires`, or `preflight` metadata in
  this pack. That is deferred follow-up.
- Do not start PR-2 until PR-1 is merged. The install/onboarding artifacts must
  point at the real shipped discovery behavior, not a branch-local preview.
- Do not treat runtime Clawperator skills as native prompt-skills in shared
  agent skill directories.
- Any `~/.agents/AGENTS.md` change must be append-only, idempotent, and bounded
  by clear Clawperator guard comments.
- Do not move app-capability discovery into `doctor`. Keep it in the `skills`
  surface.
- Phase 1 must ship its own tests. Phase 2 must ship its own tests. Do not
  defer search or fallback coverage.
- Use `.agents/skills/docs-author/SKILL.md` for the docs phase. Do not hand-edit
  generated docs surfaces.
- Keep the live query table in `tasks/install/onboarding/findings.md` intact and
  use it as the authoritative search-regression input.
- One commit per logical step. Do not batch unrelated changes.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/install/onboarding/plan.md` | Stable contract, scope boundaries, exclusions |
| `tasks/install/onboarding/findings.md` | Authoritative research input and exact user-facing failures |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Registry fallback behavior |
| `apps/node/src/domain/skills/searchSkills.ts` | Current search logic |
| `apps/node/src/contracts/skills.ts` | Registry contract and possible metadata surface |
| `apps/node/src/cli/commands/skills.ts` | Existing command output pattern |
| `apps/node/src/cli/registry.ts` | `skills` namespace registration and help blocks |
| `apps/node/src/test/unit/skills.test.ts` | Unit test patterns and existing skills coverage |
| `sites/landing/public/install.sh` | Installer sequencing, AGENTS template, final summary |
| `docs/internal/design/agent-host-integration.md` | Host-agent bridge order and design constraints |
| `docs/internal/openclaw-reference.md` | OpenClaw context for future-facing guidance |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for Phase 4 docs work |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Runtime discovery ergonomics | 1, 2 | default, thinking | none |
| PR-2 | Install and host-agent artifacts | 3, 4 | default, default | PR-1 merged |

## Phase 1: Registry Fallback and Runtime Discovery Foundation

### Agent Tier

default

### Goal

Make installed runtime skills discoverable from the CLI after a successful
install, even in a fresh non-login shell.

### Files or Surfaces To Change

- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- `apps/node/src/domain/skills/skillsConfig.ts` if a helper is needed
- `apps/node/src/test/unit/skills.test.ts`
- Any adjacent test fixtures strictly required for the new fallback behavior

### Steps

1. Read the current registry-loading path and confirm how the installed
   home-directory registry path is assembled elsewhere in the codebase.
2. Add a fallback so registry resolution checks the installed path under
   `~/.clawperator/skills/skills/skills-registry.json` before failing when no
   explicit env var or explicit registry path is provided.
3. Keep `CLAWPERATOR_SKILLS_REGISTRY` as an override. If it is set and points to
   a bad file, preserve the configured-path failure behavior.
4. Add unit tests for:
   - installed-path fallback succeeds when CWD-relative path is missing
   - explicit env var still takes precedence
   - broken explicit env var still fails closed
   - CWD-relative path still works when present
5. Re-run the Node build and tests.

### Acceptance Criteria

- `clawperator skills list` no longer depends on shell-rc propagation after a
  successful install
- explicit `CLAWPERATOR_SKILLS_REGISTRY` behavior remains unchanged
- new fallback behavior is covered by unit tests in the same phase

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commits

```text
feat(node): add installed skills registry fallback
```

```text
test(node): cover installed skills registry fallback
```

## Phase 2: App-Oriented Discovery and Search Quality

### Agent Tier

thinking

### Goal

Let an agent answer "what can this host do for Google Home?" in one command and
make user-language skill search return the right Google Home HVAC skills.

### Files or Surfaces To Change

- `apps/node/src/contracts/skills.ts`
- `apps/node/src/domain/skills/searchSkills.ts`
- `apps/node/src/domain/skills/` helpers if needed
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/skills.test.ts`
- Any repo-local registry fixtures used by the tests

### Steps

1. Add the minimum metadata and ranking support needed to fix the real queries
   from `tasks/install/onboarding/findings.md`. Prefer explicit `keywords` or
   equivalent metadata over heuristic-only search changes.
2. Add a `skills for-app <package_id>` discovery surface in the `skills`
   namespace. Keep the output shape aligned with existing `formatSuccess` /
   `formatError` patterns.
3. Seed or adapt the relevant registry fixtures so the Google Home HVAC skills
   can be discovered using:
   - `google home`
   - `climate`
   - `hvac`
   - `air conditioner`
   - `aircon`
   - `ac`
4. Preserve the live query table in `findings.md` as the authoritative set of
   regression cases. Use those exact problem queries in tests.
5. Add unit tests for:
   - `skills for-app com.google.android.apps.chromecast.app`
   - correct Google Home hits for `google home`
   - correct Google Home hits for `air conditioner`
   - correct Google Home hits for `aircon`
   - short-query behavior so `"ac"` no longer confidently ranks irrelevant
     skills ahead of the HVAC skills
6. Update CLI help text only as needed to document the new discovery surface.
7. Re-run the Node build and tests.

### Acceptance Criteria

- `skills for-app` exists and returns the Google Home HVAC skills
- search improvements are driven by explicit metadata and tested ranking rules
- the exact user-problem queries from `findings.md` are covered by unit tests
- no semantic-search or fuzzy-match redesign is introduced

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commits

```text
feat(skills): add app-oriented skill discovery command
```

```text
feat(skills): improve runtime skill search keywords and ranking
```

```text
test(skills): add discovery and search regression coverage
```

## Phase 3: Install Artifacts and `~/.clawperator/AGENTS.md`

### Agent Tier

default

### Goal

Make the installed host artifacts explain the runtime capability that is already
present, and persist the key install outputs for future agent turns.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`

### Steps

1. Expand the `~/.clawperator/AGENTS.md` template so it includes runtime skills,
   grouped or summarized in a way that makes the Google Home HVAC skills obvious
   to a cold-start host agent.
2. Add a durable `install-state.json` artifact under `~/.clawperator/` that
   records the minimum stable install facts future agents need.
3. Add `mcp-config-snippet.json` under `~/.clawperator/` with paste-ready MCP
   config guidance for host agents.
4. Update the final installer summary to reference the durable artifact paths
   rather than leaving critical orientation only in stdout.
5. Keep these changes additive. Do not rewrite unrelated install behavior.
6. Add or extend install-script validation coverage if the repo already has a
   suitable harness for this output generation path.

### Acceptance Criteria

- `~/.clawperator/AGENTS.md` describes runtime skills, not just authoring skills
- `install-state.json` and `mcp-config-snippet.json` are created by the install
  flow
- the final summary points at durable on-disk artifacts
- install behavior remains syntax-valid and covered by the appropriate test path

### Validation

```bash
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commits

```text
feat(install): add runtime skill guidance and durable host artifacts
```

```text
test(install): cover onboarding host artifacts
```

## Phase 4: Shared-Agent Bridge and Public Docs

### Agent Tier

default

### Goal

Add a bounded shared-agent bridge and update the authored docs so the new
discovery behavior is public, durable, and easy to follow.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`
- `docs/` authored pages that describe install/onboarding and skills discovery
- `sites/docs/.build/` regenerated via docs workflow

### Steps

1. Add a bounded, guard-comment-delimited Clawperator section to the shared
   agent discovery surface used by the installer. This should point to
   `~/.clawperator/AGENTS.md` and the `clawperator skills` discovery commands.
2. Keep the bridge clearly a pointer/delegator. Do not try to mirror runtime
   skills into shared agent skill directories.
3. Use `.agents/skills/docs-author/SKILL.md` for the docs work.
4. Update the authored docs so they describe:
   - installed registry fallback behavior
   - the new app-oriented discovery surface
   - host-facing install artifacts
   - MCP snippet availability if Phase 3 shipped it
5. Regenerate docs and run the full docs build.

### Acceptance Criteria

- shared-agent bridge text is append-only, bounded, and idempotent
- public docs describe the shipped onboarding/discovery behavior and no more
- generated docs are produced through the normal docs workflow

### Validation

```bash
bash -n sites/landing/public/install.sh
./scripts/docs_build.sh
```

### Expected Commits

```text
feat(install): add bounded shared-agent Clawperator bridge
```

```text
docs: update install and skills discovery guidance for host agents
```

## Finalization

- After PR-2, update `tasks/install/onboarding/finalization-items.md` if any
  part of F6 still needs sharper scoping for the follow-up task pack.
