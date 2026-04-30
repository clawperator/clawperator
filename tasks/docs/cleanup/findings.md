# Docs IA Audit - Consolidated Findings

Synthesized from two independent audits (Claude + Codex) against source as of May 2026.
Source files examined: `docs/api/`, `apps/node/src/cli/registry.ts`, `apps/node/src/contracts/`,
`.agents/skills/docs-build/scripts/`, `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml`,
`sites/docs/.build/api/cli.md`.

---

## Scope

Public API and CLI documentation only (`docs/api/`, `sites/docs/`). Landing site (`sites/landing/`)
and internal design docs (`docs/internal/`) are out of scope.

Questions addressed:
1. Are canonical links established and discoverable for all major concepts?
2. How well do pages cross-link to each other?
3. Is the CLI reference accurate, complete, and readable as an agent reference?
4. Where does duplication exist and who owns the source of truth?
5. Does the documentation meet the quality bar for a professional pre-alpha release?

---

## Executive Summary

The docs surface has solid authored pages for the major API areas but has three high-priority
structural problems that degrade it for automated agents and human developers alike.

**High priority:**
- The CLI reference page emits every command three times (generator structural bug).
- Alias flags and shim commands appear in public output because the generator has no
  documented-flags list for most commands.
- The docs surface has no stable anchor strategy, so deep links to specific commands,
  actions, error codes, or selectors are not reliable.

**Medium priority:**
- No canonical source-of-truth manifest: ownership of which page covers each concept is
  implicit, causing duplication between authored pages and generated output.
- Cross-linking between related pages is absent or accidental. An agent reading
  `actions.md` cannot navigate to the CLI reference for the same concept, and vice versa.
- The "API call" terminology is ambiguous throughout: it conflates CLI subcommands,
  execution action types, and HTTP serve endpoints.

**Low priority:**
- Doctor-check details are repeated across multiple pages.
- Nav reading order doesn't follow a first-time user's mental model.
- Error table in `errors.md` is thin compared to the range of codes emitted at runtime.

The CLI triple-duplication and alias-flag exposure are generator bugs, not authoring bugs.
Fixing them requires changes to `generate_cli_reference.py` and `registry.ts`, not to
hand-authored markdown. All other findings can be addressed by authoring and generator
configuration changes alone.

---

## Current Docs Map

| Page | Type | Source | Covers |
|------|------|--------|--------|
| `api/overview.md` | Authored | `docs/api/overview.md` | Execution model, envelope, correlation IDs |
| `api/cli.md` | Generated | `registry.ts` via `generate_cli_reference.py` | CLI command reference |
| `api/actions.md` | Authored | `docs/api/actions.md` | Execution action types and parameters |
| `api/selectors.md` | Authored | `docs/api/selectors.md` | Selector fields and semantics |
| `api/snapshot.md` | Authored | `docs/api/snapshot.md` | Snapshot command, output shape |
| `api/serve.md` | Authored | `docs/api/serve.md` | HTTP serve command and endpoints |
| `api/recording.md` | Authored | `docs/api/recording.md` | Recording workflow, all CLI commands, output shapes, NDJSON schema, compare outcomes |
| `api/mcp.md` | Authored + marker | `docs/api/mcp.md` + `registry.ts` | MCP tool summary |
| `api/errors.md` | Authored + marker | `docs/api/errors.md` + `contracts/errors.ts` | Error codes table |
| `setup.md` | Authored | `docs/setup.md` | Device setup, APK install |

Generated output pipeline:
```
docs/ (authored) + registry.ts + contracts/
  -> assemble.py + generators
  -> sites/docs/.build/  (staging, never hand-edit)
  -> mkdocs build
  -> sites/docs/site/    (deployable, never hand-edit)
```

---

## Source-of-Truth Model

Each concept has exactly one owned location. Current ownership is implicit; it should be
declared in `source-map.yaml` or a companion manifest.

| Concept category | Canonical owner | Secondary references OK? |
|------------------|-----------------|--------------------------|
| CLI command flags and descriptions | `registry.ts` (`documentedFlags`) | Generator reads; authored pages may summarize |
| Execution action types and parameters | `contracts/execution.ts` + `docs/api/actions.md` | `actions.md` is the durable home; generator may emit a summary |
| Selector fields | `contracts/selectors.ts` + `docs/api/selectors.md` | CLI reference lists primary flags inline; full detail in selectors.md |
| Error codes | `contracts/errors.ts` via marker expansion | `errors.md` is the single rendered location |
| Result envelope shape | `contracts/result.ts` + `docs/api/overview.md` | overview.md is the durable home |
| Serve endpoints | `apps/node/src/cli/commands/serve.ts` + `docs/api/serve.md` | serve.md is the durable home |
| MCP tools | `registry.ts` via marker expansion | `mcp.md` is the durable home |
| Doctor checks | `domain/doctor/checks/` + `docs/setup.md` | setup.md is the durable home; no repetition on other pages |
| Recording workflow | `docs/api/recording.md` | Comprehensive; no repetition needed |

