# Docs API and CLI Information Architecture Cleanup Work Breakdown

Parent plan: `tasks/docs/cleanup/plan.md`

## Executive Summary

4 PRs, 5 phases. **PR-1** contains Phase 1, the generated CLI reference and
command metadata cleanup. **PR-2** contains Phases 2 and 3, the anchor
foundation plus ownership manifest and generated detail links. **PR-3** contains
Phase 4, focused authored-doc cleanup. **PR-4** contains Phase 5, warning-only
docs checks.

Current state assumes PR-1 has merged. Phase 1 is complete, and Phase 2 is next.

## Status

| Item | Value |
| --- | --- |
| State | in progress |
| Total PRs | 4 |
| Total phases | 5 |
| Completed | PR-1 / Phase 1 |
| Remaining | 2, 3, 4, 5 |
| Current / Next | Phase 2 |
| Blockers | none |

## Hard Rules

- Do not start PR-2 until PR-1 is merged. Do not start PR-3 until PR-2 is
  merged. Do not start PR-4 until PR-3 is merged.
- Treat `tasks/docs/cleanup/findings.md` as authoritative input. If code proves
  a finding wrong, append a dated `## Execution Notes` section before the phase
  commit and explain the correction.
- Read the source-of-truth code before changing docs. Existing docs alone are
  not sufficient evidence.
- Do not edit `sites/docs/.build/` or `sites/docs/site/` by hand. Update
  authored docs, source code metadata, or generator scripts, then regenerate.
- Use `.agents/skills/docs-author/SKILL.md` for authored public docs edits.
- Use `.agents/skills/docs-build/SKILL.md` for docs assembly, generated output,
  and docs build validation.
- Use `.agents/skills/api-agent-ux/SKILL.md` when reviewing command
  terminology, selector vocabulary, or docs that might compensate for API
  friction.
- Do not use regex-extracted flag dumps as public CLI reference output after
  Phase 1.
- Do not call `setup` or `provision` deprecated. `setup` is a guidance shim and
  top-level `provision emulator` is an alias for `emulator provision`.
- Keep recording commands in `api/cli.md`. The generated CLI page is the
  all-CLI index even though `docs/api/recording.md` owns behavior details.
- Do not create an authored `docs/api/cli.md` file. The CLI reference is
  generated into `sites/docs/.build/api/cli.md` for the public `api/cli.md`
  path.
- Keep `docs/api/overview.md` as the result-envelope owner in this task. Do not
  add result-envelope marker generation.
- The current `sites/docs/mkdocs.yml` does not enable a Markdown heading-id
  extension such as `attr_list`. For authored pages, use HTML anchors such as
  `<a id="action-click"></a>` immediately before the owning heading unless the
  implementation PR also enables and validates another explicit-anchor syntax.
- A phase that changes generator behavior must include tests or deterministic
  checks for that behavior in the same phase and commit.
- Commit each phase as a coherent unit after validation passes. Content-heavy
  authored docs work may use draft and refine commits if that makes review
  easier.
- Use regular hyphens only. Do not introduce em dashes.
- Never shorten `Clawperator`.

## Required Reading

Read these files IN THIS ORDER before writing anything for each PR.

