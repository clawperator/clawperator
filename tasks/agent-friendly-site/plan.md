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

---

## Additions from second agent review (Claude, March 10 2026)

The following items were missing or underrepresented after an independent live crawl
of both domains. They are grouped by whether they belong inside existing workstreams
or are new workstreams entirely.

---

### New Workstream A: Create `docs.clawperator.com/llms.txt`

Workstream 5 mentions "llms.txt on both hosts" in its acceptance criteria, but the
docs host has no `llms.txt` at all (returns 404). Creating it is a distinct
deliverable from strengthening the existing root one.

#### Why this is a separate workstream

- The docs host is the substantive technical surface. Agents that land there after
  following a link from the homepage have no machine-readable index to work from.
- An agent that does not know about `llms.txt` at the root domain but does inspect
  `docs.clawperator.com` directly will find nothing.
- This is the highest-signal file missing from the docs host.

#### Minimum content

```markdown
# Clawperator Documentation

> Deterministic Android automation runtime for AI agents.
> Clawperator is the actuator. Your LLM is the brain.

## Key pages

- [Node API Agent Guide](https://docs.clawperator.com/ai-agents/node-api-for-agents/): Full reference for agents — actions, matchers, result envelopes, error codes.
- [Operator LLM Playbook](https://docs.clawperator.com/design/operator-llm-playbook/): Decision guidance for LLMs operating Clawperator.
- [API Overview](https://docs.clawperator.com/reference/api-overview/): HTTP API endpoints (POST /execute, GET /devices, etc.).
- [CLI Reference](https://docs.clawperator.com/reference/cli-reference/): Full CLI command reference.
- [Error Codes](https://docs.clawperator.com/reference/error-codes/): All error codes with meanings.
- [Skills Usage Model](https://docs.clawperator.com/skills/usage-model/): Packaged automation recipes — discovery and invocation.
- [First-Time Setup](https://docs.clawperator.com/getting-started/first-time-setup/): Device and emulator setup.
- [Troubleshooting](https://docs.clawperator.com/troubleshooting/troubleshooting/): Common issues.

## Optional

- [llms-full.txt](https://clawperator.com/llms-full.txt): Complete documentation concatenated into a single file.
```

#### For MkDocs

Place the file at `docs/llms.txt` in the docs source tree. MkDocs copies files in
`docs/` that are not `.md` into the built output verbatim.

#### Acceptance criteria

- `curl -I https://docs.clawperator.com/llms.txt` returns `200`
- `curl https://docs.clawperator.com/llms.txt` returns link-rich markdown
- The Node API guide and Operator LLM Playbook are directly reachable in one hop

---

### New Workstream B: Publish `llms-full.txt`

Workstream 5 says "consider adding `llms-full.txt`". This should be a concrete
deliverable. It is not a substitute for fixing robots.txt or sitemaps — it is a
separate, high-value artifact for agents that want everything in one fetch.

#### What it is

A single static file at `https://clawperator.com/llms-full.txt` that concatenates
the content of all documentation pages in reading order, separated by headings.

#### Why this matters

- An agent can fetch one URL and have the complete technical corpus in context.
- This is particularly valuable for ChatGPT, Claude, and similar systems that do
  multi-step research: one fetch replaces a dozen page fetches.
- Several agent frameworks explicitly look for `llms-full.txt` alongside `llms.txt`.
- It bypasses any remaining crawl friction on the docs host entirely.

#### Suggested build step

```bash
# Run after mkdocs build
cat \
  docs/getting-started/first-time-setup.md \
  docs/getting-started/terminology.md \
  docs/ai-agents/node-api-for-agents.md \
  docs/design/operator-llm-playbook.md \
  docs/reference/api-overview.md \
  docs/reference/cli-reference.md \
  docs/reference/error-codes.md \
  docs/skills/usage-model.md \
  docs/skills/skill-authoring-guidelines.md \
  docs/architecture/architecture.md \
  docs/troubleshooting/troubleshooting.md \
  > site/llms-full.txt
```

Reference it from `llms.txt` on both hosts so agents know it exists.

#### Acceptance criteria

- `curl https://clawperator.com/llms-full.txt` returns the full concatenated docs
- The file is referenced from `clawperator.com/llms.txt` and
  `docs.clawperator.com/llms.txt`
- The file is listed in the root sitemap

---

### Additions to Workstream 1: Named AI crawler User-Agents in `robots.txt`

The plan recommends `User-agent: *` which is sufficient for spec-compliant crawlers.
However, some WAF and CDN rules apply per-User-Agent selectively, and can block a
specific bot even when `*` allows it. Listing named AI crawlers explicitly is a
cheap, unambiguous signal.

Add to both `clawperator.com/robots.txt` and `docs.clawperator.com/robots.txt`:

```txt
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /
```

