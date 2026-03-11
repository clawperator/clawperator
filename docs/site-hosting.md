# Site Hosting

This note captures the current hosting setup for the public Clawperator sites.

## Docs site build requirement

The docs site cannot be built in Cloudflare Pages with plain `mkdocs build`.

The Pages project for `docs.clawperator.com` must use the repo build script:

```sh
../../scripts/docs_build.sh
```

Why:

- `mkdocs build` alone does not publish the required root text assets
- the build script also generates `llms-full.txt`
- the build script also copies `sites/docs/static/` into `sites/docs/site/`

Without that script, the deployed docs site will miss root files such as:

- `robots.txt`
- `llms.txt`
- `llms-full.txt`

## Current Cloudflare split

The current Cloudflare setup is split across two accounts:

- `clawpilled`
  - owns the live `clawperator.com` zone and active DNS
  - controls zone-level features such as AI Crawl Control
- `Action Launcher`
  - currently owns the Cloudflare Pages projects for:
    - `clawperator`
    - `clawperator-docs`

This is messy and should be treated as operational debt.

Practical consequence:

- Pages deployment fixes for `docs.clawperator.com` must currently be made in
  the `Action Launcher` account
- zone-level overrides such as managed `robots.txt` behavior must currently be
  managed in the `clawpilled` account

## Recommendation

Keep the current setup stable until the sites are healthy, then plan a
deliberate migration so DNS and Pages live in the same Cloudflare account.
