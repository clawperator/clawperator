# Docs IA Audit - Consolidated Findings

Synthesized from two independent audits (Claude + Codex) against source as of May 2026.
Source files examined: `docs/api/`, `apps/node/src/cli/registry.ts`,
`apps/node/src/contracts/` (errors, selectors, aliases, execution),
`apps/node/src/cli/selectorFlags.ts`, `.agents/skills/docs-build/scripts/`,
`sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml`, `sites/docs/.build/api/cli.md`.

---

## Scope

Public API and CLI documentation only (`docs/api/`, `sites/docs/`). Landing site
(`sites/landing/`) and internal design docs (`docs/internal/`) are out of scope.

Questions addressed:
1. Are canonical links established and discoverable for all major concepts?
2. How well do pages cross-link to each other?
3. Is the CLI reference accurate, complete, and readable as an agent reference?
4. Where does duplication exist and who owns the source of truth?
5. Does the documentation meet the quality bar for a professional pre-alpha release?

---

## Executive Summary

The docs surface has solid authored pages for the major API areas but has three
high-priority structural problems that degrade it for automated agents and human
developers alike.

**High priority:**
- The CLI reference page emits every command three times (generator structural bug).
- Non-primary compatibility aliases and shim commands appear in public output because the
  generator lacks a documented-flags list for most commands.
- The docs surface has no stable anchor strategy, so deep links to specific commands,
  actions, error codes, or selectors are not reliable.

**Medium priority:**
- No declared source-of-truth manifest: ownership of which page covers each concept is
  implicit, causing duplication that drifts.
- Authored pages have page-level "Related Pages" sections, but generated `api/cli.md` has
  no canonical detail links, and anchor-level cross-links (command -> action type, action
  -> error code) are absent throughout.
- The "API call" terminology is ambiguous: it conflates CLI commands, execution action
  types, and HTTP serve endpoints.

**Low priority:**
- Doctor-check details are repeated across `setup.md` and `doctor.md` with no clear
  ownership boundary.
- Nav reading order does not match a first-time user's mental model.
- Error table in `errors.md` lacks command-of-origin and retryability columns.

The CLI triple-duplication and alias-flag exposure are generator bugs, not authoring bugs.
Fixing them requires changes to `generate_cli_reference.py` and `registry.ts`. All other
findings are addressable through authoring and generator configuration changes.

---

## Current Docs Map

| Page | Type | Source | Covers |
|------|------|--------|--------|
| `api/overview.md` | Authored | `docs/api/overview.md` | Execution model, envelope, correlation IDs |
| `api/cli.md` | Generated | `registry.ts` via `generate_cli_reference.py` | CLI command reference |
| `api/actions.md` | Authored | `docs/api/actions.md` | Execution action types and parameters |
| `api/selectors.md` | Authored | `docs/api/selectors.md` | Selector fields and semantics |
| `api/snapshot.md` | Authored | `docs/api/snapshot.md` | Snapshot command and output shape |
| `api/serve.md` | Authored | `docs/api/serve.md` | HTTP serve command and endpoints |
| `api/recording.md` | Authored | `docs/api/recording.md` | Full recording workflow, all CLI commands, output shapes, NDJSON schema, compare outcomes |
| `api/doctor.md` | Authored | `docs/api/doctor.md` | Doctor contract, check types, output interpretation |
| `api/mcp.md` | Authored + marker | `docs/api/mcp.md` + `registry.ts` | MCP tool summary |
| `api/errors.md` | Authored + marker | `docs/api/errors.md` + `contracts/errors.ts` | Error codes table |
| `setup.md` | Authored | `docs/setup.md` | Device setup, APK install, readiness gate summary |

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

