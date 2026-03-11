---
name: geo-verify-public-surfaces
description: Verify the live crawl-facing GEO surfaces for clawperator.com and docs.clawperator.com, then summarize the findings for the user. Use when an agent needs to check robots.txt, llms.txt, llms-full.txt, sitemap endpoints, markdown entrypoints, redirect aliases, anti-indexing headers, and Cloudflare anti-bot behavior after deployment.
---

# GEO Verify Public Surfaces

This skill validates the live machine-facing surfaces for Clawperator and
produces a concise summary that an agent can relay without asking a human to
scan raw headers.

It also probes for Cloudflare anti-agent behavior, since default bot-mitigation
settings can silently break machine-facing routes even when source files are
present.

## What this skill covers

- `https://clawperator.com/robots.txt`
- `https://clawperator.com/llms.txt`
- `https://clawperator.com/llms-full.txt`
- `https://clawperator.com/index.md`
- `https://clawperator.com/agents`
- `https://clawperator.com/sitemap.xml`
- alias redirects such as `/agent.md`, `/agents.md`, and `/for-agents`
- `https://docs.clawperator.com/robots.txt`
- `https://docs.clawperator.com/llms.txt`
- `https://docs.clawperator.com/llms-full.txt`
- `https://docs.clawperator.com/geo-debug.txt`
- `https://docs.clawperator.com/sitemap.xml`
- key docs entrypoints such as the Node API guide and CLI reference
- Cloudflare behavior for named bot user agents such as `GPTBot`,
  `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, and `Googlebot`
- challenge pages, mitigation headers, AI-blocking headers, and suspicious
  fallback bodies on machine-facing routes

## Workflow

1. Run the helper script:
   - production defaults:
     - `.agents/skills/geo-verify-public-surfaces/scripts/verify_public_surfaces.py`
   - custom preview hosts:
     - `.agents/skills/geo-verify-public-surfaces/scripts/verify_public_surfaces.py --landing-base-url <landing_url> --docs-base-url <docs_url> --allow-noindex`
2. Let the script complete even if one or more checks fail.
3. Read the final summary section and any failing checks.
4. In your user-facing response:
   - lead with whether the live GEO surface passes or fails overall
   - call out only the failing or suspicious routes
   - mention notable edge behavior such as relative redirect `Location` headers,
     `X-Robots-Tag`, `cf-mitigated`, challenge pages, or bot-specific failures
   - do not dump all headers unless the user asked for raw output

## Targeting rules

- If no flags are provided, the helper checks production:
  - `https://clawperator.com`
  - `https://docs.clawperator.com`
- For preview validation, pass both preview hosts explicitly.
- For preview validation, usually also pass `--allow-noindex` because branch
  previews often carry `X-Robots-Tag: noindex` by design.
- Use preview URLs from Cloudflare check runs or PR comments when available.

## Output contract

The helper prints:

- one line per check with `PASS` or `FAIL`
- a short summary block with totals
- a JSON object at the end under `RESULT_JSON:` for machine consumption

Use the summary as the main basis for your answer. Use the JSON block if you
need to count failures or quote exact reasons.

## Notes

- This is a live-edge check, not a source-file lint.
- Cloudflare behavior is part of the result. If live behavior differs from the
  repo, report the live result.
- Do not ask the user to inspect header output manually. Summarize the result
  yourself.
