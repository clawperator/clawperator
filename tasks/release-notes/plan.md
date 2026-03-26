# Release Notes — Plan

## Strategy

A single skill, `release-notes-author`, lives at `.agents/skills/release-notes-author/` in this repository. It gathers raw git data via a deterministic shell script, then the running agent synthesizes the data into formatted release notes. No external API calls and no separate LLM invocation — the agent executing the skill IS the LLM.

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
| 📱 Android Operator APK | `apps/android/**` | `apps/android/build/**`, `apps/android/app/build/**`, `apps/android/**/generated/**` |
| 📚 Documentation & Website | `docs/**`, `sites/docs/**`, `sites/landing/**` | `docs/internal/**`, `sites/docs/AGENTS.md`, `sites/docs/requirements.txt`, `sites/landing/public/sitemap.xml`, `sites/landing/public/landing-sitemap.xml` |
| *(omit)* | `.agents/**`, `.github/**`, `tasks/**`, `gradle/**`, build/CI config, lock files | — |

A commit touching multiple surfaces appears in each relevant section. Exclusion paths take precedence — a commit to `apps/node/node_modules/` is INFRA even though it is under `apps/node/`.

**Two-stage classification:** Surface detection (script) determines which surfaces a commit touched. File-type classification (also script) determines whether it warrants a bullet. The LLM synthesis step writes prose only — it does not make keep/drop decisions.

Each changed file is typed as `src`, `generated`, or `config` by the script using a hardcoded table:

| Type | Paths |
|------|-------|
| `src` | `apps/node/src/**` (excl. `src/test/**`), `apps/android/app/src/main/**`, authored `docs/**` (non-generated) |
| `generated` | `apps/node/dist/**`, `apps/node/package-lock.json`, `sites/docs/static/llms-full.txt`, `sites/docs/static/llms.txt`, `sites/landing/public/llms-full.txt`, `sites/landing/public/llms.txt` |
| `config` | `apps/node/package.json`, `sites/docs/mkdocs.yml`, `sites/docs/source-map.yaml`, `gradle/**`, `build.gradle.kts`, `settings.gradle.kts`, `*.properties` |
| `infra` | `apps/node/src/test/**`, `apps/android/app/src/test/**`, `apps/android/app/src/androidTest/**`, `.agents/**`, `.github/**`, `tasks/**`, `docs/internal/**`, `sites/docs/AGENTS.md`, `sites/docs/requirements.txt`, sitemap files, build output dirs |
| `src` (default) | Anything in a named surface path not matched above |
| `infra` (default) | Anything **not** under any named surface path and not matched above (e.g. `CHANGELOG.md`, `README.md`, `scripts/**`, root-level configs) |

**Surface detection:** a file contributes to a named surface (`node`, `android`, `docs`) if it falls under that surface's path prefix AND its type is `src`, `generated`, or `config` (not `infra`). Files typed `infra` never contribute to any surface.

**Commit classification rule** (deterministic, applied by the script):
- **keep** — at least one `src` file in any named surface
- **drop:no-src** — named-surface files exist, but all are `config` and/or `generated` (covers config-only, generated-only, and mixed)
- **drop:infra** — no named-surface files at all

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

## Output Format

Every generated block must follow this exact structure:

```markdown
## [<version>] - <YYYY-MM-DD>

<One or two sentence high-level summary of the release.>

### 🤖 Node API & CLI
- **Added:** ...
- **Changed:** ...
- **Fixed:** ...

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

---

## CHANGELOG Insertion Rule (Upsert)

The skill is structurally idempotent. Behavior depends on file and block state:

| State | Behavior |
|-------|----------|
| `CHANGELOG.md` does not exist | Create it with the standard header, `## [Unreleased]` placeholder, and the new block |
| File exists, target `## [x.y.z]` block absent, `## [Unreleased]` present | Insert new block immediately after the `## [Unreleased]` section (below its content if any, above the next `## [`) |
| File exists, target block absent, no `## [Unreleased]` | Insert new block at top of file after the header comment |
| File exists, target `## [x.y.z]` block present | Replace existing block from its header line up to (but not including) the next `## [` line |
| File exists, no prior version blocks and no `## [Unreleased]` | Append new block after the header comment |

Never delete or modify any other versioned entries. "Replace" means the entire block including the version header line.

---

## Scope of This Task

1. Implement the `release-notes-author` skill (script + SKILL.md) in this repo at `.agents/skills/release-notes-author/`.
2. Backfill `CHANGELOG.md` for `v0.5.1` (small, mostly docs — good first test).
3. Backfill `CHANGELOG.md` for `v0.5.0` (larger, major API refactor — stress test).
4. Document findings in `tasks/release-notes/findings.md` as work proceeds.
5. Wire the CHANGELOG block into `.github/workflows/release-apk.yml` so GitHub Releases include it.

Out of scope for this task: docs site version number display (separate follow-on task).
