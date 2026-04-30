# Docs Cleanup Findings

## Scope

This audit covers the Clawperator public docs information architecture for API and CLI documentation, with emphasis on the generated CLI reference, canonical ownership, stable anchors, and agent usability.

Inspected surfaces:

- `sites/docs/mkdocs.yml`
- `sites/docs/source-map.yaml`
- `sites/docs/.build/api/cli.md`
- `.agents/skills/docs-build/scripts/assemble.py`
- `.agents/skills/docs-build/scripts/generate_cli_reference.py`
- `docs/index.md`
- `docs/setup.md`
- `docs/api/overview.md`
- `docs/api/actions.md`
- `docs/api/selectors.md`
- `docs/api/errors.md`
- `docs/api/devices.md`
- `docs/api/doctor.md`
- `docs/api/snapshot.md`
- `docs/api/serve.md`
- `docs/api/recording.md`
- `docs/api/navigation.md`
- `docs/api/timeouts.md`
- `docs/api/environment.md`
- `docs/api/daemon.md`
- `docs/api/mcp.md`
- `docs/api/logging.md`

Inspected source-of-truth code:

- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/selectorFlags.ts`
- `apps/node/src/contracts/aliases.ts`
- `apps/node/src/contracts/inputAliases.ts`
- `apps/node/src/contracts/selectors.ts`
- `apps/node/src/contracts/execution.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/contracts/result.ts`
- `apps/node/src/cli/commands/serve.ts`

Out of scope:

- Landing site IA under `sites/landing/`
- Styling or visual redesign
- Android runtime implementation details except where they define public contracts
- Editing generated docs directly
- Implementing the cleanup

## Executive Summary

The authored API docs are substantially stronger than the generated CLI reference. Pages such as `actions.md`, `selectors.md`, `doctor.md`, `serve.md`, and `recording.md` are generally code-grounded and useful. The main cleanup should not be a broad rewrite. It should first fix the generated CLI reference and then add canonical ownership and anchor-level links around the existing good content.

Highest-impact recommendations:

1. Rebuild `/api/cli/` as a generated command index plus concise per-command sections. Today it repeats command metadata three times and reads like a parser dump.
2. Stop regex-extracting public flags from command bodies. Add explicit public metadata, such as `documentedFlags`, and show only primary agent-facing flags.
3. Classify command visibility. Guidance shims such as top-level `setup` should be hidden from the public command index; working aliases such as top-level `provision emulator` should appear under their canonical command, not as peer commands.
4. Define stable anchors for commands, action types, selector concepts, error codes, result-envelope fields, serve endpoints, and setup steps.
5. Add a docs-owned ownership and link manifest so generated pages can route readers to the canonical authored pages.
6. Keep result-envelope prose authored for now, keep recording command coverage in both `api/cli.md` and `recording.md` at different depths, and treat nav reordering as low-risk because page URLs do not change when file paths stay the same.

This findings file is ready to feed into `$task-author`. There are no blocking open questions for task-pack creation.

## Current Docs Map

| Page | Type | Current role |
| --- | --- | --- |
| `docs/index.md` | Authored | Human and agent routing index |
| `docs/setup.md` | Authored | First-time install, device prep, Operator APK setup, readiness gate |
| `docs/api/overview.md` | Authored | Execution model, result envelope, surface differences |
| `docs/api/cli.md` | Generated | Current all-command reference generated from `registry.ts` |
| `docs/api/actions.md` | Authored | Canonical action types, parameters, CLI-to-action mapping |
| `docs/api/selectors.md` | Authored + marker | `NodeMatcher`, selector semantics, generated selector flag table |
| `docs/api/errors.md` | Authored + marker | Error shapes, recovery families, generated error-code table |
| `docs/api/devices.md` | Authored | Device listing and deterministic target resolution |
| `docs/api/doctor.md` | Authored | Doctor report contract, checks, exits, recovery |
| `docs/api/snapshot.md` | Authored | Snapshot command and XML output behavior |
| `docs/api/serve.md` | Authored | HTTP and SSE serve interface |
| `docs/api/recording.md` | Authored | Recording lifecycle, recording CLI commands, NDJSON, exports, compare |
| `docs/api/daemon.md` | Authored | Daemon lifecycle and proxy behavior |
| `docs/api/mcp.md` | Authored + marker | MCP server and generated tool summary |
| `docs/api/navigation.md` | Authored | Composed navigation patterns |
| `docs/api/timeouts.md` | Authored | Execution and action timeout budgeting |
| `docs/api/environment.md` | Authored | Environment variables and runtime configuration |

Generation pipeline:

```text
docs/ authored source
+ apps/node/src/ source contracts and CLI metadata
+ sites/docs/source-map.yaml
-> .agents/skills/docs-build/scripts/assemble.py
-> sites/docs/.build/
-> ./scripts/docs_build.sh
-> sites/docs/site/
```

Current generated pieces:

- `api/cli.md` is fully generated from `generate_cli_reference.py`.
- `api/errors.md` expands `<!-- CODE-DERIVED: error-codes -->`.
- `api/selectors.md` expands `<!-- CODE-DERIVED: selector-flags -->`.
- `api/mcp.md` expands `<!-- CODE-DERIVED: mcp-tool-summary -->`.

## Source-of-Truth Model

| Surface | Code source of truth | Rendered docs owner | Generation policy |
| --- | --- | --- | --- |
| CLI command existence, primary names, summaries | `apps/node/src/cli/registry.ts` | `api/cli.md` as generated index | Generated |
| CLI public flags | `registry.ts` explicit metadata, backed by command handlers | `api/cli.md` for primary flags; detail pages for semantics | Generated from curated metadata only |
| CLI aliases and compatibility forms | `registry.ts` parser metadata | `api/cli.md` under canonical command or aliases appendix | Generated, never equal-weight with primary names |
| Execution action types | `apps/node/src/contracts/aliases.ts` | `docs/api/actions.md` | Authored, optionally supported by generated summary later |
| Execution action parameters | `apps/node/src/contracts/execution.ts`, validation and builders | `docs/api/actions.md` | Authored |
| Selectors | `contracts/selectors.ts`, `cli/selectorFlags.ts` | `docs/api/selectors.md` | Authored + generated flag table |
| Result envelope | `contracts/result.ts`, `runExecution` wrapper behavior | `docs/api/overview.md` | Authored for now |
| Error codes | `contracts/errors.ts` | `docs/api/errors.md` | Generated table plus authored recovery guidance |
| Device targeting | device domain code and CLI handlers | `docs/api/devices.md` | Authored |
| Doctor checks and report | doctor domain code and contract files | `docs/api/doctor.md` | Authored |
| Setup flow | installer, operator setup/remediate, doctor readiness | `docs/setup.md` | Authored happy path with links to contract pages |
| Serve endpoints | `apps/node/src/cli/commands/serve.ts` | `docs/api/serve.md` | Authored |
| Recording workflow | recording domain code and CLI handlers | `docs/api/recording.md`; summarized in `api/cli.md` | Authored detail, generated CLI routing |
| Examples | verified authored docs | Relevant authored page | Authored only |

Key terminology decisions:

- Use **CLI command** for `clawperator <command>` shell invocations.
- Use **CLI subcommand** for nested CLI surfaces such as `operator setup` or `recording export`.
- Use **execution action** or **action type** for `actions[i].type` values in execution JSON.
- Use **Serve endpoint** or **HTTP endpoint** for `POST /execute`, `GET /devices`, and related routes.
- Use **Node contract** for TypeScript data shapes under `apps/node/src/contracts/`.
- Use **result envelope** only for the `[Clawperator-Result]` terminal envelope. CLI and serve may wrap it.

## Findings

### F-01 - Generated CLI Reference Triple-Duplicates Command Metadata

Severity: High

Surface: `sites/docs/.build/api/cli.md`, `.agents/skills/docs-build/scripts/generate_cli_reference.py`

Evidence:

- `generate_cli_reference.py` emits a global command table in `main()`.
- `render_group()` then emits a group table and per-command bullet sections.
- The current local `api/cli.md` output is about 360 lines and repeats command, syntax, alias, flag, and summary data for many commands.

Why it matters for humans:

The page is not skimmable. It gives the impression of generated accumulation rather than a designed reference. If metadata diverges between layers, the page can contradict itself.

Why it matters for agents:

Repeated command facts waste retrieval budget and make it harder to identify the authoritative command entry.

Recommendation:

Restructure the generator to output:

1. One command index table.
2. One concise per-command section per canonical command.
3. One optional aliases appendix only if the alias inventory is large enough to justify it.

Remove group-level duplicate tables.

### F-02 - Public CLI Flags Are Extracted Too Broadly

Severity: High

Surface: `generate_cli_reference.py`, `registry.ts`, generated `api/cli.md`

Evidence:

- `parse_supported_flags()` falls back to regex extraction of every `--flag` token in a command body when `documentedFlags` is absent.
- This captures compatibility aliases, help prose, examples, error strings, and internal implementation details.
- The selector source confirms primary flags are `--id`, `--desc`, `--role`, `--text`, and related canonical forms. Longer spellings such as resource-id and content-description variants are compatibility aliases, not primary docs forms.
- The generated `skills` row currently exposes a legacy package-name alias and other compatibility flags at the same visual weight as primary flags.

Why it matters for humans:

Readers cannot distinguish recommended public forms from accepted compatibility forms.

Why it matters for agents:

Agents learn from docs. If compatibility aliases are shown as primary forms, agents will copy them and reinforce the wrong API vocabulary.

Recommendation:

Add curated command metadata for public docs:

- `documentedFlags`: only primary agent-facing flags.
- Optional `acceptedAliases`: compatibility forms that should be hidden from main reference output.
- Optional flag category metadata if needed later, such as selector, device, output, mode.

The generator must not use regex extraction for public flag tables. During migration, missing `documentedFlags` should produce a warning or a placeholder, not an exhaustive regex dump.

### F-03 - Guidance Shims And Aliases Appear As Peer Commands

Severity: High

Surface: `registry.ts`, generated `api/cli.md`

Evidence:

- Top-level `setup` is registered but its handler always returns a usage error directing callers to `clawperator operator setup --apk <path>`. It is a guidance shim, not a valid command path.
- Top-level `provision emulator` is a working alias for `emulator provision`.
- Both currently appear as ordinary generated entries.

Why it matters for humans:

The command index should teach the canonical surface. Showing a non-callable shim beside real commands is misleading.

Why it matters for agents:

An agent may choose `clawperator setup` because it appears in the command table, then waste a turn recovering from the usage response.

Recommendation:

Add command visibility metadata:

| Kind | Treatment |
| --- | --- |
| `normal` | Main index and per-command section |
| `shim` | Omit from public command output; keep parser behavior for teaching errors |
| `alias` | Mention under the canonical command; include in aliases appendix only if inventory grows |

Apply immediately:

- `setup` -> `shim`
- top-level `provision` -> `alias` for `emulator provision`

Do not label either one as legacy or discouraged unless code adds explicit metadata with that policy.

### F-04 - Stable Canonical Anchors Are Not Defined

Severity: High

Surface: generated `api/cli.md`, authored API pages, docs workflow

Evidence:

- Headings currently rely on MkDocs slug generation.
- Generated command headings are incidental and not declared as stable public anchors.
- Action, error, selector, endpoint, and setup-step references do not have a shared anchor convention.

Why it matters for humans:

Specific docs references such as "the snapshot command docs" or "the NODE_NOT_FOUND recovery docs" should be shareable as stable links.

Why it matters for agents:

Agents benefit from precise retrieval targets. Stable anchors allow task packs, skills, and host-agent guidance to point at exact contract entries.

Recommendation:

Define and implement this anchor strategy:

| Concept | Anchor pattern | Example |
| --- | --- | --- |
| CLI command | `command-<name>` | `#command-snapshot` |
| CLI subcommand | `command-<name>-<subcommand>` | `#command-recording-export` |
| Execution action type | `action-<type>` | `#action-click` |
| Selector field | `selector-field-<field>` | `#selector-field-resource-id` |
| Selector CLI flag | `selector-flag-<flag>` | `#selector-flag-id` |
| Error code | `error-<lowercase-code>` | `#error-node-not-found` |
| Result envelope field | `result-envelope-<field>` | `#result-envelope-command-id` |
| Serve endpoint | `endpoint-<method>-<path>` | `#endpoint-post-execute` |
| Setup step | `setup-step-<slug>` | `#setup-step-install-operator-apk` |