| Concept category | Canonical owner | Notes |
|------------------|-----------------|-------|
| CLI command flags and descriptions | `registry.ts` (`documentedFlags`) | Generator reads; authored pages may summarize with links |
| Execution action types and parameters | `contracts/aliases.ts` (canonical types) + `docs/api/actions.md` | `actions.md` is the durable authored home; generator may emit summary table |
| Selector fields | `contracts/selectors.ts` + `apps/node/src/cli/selectorFlags.ts` + `docs/api/selectors.md` | CLI reference lists primary flags inline; full semantics in `selectors.md` |
| Error codes | `contracts/errors.ts` via marker expansion | `errors.md` is the single rendered location |
| Result envelope shape | `contracts/result.ts` + `docs/api/overview.md` | `overview.md` is the durable authored home |
| Serve endpoints | `apps/node/src/cli/commands/serve.ts` + `docs/api/serve.md` | `serve.md` is the durable home |
| MCP tools | `registry.ts` via marker expansion | `mcp.md` is the durable home |
| Doctor checks and output | `domain/doctor/checks/` + `docs/api/doctor.md` | `doctor.md` owns the full Doctor contract; `setup.md` references it only for the readiness gate |
| Recording workflow | `docs/api/recording.md` | Comprehensive; CLI reference need not repeat recording command detail |

---

## Findings

Each finding includes:
- **What** - the specific structural problem
- **Why it matters for humans** - impact on developers reading the docs
- **Why it matters for agents** - impact on automated agents using the docs as a reference
- **Fix** - recommended action

---

### F-01 - CLI triple-duplication (High)

**What:** The generated `api/cli.md` renders each command three times: once in the global
summary table, once in the per-group table, and once in the per-command bullet section.
`render_group()` in `generate_cli_reference.py` emits both the group table and per-command
sections in a single pass, stacked on top of the global summary table from `main()`.

**Why it matters for humans:** The reference is 361 lines long and visually noisy. When
the three layers diverge (one updated, others stale), a single file contains contradictory
descriptions of the same command.

**Why it matters for agents:** An agent scanning the CLI reference must filter duplicates
without a reliable signal for which layer is authoritative. An index with a canonical
per-command section would be unambiguous.

**Fix:** Restructure the generator to emit one global index table (one row per command,
linking to the per-command anchor) followed by one per-command detail section per command.
Remove the intermediate per-group tables; they add length without adding information not
already in the index.

---

### F-02 - Compatibility-alias flags and shim commands in public output (High)

**What:** Two distinct problems share the same root cause (no `documentedFlags` whitelist):

**2a - Alias flags exposed as primary flags.** The generator falls back to regex
extraction when a command has no `documentedFlags` array, picking up all `--flag` tokens
in the command body - including compatibility aliases. From `selectorFlags.ts`:
- `--id` is the primary flag; `--resource-id` is a compatibility alias.
- `--desc` is the primary flag; `--content-desc` is a compatibility alias.
The `skills` command is the clearest current example: `--receiver-package` and
`--device-id` appear at the same visual weight as the primary flags.

**2b - Shim commands in the public index.** Two command types should not appear in the
main index:
- `setup` (top-level): a guidance shim. Its handler immediately returns a USAGE error:
  "clawperator setup is not a valid top-level command. Use: clawperator operator setup
  --apk `<path>`". It is not callable; it exists solely to redirect misuse.
- `provision` (top-level): a working alias for `emulator provision`. It is not broken and
  not deprecated, but its peer placement alongside `emulator provision` creates surface
  confusion. Correct treatment is an aliases section, not a main-index entry.

**Why it matters for humans:** A developer reading the flag list cannot distinguish primary
from compatibility forms without reading the source. The USAGE error from `setup` is
surprising if the docs present it as a callable command.

**Why it matters for agents:** An agent attempting `clawperator setup` will receive a
USAGE error after trusting the reference. An agent passing `--resource-id` or
`--content-desc` receives values the runtime internally normalizes - but the canonical
form the agent should learn is `--id` and `--desc`.

**Fix (two parts):**
1. Add `documentedFlags` arrays to every command in `registry.ts`, listing only
   primary agent-facing flags. Compatibility aliases must not appear in
   `documentedFlags`. The generator must never fall back to regex extraction for public
   output.
2. Add a `commandKind` concept: `normal | shim | alias`. Shims are omitted from all
   public output. Working aliases appear under their canonical command with a brief note,
   and in an aliases appendix if the count warrants one.

---

### F-03 - No stable anchor strategy (High)

