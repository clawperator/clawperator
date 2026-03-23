# PRD-2: Docs Structural Reform

Workstream: docs-refactor
Priority: 2 (within docs refactor; blocked on PRD-1 completion)

Originally PRD-7 in `tasks/node/agent-usage/`. Moved here after the API refactor
plan split that work into its own task area. PRD-1 (entry points) aligns existing
docs with shipped behavior. This PRD fixes the structure of the docs site itself.

---

## Problem Statement

`docs.clawperator.com` is structurally incoherent. The site mixes at least four
conflicting organizational models simultaneously: user journeys, personas, content types,
and internal architecture. The result is duplicated entry points, repeated pages, and no
clear path from setup to usage to reference. The same concepts appear in multiple places
without a canonical home. Agents (and humans) face a discovery loop rather than a
directed path.

This is not a content quality problem - the content is largely accurate and useful. It
is an information architecture problem.

---

## Evidence

**From `docs/index.md` (verified against source):**
> `docs/index.md` already lists `llms.txt`, `Agent Quickstart`, `First-Time Setup`, and
> `OpenClaw First Run`, so the docs have the necessary entry points. The docs are useful
> once found, but the first-run path is not a single obvious sequence.
> `docs/agent-quickstart.md` and `docs/openclaw-first-run.md` exist as peers with no
> explicit priority ordering.

**From the user's original brief:**
> Structurally incoherent because it mixes multiple conflicting organizational models at
> once, including user journeys, personas, content types, and internal architecture,
> resulting in duplicated entry points, repeated pages, and unclear navigation where the
> same concepts appear in multiple places without a single canonical home. This creates
> cognitive overhead for both humans and agents, as there is no clear path from setup to
> usage to reference, and the hierarchy reflects how the system was built rather than how
> it is used.

---

## Current Behavior

Without running the docs build and auditing live, the structure shows:
- Multiple competing entry points at the same level (quickstart, openclaw-first-run,
  first-time-setup) with no explicit priority ordering
- Reference material (API, error codes, contracts) mixed into the same hierarchy as
  conceptual docs and tutorials
- Internal architecture docs alongside user-facing guides
- Pages that likely duplicate content across the agent, developer, and operator personas

---

## Proposed Change

### 1. Audit before designing

Before restructuring, run the docs site locally and map the current structure:
- List every page and its current nav location
- Identify pages that cover the same concept from different angles (duplication)
- Identify pages with no clear audience (wrong org model)
- Identify pages that are orphaned or only reachable by direct URL

Produce a short table: `current-path | content-summary | duplication | proposed-action`.

### 2. Target structure: intent-driven, four sections

The goal is a single hierarchy that answers four questions in order:

```
Get Started
  - What is Clawperator? (one-paragraph concept; points to llms.txt for agents)
  - First-time setup (install + APK + device; one canonical page, not three)
  - Agent quickstart (from zero to first command)

Use Clawperator
  - Running skills (how to find, validate, and run skills)
  - Executing commands (the execute API; how to construct payloads)
  - Doctor and readiness (what doctor checks, how to interpret results)
  - Streaming and logs (where logs live, how to read them)

Reference
  - Node API reference (execute, skills, doctor - full contract)
  - Action types (every supported action with params)
  - Error codes (every code, what it means, how to recover)
  - CLI reference (every command and flag)

Troubleshoot and Diagnose
  - Common failures (OPERATOR_NOT_INSTALLED, timeout, etc. - one page per failure class)
  - Reading the log (how to use the NDJSON log)
  - Version compatibility
```

This structure has one entry point per concept, separates "how to use" from "reference",
and gives troubleshooting its own home so it is not mixed into tutorials.

### 3. Collapse duplication

For each duplicated concept:
- Keep the most complete version as the canonical page
- Delete or redirect the others; do not preserve them as historical context
- Update all internal links to point to the canonical page

Specific candidates expected (confirm during audit):
- `agent-quickstart.md` and `openclaw-first-run.md`: collapse into one page with a
  note for OpenClaw-specific steps; or keep as separate pages under "Get Started" with
  explicit roles ("start here if using OpenClaw")
- `first-time-setup.md`: should be the one canonical "install and configure a device"
  page, not a peer to agent-quickstart
- Any architecture/internals docs: move to a separate "Contributing" or "Architecture"
  section that is not in the main nav path; these are for contributors, not operators

### 4. Update `mkdocs.yml` and `source-map.yaml`

All navigation changes must be reflected in:
- `sites/docs/mkdocs.yml`: the nav tree is the canonical structure
- `sites/docs/source-map.yaml`: any page renames or moves require source map updates
- Remove deleted pages from both files

