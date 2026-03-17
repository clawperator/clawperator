# Docs Link Validation Gap

## Summary

`scripts/validate_docs_routes.py` checks that every page listed in
`sites/docs/source-map.yaml` is reachable as a built HTML route, and that
`llms.txt` references are consistent. It does not follow relative links inside
authored docs pages.

This means a broken inner-page link - for example an `../reference/snapshot-format.md`
reference inside `docs/ai-agents/agent-quickstart.md` - would not be caught if
the target page were removed or renamed. The links resolve correctly today, but
there is no automated check to prevent silent regressions.

## Current validator scope (as of this branch)

Checks performed by `validate_docs_routes.py`:

- Every `output:` entry in `source-map.yaml` maps to a built `site/` HTML file.
- Every `https://docs.clawperator.com/...` URL in `sites/docs/docs/` resolves to
  a built HTML file.
- Required root files exist: `index.html`, `404.html`, `robots.txt`, `llms.txt`,
  `llms-full.txt`, `sitemap.xml`.
- Every route listed in `sites/docs/static/llms.txt` resolves to a built HTML file.

Not checked:

- Relative `../` or `./` links inside authored markdown pages
  (`docs/`, `sites/docs/docs/`).
- Intra-page anchors (`#section-heading`).

## Concrete example of what would break silently

If `docs/snapshot-format.md` were removed without updating its referencing pages:

- `docs/agent-quickstart.md` line: `[Clawperator Snapshot Format](../reference/snapshot-format.md)`
- `docs/index.md` line: `[Clawperator Snapshot Format](reference/snapshot-format.md)`
- `docs/node-api-for-agents.md`: multiple references

The source-map check would fail on the missing output entry (catching the
removal), but if the page were merely renamed and the source-map updated without
updating inner-page references, all validator checks would pass while the links
were broken.

## Resolution options

### Option A - Extend `validate_docs_routes.py`

Scan all `*.md` files in `sites/docs/docs/` and resolve each relative markdown
link against the file's location. Confirm the linked target exists as either:

- a `.md` file in `sites/docs/docs/` (pre-build check), or
- a built `index.html` in `sites/docs/site/` (post-build check).

This is the lowest-friction option. The script already has the necessary path
helpers and is invoked as part of `./scripts/docs_build.sh`.

Suggested implementation sketch:

```python
def check_inner_page_links(generated_docs_dir: Path, site_dir: Path) -> list[str]:
    errors = []
    for md_file in generated_docs_dir.rglob("*.md"):
        text = md_file.read_text(encoding="utf-8")
        for match in re.finditer(r'\[.*?\]\(([^)]+)\)', text):
            raw = match.group(1).split("#")[0].strip()
            if not raw or raw.startswith("http"):
                continue
            resolved = (md_file.parent / raw).resolve()
            site_path = markdown_output_to_site_path(
                str(resolved.relative_to(generated_docs_dir))
            )
            if not (site_dir / site_path).exists():
                errors.append(f"{md_file.relative_to(generated_docs_dir)}: broken link -> {raw}")
    return errors
```

### Option B - Enable MkDocs strict mode

Add `strict: true` to `sites/docs/mkdocs.yml`. MkDocs will then treat broken
relative links as build errors and fail `mkdocs build`.

Tradeoff: MkDocs link checking is relative-path only and does not validate
external URLs or `llms.txt` routes, so Option A and Option B are complementary
rather than alternatives. Strict mode is the simpler first step.

To enable:

```yaml
# sites/docs/mkdocs.yml
strict: true
```

Then verify `./scripts/docs_build.sh` still passes - any existing broken links
would surface at this point and must be fixed before enabling.

### Option C - Both

Enable MkDocs strict mode for immediate coverage during the build, and extend
`validate_docs_routes.py` for post-build coverage including anchor checking.

## Recommended approach

Start with Option B (MkDocs strict mode) as an immediate low-effort gate.
Follow with Option A to cover the post-build and `llms.txt`-consistency gap.

## Prerequisites

Before enabling strict mode, run `mkdocs build --strict` locally and resolve
any warnings MkDocs already emits. There may be zero - but this should be
confirmed before wiring it into CI.
