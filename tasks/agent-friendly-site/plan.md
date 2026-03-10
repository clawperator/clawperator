# Task: Agent-Friendly Public Site

## Goal

Make `clawperator.com` and `docs.clawperator.com` reliably crawlable and legible
to LLM agents, generic web crawlers, and machine-driven retrieval systems.

The success condition is not just that a browser can load the sites. The success
condition is that an agent can:

1. Fetch the root site without JS execution.
2. Discover the important technical pages through normal crawler entrypoints.
3. Understand what Clawperator is from machine-readable text.
4. Reach the Node API and CLI docs without guessing.
5. Avoid false negatives caused by broken `robots.txt`, empty sitemaps, or
   ambiguous crawl policy.

---

## Verified current state

Checked live on March 10, 2026.

### What is already working

- `https://clawperator.com/` returns server-readable HTML.
- `https://clawperator.com/robots.txt` is permissive.
- `https://clawperator.com/llms.txt` exists and contains useful links.
- `https://docs.clawperator.com/` serves static HTML pages directly.

### What is currently broken or weak

- `https://docs.clawperator.com/robots.txt` returns HTTP `404`.
- The body served at that path is a "content signals" rights-reservation
  template, not a normal crawl-permission file.
- `https://docs.clawperator.com/sitemap.xml` is effectively empty.
- `https://clawperator.com/sitemap.xml` only lists a handful of landing-site
  assets and does not route crawlers into the docs corpus.
- The root landing page is crawlable, but it is still primarily marketing copy
  rather than a strong machine-oriented entrypoint into the docs.

### Likely impact

- Some agents will conclude the docs site is blocked or ambiguous because the
  expected `robots.txt` endpoint returns `404` and does not provide a clear
  `Allow` policy.
- Some agents will never discover the docs pages because the docs sitemap is
  empty and the root sitemap does not advertise the docs.
- Less capable crawlers may fetch the landing page but fail to confidently
  extract the best technical starting points.

---

## Priority order

1. Fix crawl-policy correctness for `docs.clawperator.com`.
2. Fix sitemap coverage for both public surfaces.
3. Add a dedicated agent-oriented landing surface on the root domain.
4. Strengthen machine-readable guidance files.
5. Validate live behavior from the network edge after deploy.

---

## Workstream 1: Fix `docs.clawperator.com/robots.txt`

This is the highest priority item.

### Required outcome

`https://docs.clawperator.com/robots.txt` must return HTTP `200` and a simple,
unambiguous crawl policy such as:

```txt
User-agent: *
Allow: /

Sitemap: https://docs.clawperator.com/sitemap.xml
```

### Why this matters

- Crawlers expect `robots.txt` to exist at the standard path.
- Returning `404` at that path is avoidable ambiguity.
- Serving a rights-reservation template there is likely to confuse or repel AI
  retrieval systems.
- The docs site contains the substantive technical content, so this host must be
  the cleanest crawl target you have.

### Investigation targets

- `sites/docs/static/robots.txt`
- `./scripts/docs_build.sh`
- Cloudflare config, redirect rules, worker routes, and any edge transforms for
  `docs.clawperator.com`
- Hosting behavior that might be rewriting `robots.txt` at the edge

### Acceptance criteria

- `curl -I https://docs.clawperator.com/robots.txt` returns `200`
- `curl https://docs.clawperator.com/robots.txt` returns the intended file
- No content-signals template is served from that path

---

## Workstream 2: Populate docs sitemap

### Required outcome

`https://docs.clawperator.com/sitemap.xml` should list the important docs pages
at minimum, and ideally every canonical docs page.

### Minimum seed URLs

- `https://docs.clawperator.com/`
- `https://docs.clawperator.com/ai-agents/node-api-for-agents/`
- `https://docs.clawperator.com/reference/api-overview/`
- `https://docs.clawperator.com/reference/cli-reference/`
- `https://docs.clawperator.com/reference/error-codes/`
- `https://docs.clawperator.com/architecture/architecture/`
- `https://docs.clawperator.com/getting-started/first-time-setup/`
- `https://docs.clawperator.com/troubleshooting/troubleshooting/`

### Why this matters

- This is the easiest way to advertise the real technical corpus to crawlers.
- Agents that do not navigate site chrome well can still ingest the docs via the
  sitemap.