| File | Why it matters |
| --- | --- |
| `tasks/docs/cleanup/plan.md` | Stable contract, phase boundaries, and decisions |
| `tasks/docs/cleanup/findings.md` | Verified audit findings and recommendations |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for authored public docs |
| `.agents/skills/docs-build/SKILL.md` | Required workflow for generated docs and build validation |
| `.agents/skills/api-agent-ux/SKILL.md` | Agent-facing API ergonomics guidance |
| `docs/internal/design/node-api-design-guiding-principles.md` | Durable naming and API design principles |
| `sites/docs/mkdocs.yml` | Current docs nav and page URLs |
| `sites/docs/source-map.yaml` | Current generated-page and marker assembly inputs |
| `.agents/skills/docs-build/scripts/assemble.py` | Docs assembly behavior |
| `.agents/skills/docs-build/scripts/generate_cli_reference.py` | CLI reference generator to change in Phase 1 and Phase 3 |
| `.agents/skills/docs-build/scripts/generate_error_table.py` | Error-code generated table behavior |
| `.agents/skills/docs-build/scripts/generate_selector_table.py` | Selector generated table behavior |
| `.agents/skills/docs-build/scripts/generate_mcp_tool_summary.py` | MCP generated summary behavior |
| `.agents/skills/docs-build/tests/test_generators.py` | Existing Python unittest coverage for docs-build generators; extend this before inventing a new test harness |
| `apps/node/src/cli/registry.ts` | CLI command names, summaries, aliases, and docs metadata |
| `apps/node/src/cli/selectorFlags.ts` | CLI selector flag definitions and aliases |
| `apps/node/src/contracts/selectors.ts` | Selector contract source |
| `apps/node/src/contracts/execution.ts` | Execution action contract source |
| `apps/node/src/contracts/aliases.ts` | Canonical action aliases and action-name evidence |
| `apps/node/src/contracts/inputAliases.ts` | Input alias evidence |
| `apps/node/src/contracts/errors.ts` | Error-code source of truth |
| `apps/node/src/contracts/result.ts` | Result-envelope source of truth |
| `apps/node/src/cli/commands/serve.ts` | Serve route source of truth |
| `docs/api/overview.md` | Current overview and result-envelope owner |
| `docs/api/actions.md` | Current action contract page |
| `docs/api/selectors.md` | Current selector contract page |
| `docs/api/errors.md` | Current error contract page |
| `docs/api/serve.md` | Current Serve docs and missing health-route inventory |
| `docs/api/doctor.md` | Current Doctor contract owner |
| `docs/api/recording.md` | Current recording workflow and command owner |
| `docs/api/mcp.md` | Current MCP docs owner |
| `docs/setup.md` | Current setup readiness flow and Doctor duplication |
| `docs/skills/overview.md` | Current skills overview plus command-contract material to migrate |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Simplify generated CLI reference and add command docs metadata | 1 | thinking | none |
| PR-2 | Add anchor foundation, ownership manifest, and generated detail links | 2, 3 | thinking, thinking | PR-1 merged |
| PR-3 | Clean up focused authored docs and nav | 4 | thinking | PR-2 merged |
| PR-4 | Add warning-only docs checks | 5 | default | PR-3 merged |

## Phase 1: CLI Reference Generator And Metadata

### Agent Tier

thinking

### Goal

Make `/api/cli/` a trustworthy, skimmable generated command index and routing
surface instead of a duplicate-heavy parser dump.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- any adjacent CLI metadata types used by `registry.ts`
- `.agents/skills/docs-build/scripts/generate_cli_reference.py`
- tests for CLI docs metadata or generator output, using existing test patterns
  if present
- generated docs output via the docs-build workflow only

### Steps

1. Inspect current command metadata in `registry.ts` and identify every command
   currently emitted into generated `api/cli.md`.
2. Add explicit docs-facing visibility metadata. At minimum support:
   - `normal` for canonical commands
   - `shim` for non-callable guidance entries such as top-level `setup`
   - `alias` for working aliases such as top-level `provision emulator`
3. Mark top-level `setup` as `shim`.
4. Mark top-level `provision` as an alias for `emulator provision`.
5. Complete curated public flag metadata for commands emitted in `api/cli.md`.
   Use `documentedFlags` or an equivalent explicit field.
6. For selector-using commands, show only these inline selector flags:
   - `--text`
   - `--id`
   - `--desc`
   - `--role`
7. Keep compatibility aliases accepted by parser behavior out of primary flag
   output. If aliases are rendered, render them only under canonical commands or
   an appendix.
8. Update `generate_cli_reference.py` to emit:
   - one command index table
   - concise per-command sections
   - stable `command-<name>` anchors for canonical commands
   - alias notes under canonical commands
   - no group-level duplicate tables
9. Remove regex-derived flag extraction from public flag output. If a command
   lacks curated metadata during migration, emit a generator warning or a
   placeholder rather than an exhaustive regex dump.
10. Ensure recording commands remain discoverable in generated `api/cli.md`.
11. Add or update tests for the generator and metadata behavior. Required cases:
   - shim command is omitted from public output
   - alias command is not emitted as a peer canonical command
   - curated flags render and regex-only flags do not
   - selector compatibility aliases do not render as primary flags
   - recording commands are present
12. Run docs generation and validation before committing.

### Acceptance Criteria

- `api/cli.md` has one command index and concise per-command sections.
- Command metadata is not repeated across a global table, group tables, and long
  bullet lists.
- Top-level `setup` is absent from public command output.
- Top-level `provision emulator` appears only as alias information, if shown.
- Primary flags are curated by metadata, not regex extraction.
- Compatibility selector aliases such as `--resource-id` and `--content-desc`
  are absent from primary flag output.
- Recording commands are discoverable in generated `api/cli.md`.

Human review checklist:

- The page reads as a designed reference rather than a parser dump.
- The recommended command and flag vocabulary matches code-backed public forms.
- No valid primary workflow became harder to find.
- The implementation does not alter CLI execution behavior except for docs
  metadata.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