**Redirect plugin**: before adding redirect entries, check `sites/docs/mkdocs.yml` for a
`plugins:` section containing `redirects`. If the plugin is not configured, redirects via
config are not available. In that case, either: (a) add the `mkdocs-redirects` plugin to
`sites/docs/requirements.txt` and configure it, or (b) leave a markdown stub at the old
URL with a manual "This page moved to: <new-url>" note. Document which approach was used.

**Also update PRD-1 docsUrl values**: when renaming or moving the first-time-setup page
and any other pages referenced by `docsUrl` in `readinessChecks.ts`, update those
hardcoded URLs as part of this PR. Search `apps/node/src/domain/doctor/checks/` for
`docsUrl` values and update them to match the new page paths.

### 5. Update `llms.txt` to reflect the new structure

After the structure settles, update both `llms.txt` files to reflect the new page
hierarchy and canonical paths. The `llms.txt` is the machine-readable entry point and
must be accurate about where to find each type of information.

---

## Why This Matters for Agent Success

An agent that opens `docs.clawperator.com` and finds two competing quickstarts, no
clear "reference vs. tutorial" boundary, and repeated pages covering the same topic from
different angles has to do extra work to resolve the structure before extracting the
content. Worse: an agent using `llms.txt` to navigate will follow whatever structure the
nav represents. If the nav is incoherent, the machine-readable entry point is incoherent
too.

The content already exists and is largely correct after the runtime PRDs ship. This PRD
makes it findable.

---

## Scope Boundaries

In scope:
- Nav structure and hierarchy (`mkdocs.yml`)
- Page consolidation: merging duplicates, deleting redundant pages
- `source-map.yaml` updates for any renames or deletions
- `llms.txt` update to reflect new structure
- Internal link updates throughout the docs

Out of scope:
- Rewriting content (fix structure, not prose)
- Adding new content (that belongs to the relevant runtime PRD)
- Changing the MkDocs theme or visual design
- The `sites/landing/` landing site (separate surface)
- The `clawperator-skills` docs (coordinate separately)

---

## Dependencies

- **The API refactor and PRD-1 must land first.** This PRD documents the final shipped
  behavior. If the API refactor or PRD-1 is still in flight, the docs will describe
  behavior that does not yet exist or that contradicts what is actually shipped.
- PRD-1 must land first: the entry-point alignment (PRD-1) is a prerequisite. This
  PRD then finalizes the structure around that aligned content.

---

## Risks and Tradeoffs

**Risk: breaking existing links**
Renaming or moving pages breaks external links and any llms.txt references. Use redirects
where MkDocs supports them. Document the old paths in the commit message.

**Risk: scope expansion**
An audit often reveals more duplication than expected. Timebox the audit to one pass
through `mkdocs.yml` only — not the content of every page. The nav tree in `mkdocs.yml`
lists every page and its location; that is sufficient to map the full structure and
identify duplication without reading each page's prose. Open each page only when the
nav tree entry is ambiguous about what it covers.

Prioritize the first-run and reference sections; leave the deep architecture docs for
a follow-on if needed.

**Risk: landing before runtime PRDs**
If this PR lands before the API refactor and PRD-1 merge, the restructured docs will describe
behavior that does not exist yet. Hard dependency: do not open this PR until all prior
PRs are merged and deployed.

---

## Testing Plan

No unit tests. This is a documentation-only change.

### Pre-merge checklist

- `./scripts/docs_build.sh` succeeds with no broken internal links
- All pages referenced in `mkdocs.yml` exist on disk
- No pages on disk are absent from `mkdocs.yml` (orphaned pages)
- `llms.txt` URLs resolve to actual pages in the built site
- The "Get Started" section leads a new reader from zero to first command without
  requiring them to cross-reference two competing guides

### Manual walkthrough (required before merge)

Walk through two user journeys and confirm each has a single unambiguous path:

1. **New agent, first time**: `llms.txt` → quickstart → setup → first command. No
   dead ends, no "see also" that leads to a peer page covering the same thing.

2. **Experienced agent, error debugging**: navigate to the error code reference for
   `OPERATOR_NOT_INSTALLED`; navigate to the troubleshooting page for timeout errors.
   Each should be a direct path with no disambiguation required.

---

## Acceptance Criteria

- `mkdocs.yml` nav tree follows the four-section structure (Get Started / Use / Reference /
  Troubleshoot).
- No two pages cover the same concept as primary content (duplication eliminated).
- A first-time agent reading `llms.txt` can navigate to: setup page, quickstart, API
  reference, error codes, troubleshooting - each at a stable, predictable URL.
- `./scripts/docs_build.sh` succeeds with zero broken internal link warnings.
- Both `llms.txt` files reflect the new page structure accurately.
- No content was deleted without either merging it into a canonical page or confirming
  it was unreferenced and stale.