---

## Findings

### F-01 - CLI triple-duplication (High)

**What:** The generated `api/cli.md` renders each command three times: once in the global
summary table, once in the per-group table, and once in the per-command bullet section.
`render_group()` in `generate_cli_reference.py` produces both the group table and the
per-command sections in a single call, in addition to the global summary table emitted
by `main()`.

**Evidence:** `sites/docs/.build/api/cli.md` (361 lines, ~12 commands, each appearing 3 times).

**Impact:** Agents and developers reading the CLI reference must visually filter duplicate
entries. Inconsistencies between the three layers (when one is updated and another is not)
will produce contradictions in the same file.

**Fix:** Restructure the generator to emit one global index table followed by one
per-command detail section. Remove the intermediate per-group tables or collapse them into
the index. Per-command sections become the detail layer; the index table becomes the
navigation layer.

---

### F-02 - Alias flags and shim commands exposed in public output (High)

**What:** The generator uses `documentedFlags` when present, else falls back to regex
extraction of all `--flag` tokens in the command body. Most commands have no
`documentedFlags` array, so the regex picks up deprecated aliases, internal flags, and
receiver flags not intended for direct agent use. The `skills` command is the primary
example: `--receiver-package`, `--device-id`, and `--timeout-ms` appear as equal-weight
flags in the public reference.

Additionally, two command types appear in the public CLI index that should not:
- `setup`: a guidance shim. Its handler immediately returns a USAGE error directing the
  caller to `clawperator operator setup --apk <path>`. It is not a callable command; it
  exists to catch misuse and redirect it.
- `provision` (top-level): a working alias for `emulator provision`, not deprecated and
  not broken, but its presence alongside `emulator provision` creates surface confusion.
  It should appear in an aliases section, not as a peer top-level command.

**Evidence:** `registry.ts` lines 1142-1154 (setup shim), 1256-1274 (provision alias);
`sites/docs/.build/api/cli.md` flags section for `skills`.

**Impact:** An agent reading the CLI reference may attempt to call `setup` directly (it
will fail with USAGE), may be confused by duplicate provision paths, and may pass
deprecated flags that the runtime rejects or ignores.

**Fix (two parts):**
1. Add `documentedFlags` arrays to all commands in `registry.ts`. Use the explicit list
   to declare which flags are primary and agent-facing.
2. In the generator, add a `commandKind` concept: `normal | shim | alias`. Shims are
   omitted from the main table. Working aliases appear in an "Aliases" appendix or a
   collapsible alias note under the canonical command entry.

---

### F-03 - No stable anchor strategy (High)

**What:** The docs site has no declared naming convention for within-page anchors. Deep
links from one page to a specific command, action type, error code, or selector field
rely on whatever heading text MkDocs happens to generate. Heading renames silently break
those links; no tooling catches them.

**Impact:** Agent-facing link tables (e.g., a skills manifest linking to specific doc
sections) become unreliable. Cross-links between pages become maintenance debt.

**Recommended anchor pattern:**
| Concept | Anchor format | Example |
|---------|---------------|---------|
| CLI command | `command-<name>` | `#command-snapshot` |
| Execution action type | `action-<type>` | `#action-tap` |
| Selector field | `selector-field-<field>` | `#selector-field-resource-id` |
| Error code | `error-<code>` | `#error-execution-timeout` |
| Serve endpoint | `endpoint-<method>-<path>` | `#endpoint-post-execute` |
| Setup step | `setup-step-<slug>` | `#setup-step-grant-permissions` |

**Fix:** Declare this convention in `docs/internal/design/` and add explicit `<a>` anchor
tags to generated and authored pages at each canonical entry point. The generator should
emit these tags automatically for each command section.

---

### F-04 - No canonical source-of-truth manifest (Medium)

**What:** Which page "owns" a concept is implicit. When a concept appears on multiple
pages (e.g., doctor checks in both `setup.md` and `overview.md`), there is no signal
about which is authoritative and which is a summary. This causes pages to drift out of
sync when the concept changes.

