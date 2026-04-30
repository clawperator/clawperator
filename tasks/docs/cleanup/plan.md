# Docs API and CLI Information Architecture Cleanup

## Executive Summary

Clean up the Clawperator public docs information architecture for API and CLI
surfaces, starting with the generated CLI reference and then adding stable
anchors, ownership metadata, focused authored-doc improvements, and warning-only
regression checks. This is docs-dominant but crosses Node CLI metadata and docs
generation code.

This task ships in **4 PRs across 5 phases**. **PR-1** fixes the generated CLI
reference and command metadata. **PR-2** adds canonical anchors, ownership
metadata, and generated detail links. **PR-3** performs focused authored-doc
cleanup. **PR-4** adds warning-only docs checks.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 4 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships, the public docs should be easier for humans and agents to
trust:

- `/api/cli/` is a skimmable generated command index and routing surface
- each important public API or command concept has a stable canonical anchor
- generated pages link readers to authored contract owners
- duplicated CLI, selector, setup, doctor, serve, skills, and recording content
  is reduced without hiding useful entry points
- docs quality checks catch common drift without brittle broad autolinking

## Why Now

`tasks/docs/cleanup/findings.md` shows that the authored API docs are generally
stronger than the generated CLI reference. The current CLI reference repeats
metadata, exposes compatibility flags as primary forms, and treats guidance
shims and aliases like ordinary commands. That weakens the docs surface most
likely to be inspected by first-time users, agents, and product reviewers.

The cleanup should happen before more public docs or agent skills build links to
unstable command sections, duplicated generated tables, or unclear canonical
owners.

## In Scope

- command visibility and public-doc metadata for CLI commands
- `generate_cli_reference.py` output structure
- generated CLI reference anchors and details links
- stable anchors for commands, actions, selectors, errors, result envelope
  fields, Serve endpoints, MCP tools, and setup steps
- docs-owned ownership metadata for canonical pages and generated detail links
- focused updates to `overview.md`, `serve.md`, `setup.md`, `doctor.md`,
  `errors.md`, `selectors.md`, `recording.md`, `mcp.md`, and skills docs where
  needed by the findings
- API nav reordering after the CLI reference is simplified
- warning-only docs checks for internal anchors, compatibility-only aliases, and
  missing generated detail links
- docs regeneration through the existing docs-build workflow

## Out of Scope

- changing Android runtime behavior
- redesigning the visual theme or MkDocs styling
- changing the landing site under `sites/landing/`
- changing CLI parser behavior except for docs metadata needed by the generator
- creating an authored `docs/api/cli.md` source file
- adding broad prose autolinking
- generating result-envelope field tables in the first cleanup
- splitting `docs/setup.md` into multiple pages
- removing recording commands from `api/cli.md`
- treating `setup` or `provision` as deprecated
- editing `sites/docs/.build/` or `sites/docs/site/` by hand

## Existing Artifact Scope

- `tasks/docs/cleanup/findings.md` is the authoritative rationale and findings
  input for this task pack. Preserve it as the audit trail unless implementation
  discovers a code-backed contradiction. If that happens, append a dated
  `## Execution Notes` section at the end instead of rewriting history.
- `docs/` pages are authored sources and may be edited in the phases named by
  this plan.
- `apps/node/src/cli/registry.ts` and adjacent CLI metadata are in scope only
  for docs-facing command metadata and visibility. Do not redesign command
  execution behavior in this task.
- `.agents/skills/docs-build/scripts/` generator scripts are in scope for
  generated reference behavior and validation helpers.