- An empty sitemap makes the docs host look unfinished or unmaintained.

### Implementation notes

- If MkDocs does not generate a sitemap today, add a build step or plugin that
  does.
- Prefer deterministic generation from `mkdocs.yml` navigation and built output.
- Include only canonical URLs that resolve successfully.

### Acceptance criteria

- `curl https://docs.clawperator.com/sitemap.xml` returns non-empty URL entries
- Every listed URL returns `200`
- The Node API page and CLI reference are present

---

## Workstream 3: Improve root-domain sitemap strategy

### Current weakness

The root sitemap only advertises:

- `/`
- `/install.sh`
- `/llms.txt`
- `/operator.apk`

This is too shallow for a product whose real technical value is documented on a
separate docs host.

### Recommended options

Choose one of these approaches:

### Option A: Add docs URLs directly to the root sitemap

Pros:
- simplest mental model
- improves discoverability from the root host immediately

Cons:
- mixes two website surfaces in one sitemap

### Option B: Add a sitemap index on the root host

Pros:
- cleaner separation between landing and docs surfaces
- closer to standard multi-site publishing patterns

Cons:
- requires one extra generated artifact

### Recommendation

Prefer a sitemap index on `clawperator.com` that points to:

- landing sitemap
- docs sitemap

If implementation cost is higher than expected, add the docs URLs directly first
and move to a sitemap index later.

### Acceptance criteria

- Crawlers starting at `https://clawperator.com/sitemap.xml` or sitemap index can
  discover the docs host
- The docs corpus is reachable without depending on page-body link extraction

---

## Workstream 4: Add an explicit agent landing page

### Goal

Provide a low-friction, machine-first page on the root domain that explains what
Clawperator is and where agents should go next.

### Recommended routes

At least one of:

- `/agents`
- `/for-agents`
- `/agent.md`
- `/index.md`

### Recommendation

Implement both:

- a plain static HTML page such as `/agents`
- a raw markdown page such as `/agent.md`

The HTML page helps generic crawlers and human operators.
The markdown page helps brittle or markdown-preferring agents.

### Content outline

- One-sentence product definition
- One-sentence boundary: Clawperator is an actuator, not a planner
- "Start here" links:
  - docs home
  - Node API for agents
  - API overview
  - CLI reference
  - first-time setup
  - GitHub repo
- install entrypoint
- skills bundle entrypoint
- note that the docs site is the canonical technical source

### Style guidance

- factual, compact, low-marketing
- absolute URLs
- no dependency on JS
- no decorative content needed

### Acceptance criteria

- `curl https://clawperator.com/agents` yields useful machine-readable text
- `curl https://clawperator.com/agent.md` yields useful markdown
- both pages link directly to the Node API and CLI docs

### Homepage hinting

Once `/agent.md` exists, add all of the following on the landing page:

- a normal visible link such as `For agents: /agent.md`
- an entry for `/agent.md` in `llms.txt`
- an entry for `/agent.md` in the sitemap

Optionally add a top-of-document HTML comment as a fallback hint for crawlers
that retain comments in source fetches:

```html
<!-- For automated agents and crawlers: a machine-oriented markdown version of this page is available at https://clawperator.com/agent.md -->
```

This comment is not a standard and must not be the only discovery mechanism.
Treat it as a cheap extra hint, not a primary path.

---

## Workstream 5: Strengthen `llms.txt`

### Current state

The root `llms.txt` is already better than average. It should still be expanded
because it is one of the few files some agent frameworks explicitly look for.

### Improvements

- Add a clearer first paragraph with exact product framing
- Add a "Start here" section for technical implementers
- Add more deep links into the docs corpus
- State the preferred source order:
  1. docs site
  2. Node API guide
  3. CLI reference
  4. GitHub repo
- Consider adding `llms-full.txt` with a fuller technical summary and more links

### Suggested messaging

- Clawperator is a deterministic Android automation runtime for agents
- The external agent owns reasoning and planning
- The runtime executes validated actions and returns structured results
- The docs site is the canonical source for technical behavior

### Acceptance criteria

- `llms.txt` on both hosts is accurate, link-rich, and crawl-friendly
- The most important agent docs are reachable in one hop from `llms.txt`

---

## Workstream 6: Improve machine-readable text on the homepage

