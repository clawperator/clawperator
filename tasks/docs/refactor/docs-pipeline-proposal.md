# Docs Pipeline Architecture Proposal

## Current System Analysis

### How it works today

```
Source files                   Manifest              Generation          Build
─────────────                  ────────              ──────────          ─────
docs/*.md            ─┐
apps/node/src/*.ts   ─┼─→  source-map.yaml  ─→  docs-generate skill  ─→  sites/docs/docs/  ─→  mkdocs build  ─→  sites/docs/site/
../clawperator-      ─┘    (modes: copy,         (agent-driven,           (committed to git)     (gitignored)
  skills/docs/*.md          code-derived,          runs scripts)
                            curated)
                                                 Also produces:
                                                   llms-full.txt (committed to static/)
                                                   docs_inventory.json (gitignored)
                                                   docs_build.json (gitignored)
```

### Key components

| Component | Role | Committed? |
|-----------|------|-----------|
| `source-map.yaml` | Manifest: maps source files to output paths, defines modes | Yes |
| `mkdocs.yml` | MkDocs nav tree, theme, site config | Yes |
| `sites/docs/docs/` | Generated markdown consumed by MkDocs | **Yes** (this is the problem) |
| `sites/docs/.generated/` | Scratch directory for staging proposed changes | No (gitignored) |
| `sites/docs/site/` | Final HTML output from MkDocs | No (gitignored) |
| `sites/docs/static/` | Root-level site files (llms.txt, robots.txt, etc.) | Yes |
| `docs_inventory.json` | Catalog of all source files | No (gitignored) |
| `docs_build.json` | Build metadata with deterministic IDs | No (gitignored) |

### Generation modes

- **`copy`**: Source markdown copied verbatim to output path. No transformation.
- **`code-derived`**: Generated from TypeScript source (CLI reference, error codes). Agent reads code, writes markdown.
- **`curated`**: Agent assembles content from multiple sources into one page (e.g., api-overview).

### Validation chain

1. `validate_source_of_truth.py` - checks that generated page changes have corresponding source changes
2. `diff_report.py` - churn gating (max files, lines, percent)
3. `mkdocs build --strict` - broken links are build errors
4. `validate_docs_routes.py` - verifies all routes, links, and machine-facing files exist

---

## Identified Problems and Root Causes

### Problem 1: Committed generated output creates a false editing surface

**Root cause:** `sites/docs/docs/` is tracked in git but is generated output.

**Failure modes:**
- An agent reads `sites/docs/docs/api/actions.md`, sees an error, edits it directly. The edit is overwritten on next generation.
- A human reviews a PR, sees generated docs changes, assumes they were authored. Approves without checking sources.
- Generated docs drift from sources when the generation step is skipped or partially run.

**Why it exists:** The original design wanted generated output reviewable in PR diffs. This is a reasonable goal but creates a persistent second surface.

### Problem 2: Dual structural authority

**Root cause:** Both `source-map.yaml` and `mkdocs.yml` encode the docs structure.

**Failure modes:**
- Pages added to `source-map.yaml` but not `mkdocs.yml` (or vice versa). Docs build succeeds but nav is wrong.
- Ordering differs between the two files. `llms-full.txt` (source-map-ordered) disagrees with site nav (mkdocs-ordered).
- Section names diverge between the two files.

**Why it exists:** `source-map.yaml` was designed to drive generation (what to copy, from where, in what mode). `mkdocs.yml` was designed to drive MkDocs (nav, theme, site config). They serve different tools but encode overlapping concerns.

### Problem 3: Link rewriting across repositories

**Root cause:** Source docs in `../clawperator-skills/docs/` contain relative links valid in that repo. Once copied to `sites/docs/docs/skills/`, those links break.

**Failure modes:**
- A skills doc links to `../blocked-terms-policy.md`. In the skills repo, this resolves. In the output tree, the target may be at a different relative path.
- Intra-repo links in `docs/` also break when source paths differ from output paths (e.g., `docs/reference/action-types.md` becomes `api/actions.md`).