**What:** The docs site has no declared naming convention for within-page anchors. Deep
links rely on MkDocs heading-slug generation. Heading renames silently break those links;
no tooling detects them. The generated `api/cli.md` has no per-command anchors at all.

**Why it matters for humans:** "Link to the snapshot command docs" produces a URL that may
break on the next heading rename or generator change.

**Why it matters for agents:** A skills manifest or agent system prompt that references
`#command-snapshot` or `#action-click` must be stable across doc regenerations. Implicit
MkDocs slugs are not a reliable contract.

**Recommended anchor convention:**

| Concept | Format | Example |
|---------|--------|---------|
| CLI command | `command-<name>` | `#command-snapshot` |
| Execution action type | `action-<type>` | `#action-click` |
| Selector field | `selector-field-<field>` | `#selector-field-id` |
| Error code | `error-<code>` | `#error-node-not-found` |
| Serve endpoint | `endpoint-<method>-<path>` | `#endpoint-post-execute` |
| Setup step | `setup-step-<slug>` | `#setup-step-grant-permissions` |

Note: `click` is the canonical action type (`tap` and `press` are input aliases that
normalize to `click` before validation - see `contracts/aliases.ts`). Anchors should use
the canonical type, not input aliases.

**Fix:** Declare this convention in `docs/internal/design/`. The CLI reference generator
should emit `<a id="command-<name>">` before each per-command section automatically.
Authored pages should add explicit `<a>` tags at each canonical entry point.

---

### F-04 - No declared source-of-truth manifest (Medium)

**What:** Which page owns which concept is implicit. Doctor checks appear in both
`doctor.md` and `setup.md`; envelope shape details appear in both `overview.md` and
`snapshot.md`. There is no build-time signal when a summary page begins drifting from its
source page.

**Why it matters for humans:** When a field is renamed, a developer must remember to
update all pages that mention it. There is no authoritative list of which pages need
updating.

**Why it matters for agents:** An agent following links from one page may find contradictory
field descriptions on another and have no basis for resolving the conflict.

**Fix:** Extend `source-map.yaml` (or add `ownership.yaml`) to declare:
- Which page is the canonical home for each major concept category.
- Which pages may include summaries, and at what depth.
- Which concept categories are fully generated.

A warning-only build check for pages that define content outside their declared ownership
is viable as a Phase 5 addition (see Implementation Direction).

---

### F-05 - Cross-links present at page level, absent at anchor level (Medium)

**What:** The authored pages (`overview.md`, `actions.md`, `errors.md`) all have "Related
Pages" sections providing page-level navigation. The gap is more precise: the generated
`api/cli.md` has no links from a command entry to the corresponding action type in
`actions.md`, and authored pages lack stable anchor-level links between related concepts
(e.g., an error code mention in `serve.md` does not link to the specific `#error-<code>`
anchor in `errors.md`).

**Why it matters for humans:** Page-level links exist; concept-level links do not. A
developer reading a command description must manually navigate to `actions.md` and search
for the action type.

**Why it matters for agents:** An agent following the docs flow from CLI command to action
type to error codes requires three manual navigations with no guidance links between them.

**Fix:** After anchors are stable (F-03), add anchor-level "See also" links in:
- Each CLI command section in `api/cli.md` -> `#action-<type>` in `actions.md`
- Each action type section in `actions.md` -> `#command-<name>` in `cli.md`
- Error mentions in `serve.md`, `recording.md`, and `snapshot.md` -> `#error-<code>` in
  `errors.md`

The generator should emit these links automatically for CLI-to-action cross-references
using a static command-to-action mapping in the generator configuration.

---

### F-06 - Ambiguous "API call" terminology (Medium)

**What:** The phrase "API call" is used to mean at least four different things:
- A CLI command invocation (`clawperator snapshot`).
- An execution action type in the `actions[]` array (`{ "type": "click", ... }`).
- An HTTP endpoint call (`POST /execute`).
- A programmatic Node.js call.

The ambiguity is worst in `overview.md` and `actions.md`.

**Why it matters for humans:** A developer reading "make an API call" cannot determine
without context whether to reach for the CLI, construct a JSON payload, or hit an HTTP
endpoint.

