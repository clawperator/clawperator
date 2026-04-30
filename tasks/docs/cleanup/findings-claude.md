# Docs Cleanup Findings

## Scope

### Inspected

- `.agents/skills/docs-author/SKILL.md` - authoring guidance and workflow
- `.agents/skills/docs-build/SKILL.md` - build pipeline guidance
- `.agents/skills/api-agent-ux/SKILL.md` - agent UX review framework
- `.agents/skills/docs-build/scripts/generate_cli_reference.py` - CLI page generator
- `.agents/skills/docs-build/scripts/assemble.py` - docs staging assembler
- `docs/internal/design/node-api-design-guiding-principles.md` - agent UX principles
- `docs/internal/documentation-drafting-north-star.md` - documentation philosophy
- `sites/docs/mkdocs.yml` - navigation and site config
- `sites/docs/source-map.yaml` - code-derived page registry
- `sites/docs/.build/api/cli.md` - generated CLI reference (current output)
- `docs/index.md`, `docs/setup.md`, `docs/quickstart.md` (entry points)
- `docs/api/overview.md`, `docs/api/actions.md`, `docs/api/errors.md`
- `docs/api/selectors.md`, `docs/api/serve.md`, `docs/api/snapshot.md`
- `docs/api/navigation.md`

### Not inspected in depth

- `docs/api/daemon.md`, `docs/api/mcp.md`, `docs/api/logging.md`, `docs/api/timeouts.md`, `docs/api/environment.md`, `docs/api/devices.md`, `docs/api/doctor.md`, `docs/api/recording.md`
- Skills pages (`docs/skills/`)
- Troubleshooting pages
- `apps/node/src/cli/registry.ts` (partially - limited by file size)
- Live site rendering

---

## Executive Summary

The authored API docs (`overview.md`, `actions.md`, `errors.md`, `selectors.md`, `serve.md`, `snapshot.md`, `setup.md`) are genuinely good: code-grounded, structured, agent-centric, complete. They meet the north star.

The primary drag on professional quality is `api/cli.md`. The generator outputs every command three times on one long page (master table, group table, per-command detail section), mixes primary names with internal aliases, and lacks any links to the canonical authored docs that explain what commands actually do. The result is a page that looks like a code dump rather than a reference.

Secondary issues: the generator extracts all flags from registry source including deprecated alias flags (`--receiver-package`, `--device-id`, `--timeout-ms`) that the design principles explicitly mark as non-primary. These should not appear in public reference output. Deprecated commands (`setup`, `provision`) surface as first-class entries with no context.

The three highest-impact changes are:

1. Restructure the CLI reference generator to emit one entry per command (not three), with a clean index table and concise per-command sections that link to canonical authored docs.
2. Add a `documentedFlags` field to all commands in `registry.ts` so the generator can use curated flag lists instead of regex extraction.
3. Suppress or clearly mark deprecated/alias commands (`setup`, `provision`) in the generated output.

---

## Current Docs Map

### Nav structure (from `mkdocs.yml`)

```
Docs Home        index.md
Setup            setup.md
Host Agent       host-agents.md
Quickstart       quickstart.md
API/
  Overview       api/overview.md           (authored)
  CLI Reference  api/cli.md                (CODE-DERIVED via generate_cli_reference.py)
  Logging        api/logging.md            (authored)
  Actions        api/actions.md            (authored + canonical action types)
  Selectors      api/selectors.md          (authored + CODE-DERIVED marker: selector-flags)
  Snapshot       api/snapshot.md           (authored)
  Errors         api/errors.md             (authored + CODE-DERIVED marker: error-codes)
  Devices        api/devices.md            (authored)
  Doctor         api/doctor.md             (authored)
  Timeouts       api/timeouts.md           (authored)
  Environment    api/environment.md        (authored)
  Serve API      api/serve.md              (authored)
  Daemon         api/daemon.md             (authored)
  MCP Server     api/mcp.md                (authored + CODE-DERIVED marker: mcp-tool-summary)
  Navigation     api/navigation.md         (authored)
  Recording      api/recording.md          (authored)
Skills/          (4 authored pages)
Troubleshooting/ (3 authored pages)
```

