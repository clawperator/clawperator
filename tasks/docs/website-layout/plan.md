# Docs Website Layout Repair

## Executive Summary

This task pack turns the completed docs website CSS audit into a bounded implementation plan for Codex. It is docs-site layout work, shipped as 1 PR across 3 phases. The implementing agent is Codex, and Codex must use the `browser-use:browser` skill with the in-app browser for rendered viewport verification.

The work changes only docs website theme/source styling and any generated docs-site output produced by the normal build. It does not redesign the docs brand or rewrite public docs content.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

Improve desktop and mobile readability for the Clawperator docs website by fixing the narrow centered shell, sidebar/content alignment, technical-content overflow, and mobile navigation behavior identified in `tasks/docs/website-layout/findings.md`.

## Why Now

The current docs site looks unpolished on desktop and becomes hard to use on tablet/mobile. The audit found concrete CSS causes: a 900px page shell, a proportional sidebar grid that lets generated reference tables overflow, code blocks that break exact commands and JSON, and a full side navigation that pushes article content far below the fold on small screens.

## In Scope

- Adjust MkDocs Terminal theme overrides for the docs website.
- Improve the desktop page shell and sidebar/content grid.
- Preserve exact commands, JSON, paths, flags, and package names in code blocks.
- Contain table and code overflow inside local scrollers instead of creating page-level overflow.
- Improve mobile and tablet behavior for top navigation and side navigation.
- Tune inline code styling only enough to reduce visual noise on dense reference pages.
- Regenerate docs-site output with the existing docs build flow if tracked generated output changes.
- Validate the rendered site at desktop, laptop, tablet, and mobile viewports with Codex using `browser-use:browser`.

## Out of Scope

- Replacing the MkDocs Terminal theme.
- Redesigning the docs brand, color system, or information architecture.
- Rewriting authored public docs content under `docs/`.
- Hand-editing `sites/docs/.build/` or `sites/docs/site/`.
- Changing Node CLI, API, Android runtime, or generated CLI reference content.
- Adding JavaScript-heavy navigation unless a small CSS or template adjustment cannot meet the acceptance criteria.
- Solving unrelated local favicon behavior unless it is a direct side effect of the layout work.

## Existing Artifact Scope

- `tasks/docs/website-layout/findings.md`: preserve as the audit record. Codex may append validation notes if a phase discovers a material deviation from the audit, but should not rewrite the prior findings.
- `sites/docs/overrides/stylesheets/terminal-theme.css`: primary authored CSS surface for this task. In scope for layout, overflow, typography, and responsive overrides.
- `sites/docs/overrides/main.html`: in scope only if a small template-level hook is needed for table wrappers, navigation classes, or other CSS-targeting support. Prefer CSS-only changes first.
- `sites/docs/mkdocs.yml`: in scope only if theme configuration must reference an authored asset or small override. Do not restructure nav.
- `sites/docs/.build/`: generated staging output. Do not edit directly.
- `sites/docs/site/`: generated deployable output. Do not edit directly. If the normal build updates tracked generated files, commit them with the source change.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `sites/docs/overrides/stylesheets/terminal-theme.css` | Primary responsive layout, overflow, and readability fixes | Codex Phase 1 and Phase 2 |
| `sites/docs/overrides/main.html` | Optional minimal template hooks if CSS-only fixes cannot contain tables/nav cleanly | Codex Phase 1 or Phase 2 |
| `sites/docs/mkdocs.yml` | Optional theme/static reference update only if required | Codex Phase 1 or Phase 2 |
| `sites/docs/.build/` | Generated staging output only, never hand-edited | Build output |
| `sites/docs/site/` | Generated deployable output only, never hand-edited | Build output |
| `tasks/docs/website-layout/findings.md` | Existing audit evidence and any implementation-era validation anomalies | Codex Phase 3 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Audit findings and target behavior | `tasks/docs/website-layout/findings.md` |
| Docs site theme configuration | `sites/docs/mkdocs.yml` |
| Authored custom template override | `sites/docs/overrides/main.html` |
| Authored custom CSS override | `sites/docs/overrides/stylesheets/terminal-theme.css` |
| Generated docs boundaries | `sites/docs/source-map.yaml`, `sites/docs/.build/`, `sites/docs/site/` |
| Reference pages to test | `sites/docs/.build/api/cli.md`, `sites/docs/.build/api/actions.md`, `sites/docs/.build/api/errors.md`, `sites/docs/.build/skills/cli.md`, `sites/docs/.build/skills/runtime.md` |
| Browser verification workflow | `~/.codex/plugins/cache/openai-bundled/browser-use/0.1.0-alpha1/skills/browser/SKILL.md` |
| Docs build workflow | `.agents/skills/docs-build/SKILL.md`, `./scripts/docs_build.sh` |

## Deterministic Versus Judgment

Deterministic rules:

- The implementing agent is Codex.
- Codex must use the `browser-use:browser` skill for rendered viewport checks. Do not substitute macOS `open`, Chrome headless screenshots, or unrelated browser tooling unless the Browser Use skill is unavailable after following its troubleshooting path.
- Edit authored docs-site sources, not generated output.
- Preserve exact technical text in code blocks. Do not wrap long code, JSON, commands, paths, package identifiers, or flags in ways that change copy/paste readability.
- Keep generated reference tables contained inside a local horizontal scroller when they are wider than the viewport or content column.
- Pass `./scripts/docs_build.sh` before treating the work as complete.
- Confirm mobile page-level overflow is fixed with `document.documentElement.scrollWidth <= window.innerWidth` on target mobile pages, except for intentional inner scrollers.

Judgment required:

- Exact desktop shell max width, within the accepted target range.
- Exact sidebar width, within the accepted target range.
- Whether CSS-only table overflow is sufficient or a small template wrapper is needed.
- Whether the mobile side navigation should be hidden, moved after content, or collapsed, as long as article content appears promptly and navigation remains reachable.
- Fine tuning of inline code background, padding, and block padding after visual QA.

## Decision Rules

| Question | Rule |
| --- | --- |
| Who implements this task? | Codex implements all phases. Do not hand this task to a different named agent in the task pack. |
| Which browser verification tool is required? | Codex must use `browser-use:browser` with the in-app browser. Follow its `SKILL.md` before browser work. |
| Where should source CSS changes go first? | `sites/docs/overrides/stylesheets/terminal-theme.css`. |
| When may `sites/docs/overrides/main.html` change? | Only when CSS-only changes cannot create a contained, accessible table/nav behavior. |
| What desktop page width should Codex target? | Start in the `1180px` to `1200px` range for the overall shell. Adjust only if browser QA proves the result is still cramped or over-wide. |
| What desktop sidebar width should Codex target? | Start in the `220px` to `240px` range with `minmax(0, 1fr)` for content. |
| How should code blocks handle long content? | Use horizontal scrolling and preserve whitespace. Do not rely on `word-break: break-all` or `pre-wrap` for exact technical content. |
| How should tables handle long content? | Prefer local horizontal scrolling. Do not allow tables to expand the page body beyond the viewport. |
| What if generated docs output changes after build? | Commit generated output produced by the official build together with the authored source change, but never edit generated files by hand. |
| What if Browser Use cannot run? | Follow the Browser Use troubleshooting path first. If still unavailable, stop and report the blocker instead of silently substituting another browser path. |

## Failure Modes To Prevent

- The desktop page remains capped at an effective 900px shell.
- The article still starts far to the right on wide desktop screens.
- Generated reference tables still force `.terminal-mkdocs-main-grid` or the page body wider than the viewport.
- Code blocks wrap exact commands, JSON, paths, or package identifiers using `word-break: break-all`.
- Mobile users must scroll through the full side navigation before reaching article content.
- The implementation changes generated docs output directly.
- Codex skips Browser Use and validates only with static inspection or headless screenshots.
- The final CSS fights MkDocs Terminal defaults with brittle selectors that only work on one page.
- Inline code becomes less readable because visual noise is reduced too aggressively.

## Output Contract

After this task ships:

- Desktop wide (`1440px+`) docs pages use available width more intentionally, with content no longer pushed awkwardly far right.
- Laptop width (`1280px`) pages keep readable prose width while allowing reference pages enough room for technical content.
- Tablet and mobile pages reach article content promptly and do not dump the full side nav above content in a way that dominates the first screen.
- `pre` and code blocks preserve exact technical content and scroll horizontally when needed.
- Tables on generated reference pages scroll inside the content area when wider than available space.
- Inline code remains identifiable but less visually noisy in dense tables and lists.
- `./scripts/docs_build.sh` passes.
- Browser Use validation screenshots and observations cover `/api/cli/`, `/api/actions/`, `/api/errors/`, `/skills/cli/`, and `/skills/runtime/` at the required viewport sizes.

## Idempotency

- Re-running the docs build after the same source CSS/template changes should produce the same generated docs-site output.
- Re-running Browser Use validation should check the same URLs and viewport sizes.
- The task pack and `findings.md` remain temporary task artifacts until the PR ships. Durable behavior lives in the authored docs-site CSS/template sources.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Responsive docs-site layout behavior | `sites/docs/overrides/stylesheets/terminal-theme.css` |
| Any required template hooks | `sites/docs/overrides/main.html` |
| Docs-site build behavior | `./scripts/docs_build.sh` and `.agents/skills/docs-build/SKILL.md` |
| Temporary audit and validation notes | `tasks/docs/website-layout/findings.md` until task cleanup |

After the implementation PR ships, cleanup should either delete `tasks/docs/website-layout/` or migrate any still-useful operational guidance into `.agents/skills/docs-build/SKILL.md` or another durable repo-local docs maintenance guide. Do not leave long-term website behavior guidance only in `tasks/`.