- `sites/docs/source-map.yaml` may be extended or paired with a new ownership
  manifest. Do not use it as a place for runtime behavior rules.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/cli/registry.ts` | Command visibility, curated public flags, generated-doc metadata | PR-1 / Phase 1 |
| `.agents/skills/docs-build/scripts/generate_cli_reference.py` | CLI reference layout, command anchors, primary flag rendering, alias treatment | PR-1 / Phase 1, PR-2 / Phase 3 |
| `sites/docs/source-map.yaml` or `sites/docs/ownership.yaml` | Docs-owned canonical ownership and generated detail-link metadata | PR-2 / Phase 3 |
| `docs/internal/design/` | Internal anchor and ownership strategy note | PR-2 / Phase 2 |
| `sites/docs/.build/api/cli.md` | Generated staging output for public path `api/cli.md`; do not hand-edit and do not create an authored `docs/api/cli.md` source | PR-1 / Phase 1, PR-2 / Phase 3 |
| `docs/api/actions.md` | Canonical execution action anchors and links | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/selectors.md` | Canonical selector field and flag anchors | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/errors.md` | Error-code anchors and focused recovery annotations | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/overview.md` | Surface terminology map and result-envelope canonical home | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/serve.md` | Serve endpoint inventory, endpoint anchors, Error Layers section | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/setup.md` | Setup readiness flow and links to Doctor contract | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/doctor.md` | Canonical Doctor contract owner | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/recording.md` | Canonical recording lifecycle and command behavior owner | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/api/mcp.md` | Canonical MCP tool docs plus generated tool summary anchors | PR-2 / Phase 2, PR-3 / Phase 4 |
| `docs/skills/cli.md` | New canonical skills CLI detail page | PR-3 / Phase 4 |
| `docs/skills/overview.md` | Conceptual skills overview after command-contract content moves | PR-3 / Phase 4 |
| `sites/docs/mkdocs.yml` | API and Skills nav ordering | PR-3 / Phase 4 |
| docs validation scripts or checks | Warning-only drift checks | PR-4 / Phase 5 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Task rationale and decisions | `tasks/docs/cleanup/findings.md` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Docs build and generated-output workflow | `.agents/skills/docs-build/SKILL.md` |
| Agent-facing API design principles | `.agents/skills/api-agent-ux/SKILL.md`, `docs/internal/design/node-api-design-guiding-principles.md` |
| Docs nav and generated-page inputs | `sites/docs/mkdocs.yml`, `sites/docs/source-map.yaml` |
| Docs assembly pipeline | `.agents/skills/docs-build/scripts/assemble.py` |
| CLI reference generator | `.agents/skills/docs-build/scripts/generate_cli_reference.py` |
| Docs-build generator tests | `.agents/skills/docs-build/tests/test_generators.py` |
| Error and selector table generation | `.agents/skills/docs-build/scripts/generate_error_table.py`, `.agents/skills/docs-build/scripts/generate_selector_table.py` |
| MCP generated summary | `.agents/skills/docs-build/scripts/generate_mcp_tool_summary.py` |
| CLI command names, flags, aliases, and summaries | `apps/node/src/cli/registry.ts` |
| Selector flags and behavior | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Action types and aliases | `apps/node/src/contracts/execution.ts`, `apps/node/src/contracts/aliases.ts`, `apps/node/src/contracts/inputAliases.ts` |
| Error codes | `apps/node/src/contracts/errors.ts` |
| Result envelope | `apps/node/src/contracts/result.ts` |
| Serve routes | `apps/node/src/cli/commands/serve.ts` |
| Current authored API docs | `docs/api/` |
| Current setup docs | `docs/setup.md` |
| Current skills docs | `docs/skills/` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- `api/cli.md` remains the all-CLI command index and routing surface.
- Recording commands stay discoverable in `api/cli.md`; behavioral ownership
  remains in `docs/api/recording.md`.
- Top-level `setup` is a guidance shim. Hide it from the public CLI index.
- Top-level `provision emulator` is a working alias for `emulator provision`.
  Show it only under the canonical command or in an aliases appendix.
- Do not call `setup` or `provision` deprecated unless code later adds explicit
  deprecation metadata.
- Primary selector flags for inline CLI display are `--text`, `--id`, `--desc`,
  and `--role`.
- Compatibility selector aliases such as `--resource-id` and `--content-desc`
  must not appear as primary flags.
- Canonical action anchors use canonical action types from code. Use
  `#action-click`, not an anchor derived from the `tap` input alias.
- `docs/api/overview.md` is the authored canonical home for the result envelope
  in this task. Do not add result-envelope marker generation in PR-1 through
  PR-4.
- `docs/api/doctor.md` owns the Doctor contract. `docs/setup.md` owns setup
  readiness flow and links to Doctor.
- `GET /ping` and `GET /version` are implemented Serve endpoints and must be
  documented with the endpoint inventory.
- API nav reordering does not need redirect maps as long as page paths stay the
  same.
- Use a docs-owned manifest for docs ownership and detail links. Do not encode
  docs IA into runtime command behavior unless the CLI needs to emit that URL.
- The current MkDocs config does not enable a Markdown heading-id extension such
  as `attr_list`. For authored docs, use HTML anchors such as
  `<a id="action-click"></a>` immediately before the owning heading unless the
  implementation PR also enables and validates another explicit-anchor syntax.

**Judgment required:**

- The exact prose on authored docs pages, bounded by code and findings.
- The exact schema shape for ownership metadata, as long as it is stable,
  reviewable, and easy for the generator to consume.
- Which first high-signal authored mentions should gain anchor-level links.
- How much error-code recovery annotation to add in the first authored cleanup.
- Whether warning-only checks live as a new docs-build helper script or inside
  an existing validation path.