### Generation pipeline

```
registry.ts + commands/ -> generate_cli_reference.py -> api/cli.md (full page)
errors.ts              -> generate_error_table.py   -> marker in errors.md
selectorFlags.ts       -> generate_selector_table.py -> marker in selectors.md
mcp/tools/             -> generate_mcp_tool_summary.py -> marker in mcp.md
assemble.py            -> copies authored docs + runs generators -> sites/docs/.build/
docs_build.sh          -> assemble.py + mkdocs build
```

---

## Source-of-Truth Model

Recommended ownership:

| Surface | Owner | Generation | Notes |
| --- | --- | --- | --- |
| CLI command names, syntax, aliases | `registry.ts` | Generated (CLI ref index table) | Source is already code; generator must filter to primary names only |
| CLI flags per command | `registry.ts` (`documentedFlags`) | Generated (CLI ref per-command sections) | Requires adding `documentedFlags` to all commands that lack it |
| Execution action types and params | `contracts/execution.ts` | Authored (`actions.md`) | Code is truth; page should cite source for every claim |
| Selectors / `NodeMatcher` | `contracts/selectors.ts` + `selectorFlags.ts` | Mixed: authored prose in `selectors.md`, generated table via marker | Current model works well |
| Error codes | `contracts/errors.ts` | Generated table via marker in `errors.md` | Current model works well |
| Result envelope shape | `contracts/result.ts` | Authored (`overview.md`) | Code is truth; page already cites source |
| Setup / operator behavior | `cli/commands/operatorSetup.ts` | Authored (`setup.md`) | Good as-is |
| Serve API behavior | `cli/commands/serve.ts` | Authored (`serve.md`) | Good as-is |
| Examples | authored | Authored | Must stay authored; generators should not own examples |
| Deep per-command behavior | command modules | Authored per-page | Currently missing for several commands (recording, skills subcommands) |

---

## Findings

### F-01: CLI reference page triple-duplicates every command

**Severity:** High
**Surface:** `sites/docs/.build/api/cli.md` / `generate_cli_reference.py`
**Evidence:** The generator's `main()` function produces three layers for each command:
1. A master summary table (all commands, ~44 rows) at the top of the page
2. A per-group summary table for each group (Setup, Device Management, Execution, Device Interaction, Recording, Utilities)
3. A per-command bullet section under each group (`### \`command\``)

Every command appears at minimum 3 times on the same page with essentially the same information repeated. The `skills` command (which has a long multi-line syntax block and 22+ flags) appears 3 times with identical content. The final rendered page is over 360 lines.

**Why it matters for humans:** Skimming is broken. There is no way to land on a page section that contains authoritative single-definition content for a command - it is always repeated.

**Why it matters for agents:** Consuming `llms-full.txt` or a scraped page version means the same command description is ingested multiple times, diluting useful signal and wasting token budget.

**Recommendation:** Restructure the generator to produce one canonical index table followed by one per-command entry with no group-level duplication. See "Recommended CLI Reference Strategy" below.

---

### F-02: Generator surfaces deprecated alias flags as public documented flags

**Severity:** High
**Surface:** `sites/docs/.build/api/cli.md`, `generate_cli_reference.py`
**Evidence:** The `skills` command entry lists these flags in its documented flag set:
- `--receiver-package` - stale terminology; design principles and CLAUDE.md say "operator", not "receiver"
- `--device-id` - alias; design principles say `--device` is the primary documented form
- `--timeout-ms` - alias; design principles say `--timeout` is the primary form

This happens because the generator falls back to regex extraction of all `--flag` strings in the command body when `documentedFlags` is not present. It cannot distinguish primary flags from deprecated aliases.