The homepage is already server-rendered enough to be fetched without JS. That is
good. It still needs a stronger machine-readable path to the technical docs.

### Recommended additions near the top of the page

- a compact "For agents" section
- absolute links to docs home, Node API, API overview, CLI reference, and GitHub
- a concise explanation that the landing page is overview copy and the docs site
  is the canonical technical source

### Why this matters

- some agents only inspect the root page and a few linked pages
- strong early links reduce the chance of crawlers getting stuck in marketing copy

---

## Workstream 7: Check Cloudflare and edge behavior

The broken docs `robots.txt` strongly suggests an edge-layer problem, not just a
source-file problem.

### Check all of the following

- Cloudflare Bot Fight Mode
- WAF rules affecting bots or non-browser user agents
- redirects or rewrites for `/robots.txt`
- workers serving alternate content at `docs.clawperator.com`
- transform rules that might be replacing static files
- caching behavior that could preserve stale responses after a fix

### Acceptance criteria

- direct edge requests return the same content as local built artifacts
- no bot-specific rule changes the crawl-policy files

---

## Optional enhancements

These are worthwhile after the core crawl fixes are complete.

### Add structured metadata

- stronger `<meta name="description">`
- canonical URLs
- Open Graph and Twitter cards for social previews

This is useful, but not as important as `robots.txt`, sitemaps, and direct links.

### Add a docs "machine index" page

A page on the docs host that is little more than a curated list of the key
technical pages, contracts, setup docs, and reference docs.

### Add an examples page for agent builders

Short examples linking to:

- install
- connect device
- inspect UI
- execute action
- read result

This would help both humans and agents orient quickly.

### Add a plain text export of the homepage or docs entrypoint

For example:

- `/site.txt`
- `/agents.txt`
- `/docs-index.txt`

This is not a substitute for fixing the crawl basics, but it can help weaker
agent stacks.

### Add an HTML comment pointer on the homepage

If the landing page remains more visually oriented than machine oriented, add a
factual HTML comment near the top of the source pointing crawlers to `/agent.md`.

This is optional because there is no standard requiring crawlers to inspect or
honor comments. It should only ship alongside visible links, sitemap coverage,
and `llms.txt` coverage for the same route.

---

## Validation checklist

After implementation and deploy, verify from a plain shell:

```sh
curl -I https://clawperator.com
curl -I https://clawperator.com/robots.txt
curl -I https://clawperator.com/llms.txt
curl -I https://clawperator.com/sitemap.xml
curl -I https://clawperator.com/agents
curl -I https://clawperator.com/agent.md

curl -I https://docs.clawperator.com
curl -I https://docs.clawperator.com/robots.txt
curl -I https://docs.clawperator.com/llms.txt
curl -I https://docs.clawperator.com/sitemap.xml
curl -I https://docs.clawperator.com/ai-agents/node-api-for-agents/
curl -I https://docs.clawperator.com/reference/cli-reference/
```

Then inspect bodies:

```sh
curl https://clawperator.com/llms.txt
curl https://clawperator.com/agent.md
curl https://docs.clawperator.com/robots.txt
curl https://docs.clawperator.com/sitemap.xml
```

### Expected live-state checks

- both `robots.txt` files return `200`
- both `llms.txt` files return `200`
- docs sitemap is non-empty
- root sitemap or sitemap index points into the docs surface
- root agent page contains direct technical links
- no critical route depends on JS for basic content extraction

---

## Recommended implementation sequence

1. Fix docs-site `robots.txt` behavior at source and edge.
2. Generate and publish a non-empty docs sitemap.
3. Expand root sitemap behavior to advertise docs.
4. Add `/agents` and `/agent.md` on the landing site.
5. Expand root and docs `llms.txt`.
6. Add a compact "For agents" section to the homepage.
7. Re-run live validation with `curl` and generic fetchers.

---

## Definition of done

This task is done when:

- an unsophisticated crawler can fetch a clear crawl policy from both hosts
- the technical docs are discoverable without guessing
- the root domain exposes a clear machine-oriented entrypoint
- the docs site is advertised through sitemap and `llms.txt`
- Cloudflare or edge rules are no longer mutating crawl-policy files into
  ambiguous responses

At that point, a response like "I cannot directly crawl every page" should be a
tool limitation, not a site limitation.