Use canonical action types from `contracts/aliases.ts`; for example, use `action-click`, not `action-tap`.

### F-05 - Canonical Ownership Is Implicit

Severity: Medium

Surface: docs workflow, `source-map.yaml`, authored API pages

Evidence:

- `source-map.yaml` declares generated pages and marker expansions, but it does not say which page owns each concept.
- Several pages intentionally summarize concepts owned elsewhere, such as setup referencing doctor readiness or snapshot showing a result-envelope example.
- There is no machine-readable routing table for generated CLI detail links.

Why it matters for humans:

Maintainers need to know where to make the durable change and where to add only a summary link.

Why it matters for agents:

A future implementation agent may edit the most visible page rather than the canonical owner.

Recommendation:

Add a docs-owned manifest, either by extending `sites/docs/source-map.yaml` or adding `sites/docs/ownership.yaml`.

It should declare:

- canonical page per concept category
- generated page or marker ownership
- command-to-detail links for `api/cli.md`
- command-to-action links where applicable
- allowed summary pages for major concepts

Keep this manifest in the docs build surface, not embedded in `registry.ts`, unless the CLI itself needs to emit the URL in help or errors.

### F-06 - Cross-Linking Stops At Page Level

Severity: Medium

Surface: generated `api/cli.md`, authored API pages