The `skills` command in `registry.ts` likely defines these as accepted synonyms but they should not appear in the public reference output.

**Why it matters for humans:** Readers see `--receiver-package` and may use it, confusing "receiver" terminology which the project is actively retiring.

**Why it matters for agents:** Agents may reach for `--receiver-package` or `--timeout-ms` based on what they see in the docs, defeating the terminology discipline and the alias hygiene.

**Recommendation:** Two-part fix:
1. Add `documentedFlags` arrays to all commands that currently lack them in `registry.ts`, listing only primary flag names.
2. Confirm that `--receiver-package` is removed from the `skills` command registry entry entirely or demoted to a hidden alias if backward compat is required.

---

### F-03: Deprecated commands appear as first-class entries with no useful content

**Severity:** Medium
**Surface:** `sites/docs/.build/api/cli.md`
**Evidence:**
- `setup` command entry: summary is "Alias guidance - use operator setup instead", no syntax, flags are `--apk, --device, --operator-package`. It appears in both the master table and the Setup group section.
- `provision` command entry: summary is "Provision an Android emulator", no meaningful syntax, subcommands field is "emulator". It appears as a peer to real commands.

These entries are effectively "did you mean" redirects living in the docs surface as if they are real commands.

**Why it matters for humans:** A reader scanning the Setup section sees `setup` and might not understand why to use `operator setup` instead without reading carefully.

**Why it matters for agents:** An agent choosing between `setup` and `operator setup` based on the CLI reference has two entries for essentially the same operation with no clear reason to prefer one. The alias command carries less information than the real command and could mislead.

**Recommendation:** Two options:
- Option A (clean): Mark deprecated/alias commands with a `deprecated: true` or `group: "hidden"` field in `registry.ts` and filter them out of the generator output entirely.
- Option B (soft): Generate a single "Deprecated / Alias Commands" note at the bottom of the CLI reference page listing `setup -> operator setup` and `provision -> emulator provision` without full duplication of their entries.

---

### F-04: CLI reference lacks cross-links to canonical authored docs

**Severity:** Medium
**Surface:** `sites/docs/.build/api/cli.md`
**Evidence:** Every command entry in the generated CLI page is self-contained with only a summary and flag list. For example:
- `snapshot` entry: no link to `api/snapshot.md`
- `click` entry: no link to `api/selectors.md` (for selector flags) or `api/actions.md`
- `doctor` entry: no link to `api/doctor.md`
- `exec` entry: no link to `api/overview.md` or `api/actions.md`
- `skills` entry: no link to any skills page

The result is that the CLI reference is a dead end for anyone who wants to understand what a command does beyond its syntax summary. The authored docs do have "Related Pages" sections and cross-references, but the generated CLI page does not link back to them.

**Why it matters for humans:** After finding a command name in the CLI reference, a human reader has to navigate to the authored docs independently. The page looks like a standalone reference but lacks the most important information about behavior.

**Why it matters for agents:** An agent scanning the CLI reference to discover what commands exist gets a flat list with no pointers to where behavior is defined. If it only sees `api/cli.md`, it misses `api/actions.md`, `api/snapshot.md`, etc.

**Recommendation:** Add a `docLink` or `canonical_page` field to command definitions in `registry.ts` (or to a supplementary config), and have the generator emit a "Details:" link in each per-command section. At minimum, the generator can be updated to link commands that have known authored doc pages without requiring code changes - this can be a static map in the generator itself.

---

### F-05: CLI reference flag lists are unstructured and unordered

**Severity:** Medium
**Surface:** `sites/docs/.build/api/cli.md` generated tables
**Evidence:** The "Flags" column in the master summary table mixes primary flags, selector shorthand flags, device flags, and output format aliases in a single flat comma-separated list. For example, `skills` lists 22 flags in one table cell with subcommands appended via `<br>`. The `read` command lists 20 flags.