**Why it matters for agents:** An agent parsing the docs to understand how to request
automation must correctly identify the surface. Conflated terminology increases the chance
of the agent attempting the wrong surface first.

**Fix:** Adopt and consistently apply explicit terminology across all pages:
- "CLI command" for `clawperator <command>` invocations.
- "Execution action" or "action type" for items in the `actions[]` array.
- "Serve endpoint" or "HTTP endpoint" for `/execute` and siblings.
- "Node API" for programmatic use.

Add a terminology note near the top of `overview.md` defining these terms once.

---

### F-07 - Result envelope canonical home unclear (Medium)

**What:** The result envelope shape (`[Clawperator-Result]` JSON, `success`, `commandId`,
`taskId`, `error`, `data`) is described in `overview.md` but field details also appear in
`snapshot.md`, `serve.md`, and `recording.md`. The authoritative field list lives in
`contracts/result.ts`.

**Why it matters for humans:** When a field is added or renamed, it is not obvious which
pages need updating.

**Why it matters for agents:** An agent reading envelope shape from `snapshot.md` may see
a subset of the full field list. The canonical location is not signposted.

**Fix:** Declare `overview.md` as the canonical home for the envelope shape. Other pages
may show abbreviated examples but must link to `overview.md` for the full field list.
Consider a marker expansion in `source-map.yaml` to generate the field table from
`contracts/result.ts`, similar to how error codes are generated from `contracts/errors.ts`.

---

### F-08 - Serve error layers not distinguished (Medium)

**What:** `serve.md` documents the HTTP serve interface but does not clearly separate the
two error layers a caller must handle:
1. HTTP response status (400, 500) from the serve wrapper.
2. `error.code` in the `[Clawperator-Result]` envelope, such as `RESULT_ENVELOPE_TIMEOUT`
   or `NODE_NOT_FOUND`.

**Why it matters for humans:** A developer integrating with the serve interface writes
error handling for one layer and discovers the other in production.

**Why it matters for agents:** An agent calling the serve endpoint and receiving a
successful HTTP 200 may still have a failed execution indicated by the envelope. Without
explicit docs on this two-layer contract, the agent may misinterpret the response.

**Fix:** Add a dedicated section to `serve.md` covering the two error layers explicitly,
with a table of HTTP status meanings and a note that `error.code` values follow the full
error code contract in `errors.md`.

---

### F-09 - Doctor ownership boundary unclear (Low-Medium)

**What:** `docs/api/doctor.md` should own the full Doctor contract: checks, output
interpretation, exit codes, and recovery patterns. `setup.md` should reference `doctor.md`
only for the readiness gate step ("run `clawperator doctor` to verify setup"). Currently,
doctor-check details appear in both pages without a clear ownership signal.

**Why it matters for humans:** A developer updating a doctor check must remember to update
two pages.

**Why it matters for agents:** An agent diagnosing a failed doctor run may find different
details on `setup.md` vs. `doctor.md` and cannot reliably determine which is current.

**Fix:** Audit both pages; move all doctor contract details (check types, output format,
recovery patterns) to `doctor.md`. Trim `setup.md` to a single reference: "run
`clawperator doctor` to verify your setup is complete; see [Doctor](doctor.md) for output
interpretation."

---

### F-10 - Selector flag duplication in CLI reference (Low-Medium)

**What:** Selector flags appear in the generated CLI reference for every command that
accepts them, and again in full in `selectors.md`. The generator emits them as full flag
entries rather than a primary-flag-only summary.

Primary selector flags (from `selectorFlags.ts`): `--selector`, `--text`,
`--text-contains`, `--id`, `--desc`, `--desc-contains`, `--role`.
Compatibility aliases (not primary): `--resource-id` (alias for `--id`),
`--content-desc` (alias for `--desc`), `--content-desc-contains` (alias for
`--desc-contains`).

**Why it matters for humans:** Every command section repeats the same six-flag block,
inflating the reference significantly.