Evidence:

- Authored pages already include many page-level related links.
- Generated `api/cli.md` does not link command rows or sections to canonical authored detail pages.
- Existing links rarely target specific anchors for commands, action types, error codes, selectors, or endpoints.

Why it matters for humans:

Finding a command does not immediately lead to behavior, output shape, selector rules, or recovery guidance.

Why it matters for agents:

Agents may retrieve the generated command row without the contract page that explains how to interpret results or recover from errors.

Recommendation:

After anchors exist, add generated and authored anchor-level links:

- CLI command -> canonical command detail page
- CLI command -> action type where applicable
- action type -> CLI command where useful for verification
- feature page error mention -> exact error code anchor
- setup readiness gate -> Doctor contract anchor

Do not add broad prose autolinking. Use explicit authored links and generated links from the ownership manifest.

### F-07 - API Surface Terminology Is Ambiguous

Severity: Medium

Surface: `overview.md`, `actions.md`, `serve.md`, CLI reference

Evidence:

The docs can use API language to refer to several different surfaces: shell commands, execution JSON, HTTP endpoints, MCP tools, and TypeScript contract shapes.

Why it matters for humans:

Readers may not know whether they should run a CLI command, construct JSON, call HTTP, or use an MCP client.

Why it matters for agents:

Agents need to choose the right surface before they act. Ambiguous surface names increase the chance of an invalid call shape.