**Current mitigation:** `validate_docs_routes.py` catches broken links post-build. But this is detection, not prevention. The agent doing generation must manually fix links, which is error-prone.

### Problem 4: Agent-driven generation is non-deterministic

**Root cause:** The `docs-generate` skill is an instruction document for an LLM agent, not a deterministic script. The agent reads source-map.yaml, reads sources, and writes output. Different agents (or the same agent on different runs) may produce slightly different output.

**Failure modes:**
- Code-derived pages vary in formatting, ordering, or completeness depending on agent interpretation.
- Curated pages vary in which content the agent selects to include.
- Churn policy (`diff_report.py`) mitigates this but doesn't eliminate it.

### Problem 5: Generation requires full context loading

**Root cause:** The agent must read source-map.yaml, then read every source file, then produce every output page. For 20+ pages from 30+ sources, this is a large context window operation.

**Consequence:** Generation is slow, expensive, and fragile. A single mistake in one page may require re-running the entire generation.

---

## Architectural Options

### Option A: Build-Time Assembly (Don't Commit Generated Docs)

**Core idea:** `sites/docs/docs/` becomes gitignored. All assembly happens at build time via a deterministic script (not an agent).

#### Where canonical docs live

No change. Sources remain in:
- `docs/` (authored pages)
- `apps/node/src/` (code-derived inputs)
- `../clawperator-skills/docs/` (skills docs)

#### Whether generated docs are committed

**No.** `sites/docs/docs/` is added to `.gitignore`. It is assembled fresh on every build.

#### How docs are assembled for MkDocs

A new deterministic Python script (`assemble_docs.py`) replaces the agent-driven generation:

```
assemble_docs.py reads source-map.yaml and:
  1. For copy pages: copies source file to output path
  2. For code-derived pages: runs a specific generator script (e.g., generate_cli_reference.py)
  3. For curated pages: concatenates specified source sections per a merge spec
  4. Rewrites relative links based on source-path-to-output-path mapping
  5. Writes all output to sites/docs/docs/
```

#### How link rewriting is handled

The assembly script builds a link map from source-map.yaml:
```
source path → output path
docs/reference/action-types.md → api/actions.md
docs/reference/error-handling.md → api/errors.md
../clawperator-skills/docs/usage-model.md → skills/overview.md
```

During copy, every relative markdown link is checked against this map and rewritten to the correct output-relative path. Unknown links fail the build.

#### How drift is prevented

Drift is **architecturally impossible**. Generated files don't exist in git. There's nothing to drift.

#### Implications

| Dimension | Assessment |
|-----------|-----------|
| Correctness | Strongest. No drift surface. |
| Agent usability | Good. Agents edit source files only. No confusion about which file to edit. |
| PR reviewability | Weaker. Reviewers see source changes but not generated output. Must trust the pipeline. |
| CI complexity | Moderate. CI must run assembly before any docs check. |
| Local dev | Must run `assemble_docs.py` to preview docs locally. Adds one step. |
| `llms-full.txt` | Also becomes build-time only (generated from assembled output, not committed). Or committed separately with its own generation step. |

---

### Option B: Committed Output with Hardened Pipeline (Current + Improvements)

**Core idea:** Keep `sites/docs/docs/` committed but add stronger guards and reduce agent variability.

#### Where canonical docs live

No change.

#### Whether generated docs are committed

**Yes**, as today.

#### How docs are assembled

Same agent-driven flow as today, with improvements:
1. Add a `# GENERATED FILE - DO NOT EDIT` header to every generated page (with source path reference)
2. Add a pre-commit hook that rejects direct edits to `sites/docs/docs/` without corresponding source changes
3. Replace curated mode with explicit merge specs (reducing agent discretion)
4. Make code-derived generation fully scripted (not agent-interpreted)

#### How link rewriting is handled

Same as today: agent rewrites during generation, `validate_docs_routes.py` catches failures post-build.

Improvement: add a link-rewrite validation step in `diff_report.py` that checks all links in proposed output before applying.

#### How drift is prevented

