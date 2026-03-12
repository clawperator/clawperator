# GEO Status

This page summarizes the current Generative Engine Optimization (GEO) status of
the Clawperator public web surfaces and the remaining actions that improve bot
and agent support over time.

## Current status

Clawperator's public web surfaces are in good shape for bots and agents.

Current strengths:

- both public hosts expose working `robots.txt`
- both public hosts expose working sitemap surfaces
- both public hosts expose `llms.txt`
- both public hosts expose `llms-full.txt`
- the landing host exposes `index.md` and `/agents`
- the docs host exposes the Node API guide, CLI reference, and API overview
- the docs site is the canonical technical source for agent-facing behavior

Recent validation outcomes:

- live GEO edge verification passes for the key public routes
- Cloudflare Browser Rendering audit passes when using the correct crawl
  entrypoints
- sitemap metadata is now generated from per-file git history instead of being
  edited by hand

## Durable GEO rules

The current operating model is:

- `https://clawperator.com/sitemap.xml` is the public sitemap index
- `https://clawperator.com/landing-sitemap.xml` is the preferred landing-host
  crawl entrypoint for landing-only audits
- `https://docs.clawperator.com/sitemap.xml` is the canonical docs-host crawl
  map
- `robots.txt` on both hosts is intentionally simple:
  - `User-agent: *`
  - `Allow: /`
  - host-specific sitemap reference

This matches the product's intent: the sites are public and should be broadly
crawlable by agent systems.

## Known Cloudflare Browser Rendering quirks

These are important for future audits:

- after a successful `POST /crawl`, early `GET /crawl/<job_id>` requests can
  return `404 Crawl job not found`
- the same crawl job may become readable several seconds later
- landing-host `source: "sitemaps"` crawls should use
  `https://clawperator.com/landing-sitemap.xml` rather than the mixed-host root
  sitemap index when the goal is to audit landing coverage specifically
- Browser Rendering `/links` can return relative URLs, so evaluation tooling
  must normalize them before checking expected links

These are Cloudflare API behaviors, not evidence that the Clawperator sites are
hostile to crawlers.

## Sitemap generation

Sitemap metadata is now generated from source-of-truth files.

Rules:

- each URL uses the last git commit time of the file or files that actually
  define that URL
- if a source file has local uncommitted changes, sitemap generation uses the
  current UTC time for that file instead
- docs sitemap metadata is patched after MkDocs build using
  `sites/docs/source-map.yaml`

Repo-local workflow:

- skill: `.agents/skills/sitemaps-generate/`
- generator:
  `.agents/skills/sitemaps-generate/scripts/generate_sitemap_metadata.py`

## Remaining improvement areas

These are the meaningful follow-up items if we want to keep improving GEO:

- keep validating that the landing homepage extracts cleanly to markdown, not
  just that it is fetchable
- rerun Browser Rendering and live-edge GEO checks after material site,
  sitemap, robots, or Cloudflare config changes
- keep Cloudflare WAF and bot controls aligned with the public-agent intent of
  the project
- preserve obvious, early links from the landing site to the docs host and the
  canonical technical pages
- continue treating the docs host as the source of truth for technical behavior

## Practical takeaway

No major GEO blocker is currently known on the public Clawperator sites.

The main requirement going forward is discipline:

- keep machine-facing routes stable
- keep sitemap and robots generation automated
- keep Cloudflare-specific audit knowledge encoded in repo-local skills and
  docs