Recommendation:

Add a compact surface map to `overview.md` and use precise terms consistently:

- CLI command
- execution action
- Node contract
- Serve endpoint
- MCP tool
- selector
- error code
- result envelope

Roll terminology cleanup incrementally, beginning with `overview.md`, `actions.md`, and the generated CLI page.

### F-08 - Result Envelope Canonical Home Needs Clearer Signposting

Severity: Medium

Surface: `overview.md`, `snapshot.md`, `serve.md`, `recording.md`, `contracts/result.ts`

Evidence:

- `contracts/result.ts` defines the result-envelope shape.
- `overview.md` currently contains the main result-envelope explanation.
- Snapshot, serve, recording, and errors pages show envelope examples or failure interpretations.

Why it matters for humans:

It is not obvious which page owns the field list if the envelope shape changes.

Why it matters for agents:

Agents branch on envelope fields. They need one canonical place to understand wrapper-vs-envelope fields.

Recommendation:

Declare `docs/api/overview.md#result-envelope` as the canonical home for now. Other pages may show local examples but should link to that anchor for full field semantics.

Do not add result-envelope marker generation in the first implementation task. The current authored explanation is acceptable, and generating TypeScript interface tables from `contracts/result.ts` is a separate design problem. Reconsider marker generation only after the CLI reference and anchor strategy are fixed.

