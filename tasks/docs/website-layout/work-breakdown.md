# Docs Website Layout Repair Work Breakdown

Parent plan: `tasks/docs/website-layout/plan.md`

## Executive Summary

1 PR, 3 phases. Phase 1 fixes the desktop shell, sidebar/content grid, and technical-content overflow. Phase 2 handles tablet/mobile navigation and small-screen polish. Phase 3 is the required rendered visual QA pass using Codex with `browser-use:browser`, followed by final build validation and commit cleanup.

The implementing agent for every phase is Codex. Codex must use the in-app Browser Use workflow for rendered verification.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Codex is the implementing agent for this task pack.
- Codex must use `browser-use:browser` for rendered viewport verification. Do not substitute macOS `open`, Chrome headless screenshots, Playwright outside Browser Use, or Computer Use unless Browser Use is unavailable after following its own troubleshooting path.
- Read `~/.codex/plugins/cache/openai-bundled/browser-use/0.1.0-alpha1/skills/browser/SKILL.md` in full before the first browser action in this task.
- Do not hand-edit `sites/docs/.build/` or `sites/docs/site/`.
- Prefer editing `sites/docs/overrides/stylesheets/terminal-theme.css`. Edit `sites/docs/overrides/main.html` only if a CSS-only fix cannot satisfy the acceptance criteria.
- Preserve exact technical content. Do not introduce wrapping that changes copy/paste readability for commands, JSON, file paths, package identifiers, flags, or generated reference syntax.
- Keep table and code overflow local to their containers. Do not allow body-level horizontal scroll on mobile pages.
- Run `./scripts/docs_build.sh` before final acceptance.
- If Browser Use validation finds a material anomaly, append it to `tasks/docs/website-layout/findings.md` before the final phase commit.
- Keep commits narrow and conventional. Do not batch unrelated docs website work into this task.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/docs/website-layout/plan.md` | Stable contract, source boundaries, and decision rules |
| `tasks/docs/website-layout/findings.md` | Audit evidence, measured causes, and target pages/viewports |
| `~/.codex/plugins/cache/openai-bundled/browser-use/0.1.0-alpha1/skills/browser/SKILL.md` | Required in-app browser workflow for rendered validation |
| `.agents/skills/docs-build/SKILL.md` | Repo-local docs build workflow and generated-output expectations |
| `sites/docs/mkdocs.yml` | MkDocs theme configuration and docs-site nav surface |
| `sites/docs/overrides/main.html` | Current template override and injected stylesheet path |
| `sites/docs/overrides/stylesheets/terminal-theme.css` | Primary authored CSS surface to edit |
| `sites/docs/site/api/actions/index.html` | Example rendered page showing the theme-emitted layout style block that must be overridden indirectly |
| `sites/docs/source-map.yaml` | Generated docs boundaries and source mapping |
| `sites/docs/.build/api/cli.md` | Generated CLI reference source with wide table content |
| `sites/docs/.build/api/actions.md` | Generated/reference content with code blocks and tables |
| `sites/docs/.build/api/errors.md` | Reference page for mobile/dense inline-code checks |
| `sites/docs/.build/skills/cli.md` | Skills CLI page for generated reference behavior |
| `sites/docs/.build/skills/runtime.md` | Skills runtime page for tablet/mobile code/table checks |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Repair docs website layout and responsive CSS | 1, 2, 3 | default, default, thinking | none |

## Phase 1: Desktop Layout and Technical Overflow

### Agent Tier

default

### Goal

Fix the desktop page shell, sidebar/content grid, code block behavior, table overflow, and inline code visual noise without changing docs content.

### Files or Surfaces To Change

- `sites/docs/overrides/stylesheets/terminal-theme.css`
- `sites/docs/overrides/main.html` only if required by acceptance criteria
- generated docs-site output produced by `./scripts/docs_build.sh`, if tracked files change

### Steps

1. Inspect the rendered MkDocs Terminal CSS defaults in `sites/docs/site/css/terminal.css` and `sites/docs/site/css/theme.css` to confirm the selectors being overridden.
   - Also inspect one rendered `sites/docs/site/.../index.html` page, because the `.terminal-mkdocs-main-grid` rules are emitted in a page-level style block rather than in the shared CSS files.
2. Update `sites/docs/overrides/stylesheets/terminal-theme.css` so the effective page shell uses a responsive width around `1180px` to `1200px`, not the current effective 900px shell.
3. Override the desktop `.terminal-mkdocs-main-grid` behavior so the side navigation uses a fixed column around `220px` to `240px` and the main column uses `minmax(0, 1fr)`.
4. Add `min-width: 0` to the main grid content wrappers needed to prevent wide tables or code from expanding the grid.
5. Update `pre` and `pre code` behavior so code blocks preserve exact content and scroll horizontally when needed. Remove or override reliance on `white-space: pre-wrap`, `word-break: break-all`, and `word-wrap: break-word` for block code.
6. Add table overflow handling so wide tables are contained inside the content column. Prefer CSS-only `display: block; overflow-x: auto; max-width: 100%;` first. Use a template-level wrapper only if CSS-only handling fails browser validation.
7. Soften inline code styling enough to reduce dense-page visual noise while keeping code identifiable.
8. Run the docs build once to regenerate the local site for Phase 2 and Phase 3 checks.

### Acceptance Criteria

- At desktop wide viewport, the effective docs shell is no longer capped at 900px.
- At desktop wide viewport, article content no longer starts awkwardly far right due to the old centered narrow shell plus proportional grid.
- Wide generated tables do not force `.terminal-mkdocs-main-grid` or the page body wider than the viewport.
- Code blocks preserve exact whitespace and use horizontal scrolling when needed.
- Inline code remains readable and visibly distinct without overwhelming dense reference tables.
- No authored public docs content under `docs/` changes in this phase.

### Validation

```bash
./scripts/docs_build.sh
! rg -n "pre-wrap|break-all|word-wrap: break-word|--page-width: 60em" sites/docs/overrides/stylesheets/terminal-theme.css
git diff -- sites/docs/overrides/stylesheets/terminal-theme.css sites/docs/overrides/main.html sites/docs/site
```

### Expected Commit

```text
fix(docs): improve docs desktop layout and overflow
```

## Phase 2: Tablet and Mobile Navigation Polish

### Agent Tier

default

### Goal

Make tablet and mobile docs pages reach article content quickly, avoid awkward top-nav wrapping, and preserve accessible navigation without redesigning the theme.

### Files or Surfaces To Change

- `sites/docs/overrides/stylesheets/terminal-theme.css`
- `sites/docs/overrides/main.html` only if CSS cannot provide a usable small-screen navigation behavior
- generated docs-site output produced by `./scripts/docs_build.sh`, if tracked files change

### Steps

1. Use the Phase 1 local build as the baseline.
2. Add responsive breakpoints for tablet and mobile widths. Start by targeting widths below the desktop side-nav breakpoint and below `600px`.
3. Choose the lowest-risk small-screen side-nav behavior that meets acceptance:
   - hide the full side nav below a tablet breakpoint and rely on top nav/search, or
   - move the side nav after content on small screens, or
   - collapse the side nav with a small template hook.
4. Tune mobile container padding to around `14px` to `16px`.
5. Adjust top navigation wrapping so the logo and links do not crowd the first mobile viewport.
6. Confirm code and table scroll containers remain usable at mobile width after the nav changes.
7. Run the docs build again.

### Acceptance Criteria

- At `820px`, page content appears without requiring the user to scroll past the full side navigation first.
- At `390px`, the first screen is not dominated by top navigation plus full side navigation.
- Navigation remains available on small screens through top nav/search, moved side nav, or a collapsed control.
- Mobile pages do not have body-level horizontal scroll caused by layout, table, or code elements.
- Tables and code blocks still have local horizontal scrolling where needed.

### Validation

```bash
./scripts/docs_build.sh
git diff -- sites/docs/overrides/stylesheets/terminal-theme.css sites/docs/overrides/main.html sites/docs/site
```

### Expected Commit

```text
fix(docs): polish docs mobile navigation layout
```

## Phase 3: Browser Use Visual QA and Finalization

### Agent Tier

thinking

### Goal

Verify the implementation in the rendered site with Codex using `browser-use:browser`, record any material anomalies, and leave the branch ready for review.

### Files or Surfaces To Change

- `tasks/docs/website-layout/findings.md` only if validation finds material anomalies or intentional deviations from the original audit recommendation
- generated docs-site output produced by `./scripts/docs_build.sh`, if tracked files change during final build

### Steps

1. Read `~/.codex/plugins/cache/openai-bundled/browser-use/0.1.0-alpha1/skills/browser/SKILL.md` in full before browser work if it has not already been read in this execution turn.
2. Start the local docs server with:
   ```bash
   sites/docs/.venv/bin/mkdocs serve -f sites/docs/mkdocs.yml -a 127.0.0.1:8023
   ```
3. Use Codex with Browser Use and the in-app browser to navigate to the local site. Initialize Browser Use with the `iab` backend as described by its skill.
4. Check these pages and viewport sizes:

   | Viewport | URL | Required checks |
   | --- | --- | --- |
   | `1440x1100` | `http://127.0.0.1:8023/api/cli/` | desktop shell, article start position, sidebar width, command table containment |
   | `1280x900` | `http://127.0.0.1:8023/api/actions/` | prose width, inline source paths, code blocks, tables |
   | `820x1100` | `http://127.0.0.1:8023/skills/runtime/` | tablet nav behavior, content starts promptly, code/table usability |
   | `390x900` | `http://127.0.0.1:8023/api/cli/` | mobile nav behavior, command table local scroll, no body-level horizontal scroll |
   | `390x900` | `http://127.0.0.1:8023/api/errors/` | dense inline code, reference content, no body-level horizontal scroll |
   | `390x900` | `http://127.0.0.1:8023/skills/cli/` | generated skills reference behavior, no body-level horizontal scroll |

