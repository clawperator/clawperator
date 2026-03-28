# Docs Gaps for Eval Fairness - Work Breakdown

Parent plan: `docs/gaps/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 adds the annotated snapshot example to
`docs/api/snapshot.md`. Phase 2 adds the new `docs/quickstart.md` workflow
page and registers it in the nav. Both phases use the `docs-author` skill
workflow. Regenerate `.build/` once at the end of Phase 2.

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Annotated snapshot example + quickstart workflow page | 1, 2 | default, default | `./scripts/docs_build.sh` passes; both pages render correctly |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | 1 |
| Blockers | none |

## Hard Rules

1. Do not copy prose from old deleted docs. Use them only for structural
   reference. All written content must reflect the current API.
2. Capture the snapshot example from a real device run. Do not invent XML
   attributes or node structure.
3. Create `docs/gaps/findings.md` at the start of Phase 1 using the structure
   in `docs/gaps/plan.md`. Update it before every commit.
4. Do not edit `sites/docs/.build/` or `sites/docs/site/` directly.
5. Run `./scripts/docs_build.sh` exactly once, at the end of Phase 2, after
   all authored content is complete.
6. Use `.agents/skills/docs-author/SKILL.md` for all documentation authoring
   steps. Do not invent the workflow from scratch.
7. Every link in `docs/quickstart.md` must point to a page that exists on
   `docs.clawperator.com`. Do not link to local files or internal repo paths.
8. Use the branch-local CLI build for the device snapshot capture:
   `node apps/node/dist/cli/index.js`. Build first if `dist/` is stale.
9. One commit per phase. Do not batch Phase 1 and Phase 2 into one commit.
10. Update `docs/gaps/plan.md` Status section after each phase completes.
11. If the docs build fails, fix the source file first. Never patch `.build/`.
12. Never shorten `Clawperator` to `Claw` in any authored content.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `docs/gaps/plan.md` | Scope, decision rules, output contract, failure modes |
| 2 | `docs/api/snapshot.md` | Current snapshot doc - understand existing sections before adding |
| 3 | `docs/api/navigation.md` | Current navigation doc - quickstart links here for composition patterns |
| 4 | `docs/api/actions.md` | Current actions doc - quickstart links here for action reference |
| 5 | `docs/api/overview.md` | Current overview - quickstart links here |
| 6 | `sites/docs/mkdocs.yml` | Current nav structure - understand placement before editing |
| 7 | `.agents/skills/docs-author/SKILL.md` | Required workflow for all doc authoring steps |
| 8 | `git show dc51c46^:docs/snapshot-format.md` | Old snapshot example - structural reference only |
| 9 | `git show dc51c46^:docs/agent-quickstart.md` | Old quickstart - structural reference only |
| 10 | `git show dc51c46^:docs/navigation-patterns.md` | Old workflow patterns - structural reference only |

Do not begin writing until all ten files have been read.

---

## Phase 1: Annotated Snapshot Example

### Agent Tier

default

### Goal

Add a rich annotated example section to `docs/api/snapshot.md` that shows
realistic Android UI XML with inline explanations of each node pattern an agent
will commonly encounter. The example must come from a real device run.

### Files or Surfaces To Change

- `docs/gaps/findings.md` (create)
- `docs/api/snapshot.md` (add one section)

### Steps

1. Build the branch-local Node CLI if `dist/` is stale:
   ```bash
   npm --prefix apps/node run build
   ```
2. Create `docs/gaps/findings.md` with the required structure from
   `docs/gaps/plan.md`. Fill in the Device Used section immediately.
3. Run a fresh snapshot against a connected Android device with Settings open
   (or open it first via `clawperator open com.android.settings`):
   ```bash
   node apps/node/dist/cli/index.js snapshot \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --json
   ```
4. Extract `envelope.stepResults[0].data.text` from the JSON output. This is
   the raw XML hierarchy string.
5. Select an illustrative subset of nodes that includes ALL of:
   - a scroll container (`scrollable="true"`)
   - an icon-only interactive element (no `text`, uses `content-desc`)
   - a clickable row (container is clickable, children are static labels)
   - a child title/label with a stable `resource-id`
   - a child summary/subtitle label
   - at least one node with `enabled="false"` if present on the current screen,
     otherwise scroll to a screen that has one (e.g. Settings > About phone)
   Record the selection rationale in `findings.md` under "XML Subset Selected".
6. Read the old `snapshot-format.md` via git for annotation style reference:
   ```bash
   git show dc51c46^:docs/snapshot-format.md
   ```
   Note the comment style in `findings.md`. Do not copy any prose.
7. Write the annotated example section in `docs/api/snapshot.md`. Place it
   after the existing "Realistic XML Fragment" section (which shows a minimal
   envelope extract) and before "Extraction Failure". Title the new section:
   `## Annotated Live-Device Example`.

   Requirements for the section:
   - Open with one sentence: what device/screen this came from, why it is
     useful for agents.
   - Show the XML in a fenced code block.
   - Use XML comments (`<!-- ... -->`) inside the block to annotate each
     node pattern: what it is, how an agent would target it, any caveats.
   - After the code block, include a short "Reading patterns" subsection
     (3-6 bullet points) summarizing the common targeting strategies visible
     in the example: tap targets via container clickability, icon-only via
     content-desc, scroll containers, resource-id stability.
   - Do not add metadata fields (`foreground_package`, `has_overlay`) to the
     example. The example is the `data.text` XML only.
   - Do not repeat content already in existing sections. Cross-reference them.

