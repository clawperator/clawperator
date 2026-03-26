# Release Notes — Plan

## Strategy

A single skill, `release-notes-author`, lives at `.agents/skills/release-notes-author/` in this repository. It gathers raw git data via a deterministic shell script, then the running agent synthesizes the data into formatted release notes. No external API calls and no separate LLM invocation — the agent executing the skill IS the LLM.

**Scope of reliability:** This is a best-effort system grounded in commit metadata (subject, body, file paths). When commits are well-written, the output is reliably accurate. When commits are terse or misleading, the output is conservative — vague bullets rather than invented claims. This is the correct tradeoff for a bounded, auditable system.

Notes are written to `CHANGELOG.md` at the repository root. Once a changelog entry exists, the GitHub Release workflow is updated (Phase 5) to extract the relevant block and append it to the release body alongside the existing install links and artifact metadata.

The team considered a forward-only changelog, but historical backfill is the chosen scope so the repo can establish a canonical release history before future releases rely on it.

Why not `semantic-release` or `release-drafter`?
- `semantic-release` is a strong opinionated release engine, but it assumes conventional-commit-driven versioning and a tighter release pipeline than this repo currently wants.
- `release-drafter` is good at templated PR aggregation, but it depends on label discipline and does not naturally classify changes by file path across the repo surfaces we care about.
- This custom skill keeps classification aligned with the repository's actual surface boundaries and keeps the generation step auditable in one place.

---

## Surface Boundaries

Surface classification is derived from **file diffs, not commit messages**. Commit messages are unreliable and must not be used for classification. A commit touching multiple surfaces appears in each relevant section.

| Surface | Include paths | Exclude paths |
|---------|--------------|---------------|
| 🤖 Node API & CLI | `apps/node/**` | `apps/node/node_modules/**`, `apps/node/dist/**`, `apps/node/coverage/**` |
| 📱 Android Operator APK | `apps/android/**` | `apps/android/app-conformance/**`, `apps/android/build/**`, `apps/android/app/build/**`, `apps/android/**/generated/**` |
| 📚 Documentation & Website | `docs/**`, `sites/docs/**`, `sites/landing/**` | `docs/internal/**`, `sites/docs/AGENTS.md`, `sites/docs/requirements.txt`, `sites/landing/public/sitemap.xml`, `sites/landing/public/landing-sitemap.xml` |
| *(omit)* | `.agents/**`, `.github/**`, `tasks/**`, `gradle/**`, build/CI config, lock files | — |

**Note on the Documentation & Website surface:** `docs/**`, `sites/docs/**` (technical reference), and `sites/landing/**` (marketing/install site) are deliberately collapsed into one surface. This simplifies the current implementation. If future releases need to distinguish technical docs from the marketing site, split the surface by adding a `📦 Website` row and updating the lookup table in `gather_commits.sh`.

A commit touching multiple surfaces appears in each relevant section. Exclusion paths take precedence — a commit to `apps/node/node_modules/` is INFRA even though it is under `apps/node/`.

**Two-stage classification:** Surface detection (script) determines which surfaces a commit touched. File-type classification (also script) determines whether it warrants a bullet. The LLM synthesis step writes prose only — it does not make keep/drop decisions.

Each changed file is typed as `src`, `generated`, or `config` by the script using a hardcoded table:

| Type | Paths |
|------|-------|
| `src` | `apps/node/src/**` (excl. `src/test/**`), `apps/android/app/src/main/**`, authored `docs/**` (non-generated) |
| `generated` | `apps/node/dist/**`, `apps/node/package-lock.json`, `sites/docs/static/llms-full.txt`, `sites/docs/static/llms.txt`, `sites/landing/public/llms-full.txt`, `sites/landing/public/llms.txt` |
| `config` | `apps/node/package.json`, `sites/docs/mkdocs.yml`, `sites/docs/source-map.yaml`, `gradle/**`, `build.gradle.kts`, `settings.gradle.kts`, `*.properties` |
| `infra` | `apps/node/src/test/**`, `apps/android/app/src/test/**`, `apps/android/app/src/androidTest/**`, `apps/android/app-conformance/**`, `.agents/**`, `.github/**`, `tasks/**`, `docs/internal/**`, `sites/docs/AGENTS.md`, `sites/docs/requirements.txt`, sitemap files, build output dirs |
| `src` (default) | Anything in a named surface path not matched above |
| `infra` (default) | Anything **not** under any named surface path and not matched above (e.g. `CHANGELOG.md`, `README.md`, `scripts/**`, root-level configs) |