**Why it matters for agents:** An agent reading the CLI reference sees selector flag
semantics defined in multiple places and may encounter the compatibility alias names
(`--resource-id`, `--content-desc`) in the generated output rather than the canonical
short forms (`--id`, `--desc`).

**Fix:** In the CLI reference, show only the most-used primary selector flags inline per
command (`--text`, `--id`, `--desc`, `--role`), followed by a note: "For all selector
options, see [Selectors](selectors.md)." Remove compatibility aliases from generated
output entirely (addressed by F-02 `documentedFlags` fix).

---

### F-11 - Actions.md CLI-to-action mapping (Low-Medium)

**What:** `actions.md` includes a table mapping CLI commands to canonical execution action
types (e.g., `clawperator snapshot` -> `{ "type": "snapshot" }`). Both audits considered
whether this table is redundant with the CLI reference.

**Why it matters for humans:** The CLI reference is a forward lookup (what does this
command do?). The actions table is a reverse lookup (I have an action type, what is the
CLI equivalent?). These are distinct operations.

**Why it matters for agents:** An agent constructing a raw `actions[]` payload benefits
from seeing the canonical action type alongside the CLI synonym in one place. The CLI
reference's command-centric view does not provide this join easily.

**Decision:** Keep the table. The reverse-lookup value is additive, not duplicative. The
table should use canonical action types only (`click`, not `tap`).

---

### F-12 - Error table incomplete (Low)

**What:** The `errors.md` error code table, generated from `contracts/errors.ts`, lists
codes with brief descriptions but omits: which commands typically emit each code, and
whether the error is retryable. Actual codes include `RESULT_ENVELOPE_TIMEOUT`,
`NODE_NOT_FOUND`, `NODE_NOT_CLICKABLE`, `CONTAINER_NOT_FOUND`, and others.

**Why it matters for humans:** A developer debugging a `NODE_NOT_FOUND` error must search
the codebase to learn which commands can emit it.

**Why it matters for agents:** An agent receiving `RESULT_ENVELOPE_TIMEOUT` cannot
determine from the docs alone whether to retry, adjust timing, or report the failure.

**Fix:** Extend the error table template to add: a "Primary commands" column and a
"Retryable" flag column. These can be maintained as authored annotations alongside the
generated code values.

---

### F-13 - Nav reading order (Low)

**What:** The nav in `mkdocs.yml` places CLI Reference second after Overview, before
Actions and Selectors. An agent or developer reading in order encounters the detailed
command reference before understanding the execution model or action types the commands
invoke.

**Why it matters for humans:** The reference is hard to use without the conceptual
foundation that Actions and Selectors provide.

**Why it matters for agents:** An agent constructing a system prompt from the docs in
nav order may include CLI details before it has the action-type and selector vocabulary
needed to interpret them.

**Recommended order:**
1. Overview
2. Actions
3. Selectors
4. CLI Reference
5. Snapshot / Serve / Recording
6. Doctor
7. MCP
8. Errors
9. Setup

---

### F-14 - Docs compensating for API friction (Low - agent UX note)

**What:** Several doc pages include workaround guidance ("if X doesn't work, try Y") that
exists because the API rejects intuitive command forms. This is a signal for the runtime,
not a docs problem to be solved by more documentation.

**Why it matters for agents:** The agent UX principle - the command an agent tries first
should work - applies. When an intuitive form is rejected, adding docs guidance is a
temporary patch; the runtime accepting the intuitive form is the durable fix.

**This is an observation only.** Flag specific instances to engineering when identified.
Docs cannot fully substitute for runtime ergonomics.

---

## Recommended Link and Anchor Strategy

### Naming convention

Declare explicit anchors at all canonical entry points using this scheme:

| Concept | Format | Example |
|---------|--------|---------|
| CLI command | `command-<name>` | `#command-snapshot` |
| Execution action type | `action-<type>` | `#action-click` |
| Selector field | `selector-field-<field>` | `#selector-field-id` |
| Error code | `error-<code>` | `#error-node-not-found` |
| Serve endpoint | `endpoint-<method>-<path>` | `#endpoint-post-execute` |
| Setup step | `setup-step-<slug>` | `#setup-step-grant-permissions` |