By policy and validation:
- `validate_source_of_truth.py` catches generated changes without source changes
- Pre-commit hook adds a second enforcement layer
- Generated file headers make the boundary visible

#### Implications

| Dimension | Assessment |
|-----------|-----------|
| Correctness | Moderate. Drift is prevented by policy, not architecture. Policy can be bypassed. |
| Agent usability | Moderate. Generated files still exist and can confuse agents. Headers help but don't eliminate the risk. |
| PR reviewability | Strong. Generated output visible in diffs. |
| CI complexity | Low. Existing pipeline works. |
| Local dev | No additional steps. Generated docs already in tree. |
| `llms-full.txt` | Remains committed as today. |

---

### Option C: Source Restructure + Minimal Generation

**Core idea:** Restructure `docs/` to match the target output structure directly. MkDocs reads from `docs/` as its `docs_dir`. Only code-derived and cross-repo pages need generation.

#### Where canonical docs live

- `docs/` restructured to match the output nav exactly:
  ```
  docs/
    index.md
    setup.md
    api/
      overview.md
      actions.md
      selectors.md
      snapshot.md
      errors.md        (authored section)
      devices.md
      doctor.md
      timeouts.md
      environment.md
      serve.md
      navigation.md
      recording.md
    skills/            (symlinked or copied from ../clawperator-skills/docs/)
      overview.md
      authoring.md
      development.md
      runtime.md
    troubleshooting/
      operator.md
      known-issues.md
      compatibility.md
  ```
- `apps/node/src/` remains the source for code-derived content

#### Whether generated docs are committed

**Partially.** Most pages are authored directly in `docs/` (no generation needed). Only 2-3 code-derived pages are generated into `docs/` and committed. Or: code-derived pages are generated into a separate directory and MkDocs is configured to merge them.

#### How docs are assembled for MkDocs

**Option C1 - Direct pointing:**
```yaml
# mkdocs.yml
docs_dir: ../../docs    # MkDocs reads directly from docs/
```
Problem: skills docs are in another repo. Requires symlinks or a copy step.

**Option C2 - Thin assembly:**
A minimal script copies only cross-repo files and generates code-derived pages into `docs/`. Everything else is already in place.

#### How link rewriting is handled

**Mostly eliminated.** If `docs/` structure matches the output structure, intra-repo links are already correct. Only cross-repo links (skills) need rewriting during copy.

#### How drift is prevented

For authored pages: drift is impossible (source = output).
For code-derived pages: same validation as today, but only 2-3 files instead of 20+.
For cross-repo pages: same validation as today, but only 4-6 files.

#### Implications

| Dimension | Assessment |
|-----------|-----------|
| Correctness | Strong for authored pages. Moderate for generated pages (same as today but smaller surface). |
| Agent usability | Strongest. Agents edit `docs/` directly. What they see is what gets published. |
| PR reviewability | Strong. Source changes = published changes for authored pages. |
| CI complexity | Low. Minimal generation step. |
| Local dev | Simplest. `docs/` is nearly ready for MkDocs as-is. |
| Restructure cost | High upfront. Must move all source files and update all references. But the docs refactor plan already requires rewriting everything, so this cost is already being paid. |

---

## Tradeoff Comparison

| Dimension | A: Build-Time Assembly | B: Hardened Current | C: Source Restructure |
|-----------|----------------------|--------------------|--------------------|
| Drift elimination | Architectural | Policy-based | Architectural (authored), policy (generated) |
| Agent confusion risk | None | Reduced but present | Minimal |
| PR review quality | Weaker (no output diff) | Strongest | Strong |
| Pipeline complexity | Moderate (new script) | Low (incremental) | Low (minimal script) |
| Local dev friction | One extra step | None | Minimal |
| Link rewriting | Systematic, script-driven | Agent-driven + validation | Mostly eliminated |
| Code-derived handling | Script-driven generation | Agent-driven generation | Script-driven, small scope |
| Restructure cost | Low (source paths unchanged) | None | Paid by refactor plan |
| `source-map.yaml` role | Still needed (maps sources to output) | Same as today | Simplified (only maps code-derived + cross-repo) |
| `mkdocs.yml` | Same | Same | `docs_dir` points at `docs/` |