**Surface detection:** a file contributes to a named surface (`node`, `android`, `docs`) if it falls under that surface's path prefix AND its type is `src`, `generated`, or `config` (not `infra`). Files typed `infra` never contribute to any surface.

**Deleted files:** The script also captures deleted file paths (using `--diff-filter=D`) and emits them in the `FILES:` list annotated `[deleted]`. Deleted files are classified by path using the same lookup table. A deleted `src` file in a named surface contributes to surface detection and to the `keep` classification — so a commit that only removes a user-facing source file is still `keep`, not `drop`.

**Commit classification rule** (deterministic, applied by the script):
- **keep** — at least one `src` file (added, modified, renamed, OR deleted) in any named surface
- **drop:no-src** — named-surface files exist, but all are `config` and/or `generated` (covers config-only, generated-only, and mixed)
- **drop:infra** — no named-surface files at all

**Android shared modules:** `apps/android/shared/**` is not explicitly listed in the file-type table and falls through to `src` by default under the Android surface. This is the intended behavior — shared Android modules are part of the shipped product.

The LLM reads `CLASSIFICATION:` and writes bullets for `keep` commits. It never decides whether a commit should be included.

---

## Skill Design

Two files only:

```
.agents/skills/release-notes-author/
  SKILL.md               — agent instructions: run script, synthesize, write
  scripts/
    gather_commits.sh    — deterministic data gathering; structured text output
```

The script handles all keep/drop decisions deterministically. The agent writes prose for `keep` commits and writes the final CHANGELOG entry. The agent does not filter or skip commits — that is the script's job.

---

## Synthesis Contract

These rules constrain the LLM synthesis step. The agent must apply them consistently.