Use canonical forms only: `action-click` not `action-tap`; `selector-field-id` not
`selector-field-resource-id`.

### Generator responsibility

The CLI reference generator must emit `<a id="command-<name>">` before each per-command
section, making anchors stable across heading renames.

### Cross-link requirements

After anchors are stable:
- Each CLI command section -> `#action-<type>` in `actions.md`
- Each action type section -> `#command-<name>` in `cli.md`
- Each error mention in feature pages -> `#error-<code>` in `errors.md`
- `setup.md` -> `doctor.md` (readiness gate reference)

---

## Recommended CLI Reference Strategy

### Generator restructure

Current structure (causes triple duplication):
```
Global summary table
  Group A table
    Command A1 bullets
    Command A2 bullets
  Group B table
    ...
```

Target structure:
```
Index table (one row per command, anchor link in name column)
Per-command sections (one each, stable anchor, generated flags from documentedFlags only)
  Description
  Primary flags table
  Example
  Action type cross-link (where applicable)
Aliases appendix (working aliases with pointers to canonical command)
```

### `documentedFlags` requirement

Every command in `registry.ts` must have a `documentedFlags` array listing only
primary agent-facing flags. Compatibility aliases must not appear in `documentedFlags`.
The generator must not fall back to regex extraction for any public output.

### Command visibility tiers

| Kind | Treatment |
|------|-----------|
| `normal` | Main index and full per-command section |
| `shim` | Omitted from all public output (e.g., `setup`) |
| `alias` | Aliases appendix with pointer to canonical command (e.g., `provision`) |

### Selector flags in CLI reference

Show only the four most-used primary selector flags inline (`--text`, `--id`, `--desc`,
`--role`) with a note linking to `selectors.md`. Do not show `--selector` (advanced
use), `--text-contains`, or `--desc-contains` (specialized) in the inline summary.

---

## Recommended Implementation Direction

### Phase 1 - Generator correctness (prerequisite for all other phases)
1. Add `commandKind` to registry entries; mark `setup` as `shim`, `provision` as `alias`.
2. Add `documentedFlags` arrays to all commands in `registry.ts`. Use canonical flag names
   only; exclude compatibility aliases.
3. Restructure `generate_cli_reference.py`: emit index table + per-command sections only.
4. Emit `<a id="command-<name>">` anchors in each per-command section automatically.
5. Emit an aliases appendix for `alias`-kind commands.
6. Rebuild and verify: no command appears more than once; no alias flags in flag tables;
   `--resource-id` and `--content-desc` are absent from generated output.

Note: the `skills` command is the highest-priority `documentedFlags` case because it
currently exposes `--receiver-package` as a primary flag. Complete all of Phase 1 together
rather than treating `skills` as a standalone fix.

### Phase 2 - Anchor and cross-link foundation
1. Declare anchor convention in `docs/internal/design/docs-anchor-strategy.md`.
2. Add explicit `<a id>` anchors to authored pages at all major entry points (action types,
   error codes, selector fields, serve endpoints).
3. Add anchor-level cross-links from CLI command sections to action types and vice versa.
4. Add error code anchor links from `serve.md`, `recording.md`, `snapshot.md`.

### Phase 3 - Source-of-truth manifest
1. Extend `source-map.yaml` or add `ownership.yaml` declaring canonical page per concept.
2. Clarify doctor ownership: trim `setup.md` doctor detail, confirm `doctor.md` as owner.
3. Consider a marker expansion for the result envelope shape from `contracts/result.ts`.

### Phase 4 - Authored page improvements
1. Apply consistent terminology (CLI command / execution action / serve endpoint) across
   all pages, starting with `overview.md` and `actions.md`. Roll out incrementally as
   pages are touched; prioritize high-traffic pages first.
2. Improve `errors.md` with primary-command and retryable columns.
3. Add serve two-layer error section to `serve.md`.
4. Adjust nav reading order in `mkdocs.yml` (requires redirect_maps entries for any
   affected anchor URLs).
5. Do not split `setup.md` into separate files at this phase. Trim doctor-check detail
   and replace with a link to `doctor.md`. A setup/troubleshooting split is a later IA
   decision, deferred until anchor stability and redirect overhead can be properly scoped.