8. Update `findings.md` Phase 1 Decisions section.
9. Read the new section aloud (or re-read slowly) and verify:
   - every annotated comment describes something an agent would actually need
     to know
   - no invented or outdated attributes
   - no links pointing outside `docs.clawperator.com`
10. Commit:
    ```bash
    git add docs/api/snapshot.md docs/gaps/findings.md
    git commit -m "docs: add annotated snapshot example for agent orientation"
    ```

### Acceptance Criteria

Mechanical:
- `docs/api/snapshot.md` contains a section `## Annotated Live-Device Example`.
- The XML block inside the section contains at least one `<!-- ... -->` comment.
- The section contains a `### Reading patterns` subsection.
- No invented XML attributes: every attribute in the example exists in the
  real device output captured in `findings.md`.
- `findings.md` has all required sections filled in (not placeholder text).

Human review:
- The annotated example would help a cold-start agent understand how to target
  a Settings row, an icon-only button, and a scroll container.
- No content contradicts the existing "The XML Format" section.
- No em dashes in the written content.

### Validation

```bash
grep -n "Annotated Live-Device Example" docs/api/snapshot.md
grep -n "Reading patterns" docs/api/snapshot.md
```

Both commands must return a match.

### Expected Commit

```
docs: add annotated snapshot example for agent orientation
```

---

## Phase 2: Quickstart Workflow Page

### Agent Tier

default

### Goal

Write `docs/quickstart.md` - a cold-start entry point that shows the
observe-decide-act automation loop end-to-end with a concrete worked example.
Register it in the docs-site nav. Regenerate `.build/` and verify the build.

### Files or Surfaces To Change

- `docs/quickstart.md` (new)
- `docs/index.md` (add link/reference)
- `sites/docs/mkdocs.yml` (add nav entry)
- `sites/docs/.build/` (regenerated - do not hand-edit)

### Steps

1. Read the old `agent-quickstart.md` and `navigation-patterns.md` via git
   for structural reference:
   ```bash
   git show dc51c46^:docs/agent-quickstart.md
   git show dc51c46^:docs/navigation-patterns.md
   ```
   Record structural notes in `findings.md` Phase 2 Decisions section.
   Do not copy any prose.

2. Use `.agents/skills/docs-author/SKILL.md` for this authoring step.