**Recommended fix:** Extend `source-map.yaml` (or a companion `ownership.yaml`) to
declare:
- Which page owns each major concept category.
- Which pages are permitted to include summaries, and at what depth.
- Which concepts are fully generated (and should never be hand-edited in `.build/`).

This manifest gives the docs-build skill an authority check: if a page attempts to define
a concept it does not own, the build can warn.

---

### F-05 - Absent cross-linking (Medium)

**What:** Related pages do not link to each other at concept boundaries. Specific gaps:
- `actions.md` has no links to `api/cli.md` for the corresponding CLI commands.
- `api/cli.md` has no links back to `actions.md` for execution action types.
- `selectors.md` has no backlink from `actions.md` selector parameter descriptions.
- `errors.md` is not linked from command pages where those errors are emitted.
- `api/serve.md` has no link to `overview.md` for envelope shape.

**Impact:** An agent reading the docs in topic order must guess that a related page exists.
The first command an agent tries from `cli.md` may fail with an error code that appears
only in `errors.md` with no navigation path between them.

**Fix:** Add "See also" footers to each page listing at least the two or three most
directly related pages. For generated pages, emit these footers from the generator using a
static configuration block.

---

### F-06 - Ambiguous "API call" terminology (Medium)

**What:** The phrase "API call" is used throughout the docs to mean different things
depending on context:
- A CLI subcommand invocation (`clawperator snapshot`).
- An execution action type sent in the actions array (`{ "type": "tap", ... }`).
- An HTTP endpoint call to the serve interface (`POST /execute`).
- A Node.js function call via the programmatic interface.

An agent reading the docs cannot reliably determine which surface is being described
without reading surrounding context carefully.

**Fix:** Adopt explicit terminology across all pages:
- "CLI command" for `clawperator <command>` invocations.
- "Execution action" or "action type" for items in the `actions[]` array.
- "Serve endpoint" or "HTTP endpoint" for `POST /execute` and siblings.
- "Node API" for programmatic use.

Apply this consistently in `overview.md`, `actions.md`, `serve.md`, and the CLI reference.
Add a terminology note near the top of `overview.md`.

---

### F-07 - Result envelope canonical home unclear (Medium)

**What:** The result envelope shape (`[Clawperator-Result]` JSON, `success`, `commandId`,
`taskId`, `error`, `data`) is described in `overview.md` but also partially documented in
`snapshot.md`, `serve.md`, and `recording.md`. The authoritative field list lives in
`contracts/result.ts`.

**Impact:** Field additions or renames may update in one place but not others.

**Fix:** Declare `overview.md` as the canonical home for the envelope shape. Other pages
may show abbreviated examples but should link to `overview.md` for the full field list.
Add a marker expansion in `source-map.yaml` to generate the field table directly from
`contracts/result.ts`.

---

### F-08 - Serve wrapper vs. Node error codes not distinguished (Medium)

**What:** `serve.md` documents the HTTP serve interface but does not clearly distinguish
between errors that come from the serve wrapper (HTTP 400, 500) and errors in the
`[Clawperator-Result]` envelope (Node error codes like `EXECUTION_TIMEOUT`,
`SELECTOR_NOT_FOUND`). A caller of the serve interface must understand both layers.

**Fix:** Add a section to `serve.md` explicitly covering the two error layers:
the HTTP response status and the envelope `error.code` field. Link to `errors.md` for the
full error code table.

---

### F-09 - Setup page mixed concerns (Low-Medium)

**What:** `setup.md` covers device prerequisite steps, APK installation, operator setup,
and permission grants - but it also contains doctor-check details that repeat content
better owned by the doctor implementation itself. The page reads as a sequential script
rather than reference material.

**Fix:** Separate into two concerns:
- `setup.md`: installation and first-time device prep only.
- A dedicated `troubleshooting.md` or a `doctor.md` page for runtime health checks,
  doctor output interpretation, and recovery patterns.

Keep doctor check details out of `setup.md` beyond a brief mention of `clawperator doctor`
as the verification command.

---

### F-10 - Selector flag duplication (Low-Medium)

**What:** Selector flags (`--text`, `--resource-id`, `--content-desc`, etc.) appear in the
generated CLI reference for every command that accepts them, and again in full in
`selectors.md`. The generator emits them as full flag entries rather than a single
selector-flags reference.

**Fix:** In the CLI reference, list only the primary selector flags inline per command
(e.g., `--text`, `--resource-id`), and add a "Full selector options: see Selectors" link.
Do not repeat the full semantics in the CLI reference - that duplication will drift.

---

### F-11 - Actions.md CLI-to-action mapping (Low-Medium)