## Decision Rules

| Question | Rule |
| --- | --- |
| What owns command existence? | `registry.ts`, rendered through generated `api/cli.md`. |
| What owns command behavior? | The canonical authored detail page for that command family, linked from `api/cli.md`. |
| What owns command flags in the CLI index? | Curated docs metadata, such as `documentedFlags`, backed by handler behavior. |
| What happens when a command lacks curated docs flags during migration? | Emit a warning or placeholder. Do not fall back to regex flag dumps in public output. |
| What owns compatibility aliases? | Parser metadata in code; docs render them only under canonical commands or in an appendix. |
| What owns execution action semantics? | `docs/api/actions.md`, verified against `contracts/execution.ts` and aliases files. |
| What owns selector semantics? | `docs/api/selectors.md`, verified against selector contracts and flag builder code. |
| What owns result-envelope semantics? | `docs/api/overview.md#result-envelope` for this task. |
| What owns Serve endpoints? | `docs/api/serve.md`, verified against `serve.ts`. |
| What owns skills CLI behavior? | New `docs/skills/cli.md`; `docs/skills/overview.md` stays conceptual. |
| What owns recording behavior? | `docs/api/recording.md`; generated `api/cli.md` only routes to it. |
| How should cross-linking work? | Explicit authored links plus generated links from the ownership manifest. Do not broad-autolink prose. |
| How strict should new docs checks be? | Warning-only at first unless the check is purely mechanical and already proven stable. |

## Failure Modes To Prevent

- shipping another generated CLI reference that reads like a parser dump
- exposing compatibility aliases as the recommended agent-facing vocabulary
- hiding recording or skills commands while trying to simplify the CLI page
- documenting `setup` or `provision` as deprecated when the source only supports
  shim or alias classification
- adding anchors that depend on incidental MkDocs slugs rather than declared
  stable identifiers
- using unsupported `{#anchor}` heading syntax without enabling and validating
  the required MkDocs extension
- adding broad autolinking that links generic words such as setup, open, read,
  type, wait, or press incorrectly
- moving behavior detail from generated docs into another page without adding a
  generated detail link
- rewriting large docs areas without code-backed evidence
- editing generated docs by hand
- adding docs checks that are noisy enough to block routine docs authoring

## Output Contract

After PR-1:

- generated `api/cli.md` has one command index and concise per-command sections
- group-level duplicate tables are gone
- top-level `setup` is absent from public command output
- top-level `provision emulator` is shown only as an alias if included
- primary flags come from curated metadata, not regex extraction
- compatibility selector aliases are absent from primary flag output
- recording commands remain discoverable in `api/cli.md`
- Node build and test coverage prove the new docs metadata behavior

After PR-2:

- stable anchor conventions are documented internally
- canonical authored pages have explicit anchors for the concepts they own
- a docs-owned ownership manifest exists
- the CLI generator uses ownership metadata for detail links
- generated and authored docs include high-signal anchor-level links

After PR-3:

- `overview.md` has a compact surface terminology map
- `serve.md` documents `GET /ping`, `GET /version`, endpoint anchors, and Error
  Layers
- `setup.md` focuses on readiness and links to `doctor.md`
- `docs/skills/cli.md` exists and owns skills CLI behavior
- `docs/skills/overview.md` is less overloaded by command-contract detail
- selected error-code recovery annotations are improved
- API nav order matches the learning path

After PR-4:

- warning-only docs checks cover broken internal anchors, compatibility-only
  aliases in authored docs, and generated command rows missing detail links
- docs build still succeeds end to end

## Idempotency

- Re-running the CLI generator produces stable command sections, anchors, and
  detail links for unchanged command metadata.
- Re-running docs assembly and `./scripts/docs_build.sh` does not require manual
  edits to generated outputs.
- Re-running warning-only checks produces deterministic warnings for the same
  docs tree.
- Anchor names remain stable across prose edits when the underlying public
  concept name does not change.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| CLI command metadata and visibility | `apps/node/src/cli/registry.ts` and tests |
| CLI generated docs behavior | `.agents/skills/docs-build/scripts/generate_cli_reference.py` and docs-build tests or checks |
| Docs ownership and detail-link routing | `sites/docs/ownership.yaml` or `sites/docs/source-map.yaml` |
| Anchor conventions | `docs/internal/design/` |
| Result envelope semantics | `docs/api/overview.md` |
| Action, selector, error, Serve, MCP, Doctor, recording, and skills CLI contracts | The specific canonical public docs pages named in this plan |
| Cleanup rationale while the task is active | `tasks/docs/cleanup/findings.md`; delete the task folder only after durable knowledge has moved to real docs or code |