5. For mobile pages, run a browser-side computed check equivalent to:
   ```js
   document.documentElement.scrollWidth <= window.innerWidth
   ```
   This must pass for the page body. Inner table/code scrollers are allowed.
6. Capture screenshots through Browser Use for the target viewports if the browser workflow supports it in the active session. Use them for review; do not commit screenshots unless explicitly requested later.
7. If Browser Use reveals a material issue, fix it in the authored CSS/template source, rerun `./scripts/docs_build.sh`, and repeat the affected viewport checks.
8. Append a short `Implementation Validation Notes` section to `tasks/docs/website-layout/findings.md` only if:
   - the implementation intentionally deviates from a recommendation in the audit, or
   - a validation anomaly remains and should be visible to reviewers.
9. Stop the local docs server before finishing.
10. Confirm final repository state and commit any final validation note or generated build output that belongs to this task.

### Acceptance Criteria

- Browser Use was used for rendered validation. The final summary names that it was used.
- All required page/viewport combinations were checked.
- Mobile page-level overflow check passes on `/api/cli/`, `/api/errors/`, and `/skills/cli/`.
- `./scripts/docs_build.sh` passes after final source changes.
- No generated docs output was hand-edited.
- Any remaining anomaly is documented in `tasks/docs/website-layout/findings.md` with a concrete reason and review impact.
- The worktree is clean after the final commit.

### Validation

```bash
./scripts/docs_build.sh
sites/docs/.venv/bin/mkdocs serve -f sites/docs/mkdocs.yml -a 127.0.0.1:8023
git status --short
! perl -ne 'print "$ARGV:$.:$_" if /\bC(?:law)\b/' sites/docs/overrides/stylesheets/terminal-theme.css sites/docs/overrides/main.html tasks/docs/website-layout/plan.md tasks/docs/website-layout/findings.md
! perl -ne 'print "$ARGV:$.:$_" if /[\x{2013}\x{2014}]/' sites/docs/overrides/stylesheets/terminal-theme.css sites/docs/overrides/main.html tasks/docs/website-layout/*.md
```

Use Browser Use for the rendered viewport checks listed in the steps. The shell commands above are not a substitute for Browser Use.

### Expected Commit

```text
test(docs): verify responsive docs layout
```