**What:** `actions.md` includes a table mapping CLI commands to equivalent execution action
types (e.g., `clawperator tap` -> `{ "type": "tap" }`). Both the Claude and Codex audits
flagged this as potentially redundant with the CLI reference.

**Decision:** Keep this table. The reverse-lookup value (action type -> CLI command) is
distinct from the CLI reference's forward-lookup direction. Agents constructing action
arrays directly benefit from seeing the action type alongside the CLI equivalent. This
table does not duplicate; it adds a join that neither page provides alone.

---

### F-12 - Error table thin (Low)

**What:** The `errors.md` error code table, generated from `contracts/errors.ts`, lists
codes with brief descriptions but omits: which commands emit each code, typical recovery
patterns, and whether the error is retryable.

**Fix:** Extend either the marker template or a companion authored section to add at
minimum: primary commands that emit each code, and a retryable flag.

---

### F-13 - Nav reading order (Low)

**What:** The nav in `mkdocs.yml` places CLI Reference second after Overview, before
Actions, Selectors, and Setup. An agent or developer reading the docs in order encounters
the detailed command reference before understanding the execution model.

**Recommended order:**
1. Overview (execution model, envelope, correlation IDs)
2. Actions (action types and parameters)
3. Selectors (selector fields)
4. CLI Reference (commands using the above concepts)
5. Snapshot / Serve / Recording (feature-specific deep dives)
6. MCP
7. Errors
8. Setup

---

### F-14 - Docs compensating for API friction (Low - agent UX note)

**What:** Several doc pages include workarounds and "if X doesn't work, try Y" guidance
that exists because the API rejects intuitive forms. This is a signal that the API itself
should accept those forms.

**Examples observed:** The agent UX principle - the command an agent tries first should
work - applies here. When docs-only fixes are required for friction that the runtime could
absorb, consider whether the runtime should be extended rather than the docs
extended.

**This is an observation, not a docs fix.** Flag to engineering when specific cases are
identified.

---

## Recommended Link and Anchor Strategy

### Anchor naming convention

Declare explicit anchors in all generated and authored pages using this scheme:

| Concept | Format | Example |
|---------|--------|---------|
| CLI command | `command-<name>` | `#command-snapshot` |
| Execution action type | `action-<type>` | `#action-tap` |
| Selector field | `selector-field-<field>` | `#selector-field-resource-id` |
| Error code | `error-<code>` | `#error-execution-timeout` |
| Serve endpoint | `endpoint-<method>-<path>` | `#endpoint-post-execute` |
| Setup step | `setup-step-<slug>` | `#setup-step-grant-permissions` |

### Generator responsibility

The CLI reference generator should emit `<a id="command-<name>">` before each command
section. This makes anchors stable across heading renames.

### Cross-link requirements

Each page should include a "See also" section at the bottom with links to:
- `overview.md` -> `actions.md`, `selectors.md`, `errors.md`
- `actions.md` -> `selectors.md`, `cli.md` (with anchor), `errors.md`
- `selectors.md` -> `actions.md`, `cli.md`
- `cli.md` -> `actions.md`, `selectors.md`, `errors.md`
- `errors.md` -> `overview.md`, `cli.md`
- `serve.md` -> `overview.md`, `errors.md`
- `recording.md` -> `cli.md`, `errors.md`

---

## Recommended CLI Reference Strategy

### Generator restructure

Current output structure (causes triple duplication):
```
Global summary table
  Group A table
    Command A1 bullets
    Command A2 bullets
  Group B table
    Command B1 bullets
    ...
```

Target output structure:
```
Index table (one row per command, links to anchor)
  Per-command section (one per command, with stable anchor)
    Description
    Flags table (from documentedFlags only)
    Example
    See also links
```

### documentedFlags requirement

Every command in `registry.ts` must have a `documentedFlags` array listing the primary
agent-facing flags. The generator must not fall back to regex extraction in public output.
Alias flags and internal flags must be excluded from `documentedFlags`.

### Command visibility tiers

Add a `commandKind` (or equivalent) field to each command entry:

| Kind | Treatment |
|------|-----------|
| `normal` | Appears in main index and gets a full section |
| `shim` | Omitted from public output entirely; present in registry for error-redirect only |
| `alias` | Appears in an "Aliases" appendix with a note pointing to the canonical command |

`setup` is a shim. `provision` (top-level) is an alias for `emulator provision`.

### Selector flags in CLI reference

List only primary selector flags inline per command (`--text`, `--resource-id`).
Add: "For all selector options, see [Selectors](selectors.md)."
Do not repeat selector semantics in the CLI reference.

---

## Recommended Implementation Direction