python3 -m unittest discover -s .agents/skills/docs-build/tests
python3 .agents/skills/docs-build/scripts/generate_cli_reference.py > /tmp/clawperator-cli-reference.md
./scripts/docs_build.sh
rg -n "recording" sites/docs/.build/api/cli.md
if rg -n -- "--resource-id|--content-desc" sites/docs/.build/api/cli.md; then exit 1; fi
if rg -n '### `setup`|\\| `setup` \\|' sites/docs/.build/api/cli.md; then exit 1; fi
git diff --check -- apps/node .agents/skills/docs-build sites/docs docs
```

### Expected Commit

```text
docs(api): simplify generated CLI reference
```

## Phase 2: Anchor Foundation

### Agent Tier

thinking

### Goal

Define stable public anchor conventions and add explicit anchors to canonical
authored pages before generated detail links depend on them.

### Files or Surfaces To Change

- `docs/internal/design/`
- `docs/api/overview.md`
- `docs/api/actions.md`
- `docs/api/selectors.md`
- `docs/api/errors.md`
- `docs/api/serve.md`
- `docs/api/doctor.md`
- `docs/api/recording.md`
- `docs/api/mcp.md`
- `docs/setup.md`
- generated marker output only through docs-build workflow

### Steps

1. Add an internal docs note under `docs/internal/design/` that records the
   anchor conventions from `findings.md`.
2. Add explicit anchors to authored canonical pages for:
   - action types: `action-<type>`
   - selector fields: `selector-field-<field>`
   - selector CLI flags: `selector-flag-<flag>`
   - error codes: `error-<lowercase-code>`
   - result-envelope fields: `result-envelope-<field>`
   - Serve endpoints: `endpoint-<method>-<path>`
   - MCP tools: `mcp-tool-<name>`
   - setup steps: `setup-step-<slug>`
3. Use canonical names, not aliases. For actions, verify against
   `contracts/aliases.ts` and `contracts/execution.ts`.
4. Use an anchor syntax that the current docs build actually supports. With the
   current `mkdocs.yml`, prefer HTML anchors such as
   `<a id="error-node-not-found"></a>` immediately before the owning heading.
   Do not use `{#error-node-not-found}` unless the same PR enables and validates
   a Markdown extension that supports it.
5. Add only the links needed to prove the anchor pattern works. Leave broader
   cross-linking to Phase 3 and Phase 4.
6. Run docs build and link validation available in the current docs workflow.

### Acceptance Criteria

- Anchor conventions exist in a durable internal design note.
- Authored canonical pages declare stable anchors for the public concepts they
  own.
- Explicit anchor syntax is supported by the current docs build; unsupported
  `{#...}` heading markers are not introduced.
- `#action-click` exists and no canonical anchor is introduced for the `tap`
  input alias.
- `#endpoint-get-ping` and `#endpoint-get-version` are reserved for Serve health
  routes even if the full Serve prose lands in Phase 4.
- Result-envelope anchors live under `docs/api/overview.md`.

Human review checklist:

- Anchor names are predictable and stable.
- Anchors are attached to canonical owners, not summary-only pages.
- The phase does not become a broad prose rewrite.

### Validation

```bash
./scripts/docs_build.sh
rg -n "id=\"action-click\"|id=\"error-node-not-found\"|id=\"endpoint-get-ping\"|id=\"result-envelope-command-id\"" docs sites/docs/.build
git diff --check -- docs sites/docs
```

### Expected Commit

```text
docs(api): define stable API anchors
```

## Phase 3: Ownership Manifest And Generated Detail Links

### Agent Tier

thinking

### Goal

Add docs-owned concept ownership metadata and wire generated CLI output to link
canonical command entries to their authored detail pages and anchors.

### Files or Surfaces To Change

- `sites/docs/source-map.yaml` or new `sites/docs/ownership.yaml`
- `.agents/skills/docs-build/scripts/generate_cli_reference.py`
- `.agents/skills/docs-build/scripts/assemble.py` only if the ownership file
  needs assembly-time handling
- generator tests or docs-build validation helpers
- generated docs output via docs-build workflow only

### Steps

1. Choose whether to extend `source-map.yaml` or add `sites/docs/ownership.yaml`.
   Prefer a separate ownership file if it keeps generation inputs easier to
   review.
2. Declare canonical owners for:
   - CLI command detail links
   - execution action types
   - selectors
   - error codes
   - result envelope
   - Serve endpoints
   - MCP tools
   - setup flow
   - Doctor contract
   - recording workflow
   - skills CLI
3. Include command-to-detail routing for every canonical command emitted in
   generated `api/cli.md`.
4. Include command-to-action links where a command maps directly to an execution
   action or action family.
5. Update `generate_cli_reference.py` to consume the command-link portion of the
   ownership metadata.
6. Render generated CLI rows or sections with stable detail links.
7. Add warning-only validation for generated commands that lack a detail link.
   It may live in this phase or be scaffolded for Phase 5, but Phase 3 should
   have a deterministic way to inspect missing links.
8. Add tests or checks proving the generator uses ownership metadata and fails
   or warns predictably on missing links.

### Acceptance Criteria

- A docs-owned ownership manifest exists and is documented by usage.
- Generated CLI command entries link to canonical authored detail pages.
- Recording command detail links point to `docs/api/recording.md`.
- Skills command detail links point to `docs/skills/cli.md` if that page exists
  by this point, or to a planned placeholder in the ownership manifest with a
  Phase 4 follow-up note. Prefer creating the page in Phase 4 rather than
  inventing temporary prose in Phase 3.
- The ownership manifest is not embedded in runtime command behavior.

Human review checklist:

- Detail links route readers to behavior owners, not just nearby pages.
- The manifest is easy to update when commands or docs pages change.
- No broad autolinking has been introduced.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
python3 -m unittest discover -s .agents/skills/docs-build/tests
./scripts/docs_build.sh
rg -n "Details|See also|api/recording|skills/cli" sites/docs/.build/api/cli.md
git diff --check -- sites/docs .agents/skills/docs-build apps/node docs
```

### Expected Commit

```text
docs(api): add ownership links for CLI reference
```

## Phase 4: Focused Authored Page Cleanup

### Agent Tier

thinking

### Goal

Reduce duplication and sharpen contract ownership in authored docs without a
broad rewrite.

### Files or Surfaces To Change

- `docs/api/overview.md`
- `docs/api/actions.md`
- `docs/api/selectors.md`
- `docs/api/errors.md`
- `docs/api/serve.md`
- `docs/api/doctor.md`
- `docs/api/recording.md`
- `docs/api/mcp.md`
- `docs/setup.md`
- `docs/skills/overview.md`
- new `docs/skills/cli.md`
- `sites/docs/mkdocs.yml`
- `sites/docs/source-map.yaml` or `sites/docs/ownership.yaml` if new pages or
  owners are added

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` before editing authored docs.
2. Clarify API surface terminology in `overview.md`. Distinguish:
   - CLI command
   - CLI subcommand
   - execution action
   - Node contract
   - Serve endpoint
   - MCP tool
   - selector
   - error code
   - result envelope
3. Keep `overview.md#result-envelope` as the canonical result-envelope owner.
   Add links to that anchor from feature pages that show local envelope examples.
4. Update `serve.md` from `serve.ts`:
   - document `GET /ping`
   - document `GET /version`
   - verify the endpoint table against public routes in `serve.ts`
   - add or refine stable endpoint anchors
   - add an "Error Layers" section covering route-local wrapper errors,
     shared execution errors, and failed result envelopes
5. Trim Doctor contract detail from `setup.md`. Keep:
   - command to run
   - success condition
   - top setup-blocking failures
   - link to `api/doctor.md`
6. Preserve `docs/api/doctor.md` as the Doctor report, checks, exit, `--fix`,
   and recovery owner.
7. Add `docs/skills/cli.md` as the canonical skills CLI command detail page.
   Move or summarize command-contract material from `docs/skills/overview.md`
   so Overview remains conceptual.
8. Keep recording lifecycle, NDJSON, export, compare, and failures owned by
   `docs/api/recording.md`. Do not remove recording commands from `api/cli.md`.
9. Add focused authored annotations to `errors.md` where recovery remains thin.
   Do not attempt to annotate every error code if that makes the phase too
   large.
10. Add high-signal anchor-level cross-links from authored pages. Link the first
    important mention in a section; do not autolink repeated prose terms.
11. Reorder API nav in `sites/docs/mkdocs.yml` after the CLI page is simplified:
    - Overview
    - Actions
    - Selectors
    - CLI Reference
    - Snapshot Format
    - Devices
    - Doctor
    - Timeouts
    - Errors
    - Serve API
    - Daemon
    - MCP Server
    - Navigation Patterns
    - Recording Format
    - Logging
    - Environment Variables
12. Add the new skills CLI page to the Skills nav.
13. Reread every touched authored page after the first pass and make a refine
    commit if the prose still repeats ownership or over-promises behavior.

### Acceptance Criteria

- `overview.md` gives readers a compact and precise API surface map.
- `serve.md` includes `GET /ping`, `GET /version`, endpoint anchors, and an
  Error Layers section.
- `setup.md` is focused on first-run readiness and links to `doctor.md` for
  full Doctor contract details.
- `docs/skills/cli.md` exists and owns skills CLI behavior, output shapes,
  success conditions, and recovery.
- `docs/skills/overview.md` is conceptual and no longer carries the full skills
  CLI contract.
- Error annotations improve the most important thin recovery cases without
  creating unverified claims.
- API nav order changes only presentation, not page file paths.

Human review checklist:

- Every behavioral claim is traceable to code or a canonical docs owner.
- Pages are easier to skim, with less repeated prose.
- Agent-facing routes are explicit and hard to misread.
- No docs page over-promises behavior that code does not implement.

### Validation

```bash
./scripts/docs_build.sh
rg -n "GET /ping|GET /version|Error Layers" docs/api/serve.md
rg -n "docs/skills/cli.md|Skills CLI|skills/cli" sites/docs/mkdocs.yml docs sites/docs/.build
rg -n "result-envelope" docs/api docs/setup.md
rg -n "API call" docs/api docs/setup.md
bad_short='Cl''aw'
bad_timeout='EXECUTION_''TIMEOUT'
bad_selector='SELECTOR_''NOT_FOUND'
bad_dash=$'\u2014'
if rg -n "$bad_dash" docs tasks/docs/cleanup; then exit 1; fi
if rg -n "\\b${bad_short}\\b" docs tasks/docs/cleanup; then exit 1; fi
if rg -n "$bad_timeout|$bad_selector" docs; then exit 1; fi
git diff --check -- docs sites/docs
```

If `rg -n "API call"` reports intentional remaining usage, document the
allowlist in the phase commit message or execution note. Otherwise rewrite the
ambiguous term.

### Expected Commit

```text
docs(api): clarify canonical docs ownership
```

## Phase 5: Warning-Only Docs Checks

### Agent Tier

default

### Goal

Add lightweight warning-only validation so future docs changes notice broken
anchors, compatibility-only alias drift, and missing generated detail links.

### Files or Surfaces To Change

- `.agents/skills/docs-build/scripts/`
- docs-build validation wiring, if an existing hook is appropriate
- tests or fixtures for the new check
- documentation for running the check, if needed

### Steps

1. Inspect existing docs-build scripts and validation patterns before adding a
   new script.
2. Add warning-only checks for:
   - broken internal anchors
   - compatibility-only CLI aliases in authored public docs
   - generated command rows or sections missing detail links
3. Keep checks deterministic and narrow. Do not add broad prose autolinking or
   judgment-heavy lint.
4. Make the output actionable by printing file, line or command, and suggested
   owner when available.
5. Add tests or fixtures for the check behavior. Required cases:
   - valid anchor link produces no warning
   - missing anchor produces a warning
   - compatibility-only selector alias in authored docs produces a warning
   - generated command without detail link produces a warning
6. Decide whether the warning-only check should run inside `./scripts/docs_build.sh`
   or as a separate docs-build helper. If integrated into docs build, warnings
   must not fail the build in this phase.

### Acceptance Criteria

- Warning-only checks are available through the docs-build workflow or a clearly
  documented helper script.
- Warnings are deterministic and actionable.
- The checks do not block docs build on first introduction.
- Tests or fixtures prove the key warning cases.

Human review checklist:

- The checks catch the drift identified in `findings.md`.
- The checks are narrow enough that future docs authors will not ignore noisy
  output.
- No generated output was hand-edited to satisfy the checks.

### Validation

```bash
./scripts/docs_build.sh
python3 -m unittest discover -s .agents/skills/docs-build/tests
bad_short='Cl''aw'
bad_timeout='EXECUTION_''TIMEOUT'
bad_selector='SELECTOR_''NOT_FOUND'
bad_dash=$'\u2014'
if rg -n "$bad_dash" docs tasks/docs/cleanup .agents/skills/docs-build/scripts; then exit 1; fi
if rg -n "\\b${bad_short}\\b" docs tasks/docs/cleanup .agents/skills/docs-build/scripts; then exit 1; fi
if rg -n "$bad_timeout|$bad_selector" docs .agents/skills/docs-build/scripts; then exit 1; fi
git diff --check -- .agents/skills/docs-build docs sites/docs tasks/docs/cleanup
```

If the docs-build test harness changes away from `unittest`, update this
validation block in the same phase commit and explain the change in the commit
body.

### Expected Commit

```text
test(docs): add warning checks for docs links
```