---

## Recommended Direction: Option C (Source Restructure + Minimal Generation)

### Why

1. **The refactor plan already restructures everything.** The docs refactor plan (Section 2, 9) rewrites all 20 pages and defines a new target structure. The cost of making `docs/` match the output structure is zero additional work - it's a different choice about where to write the output, made at the same time the content is being rewritten anyway.

2. **It eliminates the generation step for 80% of pages.** Of 20 target pages, only 2-3 are code-derived (`api/cli.md`, parts of `api/errors.md`, parts of `api/selectors.md`) and 4 are cross-repo (skills). The remaining 13-14 are authored pages that need no transformation at all.

3. **It eliminates the link rewriting problem for intra-repo docs.** If `docs/api/actions.md` links to `../setup.md`, and the output path is `api/actions.md` linking to `setup.md`, and the source structure matches the output structure - the link is already correct. No rewriting needed.

4. **Agent ergonomics are maximized.** An agent sees `docs/api/errors.md` and knows: this is the canonical source, this is what gets published, editing it directly is correct. No indirection, no "edit the source not the output" confusion.

5. **It makes `source-map.yaml` dramatically simpler.** Instead of mapping 20 pages with copy/code-derived/curated modes, it only needs to track the 2-3 code-derived pages and 4 cross-repo pages. Everything else is implicit: if it's in `docs/` and in `mkdocs.yml` nav, it's published.

### How to implement alongside the refactor plan

The refactor plan (Phase 2) says "write 20 source pages." Instead of writing them to the current source locations and relying on generation to copy them to `sites/docs/docs/`, write them directly to `docs/` in the target structure:

```
docs/
  index.md              (authored, directly consumed by MkDocs)
  setup.md              (authored)
  api/
    overview.md         (authored)
    cli.md              (code-derived, generated into docs/ at build time)
    actions.md          (authored)
    selectors.md        (authored, with code-derived section appended at build time)
    snapshot.md         (authored)
    errors.md           (authored, with code-derived error table appended at build time)
    devices.md          (authored)
    doctor.md           (authored)
    timeouts.md         (authored)
    environment.md      (authored)
    serve.md            (authored)
    navigation.md       (authored)
    recording.md        (authored)
  skills/               (copied from ../clawperator-skills/docs/ at build time)
    overview.md
    authoring.md
    development.md
    runtime.md
  troubleshooting/
    operator.md         (authored)
    known-issues.md     (authored)
    compatibility.md    (authored)
```

**MkDocs configuration:**
```yaml
docs_dir: ../../docs
```

**Build-time steps (in `docs_build.sh`):**
1. Copy skills docs from `../clawperator-skills/docs/` to `docs/skills/`, rewriting links
2. Generate code-derived content (CLI reference, error code table, selector flag table)
3. Run MkDocs build
4. Generate `llms-full.txt` from built output
5. Validate

**What gets gitignored:**
- `docs/skills/` (cross-repo copies, generated at build time)
- `docs/api/cli.md` (fully code-derived)
- Potentially: code-derived sections within authored files are handled differently (see below)

### Handling code-derived content within authored pages

For `api/errors.md` and `api/selectors.md`, which mix authored recovery guidance with code-derived enumerations:

**Approach: marker-based injection.**

The authored file contains a marker:
```markdown
## Error Codes

<!-- CODE-DERIVED: errors -->

## Recovery Guidance

(authored content here)
```

At build time, a script replaces the marker with the generated table from `apps/node/src/contracts/errors.ts`. The authored file is the source of truth for structure and prose. The code is the source of truth for the enumeration.

The authored file (with marker) is committed. The expanded file (with injected table) is what MkDocs sees. This can be done by:
- Expanding in-place before MkDocs build, then reverting (messy)
- Expanding into a build directory that MkDocs reads from (cleaner)

**Recommended: expand into a build staging directory.**