Ordered by impact and dependency:

### Phase 1 - Generator correctness (unblock all other work)
1. Add `commandKind` to registry commands; mark `setup` as shim.
2. Add `documentedFlags` arrays to all commands.
3. Restructure `generate_cli_reference.py`: emit index table + per-command sections only.
4. Emit stable `<a id="command-<name>">` anchors in per-command sections.
5. Rebuild and verify `sites/docs/.build/api/cli.md` has no duplicate entries and no
   alias flags in public output.

### Phase 2 - Anchor and cross-link foundation
1. Declare anchor convention in `docs/internal/design/docs-anchor-strategy.md`.
2. Add "See also" sections to `overview.md`, `actions.md`, `selectors.md`, `errors.md`,
   `serve.md`, `recording.md`.
3. Add explicit anchors to authored pages for major entry points.

### Phase 3 - Source-of-truth manifest
1. Extend `source-map.yaml` or add `ownership.yaml` declaring canonical page per concept.
2. Add a build-time check (warning-only) for pages that define content outside their
   declared ownership.
3. Add a marker expansion for the result envelope shape from `contracts/result.ts`.

### Phase 4 - Authored page improvements
1. Apply consistent terminology (`CLI command` / `execution action` / `serve endpoint`).
2. Improve `errors.md` with primary-command column and retryable flag.
3. Add serve error-layer section to `serve.md`.
4. Separate setup / doctor-check concerns (setup.md vs. troubleshooting page).
5. Adjust nav reading order in `mkdocs.yml`.

### Phase 5 - Docs lint (optional, low-risk)
Warning-only lint is viable and worth adding once anchors are stable:
- Detect broken internal anchor links (high value, low false-positive risk).
- Detect known alias-flag names appearing in authored content (catches manual copy-paste
  of deprecated flag names into authored pages).
- Do not add lint that fires on judgment calls (e.g., "this page should link to X").

---

## Decisions Resolved From Prior Drafts

| Question | Decision | Rationale |
|----------|----------|-----------|
| Is `setup` deprecated? | No. It is a guidance shim that returns a USAGE error. It should be hidden from public output, not labeled deprecated. | Code inspection: `registry.ts` lines 1142-1154. |
| Is `provision emulator` deprecated? | No. It is a working alias for `emulator provision`. It should appear in an aliases section, not the main command table. | Code inspection: `registry.ts` lines 1256-1274. |
| Does `recording.md` need new authored CLI docs? | No. `recording.md` already has 1088 lines covering the full recording workflow, all CLI commands, output shapes, NDJSON schema, error codes, and compare outcomes. The earlier finding claiming it was missing was wrong. | Direct file read confirmed. |
| Should the actions.md CLI-to-action mapping table be kept or removed? | Keep it. The reverse-lookup direction (action type -> CLI command) adds value that neither page provides alone. | User decision, confirmed reasonable. |
| How strongly should docs linting be recommended? | Warning-only lint for exact code spans is viable and worth adding in a later phase, not in Phase 1. Lint that fires on structural/judgment calls should be avoided. | Nuanced position; not a hard no. |
| Generator dict vs. docs-owned manifest for concept ownership? | Prefer a docs-owned manifest (`source-map.yaml` extension or `ownership.yaml`) over hardcoding ownership in the generator. Long-term maintainability. | User preference confirmed. |
| How many selector flags to show inline in the CLI reference? | Primary flags only (`--text`, `--resource-id`), with a link to `selectors.md` for the full list. | Reduces duplication without hiding the most-used flags. |

---

## Open Questions

1. **Alias appendix format:** Should the "Aliases" appendix in the CLI reference be a
   table, a collapsible section per alias, or a single note under the canonical command?
   Depends on how many aliases exist; inventory needed.

2. **Marker expansion for result envelope:** `contracts/result.ts` would need a stable
   extraction marker (similar to error codes). Is the shape stable enough to warrant this,
   or is overview.md prose sufficient for now?

3. **Terminology migration scope:** Applying consistent terminology across all pages is
   a medium-effort authoring task. Should this be done in one pass or incrementally as
   other page edits happen?

4. **Setup page split timing:** Separating `setup.md` into setup + troubleshooting affects
   nav, redirects, and any external links. Should this happen early (Phase 4) or be
   deferred until the site has more traffic and anchor stability matters more?

5. **Skills CLI reference:** The `skills` command currently exposes alias flags in public
   output (the highest-priority instance of F-02). Should `skills` get `documentedFlags`
   added as a standalone fix before the full Phase 1 generator restructure, or wait for
   the whole Phase 1 to ship together?