These long flag lists in table cells:
- Render as extremely wide table rows in most Markdown renderers
- Do not distinguish required flags from optional flags
- Do not distinguish primary flags from accepted aliases
- Mix selector flags (--text, --id, --desc, --role) with device flags (--device) and mode flags (--validate-only, --dry-run)

**Why it matters for humans:** Tables with 20+ flags in a single cell are not scannable. The visual density defeats the purpose of having a table.

**Why it matters for agents:** A flat unordered flag list provides less signal than a structured one. The first command an agent would try is not identifiable.

**Recommendation:** In the restructured CLI reference, replace the flat flag column with a shorter curated list (primary selector flags + device flags + mode flags, max 5-7 per entry) and link to the full selector docs for selector flag details. The full flag enumeration belongs in the per-command authored doc page, not in the index table.

---

### F-06: "CLI To Action Mapping" table in `actions.md` partially duplicates the CLI reference

**Severity:** Low-Medium
**Surface:** `docs/api/actions.md` (lines near end of file)
**Evidence:** `actions.md` contains a "CLI To Action Mapping" table that maps CLI commands to their canonical action types (e.g., `click -> click`, `type -> enter_text`, `scroll-until -> scroll_until or scroll_and_click`). This table exists as authored content in `actions.md`.

The generated CLI reference page contains the same mapping implicitly, since each command's summary says what it does. The overlap is not severe but the direction of cross-reference is asymmetric: `actions.md` references the CLI surface, but the CLI reference page doesn't reference `actions.md`.

**Why it matters for humans:** If the CLI surface changes, two places need updating - the registry (which drives the generator) and the authored CLI-to-action table in `actions.md`.

**Why it matters for agents:** An agent reading `actions.md` gets the mapping. An agent reading `api/cli.md` does not. There is no reason for both to exist as separate tables.

**Recommendation:** Make the CLI-to-action mapping table in `actions.md` the canonical link bridge: it stays in `actions.md` as authored content, and the generated CLI reference links each command entry to the relevant action in `actions.md`. This avoids duplication while keeping both pages useful.

---

### F-07: Selector flags documented in both the CLI reference and `selectors.md`

**Severity:** Low-Medium
**Surface:** `docs/api/selectors.md`, `sites/docs/.build/api/cli.md`
**Evidence:** The CLI reference lists `--text, --text-contains, --id, --desc, --desc-contains, --role, --selector` for every device interaction command that uses selectors. `selectors.md` has a generated table of all selector flags (via the `selector-flags` marker) plus prose explaining their semantics. The same flag names appear in both surfaces.

The duplication is not exact since `selectors.md` explains semantics and `api/cli.md` just lists names. But a reader who doesn't know to go to `selectors.md` gets an incomplete picture from either page alone.

**Why it matters for humans:** Selector flag explanations live on `selectors.md` but the generated CLI reference does not link there.

**Why it matters for agents:** Both pages are in `llms-full.txt`. The selector flag names repeat without the semantics attached to the second occurrence.

**Recommendation:** The generated CLI reference per-command sections for selector-using commands should say "selector flags: see [Selectors](selectors.md)" instead of listing all flags inline. Primary device/mode flags can still be listed inline since they don't have a dedicated page.

---

### F-08: Doctor check IDs appear on both `setup.md` and `api/doctor.md`

**Severity:** Low
**Surface:** `docs/setup.md`, `docs/api/doctor.md`
**Evidence:** `setup.md` contains a full table of doctor check IDs (`host.node.version`, `host.java.version`, etc.) and a `DoctorReport` JSON shape. `api/doctor.md` (not read in full during this audit but referenced from setup.md) is the canonical home for that information.

The setup page has enough of the doctor contract to be self-contained, which may be intentional for the setup flow. But if the check list changes, two pages need updating.

**Why it matters for humans:** Minor maintenance burden.