```
docs_build.sh:
  1. Copy docs/ to sites/docs/.build/
  2. Copy skills docs into .build/skills/
  3. Generate api/cli.md into .build/api/
  4. Expand code-derived markers in .build/api/errors.md, .build/api/selectors.md
  5. Point MkDocs at .build/
  6. Build
```

This preserves `docs/` as purely authored content. The build staging directory is gitignored.

### Impact on source-map.yaml

`source-map.yaml` shrinks dramatically. It only needs to define:
- Code-derived pages: which code files generate which output
- Cross-repo copies: which skills docs map to which output paths
- Marker expansion specs: which authored pages have code-derived sections and what generates them

Everything else (authored pages that map 1:1 to output) is implicit from `docs/` directory structure + `mkdocs.yml` nav.

Alternatively, `source-map.yaml` could be eliminated entirely, replaced by:
- A `code-derived.yaml` that defines the 2-3 generated pages
- A `cross-repo.yaml` that defines the 4 skills doc copies
- Convention: everything in `docs/` not listed in the above is authored and published as-is

### Impact on existing pipeline scripts

| Script | Change |
|--------|--------|
| `build_inventory.py` | Simplify: only needs to catalog code-derived sources, not all docs |
| `diff_report.py` | Scope shrinks: only applies to code-derived and cross-repo pages |
| `generate_llms_full.py` | Update to read from build staging directory, walk `mkdocs.yml` nav |
| `validate_source_of_truth.py` | Simplify: only validates code-derived and cross-repo pages |
| `write_build_metadata.py` | No change |
| `validate_docs_routes.py` | No change |
| `docs_build.sh` | Add assembly step before MkDocs build |

### Impact on `sites/docs/docs/`

This directory is **deleted from the repo**. Its contents are replaced by the build staging directory (`sites/docs/.build/`) which is gitignored.

The `sites/docs/docs/` entry in `.gitignore` is added. Existing committed files are removed in the refactor PR.

### What this means for the refactor plan

The refactor plan's Phase 2 ("Write Source Docs") changes target:
- Instead of writing to source locations that get copied to `sites/docs/docs/`, write directly to `docs/` in the target structure
- Skills pages are still authored in `../clawperator-skills/docs/` and copied at build time
- Code-derived pages are still generated from `apps/node/src/`

The refactor plan's Phase 1 ("Infrastructure") adds:
- `assemble_docs.sh` or equivalent build-time assembly step
- Marker-based injection for curated pages
- Updated `docs_build.sh` with assembly step
- Gitignore changes

The refactor plan's Phase 4 ("Generate and Validate") simplifies:
- No need to run `docs-generate` skill for copy pages
- Only code-derived generation + cross-repo copy + MkDocs build

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `docs/` restructure breaks existing references in CLAUDE.md, scripts, CI | The refactor plan already updates all references. This is additive, not new risk. |
| Cross-repo link rewriting has edge cases | Build-time rewriting with explicit mapping + strict MkDocs build catches all broken links. |
| Code-derived marker injection is a new mechanism | Simple sed/python replacement. Test with existing code-derived content before full rollout. |
| Local dev requires build step to see skills docs | Acceptable. Skills docs are a small subset. Most authored docs are visible without any build step. |
| `llms-full.txt` no longer committed in generated form | Generate from build output. Commit to `sites/docs/static/` as part of the build step, or make it build-time only. |

---

## Summary

| Option | Verdict |
|--------|---------|
| A: Build-Time Assembly | Sound but adds unnecessary indirection for authored pages that don't need transformation |
| B: Hardened Current | Preserves the fundamental problem. More guardrails on a flawed architecture. |
| **C: Source Restructure** | **Recommended.** Eliminates the generation step for most pages, removes the false editing surface, and is free to implement because the refactor plan already rewrites everything. |

The key insight: the docs refactor plan is already paying the restructure cost. Choosing where to place the rewritten files is a one-time decision made during that rewrite. Placing them in `docs/` matching the output structure eliminates the entire copy-based generation pipeline for 80% of pages and removes `sites/docs/docs/` as a committed artifact.