### Phase 5 - Docs lint (warning-only)
Warning-only lint is viable and worth adding once anchors are stable:
- Broken internal anchor links (high value, low false-positive risk).
- Known compatibility alias names appearing in authored content pages (catches manual
  copy-paste of `--resource-id` or `--content-desc` into authored text).
- Do not add lint that fires on structural or judgment calls.

---

## Decisions Resolved From Prior Drafts

| Question | Decision | Rationale |
|----------|----------|-----------|
| Is `setup` deprecated? | No. It is a guidance shim returning a USAGE error. Omit from public output entirely; do not label deprecated. | `registry.ts` lines 1142-1154: handler returns USAGE error unconditionally. |
| Is `provision emulator` deprecated? | No. It is a working alias for `emulator provision`. Appears in aliases appendix, not main index. | `registry.ts` lines 1256-1274: handler calls `cmdProvisionEmulator()`. |
| Does recording need new authored CLI docs? | No. `recording.md` is 1088 lines and covers the full workflow, all CLI commands, output shapes, NDJSON schema, and compare outcomes exhaustively. | Direct file read confirmed. |
| Should `actions.md` CLI-to-action mapping be kept? | Yes. The reverse-lookup direction (action type -> CLI command) is additive, not duplicative. Use canonical action types only. | Confirmed by Codex and Claude audits. |
| Lint recommendation strength? | Warning-only lint for broken anchor links and alias-name occurrences in authored content is viable in Phase 5. Not Phase 1. | Nuanced position supported by both audits. |
| Generator dict vs. docs-owned manifest? | Prefer docs-owned manifest (`source-map.yaml` extension or `ownership.yaml`) over hardcoding ownership inside the generator. | Long-term maintainability; decouples authoring decisions from build tooling. |
| How many selector flags inline in CLI reference? | Four primary flags (`--text`, `--id`, `--desc`, `--role`) + link to `selectors.md`. Omit `--selector`, `--text-contains`, `--desc-contains` from inline summary. | Reduces clutter; primary flags cover the common case. |
| Alias appendix format? | Show working aliases under their canonical command entry. Add a dedicated aliases appendix only if the total alias count exceeds roughly five entries. | Low alias count today; appendix overhead is not warranted unless inventory grows. |
| Terminology migration scope? | Incremental, tied to touched pages. Prioritize `overview.md` and `actions.md` first (highest traffic). Do not do a big-bang pass. | Reduces risk of large-scope authoring errors; changes are reviewable in context. |
| Setup page split timing? | Do not split early. First pass: trim doctor-check detail from `setup.md`, add link to `doctor.md`. Full split to a separate troubleshooting page is a later IA decision. | Split requires redirects and anchor-stability planning. Premature before Phase 2 lands. |
| Skills `documentedFlags` as standalone fix? | No. Address as the first high-priority command in Phase 1's full generator cleanup, not as a one-off patch. | A one-off patch leaves the generator fallback behavior intact for all other commands. |

---

## Open Questions

These require human judgment and cannot be resolved from the source files alone.

1. **Result envelope marker expansion:** The envelope shape in `contracts/result.ts` is
   relatively stable. Should a marker expansion be added to auto-generate the field table
   in `overview.md` (as error codes are generated in `errors.md`), or is hand-authored
   prose in `overview.md` sufficient and preferable for the envelope shape description?

2. **Recording commands in CLI reference:** Recording lifecycle commands (`record start`,
   `record stop`, `record pull`, etc.) are currently covered only in `recording.md`, not
   in `api/cli.md`. Should they also appear in the generated CLI reference (with detail
   links pointing to `recording.md`), or should `recording.md` remain the sole reference
   and `cli.md` link to it at the group level? The choice affects Phase 1 generator scope.

3. **Nav reorder redirect overhead:** Reordering the nav changes page URLs for any
   affected entries (depending on how MkDocs resolves paths) and requires new redirect_map
   entries. Is this change worth doing before the site has significant external link
   surface, or should it be deferred until a planned URL-stability pass?
