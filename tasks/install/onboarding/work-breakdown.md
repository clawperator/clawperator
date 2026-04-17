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
- The `keywords` metadata in Phase 2 is a cross-repo contract change. Land a
  paired PR in `../clawperator-skills` that bumps the registry schema and seeds
  Google Home HVAC entries (`["air conditioner", "aircon", "ac", "heater",
  "hvac", "climate", "google home"]`) in the same review window as the Node
  change. Do not rely only on a local test fixture to prove the behavior.
- `skills for-app <pkg>` must be implemented as a thin wrapper over the
  existing `searchSkills({ app })` path. Do not introduce a new domain module.
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
- Treat testing as first-class work. Each phase must add or tighten the test
  path that proves its shipped behavior; do not rely on manual confidence or
  on later phases to backfill validation.
- `bash -n sites/landing/public/install.sh` is syntax validation only. Any
  installer behavior change must also be proven through
  `validation/install/test_install.sh` or a clearly justified existing harness
  under `validation/install/`.
- Do not split `sites/landing/public/install.sh` into sibling helper files as
  part of Phase 3. The public installer must keep working as a single-file
  stdin script, and the current harnesses also source functions directly before
  `main()` runs.
- Phase 3 installer work must be done in small local patches. Avoid large
  rewrite-style edits to `install.sh`.
- For Phase 3, "validate after each slice" is not satisfied by `bash -n`
  alone. After each slice, rerun:
  - `bash -n sites/landing/public/install.sh`
  - `bash validation/install/test_authoring_skills.sh`
  - `bash validation/install/test_main.sh`
  Then run `./validation/install/test_install.sh` when a slice changes
  end-to-end installer outputs or when declaring the phase complete.
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
| `validation/install/test_authoring_skills.sh` | Sourced-function harness shape for installer helpers |
| `validation/install/test_main.sh` | `main()`-driven harness shape and rerun behavior |
| `validation/install/test_install.sh` | Top-level installer validation suite |
| `docs/internal/design/agent-host-integration.md` | Host-agent bridge order and design constraints |
| `docs/internal/openclaw-reference.md` | OpenClaw context for future-facing guidance |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for Phase 4 docs work |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate | Cross-repo dependency |
| --- | --- | --- | --- | --- | --- |
| PR-1 | Runtime discovery ergonomics | 1, 2 | default, thinking | none | Phase 2 requires a paired PR in `../clawperator-skills` before the phase is complete |
| PR-2 | Install and host-agent artifacts | 3, 4 | default, default | PR-1 merged | none |

## Testing Model

| Phase | Primary proof | What it must prove | Not sufficient by itself |
| --- | --- | --- | --- |
| 1 | `apps/node/src/test/unit/skills.test.ts` | installed-home registry fallback, env precedence, unchanged failure semantics, warning suppression | manual `skills list` spot-checks |
| 2 | `apps/node/src/test/unit/skills.test.ts` plus paired `../clawperator-skills` change | `skills for-app`, deterministic ranking, exact findings-driven query regressions, shipped keyword data exists in the real skills repo | only editing local fixtures, only checking one query by hand |
| 3 | `validation/install/test_authoring_skills.sh`, `validation/install/test_main.sh`, then `validation/install/test_install.sh` | durable artifact creation, runtime-skills rendering in `~/.clawperator/AGENTS.md`, JSON parseability, rerun idempotency, and compatibility with both sourced-function and `main()` installer entrypoints | `bash -n`, stdout inspection, one-off local install run |
| 4 | `validation/install/test_install.sh` plus `./scripts/docs_build.sh` | bounded `~/.agents/AGENTS.md` append behavior, docs accuracy, generated docs regeneration | docs edits without build, installer edits without harness coverage |

OpenClaw itself is not the test harness for this pack. We are testing the
surfaces an OpenClaw-style host actually consumes: CLI discovery behavior,
durable install artifacts, shared-agent pointer text, and docs.

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
   home-directory registry path is assembled elsewhere in the codebase. Note
   that `loadRegistry` already has a CWD-relative `../../skills/...` fallback
   (see `localSkillsRegistry.ts`). The new installed-home fallback must
   compose cleanly with it, not replace it.
