# Task: Agent-Friendly Public Site

## Goal

Make `clawperator.com`, `docs.clawperator.com`, and the GitHub repo easy for
LLM agents, generic crawlers, and retrieval systems to discover, fetch, and
understand without JS execution or guesswork.

The success condition is:

1. Both public hosts expose clear crawl-policy files.
2. The docs corpus is discoverable through standard crawler entrypoints.
3. Agents can find a machine-oriented landing page from the root site.
4. Agents can fetch a high-signal technical index and, optionally, a full corpus
   file in one hop.
5. No edge-layer or metadata rule silently blocks AI indexing.

---

## Verified live state

Checked live on March 10, 2026.

### Working now

- `https://clawperator.com/` returns server-readable HTML.
- `https://clawperator.com/robots.txt` is permissive.
- `https://clawperator.com/llms.txt` exists and contains useful links.
- `https://docs.clawperator.com/` serves static HTML pages directly.

### Broken or weak now

- `https://docs.clawperator.com/robots.txt` returns HTTP `404`.
- The body at that path is a content-signals rights-reservation template, not a
  normal `robots.txt`.
- `https://docs.clawperator.com/sitemap.xml` is empty.
- `https://docs.clawperator.com/llms.txt` is missing.
- `https://clawperator.com/sitemap.xml` is too shallow and does not advertise the
  docs corpus.
- The landing page is crawlable, but it does not strongly route agents to the
  technical docs.

### Likely impact

- Some agents will treat the docs host as blocked or ambiguous.
- Some crawlers will never discover the docs corpus.
- Some agents will fetch only the marketing page and miss the technical docs.

---

## Delivery principles

- Prefer standard discovery mechanisms first: `robots.txt`, sitemap, normal
  links, static HTML.
- Treat `llms.txt` and `llms-full.txt` as high-value bonus signals, not
  replacements for standard crawl plumbing.
- Use absolute URLs in machine-facing files.
- Keep agent-facing copy factual and compact.
- Do not rely on HTML comments alone for discovery.

---

## Phase 1: Fix crawl policy and indexability blockers

This phase removes the highest-risk reasons an agent would refuse to crawl.

### 1.1 Fix `docs.clawperator.com/robots.txt`

#### Outcome

`https://docs.clawperator.com/robots.txt` must return HTTP `200` and clear
allow rules.

#### Required content

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

Sitemap: https://docs.clawperator.com/sitemap.xml
```

#### Notes

- `User-agent: *` is the real baseline.
- Explicit named AI crawlers are included because CDN and WAF behavior is often
  applied per user agent.

#### Implementation targets

- `sites/docs/static/robots.txt`
- `./scripts/docs_build.sh`
- Cloudflare rules and worker behavior for `docs.clawperator.com`

### 1.2 Normalize `robots.txt` on the root host

Update `https://clawperator.com/robots.txt` to use the same explicit structure
and include the final root sitemap location.

#### Implementation targets

- `sites/landing/public/robots.txt`

### 1.3 Run anti-AI and anti-indexing audit

Before and after the file changes, verify that no page is being silently blocked
by metadata or response headers.

#### Audit checks

- no `noai`
- no `noimageai`
- no `noindex` on pages intended for public indexing
- no blocking `X-Robots-Tag` headers

#### Check points

- landing homepage
- `/agents`
- `/agent.md`
- docs homepage
- Node API guide
- CLI reference
- Operator LLM playbook

### 1.4 Inspect edge behavior

The broken docs `robots.txt` strongly suggests edge-layer mutation.

#### Check all of the following

- Cloudflare Bot Fight Mode
- WAF rules
- worker routes
- transform rules
- redirects or rewrites for `/robots.txt`, `/llms.txt`, and sitemap routes
- cache behavior after deploy

### Phase 1 acceptance

- `curl -I https://docs.clawperator.com/robots.txt` returns `200`
- `curl https://docs.clawperator.com/robots.txt` returns the intended text
- `curl -I https://clawperator.com/robots.txt` returns `200`
- no blocking `X-Robots-Tag` headers on key docs pages
- no `noai`, `noimageai`, or `noindex` directives on intended public pages

---

## Phase 2: Publish strong discovery artifacts

This phase makes the technical corpus discoverable through machine-first files.

### 2.1 Generate a real docs sitemap

#### Outcome

`https://docs.clawperator.com/sitemap.xml` must list the important docs pages at
minimum, and ideally every canonical docs page.

#### Minimum seed URLs