### F-09 - Serve Error Layers Need Sharper Separation

Severity: Medium

Surface: `docs/api/serve.md`, `apps/node/src/cli/commands/serve.ts`, `docs/api/errors.md`

Evidence:

- Serve route handlers emit route-local wrapper errors such as invalid body or invalid device id.
- Execution endpoints also pass through `runExecution()` results, which may contain shared Clawperator error codes or failed result envelopes.
- The distinction exists in prose but should be easier to branch on.

Why it matters for humans:

HTTP consumers need to know whether a failure came from request validation, serve routing, device resolution, or Android execution.

Why it matters for agents:

An agent may see HTTP `200` with a failed envelope or HTTP `400` with a serve-local wrapper. Those require different recovery logic.

Recommendation:

Add a `serve.md` section named "Error Layers" with:

- route-local HTTP wrapper errors
- shared `runExecution()` errors
- result-envelope failures
- exact fields to inspect in order
- links to `errors.md` and `overview.md#result-envelope`

### F-10 - Doctor Contract Ownership Is Blurry Between Setup And Doctor Pages

Severity: Medium

Surface: `docs/setup.md`, `docs/api/doctor.md`

Evidence:

- `docs/api/doctor.md` is the natural owner for Doctor report shape, check list, exit code behavior, `--fix`, and recovery.
- `docs/setup.md` includes substantial Doctor details because setup needs a readiness gate.

Why it matters for humans:

Maintainers may update Doctor behavior in one page and miss the other.

Why it matters for agents:

An agent following setup should see the readiness gate, while an agent interpreting a Doctor failure should land on the full Doctor contract.

Recommendation:

Keep `setup.md` focused on first-run flow:

- command to run
- success condition
- top setup-blocking failures
- link to `api/doctor.md`

Move or reduce full Doctor contract details in `setup.md`. Do not split `setup.md` into a new troubleshooting page in the first cleanup task.

### F-11 - Selector Flags Are Repeated Too Verbosely In CLI Output

Severity: Medium

Surface: generated `api/cli.md`, `docs/api/selectors.md`, `selectorFlags.ts`

Evidence:

- Selector flags are listed repeatedly for every selector-using command.
- `selectors.md` already owns the full selector contract and generated selector flag table.
- Compatibility aliases should not appear in primary command summaries.

Why it matters for humans:

The CLI reference becomes wider and noisier without explaining selector semantics.

Why it matters for agents:

Agents need the four common selector flags up front, then a stable link to the full selector contract.

Recommendation:

In `api/cli.md`, show only the most-used primary selector flags inline:

- `--text`
- `--id`
- `--desc`
- `--role`

Then link to `selectors.md` for `--selector`, contains variants, container selectors, mutual exclusion, blank-value rules, and compatibility aliases.

### F-12 - Error Code Table Is Complete But Thin

Severity: Low

Surface: `docs/api/errors.md`, `generate_error_table.py`, `contracts/errors.ts`

Evidence:

- The generated error table enumerates codes from `contracts/errors.ts`.
- Many rows have sparse notes.
- Recovery families and key cases exist, but less-common codes are not easy to act on.

Why it matters for humans:

Debugging a less-common error may still require code search.

Why it matters for agents:

Agents need to know whether to retry, repair setup, adjust selectors, or stop.

Recommendation:

After anchor work, add authored annotations for:

- primary surfaces that may emit the code
- retryability or recovery family
- canonical recovery page or section

Do not block the initial CLI reference cleanup on this.

### F-13 - Nav Order Can Better Match The Learning Path

Severity: Low

Surface: `sites/docs/mkdocs.yml`

Evidence:

The API nav currently places CLI Reference immediately after Overview. That exposes the weakest generated page before the reader has Actions and Selectors vocabulary.

Why it matters for humans:

A first-time reader benefits from concepts before exhaustive command lookup.

Why it matters for agents:

Agents ingesting nav order may encounter command syntax before action and selector concepts.

Recommendation:

After `/api/cli/` is simplified, reorder only the API nav entries so concepts precede command lookup:

1. Overview
2. Actions
3. Selectors
4. CLI Reference
5. Snapshot Format
6. Devices
7. Doctor
8. Timeouts
9. Errors
10. Serve API
11. Daemon
12. MCP Server
13. Navigation Patterns
14. Recording Format
15. Logging
16. Environment Variables

This does not require redirects as long as file paths remain unchanged. MkDocs nav order changes presentation, not page URLs.

### F-14 - Docs Should Not Compensate For API Friction

Severity: Low

Surface: API agent UX, CLI docs, command help

Evidence:

The repo's API agent UX guidance says the command an agent tries first should work when it maps cleanly to deterministic behavior. Documentation can teach canonical forms, but it should not be the only fix for rejected intuitive forms.

Why it matters for humans:

Docs full of workaround guidance make the project feel less intentional.

Why it matters for agents:

Agents recover better from parser aliases and teaching errors than from prose instructions buried in docs.

Recommendation:

When cleanup finds repeated prose explaining a non-obvious CLI shape, file an API ergonomics follow-up rather than adding more docs. Keep this out of the first docs cleanup task unless a specific parser bug is discovered.

## Recommended Link And Anchor Strategy

Anchor rules:

- Use explicit anchors for public canonical entries.
- Use canonical names, not aliases.
- Generate command anchors from the CLI generator.
- Add authored anchors only where a page owns the concept.
- Validate internal links after anchors are added.

Canonical examples:

| Concept | Anchor |
| --- | --- |
| `snapshot` CLI command | `api/cli.md#command-snapshot` |
| `recording export` CLI subcommand | `api/recording.md#command-recording-export` and index link from `api/cli.md` |
| `click` action type | `api/actions.md#action-click` |
| `resourceId` selector field | `api/selectors.md#selector-field-resource-id` |
| `--id` selector flag | `api/selectors.md#selector-flag-id` |
| `NODE_NOT_FOUND` error | `api/errors.md#error-node-not-found` |
| `commandId` result-envelope field | `api/overview.md#result-envelope-command-id` |
| `POST /execute` | `api/serve.md#endpoint-post-execute` |

Cross-link maintenance:

- Use a docs-owned manifest for generated command detail links.
- Add explicit authored links for first high-signal mention in a section.
- Do not autolink ordinary prose words such as setup, open, read, type, wait, or press.
- A later warning-only lint may check broken anchors and compatibility-only aliases in authored docs.

## Recommended CLI Reference Strategy

`/api/cli/` should become a generated command index and routing surface.

It should include:

- one index row per canonical command
- primary syntax
- short summary
- primary flags only
- details link to the canonical authored page
- action link when the command maps to an execution action
- concise per-command section
- alias notes under canonical commands

It should omit:

- regex-derived flag dumps
- compatibility aliases as primary flags
- non-callable guidance shims
- repeated group tables
- long subcommand syntax blocks in table cells
- full selector flag enumeration
- behavior explanations already owned by authored pages

Recording commands should appear in `api/cli.md` because it is the all-CLI command index. Their detail links should point to `docs/api/recording.md`, which remains the canonical behavioral and format owner. The CLI index should not repeat the recording lifecycle or output shapes.

## Recommended Implementation Direction

### Phase 1 - CLI Reference Generator And Metadata

Goal: make `/api/cli/` trustworthy and skimmable.

Work:

1. Add command visibility metadata to `registry.ts` or a docs-owned companion manifest.
2. Mark top-level `setup` as a shim and top-level `provision` as an alias of `emulator provision`.
3. Add `documentedFlags` or equivalent curated public flag metadata for all commands.
4. Update `generate_cli_reference.py` to remove duplicate group tables.
5. Generate one index plus concise command sections.
6. Generate stable `command-<name>` anchors.
7. Include recording commands in the generated CLI index with links to `recording.md`.
8. Remove regex-derived public flag output.

Validation:

```bash
python3 .agents/skills/docs-build/scripts/generate_cli_reference.py > /tmp/cli.md
./scripts/docs_build.sh
! rg -- "--resource-id|--content-desc" sites/docs/.build/api/cli.md
! rg "### `setup`|\\| `setup` \\|" sites/docs/.build/api/cli.md
```