3. Write `docs/quickstart.md`. It must include these sections in this order:

   **Required sections:**
   - `# Quickstart` - H1 title
   - `## Before you start` - prerequisites: doctor check passes, device
     connected, clawperator binary accessible, link to setup.md
   - `## The automation loop` - short description of the observe-decide-act
     pattern. Make it explicit: (1) snapshot, (2) decide, (3) act, (4) repeat.
   - `## Step 1: Open an app` - show `clawperator open com.android.settings`
     with expected output shape. Explain `open_app` briefly, link to actions.md.
   - `## Step 2: Observe the screen` - show `clawperator snapshot --json`.
     Show where to find `data.text` in the envelope. Link to snapshot.md for
     the full XML contract. One-sentence pointer to the annotated example.
   - `## Step 3: Act on what you see` - show a `clawperator click` example
     using `--text` selector. Show a `clawperator type` example. Link to
     selectors.md and actions.md for full selector/action reference.
   - `## Putting it together` - a minimal 3-step CLI sequence:
     open Settings, snapshot, click a row. Show actual CLI commands.
   - `## What to read next` - bullet list of links:
     - Actions reference: `api/actions.md`
     - Selectors: `api/selectors.md`
     - Snapshot format: `api/snapshot.md`
     - Navigation patterns: `api/navigation.md`
     - Errors: `api/errors.md`

   Content rules:
   - All CLI examples must use `--device <device_serial>` and
     `--operator-package <operator_package>`.
   - All links must be relative doc-site links, not absolute URLs.
   - Do not describe strategy or planning. Clawperator is the hand, not the brain.
   - No em dashes.
   - Second-person voice (`you`, `your`).
   - Match the prose style of `docs/api/overview.md`.

4. Add a link to `docs/quickstart.md` from `docs/index.md`. Find the most
   appropriate existing section to add it. If no suitable section exists, add
   a short "Getting started" entry before the API section links.

5. Add the nav entry to `sites/docs/mkdocs.yml`. Insert between `setup.md`
   and the `API:` group:
   ```yaml
   - Quickstart: quickstart.md
   ```

6. Regenerate `sites/docs/.build/`:
   ```bash
   ./.agents/skills/docs-build/scripts/run_docs_build.sh
   ```
   Or use the docs-build skill if it handles regeneration end-to-end.

7. Run the full docs build to verify no broken links or nav errors:
   ```bash
   ./scripts/docs_build.sh
   ```
   The command must exit 0.

8. Update `findings.md` Phase 2 Decisions section.

9. Commit:
   ```bash
   git add docs/quickstart.md docs/index.md sites/docs/mkdocs.yml \
     sites/docs/.build/ docs/gaps/findings.md
   git commit -m "docs: add quickstart workflow guide and register in nav"
   ```

### Acceptance Criteria

Mechanical:
- `docs/quickstart.md` exists.
- `docs/quickstart.md` contains all required section headings (grep for each).
- `sites/docs/mkdocs.yml` contains `quickstart.md`.
- `./scripts/docs_build.sh` exits 0 with no warnings about missing pages.
- `sites/docs/.build/quickstart.md` exists (generated output present).

```bash
grep -n "Before you start\|automation loop\|Step 1\|Step 2\|Step 3\|Putting it together\|What to read next" docs/quickstart.md
grep "quickstart.md" sites/docs/mkdocs.yml
ls sites/docs/.build/quickstart.md
./scripts/docs_build.sh
```

Human review:
- A cold-start agent could follow the page from top to bottom and know how to
  take a snapshot, read the XML, and click an element.
- Every CLI example is runnable with a real device (no invented flags).
- No link is broken or points to a non-existent page.
- The page does not duplicate large blocks of content from `api/snapshot.md`
  or `api/actions.md`; it introduces concepts and links to the full reference.
- No em dashes.

### Expected Commit

```
docs: add quickstart workflow guide and register in nav
```