- `https://docs.clawperator.com/`
- `https://docs.clawperator.com/ai-agents/node-api-for-agents/`
- `https://docs.clawperator.com/design/operator-llm-playbook/`
- `https://docs.clawperator.com/reference/api-overview/`
- `https://docs.clawperator.com/reference/cli-reference/`
- `https://docs.clawperator.com/reference/error-codes/`
- `https://docs.clawperator.com/architecture/architecture/`
- `https://docs.clawperator.com/getting-started/first-time-setup/`
- `https://docs.clawperator.com/troubleshooting/troubleshooting/`

#### Implementation targets

- `sites/docs/mkdocs.yml`
- `./scripts/docs_build.sh`
- docs-site build output pipeline

### 2.2 Improve root sitemap strategy

The root sitemap must advertise the docs surface, not just a few landing assets.

#### Preferred implementation

Use a sitemap index on `clawperator.com` that points to:

- landing sitemap
- docs sitemap

#### Acceptable fallback

Add the key docs URLs directly to the root sitemap if a sitemap index is more
work than it is worth in the first pass.

#### Implementation targets

- `sites/landing/public/sitemap.xml`
- any build script needed for sitemap generation

### 2.3 Create `docs.clawperator.com/llms.txt`

This is a separate deliverable, not a side effect of improving the root file.

#### Outcome

Publish a docs-host `llms.txt` that points directly to the highest-signal
technical pages.

#### Required content outline

- one-sentence product definition
- actuator-not-planner framing
- direct links to:
  - docs home
  - Node API guide
  - Operator LLM playbook
  - API overview
  - CLI reference
  - error codes
  - first-time setup
  - troubleshooting
- link to `llms-full.txt` once it exists

#### Implementation targets

- `sites/docs/static/llms.txt` or docs-source equivalent if that fits the build
  flow better

### 2.4 Strengthen root `llms.txt`

Expand the existing root file into a better dispatcher.

#### Required changes

- clearer first paragraph
- explicit "Start here" section
- direct deep links into the docs corpus
- explicit statement that the docs site is the canonical technical source
- link to `/agents`
- link to `/agent.md`
- link to `llms-full.txt` once it exists

#### Implementation targets

- `sites/landing/public/llms.txt`

### 2.5 Publish `llms-full.txt`

Make this a real deliverable, not a maybe.

#### Outcome

A single file at `https://clawperator.com/llms-full.txt` that concatenates the
key technical docs in a deliberate reading order.

#### Why it matters

- one fetch gives an agent the full corpus
- bypasses weak link traversal
- useful for research agents and retrieval systems

#### Content scope

Include at least:

- first-time setup
- terminology if relevant
- Node API for agents
- Operator LLM playbook
- API overview
- CLI reference
- error codes
- skills usage model
- architecture
- troubleshooting

#### Implementation targets

- docs build pipeline
- landing public output or generated artifact path

### Phase 2 acceptance

- `curl https://docs.clawperator.com/sitemap.xml` returns non-empty URL entries
- root sitemap or sitemap index advertises the docs host
- `curl -I https://docs.clawperator.com/llms.txt` returns `200`
- `curl -I https://clawperator.com/llms-full.txt` returns `200`
- `llms-full.txt` is referenced from both `llms.txt` files

---

## Phase 3: Add agent-first entrypoints on the root site

This phase gives crawlers and humans an obvious machine-oriented path from the
homepage.

### 3.1 Add `/agents`

#### Outcome

A plain static HTML page on the root domain that explains what Clawperator is
and routes agents to the right docs.

#### Required content

- one-sentence product definition
- actuator-not-planner boundary
- note that the docs site is the canonical technical source
- direct links to:
  - docs home
  - Node API guide
  - Operator LLM playbook
  - API overview
  - CLI reference
  - install entrypoint
  - GitHub repo

### 3.2 Add `/agent.md`

#### Outcome

A raw markdown version of the agent landing page for markdown-preferring agents
and brittle fetchers.

#### HTTP requirement

Serve with:

```txt
Content-Type: text/markdown; charset=utf-8
```

If the platform serves `.md` as a generic binary or download type, add an
override in hosting config.

### 3.3 Add homepage and head-level hints

These are support signals, not the main discovery mechanism.

#### Required additions

- visible body link to `/agent.md`
- visible body link to `/agents`
- `/agent.md` included in `llms.txt`
- `/agent.md` included in sitemap
- `<link rel="alternate" type="text/markdown" href="https://clawperator.com/agent.md">`
  in the `<head>` of the homepage and `/agents`

