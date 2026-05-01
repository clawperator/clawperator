# Docs Website Responsive CSS Review Findings

## Scope

Reviewed the current MkDocs docs website implementation and rendered output for layout, readability, and responsive behavior. This is a recommendation record only. No website source, generated docs output, or theme files were changed as part of this task note.

Inspected:

- `sites/docs/mkdocs.yml`
- `sites/docs/overrides/main.html`
- `sites/docs/overrides/stylesheets/terminal-theme.css`
- `sites/docs/.build/`
- `sites/docs/site/`
- `docs/api/actions.md`
- generated `sites/docs/.build/api/cli.md`
- `docs/api/errors.md`
- `docs/skills/cli.md`
- `docs/skills/runtime.md`

Rendered checks used:

- `1440x1100`: `/api/cli/`
- `1280x900`: `/api/actions/`
- `820x1100`: `/skills/runtime/`
- `390x900`: `/api/cli/`

Validation run before the visual audit:

```bash
./scripts/docs_build.sh
```

The two original temporary screenshot paths from the user request were no longer present on disk when checked, so the audit relied on fresh local renders of the current site.

## Executive Summary

The current docs site problems are mostly layout mechanics, not brand direction.

The site uses the MkDocs Terminal theme with a custom `--page-width: 60em`. With the current 15px base font size, this creates a centered 900px shell. On desktop, the theme then splits that already narrow shell into a left navigation column and main content column. The result is that article content begins too far to the right while large areas of desktop viewport remain unused.

The second major problem is technical-content overflow. Code blocks currently wrap with `white-space: pre-wrap` and `word-break: break-all`, while generated reference tables can force the main grid wider than its intended container. Commands, JSON, paths, flags, and package names should remain exact and copyable, so horizontal scrolling is safer than aggressive wrapping.

Highest-impact fixes:

- Widen and modernize the page shell.
- Replace the proportional sidebar grid with an explicit sidebar plus `minmax(0, 1fr)` content column.
- Add `min-width: 0` to grid children and content containers.
- Make `pre`, code blocks, and tables horizontally scroll when needed.
- Collapse, hide, or move the full side navigation earlier on tablet and mobile.
- Reduce the visual weight of inline code on dense generated reference pages.

## Current Problems

### Desktop shell is too narrow and centered

- Severity: High
- Affected viewport: desktop wide and laptop
- Affected element/page: all docs pages with side navigation, especially `/api/cli/` and `/api/actions/`
- Likely cause: Terminal CSS applies `.container { max-width: var(--page-width); }`; the custom stylesheet sets `--page-width: 60em`.
- Why it hurts readability: at `1440px`, the page shell is only about `900px` wide and starts around x=270px. The article content then starts around x=448px after the side navigation and grid gap. The page feels offset and cramped despite abundant desktop space.

### Sidebar and content grid fight the container

- Severity: High
- Affected viewport: desktop wide, laptop, mobile
- Affected element/page: generated CLI reference table on `/api/cli/`
- Likely cause: the theme injects `.terminal-mkdocs-main-grid { grid-template-columns: 4fr 9fr; }` above `70em`. Grid children keep intrinsic minimum widths, and wide table content forces the content column wider than the 900px page shell.
- Why it hurts readability: the measured grid was 860px wide, but its columns resolved to roughly `137px 907px`. The main content spills beyond the intended shell. On mobile, the same generated table remains about 907px wide and creates page-level horizontal overflow.

### Full side navigation appears before content on tablet and mobile

- Severity: High
- Affected viewport: tablet and mobile
- Affected element/page: all docs pages with side navigation
- Likely cause: below `70em`, the theme falls back to a one-column grid, but the complete side navigation remains in normal document flow above the article.
- Why it hurts readability: at `820px`, article content started around y=1219px on `/skills/runtime/`. At `390px`, the first screen was dominated by top navigation and side navigation, with page content pushed far below the fold.

### Code blocks wrap and break exact technical text

- Severity: Medium
- Affected viewport: all
- Affected element/page: code blocks in `/api/actions/`, `/skills/runtime/`, and generated reference pages
- Likely cause: Terminal CSS sets `pre { white-space: pre-wrap; word-break: break-all; word-wrap: break-word; }`, while `pre code` also has `overflow-x: scroll`.
- Why it hurts readability: commands, JSON, paths, package names, and identifiers break across lines. This makes exact copy/paste and visual comparison harder. The outer `pre` wrapping behavior defeats the inner code scrolling behavior.

### Tables do not have contained horizontal overflow

- Severity: Medium
- Affected viewport: desktop and mobile, worse on generated reference pages
- Affected element/page: `/api/cli/` command index and other reference tables
- Likely cause: plain Markdown tables render as bare `table` elements with `width: 100%`, no wrapper, and no constrained scroll container.
- Why it hurts readability: wide tables either compress content into awkward wrapped cells or force grid/page overflow. On mobile, this should be a table-level scroll interaction, not body-level horizontal scroll.

### Inline code is visually noisy in dense pages

- Severity: Medium
- Affected viewport: all
- Affected element/page: tables and source lists with many inline `code` fragments
- Likely cause: `--code-bg-color: #f4ede1` is applied broadly to inline code, including dense reference tables.
- Why it hurts readability: inline code becomes a field of highlighted fragments. That is useful for a few identifiers, but it reduces scanability when nearly every cell contains code-styled text.

### Top navigation wraps awkwardly on mobile

- Severity: Medium
- Affected viewport: mobile
- Affected element/page: header nav
- Likely cause: Terminal theme flex navigation wraps naturally and is not tuned for narrow docs viewports.
- Why it hurts readability: at `390px`, header links wrap beside the logo before the side nav begins. The first viewport feels crowded before the user reaches article content.

### Local favicon request returned 404

