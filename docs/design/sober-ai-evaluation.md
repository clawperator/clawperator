# sober-ai Evaluation for GEO

This document records what `sober-ai` can and cannot tell us about
Clawperator's LLM readiness.

Date run: 2026-03-10

Targets:

- `https://clawperator.com`
- `https://docs.clawperator.com`

Tool evaluated:

- `https://github.com/nitishagar/sober-ai`

## Conclusion

`sober-ai` is useful as a secondary audit tool for page extractability.

It is not sufficient as the primary GEO gate for Clawperator.

It correctly tells us whether a page is server-rendered, semantically
structured, and easy to extract without JavaScript. That is valuable.

It does not check the machine-facing discovery surfaces that matter most for
this project:

- `robots.txt`
- `llms.txt`
- `llms-full.txt`
- sitemap wiring between root and docs hosts
- markdown entrypoints such as `/index.md`
- redirect alias behavior
- response headers for machine-facing assets
- Cloudflare bot behavior and edge overrides

Use it to answer "can an agent extract this page?"

Do not use it alone to answer "can an agent discover and trust the canonical
Clawperator docs surface?"

## How it was run

Setup:

```sh
git clone https://github.com/nitishagar/sober-ai ~/src/sober-ai
cd ~/src/sober-ai
npm install
npx playwright install chromium
```

Execution:

```sh
node <<'EOF'
const yaml = require('js-yaml');
const fs = require('fs');
const Auditor = require('./src/core/auditor');
const config = {
  audits: yaml.load(fs.readFileSync('./src/config/audits.yaml', 'utf8')),
  models: yaml.load(fs.readFileSync('./src/config/models.yaml', 'utf8')),
};
(async () => {
  for (const url of ['https://clawperator.com', 'https://docs.clawperator.com']) {
    const auditor = new Auditor(config);
    const result = await auditor.audit(url);
    console.log('===RESULT===' + url);
    console.log(JSON.stringify(result, null, 2));
  }
})();
EOF
```

Notes:

- Playwright-based fetching worked once Chromium was installed.
- The optional LLM recommendation stage failed locally and fell back to the
  baseline rule recommendations. That did not block the audit itself.

## Results

### `https://clawperator.com`

Scores:

- overall: `58` (`F`)
- SSR readiness: `100`
- schema coverage: `0`
- semantic structure: `65`
- content extractability: `65`

Findings worth taking seriously:

- SSR is strong. The site is readable without JavaScript.
- No Schema.org markup was detected.
- Link text quality was scored poorly.
- Image alt coverage was scored poorly.

Findings to treat carefully:

- The tool penalizes short, landing-page style paragraphs.
- It suggests author and date metadata, which is not especially important for a
  product homepage.
- The overall `F` grade overstates the practical risk for our use case because
  the site is explicitly optimized around crawlable HTML plus separate
  machine-facing routes.

Interpretation:

The landing site is already in a good place for no-JS accessibility. Its main
weaknesses under this tool are semantic polish and lack of schema, not basic
fetchability.

### `https://docs.clawperator.com`

Scores:

- overall: `51` (`F`)
- SSR readiness: `100`
- schema coverage: `0`
- semantic structure: `75`
- content extractability: `30`

Findings worth taking seriously:

- SSR is strong. The docs site is readable without JavaScript.
- No Schema.org markup was detected.
- The home page content block is judged hard to extract as a single coherent
  piece of text.

Findings to treat carefully:

- The docs score is based on the docs home page, not the high-signal deep pages
  such as the Node API and CLI reference.
- The "lack of content structure" finding on the docs home page is likely more
  about the exact MkDocs landing layout than the docs corpus as a whole.
- Author and date metadata are again low-priority for this surface.

Interpretation:

The docs host is fetchable and semantically decent, but `sober-ai` does not
tell us whether agents can find the right deep pages or the machine-oriented
artifacts. It mostly measures the presentation quality of the docs home page.

## What we learned

Useful signals:

- both public hosts are accessible without JS
- the site surfaces have enough semantic structure for basic extraction
- the landing page and docs home page could benefit from cleaner descriptive
  link text
- Schema.org is currently absent on both hosts

Missing signals:

- whether `robots.txt` is live and permissive
- whether `llms.txt` and `llms-full.txt` are discoverable and correct
- whether `/index.md` is linked, served correctly, and easy to find
- whether sitemap plumbing points crawlers from the root host into the docs host
- whether Cloudflare treats AI user agents differently from normal fetches
- whether headers inject `noindex`, `noai`, or related anti-crawl directives

## Recommendations

Primary recommendation:

- keep using the Clawperator GEO checklist as the main gate

Secondary recommendation:

- use `sober-ai` as an occasional audit for HTML semantics and extractability

Concrete follow-ups that `sober-ai` suggests:

- improve descriptive link text on the landing and docs home pages
- review image `alt` text on the landing page
- decide whether adding minimal Schema.org is worth the maintenance cost

Concrete follow-ups that must still be covered outside `sober-ai`:

- validate live `robots.txt` on both hosts
- validate live `llms.txt` and `llms-full.txt`
- validate `/index.md` content type and redirects
- validate root-to-docs sitemap discovery
- validate bot behavior at the Cloudflare edge

## Recommended operating model

Treat GEO validation as two separate layers:

1. Discovery and policy
   - `robots.txt`
   - sitemaps
   - `llms.txt`
   - `llms-full.txt`
   - markdown entrypoints
   - redirects
   - headers

2. Extractability and semantics
   - SSR
   - semantic HTML
   - descriptive link text
   - schema
   - content structure

`sober-ai` is useful for layer 2.

Clawperator still needs custom checks for layer 1.