Expected result:

- no command appears in three duplicated layers
- top-level `setup` is absent from public command output
- top-level `provision` appears only as an alias note if included
- compatibility selector aliases are absent from primary flag output
- recording commands are discoverable in `api/cli.md`

### Phase 2 - Anchor Foundation And Detail Links

Goal: make command, action, error, selector, endpoint, and envelope links stable.

Work:

1. Add an internal docs anchor strategy note under `docs/internal/design/`.
2. Add explicit anchors to authored canonical pages.
3. Add generated command detail links from the CLI reference.
4. Add command-to-action and action-to-command links where useful.
5. Add exact error-code links in high-traffic feature pages.

Validation:

```bash
./scripts/docs_build.sh
rg "#command-|#action-|#error-|#endpoint-" sites/docs/.build docs/api docs/setup.md
```

### Phase 3 - Ownership Manifest

Goal: prevent future drift.

Work:

1. Add `sites/docs/ownership.yaml` or extend `source-map.yaml`.
2. Declare canonical owners for command detail links, action types, selectors, errors, result envelope, serve endpoints, doctor checks, setup flow, and recording workflow.
3. Wire the CLI generator to consume the command link portion.
4. Add warning-only validation for missing command detail links.

Validation:

```bash
./scripts/docs_build.sh
```

### Phase 4 - Focused Authored Page Cleanup

Goal: reduce duplication and clarify contracts without a broad rewrite.

Work:

1. Clarify API surface terminology in `overview.md`.
2. Trim Doctor contract detail from `setup.md`; keep setup readiness gate and link to `doctor.md`.
3. Add a Serve "Error Layers" section.
4. Add or improve result-envelope links from feature pages to `overview.md#result-envelope`.
5. Add authored annotations to `errors.md` only where recovery remains thin.
6. Reorder API nav entries after `/api/cli/` is fixed. Do not add redirects for nav-only reordering.

Validation:

```bash
./scripts/docs_build.sh
rg "API call" docs/api docs/setup.md
```

### Phase 5 - Warning-Only Docs Checks

Goal: catch regressions without making docs authoring brittle.

Work:

1. Add broken internal anchor checks.
2. Add warning-only checks for compatibility-only CLI aliases in authored public docs.
3. Add warning-only checks for generated command rows missing a details link.

Do not add broad prose autolinking or judgment-heavy lint.

## Decisions Resolved

| Decision | Resolution |
| --- | --- |
| Top-level `setup` | Guidance shim only. Hide from public CLI index. Do not label as legacy or discouraged unless code adds explicit metadata with that policy. |
| Top-level `provision emulator` | Working alias for `emulator provision`. Show under canonical command, not as peer. |
| Result envelope marker generation | Defer. Keep `overview.md` as authored canonical home for now. |
| Recording commands in `api/cli.md` | Yes. Include them in the generated all-CLI index with links to `recording.md`. |
| Recording behavioral ownership | `docs/api/recording.md` remains canonical for lifecycle, output, NDJSON, export, compare, and failures. |
| Nav reorder redirect overhead | No redirect overhead for nav-only reorder when file paths stay unchanged. Reorder later as a low-risk docs IA cleanup. |
| Skills `documentedFlags` | Do within the full generator metadata cleanup, prioritizing `skills`, not as a one-off patch. |
| Selector flags inline | Show `--text`, `--id`, `--desc`, `--role`; link to Selectors for full options. |
| Action mapping table in `actions.md` | Keep. It provides reverse lookup from execution action to CLI verification path. |
| Ownership metadata location | Prefer docs-owned manifest over hardcoding docs IA in `registry.ts`; keep runtime behavior metadata in code. |
| Setup split | Do not split now. Trim setup to readiness flow and link to Doctor. |
| Terminology cleanup | Incremental, tied to touched pages, starting with Overview and Actions. |

## Open Questions

None blocking task-author work.

The implementation task can proceed with the decisions above. Any later choice about generating result-envelope field tables, splitting setup into multiple pages, or adding stricter docs lint should be treated as follow-up after the CLI reference and anchor foundation ship.