**Why it matters for agents:** Minor token duplication in `llms-full.txt`.

**Recommendation:** In `setup.md`, keep the check table as a summary for the setup flow, but add a note that the full contract is in `api/doctor.md`. If the tables are identical, consider trimming `setup.md` to the 4-5 checks most relevant to first-run setup and cross-referencing for the rest.

---

### F-09: `skills` subcommands have no authored deep-dive pages

**Severity:** Low-Medium
**Surface:** Missing pages under `docs/` and `docs/skills/`
**Evidence:** The `skills` command has 14 subcommands visible in the generated CLI reference. The `docs/skills/` section has pages for overview, authoring, development workflow, device prep, and personalized skills - but no page covering the `skills` CLI surface: `skills list`, `skills get`, `skills for-app`, `skills search`, `skills compile-artifact`, `skills new`, `skills validate`, `skills run`, `skills install`, `skills update`, `skills sync`.

The only coverage of these subcommands is the generated CLI reference entry (syntax + flags) and the skills overview page (prose about the registry model). There is no page that explains what each skills subcommand does, what its output shape is, or how to recover from failures.

**Why it matters for humans:** Skills are the primary use case for many users, but the CLI surface is only partially documented.

**Why it matters for agents:** An agent trying to use `skills run` or `skills validate` has only the flag list to work from. There is no documented output shape, no documented error codes, no documented success conditions.

**Recommendation:** Add an authored `docs/skills/cli.md` or `docs/api/skills.md` page that documents the skills CLI surface with the same depth as `api/serve.md` documents the serve endpoints. This is separate from the existing skills authoring/runtime pages.

---

### F-10: Recording commands have no authored doc page

**Severity:** Low
**Surface:** `docs/api/recording.md` - only covers recording format, not the CLI commands
**Evidence:** `docs/api/recording.md` is listed in the nav as "Recording Format" and appears to document the NDJSON recording schema. The recording CLI commands (`recording start/stop/pull/parse/export/compare`) appear only in the generated CLI reference with syntax and flag lists. There is no authored page explaining what each recording subcommand does, what its output looks like, or how to parse a recording file programmatically.

**Why it matters for humans:** The recording workflow (start -> stop -> pull -> parse/export) requires understanding the sequence, but that sequence is not documented.

**Why it matters for agents:** An agent trying to use the recording CLI only has the generated flag list. No success conditions, no output shape, no error recovery.

**Recommendation:** Expand `docs/api/recording.md` to cover both the recording format and the recording CLI workflow in sequence, or split into `recording.md` (format) and a subsection of the CLI reference that links to it. The full CLI workflow is missing.

---

### F-11: MkDocs anchor stability is implicit, not documented

**Severity:** Low
**Surface:** Anchor strategy, cross-linking
**Evidence:** MkDocs generates anchors from heading text. The generated CLI page uses `### \`command\`` headings which produce anchors like `#snapshot`, `#click`, `#skills`. These anchors are stable because the generator produces them consistently, but:
- They are not documented as canonical links anywhere
- The `index.md` "API" section links to the page-level URLs (e.g., `api/cli.md`) but not to per-command anchors
- If a command name changes, its anchor changes with no redirect

The authored pages use `##` and `###` headings which also produce stable anchors (e.g., `#open_app`, `#click` in `actions.md`).

**Why it matters for humans:** External links to `docs.clawperator.com/api/cli/#snapshot` would break if the command is renamed or if the generated page structure changes.

**Why it matters for agents:** Agents using `llms.txt` or `llms-full.txt` navigate by page URL, not anchor. Anchor stability is less critical for agent consumers.

**Recommendation:** Document the stable canonical URL for each important page in a brief table (at minimum as an internal reference). For the CLI reference, the stable contract is the page URL `api/cli/` plus anchor `#command-name`. Add a note in the generator output that these anchors are derived from command names and are stable.

---

## Recommended Link and Anchor Strategy

### What should get stable anchors