2. Add a fallback so registry resolution checks the installed path under
   `~/.clawperator/skills/skills/skills-registry.json` before failing when no
   explicit env var or explicit registry path is provided. Suppress the
   "CLAWPERATOR_SKILLS_REGISTRY is not set" warning when the home-directory
   fallback resolves successfully - otherwise `doctor` still prints a
   misleading warning on the happy path.
3. Keep `CLAWPERATOR_SKILLS_REGISTRY` as an override. If it is set and points to
   a bad file, preserve the configured-path failure behavior.
4. Add unit tests for:
   - installed-home fallback succeeds when CWD-relative path is missing
   - explicit env var still takes precedence over both fallbacks
   - broken explicit env var still fails closed (path-not-found error)
   - CWD-relative path still works when present and env var is unset
   - warning about unset env var is suppressed when the home-directory
     fallback resolved successfully
5. Re-run the Node build and tests. Treat the new unit coverage as the merge
   gate for this phase; no later phase is allowed to "implicitly" cover
   registry fallback.

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

1. Add `keywords?: string[]` to `SkillEntry` in
   `apps/node/src/contracts/skills.ts` and teach `searchSkills` to match
   `--keyword` against it. Implement a ranking rule that places exact-token
   matches on `id` / `applicationId` / `keywords` ahead of substring matches on
   `summary`. Returned order must be deterministic. No fuzzy-match or semantic
   redesign.
2. Add `skills for-app <package_id>` as a thin wrapper over
   `searchSkills({ app })`. Register the subcommand in
   `apps/node/src/cli/registry.ts` and dispatch to a one-line handler in
   `apps/node/src/cli/commands/skills.ts`. Keep the output shape aligned with
   existing `formatSuccess` / `formatError` patterns. No new domain module.
3. Land the paired PR in `../clawperator-skills` that updates the registry
   JSON schema to include optional `keywords` and seeds Google Home HVAC
   entries with:
   - `google home`
   - `climate`
   - `hvac`
   - `air conditioner`
   - `aircon`
   - `ac`
4. Preserve the live query table in `findings.md` as the authoritative set of
   regression cases. Use those exact problem queries in tests.
5. Add unit tests for:
   - `skills for-app com.google.android.apps.chromecast.app` returns the four
     Google Home HVAC skills and nothing else
   - correct Google Home hits for `google home`
   - correct Google Home hits for `air conditioner`
   - correct Google Home hits for `aircon`
   - `"ac"` no longer ranks `com.coles.*` / `com.woolworths.*` /
     `com.globird.energy.*` ahead of the HVAC skills (use the exact mis-ranked
     list from `findings.md` F5 as the regression fixture)
   - explicit-keyword hit beats substring-summary hit in ordering
6. Update CLI help text only as needed to document the new discovery surface.
7. Re-run the Node build and tests. Confirm the regression set proves returned
   order, not only result inclusion.

### Acceptance Criteria

- `skills for-app` exists as a thin wrapper and returns the Google Home HVAC
  skills
- search improvements are driven by explicit `keywords` metadata and tested
  ranking rules; result order is deterministic
- the exact user-problem queries from `findings.md` are covered by unit tests,
  including the "ac" mis-ranking regression
- paired `../clawperator-skills` PR exists and carries the schema plus seeded
  Google Home HVAC keywords; Phase 2 is not complete until that sibling-repo PR
  is open and linked from the Clawperator PR
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

1. Keep all new Phase 3 logic in `sites/landing/public/install.sh` itself.
   Do not create sibling helper files or lazy-fetch helpers for this phase.
   The current installer contract must continue to work for both:
   - stdin execution via `curl ... | bash`
   - harnesses that source installer functions directly before `main()` runs
2. Implement Phase 3 in narrow slices, validating after each slice instead of
   landing one large edit:
   - Slice A: runtime-skills rendering in `write_agent_guide()`
   - Slice B: `install-state.json`
   - Slice C: `mcp-config-snippet.json`
   - Slice D: final summary text
   After each slice, run at minimum:
   - `bash -n sites/landing/public/install.sh`
   - `bash validation/install/test_authoring_skills.sh`
   - `bash validation/install/test_main.sh`
   Run `./validation/install/test_install.sh` once the slice changes
   top-level installer artifacts or summary behavior, and again before
   declaring Phase 3 complete.