- Severity: Low
- Affected viewport: all local serve checks
- Affected element/page: browser chrome polish
- Likely cause: local MkDocs serve logged requests for `/favicon.png` as 404.
- Why it hurts readability: not a layout blocker, but it is a small polish issue to verify during a future docs-site pass.

## Recommended CSS/Layout Strategy

### Page and content container width

Replace the effective 900px shell with a responsive page width that uses desktop space without creating overlong prose lines.

Recommended direction:

```css
:root {
  --page-width: 1180px;
}

.container {
  width: min(100% - 32px, var(--page-width));
  max-width: var(--page-width);
}
```

For wide screens, `1180px` to `1200px` is a good starting range. With a fixed navigation column around `220px` to `240px`, the article area lands around `850px` to `930px`, which is acceptable for technical docs that include code and tables. If prose feels too wide after the shell fix, cap direct prose children separately rather than constraining the entire reference layout.

### Sidebar and content alignment

Avoid proportional `4fr 9fr` columns. Use an explicit sidebar and a flexible content column:

```css
@media (min-width: 70em) {
  .terminal-mkdocs-main-grid {
    grid-template-columns: 240px minmax(0, 1fr);
    column-gap: 2rem;
  }

  #terminal-mkdocs-main-content,
  #mkdocs-terminal-content {
    min-width: 0;
  }
}
```

This keeps the sidebar predictable and allows wide content to shrink inside the available main column instead of expanding the grid.

### Code block behavior

Code blocks should preserve exact text and scroll horizontally when needed:

```css
pre {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
}

pre code {
  display: block;
  min-width: max-content;
  overflow-x: visible;
}
```

This is especially important for commands, JSON, package names, paths, and generated examples. Wrapping long code should be avoided unless a specific page intentionally opts in.

### Table behavior

Tables should not force body-level horizontal scroll. Low-risk first pass:

```css
#mkdocs-terminal-content table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}
```

Better longer-term approach:

- Wrap generated Markdown tables in a `.table-scroll` container during rendering or generation.
- Keep the inner `table` as a native table.
- Put `overflow-x: auto` on the wrapper.

This preserves table semantics better, but the CSS-only approach is likely enough for an initial visual repair.

### Inline code styling

Keep inline code visible but less heavy:

```css
:root {
  --code-bg-color: #f7f1e8;
}

#mkdocs-terminal-content :not(pre) > code {
  padding: 0 0.15em;
}
```

Avoid adding borders around inline code. On dense generated pages, softer highlighting will improve scanability without changing content.

### Mobile breakpoints

The full side navigation should not dominate the first mobile view. Recommended options, from lowest to higher implementation effort:

1. Hide the side navigation below a tablet breakpoint and rely on top nav/search.
2. Move side navigation after article content on small screens.
3. Convert side navigation into a collapsed `<details>` block or menu.

For mobile padding, reduce the horizontal padding from 20px to around 14px to 16px:

```css
@media (max-width: 600px) {
  .container,
  .container-fluid {
    padding-left: 16px;
    padding-right: 16px;
  }
}
```

The top navigation also needs a compact behavior so links do not wrap awkwardly next to the logo.

### Generated reference pages

Generated pages like `/api/cli/` need to be treated as reference surfaces, not pure prose.

Recommended behavior:

- Let generated reference pages use the wider main column.
- Use horizontal scrolling for command index tables.
- Preserve exact commands and JSON in code blocks.
- Avoid wrapping identifiers or flags inside code blocks.
- Keep copy/paste readability ahead of fitting every token into the viewport.

## Proposed Implementation Plan

1. Low-risk layout/container fixes

   Update `sites/docs/overrides/stylesheets/terminal-theme.css` only. Increase `--page-width`, set a responsive container width, replace the desktop grid with a fixed sidebar plus `minmax(0, 1fr)`, and add `min-width: 0` to main content wrappers.

2. Code/table overflow fixes

   Override `pre`, `pre code`, and table overflow behavior so long technical content scrolls inside its container. Confirm body-level horizontal scroll is gone on mobile.

3. Mobile polish

   Add a small-screen strategy for side navigation and top navigation. The success criterion is that article content appears quickly and nav wrapping does not consume the first screen.

4. Visual quality assurance pass

   Tune inline code background, code block padding, table cell padding, and line height after the layout fixes are in place. Avoid redesigning the docs brand or replacing the theme.

## Validation Plan

Run:

```bash
./scripts/docs_build.sh
sites/docs/.venv/bin/mkdocs serve -f sites/docs/mkdocs.yml
```

Check these pages and viewports before shipping:

- `1440x1100`: `/api/cli/`
  - Article start position feels intentional.
  - Sidebar width is stable.
  - Command table is contained.
  - No body-level horizontal scroll.

- `1280x900`: `/api/actions/`
  - Prose width is readable.
  - Source path inline code remains readable.
  - JSON/code blocks preserve exact text and scroll when needed.
  - Tables stay inside the main content area.

- `820x1100`: `/skills/runtime/`
  - Tablet navigation does not push the article excessively far down.
  - Code blocks remain copyable.
  - Tables do not force page overflow.

- `390x900`: `/api/cli/`
  - Top navigation behaves cleanly.
  - Side navigation does not dominate the page before content.
  - Command table scrolls inside its own area.
  - `document.documentElement.scrollWidth <= window.innerWidth` unless an intentional inner scroller is being measured.

- `390x900`: `/api/errors/` and `/skills/cli/`
  - Dense inline code is readable.
  - Generated lists and tables do not create body-level horizontal scroll.
  - Long commands and JSON remain exact and copyable.

For browser-level verification, capture screenshots at each viewport and run a computed check for page-level overflow:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

That check should pass on mobile after table and code overflow are contained.