This is not a replacement for fixing edge-layer blocking (Workstream 7), but it
removes ambiguity for crawlers that check their own User-Agent entry before `*`.

---

### Additions to Workstream 4: HTTP headers and HTML `<head>` hints for agent.md

When the agent landing page and markdown file are live, two additional details
matter:

#### Correct `Content-Type` for `agent.md`

Agents and HTTP clients that inspect `Content-Type` should receive:

```
Content-Type: text/markdown; charset=utf-8
```

If the static host serves `.md` files as `application/octet-stream` or
`text/plain`, the agent may treat the response as a download rather than text.
Verify this and add a MIME type override in the hosting config if needed.

#### `<link rel="alternate">` in the HTML `<head>`

Add to the `<head>` of the homepage and `/agents` page:

```html
<link rel="alternate" type="text/markdown" href="https://clawperator.com/agent.md">
```

This is a semantic, spec-adjacent hint that some agent frameworks use to
auto-discover machine-readable alternates. It costs nothing and reinforces the
HTML comment approach already described in Workstream 4.

---

### New Workstream C: Anti-AI tag audit

Before shipping any of the above, verify that no page on either host accidentally
blocks AI indexing. These markers can override a permissive `robots.txt`:

#### Check for `noai` and `noimageai` meta tags

```bash
# After mkdocs build, scan built HTML
grep -r 'noai\|noimageai\|noindex' site/
```

If found, determine whether the MkDocs theme or a plugin is injecting them. The
`mkdocs-terminal` theme used on the docs site should not inject these, but confirm.

#### Check `X-Robots-Tag` HTTP response headers

```bash
curl -I https://docs.clawperator.com/ai-agents/node-api-for-agents/
```

Look for `X-Robots-Tag: noindex` or `X-Robots-Tag: noai` in the response. These
can be injected by Cloudflare transform rules, workers, or hosting-layer config
independently of anything in the page source.

#### Acceptance criteria

- No `noai`, `noimageai`, or `noindex` directives on any page intended for public
  indexing
- No `X-Robots-Tag` header blocking AI crawlers on any technical docs page

---

### New Workstream D: GitHub README as crawl surface

Agents researching Clawperator frequently land on the GitHub repo
(`https://github.com/clawpilled/clawperator`) before or instead of the docs site.
The README is a high-value crawl surface that should be treated as a first-class
agent entrypoint.

#### Recommended README additions

- A clear one-sentence product definition in the first 50 words
- A "For AI agents" section with direct links to:
  - `docs.clawperator.com/ai-agents/node-api-for-agents/`
  - `docs.clawperator.com/design/operator-llm-playbook/`
  - `clawperator.com/llms.txt`
  - `clawperator.com/llms-full.txt` (once available)
- The actuator-not-planner framing, stated explicitly

GitHub renders README.md and the raw markdown is directly fetchable by agents at
`https://raw.githubusercontent.com/clawpilled/clawperator/main/README.md`.

#### Acceptance criteria

- README first paragraph clearly defines Clawperator in plain text
- "For AI agents" section links directly to the Node API guide and LLM playbook

---

### Addition to Validation checklist

Add these checks to the existing validation checklist:

```sh
# Check Content-Type for new files
curl -I https://clawperator.com/agent.md
curl -I https://clawperator.com/llms-full.txt
curl -I https://docs.clawperator.com/llms.txt

# Verify no anti-AI headers on docs pages
curl -I https://docs.clawperator.com/ai-agents/node-api-for-agents/
curl -I https://docs.clawperator.com/design/operator-llm-playbook/

# Verify llms-full.txt is non-empty and contains expected content
curl https://clawperator.com/llms-full.txt | wc -c
curl https://clawperator.com/llms-full.txt | grep "node-api\|enter_text\|EXECUTION_CONFLICT"
```

---

### Updated implementation sequence (merged)

Incorporates the additions above into the original sequence:

1. Fix `docs.clawperator.com/robots.txt` at source and edge (Workstream 1).
2. Add named AI crawler User-Agents to both `robots.txt` files (addition to WS1).
3. Run anti-AI tag audit across both hosts (Workstream C).
4. Generate and publish the docs sitemap (Workstream 2).
5. Expand root sitemap to advertise docs (Workstream 3).
6. Create `docs.clawperator.com/llms.txt` (Workstream A — new).
7. Add `/agents` and `/agent.md` on the landing site with correct Content-Type
   and `<link rel="alternate">` (Workstream 4 + additions).
8. Publish `llms-full.txt` (Workstream B — new).
9. Strengthen root `llms.txt` and reference `llms-full.txt` from both hosts
   (Workstream 5).
10. Add "For agents" section to homepage (Workstream 6).
11. Strengthen GitHub README (Workstream D — new).
12. Re-run full validation checklist from a plain shell.

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