3. Expand the `~/.clawperator/AGENTS.md` template in
   `sites/landing/public/install.sh` `write_agent_guide()` so it includes
   runtime skills, grouped by `applicationId`, with `intent`, `summary`, and a
   concrete `clawperator skills run <id>` invocation example. Source the data
   by reading the installed registry at
   `~/.clawperator/skills/skills/skills-registry.json`. If the registry is
   absent or unreadable, fall back to today's authoring-skills-only content
   and leave a clear "runtime skills not available" note - do not fail the
   install.
4. For runtime-skill rendering, prefer a small embedded `node` block that reads
   the installed registry JSON and prints grouped sections. Do not hand-roll
   complex JSON parsing in shell if a tiny embedded Node helper keeps the edit
   more local and deterministic.
5. Add a durable `~/.clawperator/install-state.json` artifact with at minimum:
   `schemaVersion`, `installedAt`, `cliVersion`, `apkVersion`, `registryPath`,
   `lastDeviceSerial`. Rewrite-safe. Field rules:
   - `schemaVersion`, `installedAt`, `cliVersion`: always required
   - `registryPath`: required when runtime skills install/configure succeeded,
     otherwise `null`
   - `apkVersion`: the known installer version when available, otherwise `null`
   - `lastDeviceSerial`: nullable when the install did not select one
6. Add `~/.clawperator/mcp-config-snippet.json` with paste-ready entries for
   Claude Desktop, Codex, and a generic stdio MCP consumer. Do not attempt
   automatic registration.
7. Update the final installer summary to reference the durable artifact paths
   rather than leaving critical orientation only in stdout.
8. Keep these changes additive. Do not rewrite unrelated install behavior.
9. Before broadening behavior, tighten the harnesses so they encode the Phase 3
   nullability contract directly:
   - `apkVersion` may be `null`
   - `registryPath` may be `null`
   - `lastDeviceSerial` may be `null`
10. Extend `validation/install/test_install.sh` (the existing harness) to
   assert: `~/.clawperator/AGENTS.md` lists at least one runtime skill when
   the registry is present; `install-state.json` exists and parses as JSON;
   `mcp-config-snippet.json` exists and contains the Claude Desktop entry;
   re-running the installer does not duplicate any of these artifacts or any
   appended sections.
11. Keep the harness additions phase-local. Do not defer installer-artifact
   assertions to Phase 4 just because both phases land in PR-2.
12. Treat `validation/install/test_authoring_skills.sh` and
    `validation/install/test_main.sh` as separate consumers with different
    failure modes:
    - `test_authoring_skills.sh` exercises sourced helper functions such as
      `write_agent_guide()` directly
    - `test_main.sh` exercises `main()` and rerun behavior
    Phase 3 is not complete until both still pass.

### Acceptance Criteria

- `~/.clawperator/AGENTS.md` describes runtime skills, not just authoring skills
- `install-state.json` and `mcp-config-snippet.json` are created by the install
  flow
- the final summary points at durable on-disk artifacts
- install behavior remains syntax-valid and covered by the appropriate test path

### Validation

```bash
bash -n sites/landing/public/install.sh
bash validation/install/test_authoring_skills.sh
bash validation/install/test_main.sh
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

1. If `~/.agents/AGENTS.md` already exists, append a bounded,
   guard-comment-delimited `## Clawperator` section (same discipline as the
   existing shell-rc append in `setup_skills_via_cli`). The section points to
   `~/.clawperator/AGENTS.md` and the `clawperator skills` discovery commands.
   If the file does not exist, do not create it - Clawperator does not own
   that path. Re-runs must not duplicate or drift the section.
2. Keep the bridge clearly a pointer/delegator. Do not try to mirror runtime
   skills into shared agent skill directories.
3. Use `.agents/skills/docs-author/SKILL.md` for the docs work.
4. Update the authored docs so they describe:
   - installed registry fallback behavior
   - the new app-oriented discovery surface
   - host-facing install artifacts
   - MCP snippet availability if Phase 3 shipped it
5. Extend `validation/install/test_install.sh` to cover the shared-agent
   bridge behavior: when `~/.agents/AGENTS.md` exists, the Clawperator block is
   appended exactly once; when the file is absent, the installer does not
   create it.
6. Regenerate docs and run the full docs build.

### Acceptance Criteria

- shared-agent bridge text is append-only, bounded, and idempotent
- public docs describe the shipped onboarding/discovery behavior and no more
- generated docs are produced through the normal docs workflow

### Validation

```bash
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
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