- One anchor per CLI command: `api/cli.md#snapshot`, `api/cli.md#click`, etc. (already stable via generated headings)
- One anchor per action type: `api/actions.md#snapshot`, `api/actions.md#click`, etc. (already stable via authored headings)
- One anchor per error code: `api/errors.md#execution_validation_failed`, etc. (depends on generator output)

### Where canonical links should live

| Surface | Canonical page | Canonical anchor pattern |
| --- | --- | --- |
| CLI command syntax and flags | `api/cli.md` | `#command-name` |
| Action type parameters | `api/actions.md` | `#action_type` |
| Selector flags | `api/selectors.md` | `#selector-flags` (generated section) |
| Error codes | `api/errors.md` | generated table anchors |
| Result envelope | `api/overview.md` | `#result-envelope` |
| Setup workflow | `setup.md` | step headings |
| Serve endpoints | `api/serve.md` | endpoint headings |

### How cross-linking should be maintained

The simplest sustainable model:

1. **Authored pages**: continue using relative markdown links as they do now (`[Selectors](selectors.md)`, `[Actions](actions.md)`). This works well.
2. **Generated CLI page**: the generator should emit a "Details:" line for each command entry pointing to the canonical authored page. This can be maintained as a static lookup dict in the generator script.
3. **No autolinking in prose**: generic word autolinking is too noisy and error-prone. Explicit authored markdown links are the right model.
4. **No lint for unlinked command names**: the surface area is too large and the false-positive rate for common words (`open`, `read`, `type`) would make such a lint impractical.

---

## Recommended CLI Reference Strategy

### What `/api/cli/` should become

A clean **index** that is the authoritative machine-readable command list, not a behavior reference.

Structure:

```
# CLI Reference

This page is generated from the Node CLI registry.
For behavior, output shapes, and examples, follow the "Details" link for each command.

## Index

| Command | Syntax | Summary | Details |
| --- | --- | --- | --- |
| `snapshot` | `snapshot [--device <id>]` | Get current Android UI hierarchy as XML | [Snapshot Format](snapshot.md) |
| `click` | `click --text <text> [--device <id>]` | Tap the first matching UI element | [Actions](actions.md#click), [Selectors](selectors.md) |
| `exec` | `exec <json-or-file> [--device <id>]` | Execute a validated command payload | [API Overview](overview.md) |
...

## Command Details

### `snapshot`

- Summary: Get current Android UI hierarchy as XML
- Syntax: `snapshot [--device <id>] [--operator-package <pkg>]`
- Primary flags: `--device`, `--operator-package`, `--no-daemon`
- Aliases: `snapshot-ui`
- Details: [Snapshot Format](snapshot.md)

### `click`

- Summary: Tap the first matching UI element
- Syntax: `click --text <text> | --id <id> | --desc <text> | --role <role> [--device <id>]`
- Primary flags: see [Selector Flags](selectors.md#selector-flags); `--long`, `--focus`, `--coordinate`, `--device`, `--operator-package`
- Aliases: `tap`
- Details: [Actions - click](actions.md#click), [Selectors](selectors.md)
```

### What should move elsewhere or link elsewhere

- Full flag semantics: `api/selectors.md` (for selector flags), per-action authored pages
- Behavior, output shapes, and examples: authored pages (`api/actions.md`, `api/snapshot.md`, `api/serve.md`, etc.)
- Error codes: `api/errors.md`
- Skills subcommand reference: new `docs/skills/cli.md` or `docs/api/skills.md`

### What the generator must do differently

1. Emit each command exactly once (no group-level duplication of the master table)
2. Show only `documentedFlags` (primary flags), not all extracted flag strings
3. Link each command entry to its canonical authored doc page
4. Filter deprecated/alias commands (`setup`, `provision`) or put them in a separate "Deprecated" appendix
5. Keep the syntax column to the most common form (one line), with aliases on a separate line