**Category rubric (one per bullet, determined by the change's effect):**
- `Added` — a new capability, action, flag, option, endpoint, or behavior that did not exist before
- `Changed` — an existing capability is modified, renamed, restructured, or now behaves differently
- `Fixed` — a defect, error condition, or incorrect behavior is corrected
- `Removed` — a capability that previously existed has been deleted; always prefix with `**Breaking:**`
- A single commit may produce bullets in more than one category if it genuinely introduces distinct effects

**Breaking changes:** If a commit removes or renames a public API, changes a default in a backward-incompatible way, or requires callers to update their code, prefix the bullet with `**Breaking:**` before the category label. Examples: `- **Breaking:** **Changed:** Renamed \`foo\` to \`bar\`` or `- **Breaking:** **Removed:** Removed \`foo\` action`. Surfacing breaking changes is mandatory — they must not be flattened into generic `Changed` bullets. Only mark `**Breaking:**` when there is explicit evidence in `SUBJECT` or `BODY` of backward incompatibility, or when a `[deleted][src]` file represents a user-facing capability (command, action, API) with no replacement evident in the same commit.

**Deleted files in synthesis:** Files annotated `[deleted]` in the `FILES:` list were removed from the repository. A deleted `[src]` file in a named surface must produce a bullet. If the deletion removes a user-facing capability and no replacement is evident in the same commit, surface it as `**Breaking:** **Removed:**`. If the deletion is part of a refactor where the behavior was replaced or renamed (evidenced by other files in the same commit), surface it as `**Breaking:** **Changed:**` or incorporate it into another bullet with the replacement named. If the src file was purely internal and the deletion has no user-visible effect, escalate as "no user-facing change despite keep classification" in findings.md with the SHA and reason.

**"Related commits" definition:** Two commits in the same PR (`PR:` line shows same number) must be merged into a single bullet group. Outside of same-PR commits, two commits may be merged when evidenced by (a) shared or adjacent `FILES` entries in the same module or (b) explicit cross-referencing in their `BODY` text. When merging, list all contributing SHAs in findings.md. A commit may not be merged into another if doing so would suppress a distinct user-visible behavior.

**Multi-surface commits — per-surface framing:** A commit touching multiple surfaces appears in each relevant surface section, but each bullet must be framed from that surface's perspective. Do not emit near-identical wording across sections. If a commit changes both the Node implementation and its documentation, the Node bullet describes the behavior change; the Docs bullet describes what documentation was added or updated. If the only cross-surface artifact is a generated file update (e.g., `llms.txt` regenerated), omit the redundant surface bullet rather than duplicating.

**Synthesis is bounded to script output:** Bullets must be grounded solely in each commit's `SUBJECT`, `BODY`, and `FILES` from the script output. The agent must not inspect the actual diff or any file outside the script output. When commit messages are thin and the evidence is weak, write a conservative bullet that acknowledges limited context rather than inferring behavior that is not evidenced.

**Summary sentence rubric:** The summary (one or two sentences) describes the release's dominant character for a developer deciding whether to upgrade. Apply in order: (1) if breaking changes exist, lead with them; (2) if one surface clearly dominates by count of `keep` commits, name it; (3) describe the most significant user-visible outcome, not implementation details. Do not reproduce bullet content verbatim.

**Root-level and out-of-surface files are intentionally excluded:** `README.md`, `CHANGELOG.md`, `scripts/**`, and root-level configs are classified `infra` by default and never contribute to any surface. This is a deliberate product boundary. If this boundary should change for a future release, update the lookup table in `gather_commits.sh` before running the skill.

---

## Output Format

Every generated block must follow this exact structure:

```markdown
## [<version>] - <YYYY-MM-DD>

<One or two sentence high-level summary of the release.>

### 🤖 Node API & CLI
- **Added:** ...
- **Changed:** ...
- **Fixed:** ...
- **Breaking:** **Removed:** ...

### 📚 Documentation & Website
- **Added:** ...
- **Changed:** ...
- **Fixed:** ...

### 📱 Android Operator APK
- **Added:** ...
- **Changed:** ...
- **Fixed:** ...
```

Sections that have no user-facing changes are omitted entirely.

**Date rule:** Use the annotated tag's creation date via `git for-each-ref --format='%(creatordate:short)' refs/tags/<end-tag>`. For lightweight tags this returns the commit's committer date, which is acceptable. If the tag ref does not exist the script must exit non-zero with a clear error — no fallback to today's date.

---

## Configurability

The skill accepts positional tags `<start-tag> <end-tag>` (e.g., `v0.5.0` and `v0.5.1`). This supports both current-release and historical backfill use cases with the same invocation.

**Git range semantics:** `START_TAG..END_TAG` means commits reachable from `END_TAG` but not from `START_TAG` — start is exclusive, end is inclusive. The script enumerates exactly the commits that went into the release represented by `END_TAG`.

---

## CHANGELOG Insertion Rule (Upsert)

The skill is structurally idempotent. Behavior depends on file and block state:

| State | Behavior |
|-------|----------|
| `CHANGELOG.md` does not exist | Create the file with `# Changelog\n\n`, then apply the "no version blocks" case below |
| Target `## [x.y.z]` block present | Replace from its `## [x.y.z]` header line up to (not including) the next `## [` line |
| Target block absent, `## [Unreleased]` present | Insert new block **after** the `[Unreleased]` section (after its content, immediately before the next `## [x.y.z]` line or end of file) |
| Target block absent, no `## [Unreleased]`, at least one `## [x.y.z]` exists | Insert new block immediately before the first `## [x.y.z]` line |
| No version blocks at all (with or without `## [Unreleased]`) | Append new block at end of file |

Never delete or modify any other versioned entries. "Replace" means the entire block including the version header line.

---

## Scope of This Task

1. Implement the `release-notes-author` skill (script + SKILL.md) in this repo at `.agents/skills/release-notes-author/`.
2. Backfill `CHANGELOG.md` for `v0.5.1` (small, mostly docs — good first test).
3. Backfill `CHANGELOG.md` for `v0.5.0` (larger, major API refactor — stress test).
4. Document findings in `tasks/release-notes/findings.md` as work proceeds.
5. Wire the CHANGELOG block into `.github/workflows/release-apk.yml` so GitHub Releases include it.

Out of scope for this task: docs site version number display (separate follow-on task).
