# GEO Improvements Plan

This plan captures the next actionable website improvements that will make
Clawperator easier for humans, crawlers, and LLM agents to discover and
understand.

It is intentionally focused on implementation work, not audit tooling.

## Goals

- strengthen the semantic quality of the landing and docs surfaces
- make key technical routes easier to understand out of context
- improve machine-readable meaning without adding noise or drift
- keep the GEO layer durable and easy to validate after deployment

## Phase 1 - Semantic polish on the landing site

### Objective

Improve the homepage and `/agents` page so crawlers can infer intent more
cleanly from the HTML alone.

### Work

- review the main homepage CTA and support link text
- replace vague link labels with descriptive labels where possible
- review outbound links on `/agents` and ensure each label is self-explanatory
- review landing-page images and add or improve `alt` text where it is weak or
  missing

### Implementation targets

- `sites/landing/app/page.js`
- `sites/landing/app/agents/page.js`

### Acceptance criteria

- important links make sense out of context
- decorative images stay decorative
- informative images have concise, useful `alt` text
- the landing pages remain visually consistent with the existing design

## Phase 2 - Improve docs homepage extractability

### Objective

Make the docs homepage easier to parse as a structured technical entrypoint.

### Work

- review the docs homepage copy and section layout
- ensure the page has a clear summary near the top
- ensure the page has obvious section grouping for:
  - getting started
  - Node API for agents
  - operator playbook
  - CLI and API reference
- review docs-home link labels and make them more descriptive where needed

### Implementation targets

- authored source that feeds the docs homepage
- generated output only after source updates

### Acceptance criteria

- the docs homepage reads as a structured technical map, not a loose wall of
  links
- key docs surfaces are visible early in the page
- section and link wording is useful to both humans and crawlers

## Phase 3 - Add minimal structured data

### Objective

Add a small amount of durable Schema.org markup where it is high-signal and
easy to maintain.

### Work

- add `Organization` and `WebSite` JSON-LD on the landing site
- decide whether to add a lightweight `WebPage` schema to the homepage
- evaluate a minimal docs-site schema strategy for the docs homepage
- avoid per-page schema sprawl unless it can be generated reliably

### Implementation targets

- `sites/landing/app/layout.js`
- docs-site layout or template files if a docs-home schema is added

### Acceptance criteria

- schema is valid JSON-LD
- schema reflects canonical URLs and product identity correctly
- schema maintenance burden stays low
- no hand-maintained deep-page schema is introduced without automation

## Phase 4 - Strengthen machine-facing entrypoint quality

### Objective

Tighten the machine-facing artifacts so they remain high-signal and internally
consistent.

### Work

- review `/index.md` for clarity, brevity, and link ordering
- ensure `/index.md` points clearly to the canonical technical docs
- review `llms.txt` and `llms-full.txt` for stale or weak links
- verify the landing and docs sitemap contents still reflect the best crawl
  routes
- review redirect aliases and keep only the ones that are clearly useful

### Implementation targets

- `sites/landing/public/index.md`
- `sites/landing/public/llms.txt`
- `sites/landing/public/llms-full.txt`
- `sites/docs/static/llms.txt`
- sitemap and redirect files on both public surfaces

### Acceptance criteria

- machine-facing files are factual and compact
- canonical routes are obvious
- there is no duplicate canonical messaging across multiple markdown entrypoints
- sitemap and redirect behavior remain intentional and easy to explain

## Phase 5 - Live GEO verification pass

### Objective

Turn the current GEO checklist into a repeatable post-deploy verification pass.

### Work

- create a simple verification checklist for both public hosts
- verify status code, content type, and redirect behavior for machine-facing
  routes
- verify `robots.txt`, `llms.txt`, `llms-full.txt`, `/index.md`, `/agents`, and
  both sitemap endpoints live
- verify no accidental `noindex`, `noai`, `noimageai`, or blocking
  `X-Robots-Tag` headers on intended public pages
- verify Cloudflare is not overriding repo intent for crawler-facing files

### Implementation targets

- internal GEO documentation
- optional validation script if the checks can be automated cleanly

### Acceptance criteria

- the team has a single repeatable live-check procedure
- regressions can be detected quickly after merge
- source truth and live behavior are compared explicitly

## Recommended implementation order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5

## Notes for the implementing agent

- keep public-facing copy factual and compact
- preserve the current canonical routes:
  - human low-noise page: `/agents`
  - canonical markdown page: `/index.md`
- prefer durable, low-maintenance improvements over clever one-off GEO tricks
- if a change affects docs-site content, update authored docs first and
  regenerate generated output afterward