---

## Implementation Phases

### Phase 1: Generator cleanup (reviewable, no authored content changes)

- Add `documentedFlags` to `registry.ts` for all commands that currently fall back to regex extraction, starting with `skills`, `recording`, and `exec`
- Add `deprecated: true` or `group: "hidden"` to `setup` and `provision` in `registry.ts`
- Remove `--receiver-package`, `--device-id`, `--timeout-ms` from skills `documentedFlags`
- Update `generate_cli_reference.py`:
  - Remove the per-group summary table duplication (keep master index table + per-command sections)
  - Limit flag output to `documentedFlags` only, falling back to a curated list rather than full regex extraction
  - Filter out hidden/deprecated commands

One PR. Validates with `./scripts/docs_build.sh`. No authored content changes.

### Phase 2: Add "Details" links to generated CLI page

- Add a static command-to-doc mapping dict in `generate_cli_reference.py`
- Emit a "Details:" line in each per-command section pointing to the canonical authored page
- For commands with no deep-dive page yet, link to `api/overview.md` as a fallback

One PR. Validates with `./scripts/docs_build.sh`.

### Phase 3: Authored doc improvements

- Add `docs/skills/cli.md` documenting the skills CLI subcommand surface (output shapes, error codes, success conditions)
- Expand `docs/api/recording.md` to document the recording CLI workflow sequence
- Trim the doctor check table in `setup.md` to first-run-relevant checks only, linking to `api/doctor.md` for full contract
- Remove the `actions.md` CLI-to-action mapping table (link to `api/cli.md` instead since Phase 2 adds that direction) OR keep it but add a source note that it tracks `registry.ts` via `api/cli.md`

Two to three PRs, one authored page per PR per the docs-author workflow.

### Phase 4: Validate and ship

- Run `./scripts/docs_build.sh` end-to-end
- Check `llms-full.txt` size and content for obvious noise reduction
- Verify the generated CLI page renders cleanly in the MkDocs terminal theme
- Update `docs/index.md` "CLI Reference" link description if the page character changed significantly

One PR.

---

## Open Questions

1. **Deprecated command handling**: Should `setup` and `provision` be removed from the generated output entirely, or kept with an explicit "deprecated" marker? Removing them is cleaner but may confuse agents that try these names. Keeping them with a marker preserves discoverability.

2. **Skills CLI page location**: Should the skills CLI subcommand reference live at `docs/skills/cli.md` (grouped with skills content) or `docs/api/skills.md` (grouped with the API section)? The skills section is already complex; the API section is more consistent with how other CLI-driven subsystems are documented.

3. **`documentedFlags` in `registry.ts`**: Is the `documentedFlags` array mechanism already used consistently by some commands but not others, or is it a planned mechanism that is rarely populated? If rarely used, Phase 1 has more scope than estimated.

4. **Generator "Details" link dict**: Should the command-to-doc-page mapping live inside the generator script (Python dict, easy to update without touching `registry.ts`) or inside `registry.ts` itself as a `docPage` field? The `registry.ts` approach ties the mapping to the code definition but requires a TypeScript change per link update.

5. **"CLI To Action Mapping" table in `actions.md`**: Keep, remove, or convert to a generated marker? If the CLI reference (Phase 2) provides the link to `actions.md`, the mapping table in `actions.md` becomes redundant. But it provides the reverse lookup (action type -> CLI command) which is useful for agents building raw payloads and wanting to know how to verify via CLI. Recommend keeping it but confirming it stays in sync with the generator output.

6. **Selector flags in CLI table**: The current pattern shows all shorthand selector flags (`--text, --text-contains, --id, --desc, --desc-contains, --role, --selector`) per command. In the restructured generator, should these be replaced with a single "selector flags: see [Selectors](selectors.md)" note, or should the 4 primary shorthand flags be listed inline? Listing 4 is readable; the link-only approach is cleaner but loses discoverability.