#### Optional addition

Add this HTML comment near the top of the homepage source:

```html
<!-- For automated agents and crawlers: a machine-oriented markdown version of this page is available at https://clawperator.com/agent.md -->
```

This is optional because there is no standard requiring crawlers to inspect
comments.

### 3.4 Add a compact "For agents" section to the homepage

Place it high enough on the page that a shallow fetch sees it early.

#### Required content

- direct links to key docs
- one sentence saying the landing page is overview copy and the docs site is the
  canonical technical source

#### Implementation targets

- `sites/landing/app/page.js`
- `sites/landing/app/layout.js` if head tags are added there
- hosting config if MIME overrides are needed

### Phase 3 acceptance

- `curl https://clawperator.com/agents` yields useful machine-readable text
- `curl https://clawperator.com/agent.md` yields useful markdown
- `curl -I https://clawperator.com/agent.md` reports the intended content type
- the homepage source contains normal links to the agent entrypoints

---

## Phase 4: Strengthen secondary crawl surfaces

This phase catches agents that start somewhere other than the website root.

### 4.1 Improve GitHub README

Many agents land on GitHub first.

#### Required changes

- define Clawperator clearly in the first paragraph
- add a "For AI agents" section
- link directly to:
  - Node API guide
  - Operator LLM playbook
  - root `llms.txt`
  - `llms-full.txt`
- state the actuator-not-planner boundary clearly

#### Implementation targets

- `README.md`

### 4.2 Optional docs machine index page

If needed after the main work is done, add a docs-host page that is little more
than a curated list of the key technical pages.

This is optional because `llms.txt`, sitemap, and `/agents` should cover most of
the need.

### Phase 4 acceptance

- README first paragraph defines the product clearly
- README includes a "For AI agents" section with direct technical links

---

## Phase 5: Validate live behavior end to end

Do not treat build success as proof. Validate from the network edge.

### Required shell checks

```sh
curl -I https://clawperator.com
curl -I https://clawperator.com/robots.txt
curl -I https://clawperator.com/llms.txt
curl -I https://clawperator.com/llms-full.txt
curl -I https://clawperator.com/sitemap.xml
curl -I https://clawperator.com/agents
curl -I https://clawperator.com/agent.md

curl -I https://docs.clawperator.com
curl -I https://docs.clawperator.com/robots.txt
curl -I https://docs.clawperator.com/llms.txt
curl -I https://docs.clawperator.com/sitemap.xml
curl -I https://docs.clawperator.com/ai-agents/node-api-for-agents/
curl -I https://docs.clawperator.com/design/operator-llm-playbook/
curl -I https://docs.clawperator.com/reference/cli-reference/
```

### Required body checks

```sh
curl https://clawperator.com/llms.txt
curl https://clawperator.com/llms-full.txt | wc -c
curl https://clawperator.com/agent.md
curl https://docs.clawperator.com/robots.txt
curl https://docs.clawperator.com/llms.txt
curl https://docs.clawperator.com/sitemap.xml
```

### Required header checks

```sh
curl -I https://docs.clawperator.com/ai-agents/node-api-for-agents/
curl -I https://docs.clawperator.com/design/operator-llm-playbook/
curl -I https://clawperator.com/agent.md
```

Verify:

- no blocking `X-Robots-Tag`
- `agent.md` content type is correct
- docs sitemap is not empty
- both `llms.txt` files are live
- `llms-full.txt` is non-empty

---

## Recommended implementation order

Use this exact order unless a local dependency forces a small swap.

1. Phase 1: fix `robots.txt`, anti-AI audit, and edge behavior.
2. Phase 2: publish docs sitemap, root sitemap strategy, docs `llms.txt`, root
   `llms.txt`, and `llms-full.txt`.
3. Phase 3: add `/agents`, `/agent.md`, head hints, and homepage links.
4. Phase 4: update `README.md`.
5. Phase 5: validate from live URLs after deploy.

---

## Definition of done

This task is done when:

- both hosts expose clear crawl-policy files
- the docs corpus is discoverable through sitemap and `llms.txt`
- the root site exposes `/agents` and `/agent.md`
- `llms-full.txt` exists and is linked from both hosts
- no anti-indexing metadata or headers block intended public pages
- GitHub README routes agents to the technical docs

At that point, "I cannot directly crawl the site" should be a tooling limitation
or temporary fetch issue, not a site-structure problem.
