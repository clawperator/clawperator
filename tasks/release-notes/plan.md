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

## Synthesis Contract

These rules constrain the LLM synthesis step. The agent must apply them consistently.

**Category rubric (one per bullet, determined by the change's effect):**
- `Added` — a new capability, action, flag, option, endpoint, or behavior that did not exist before
- `Changed` — an existing capability is modified, renamed, restructured, or now behaves differently
- `Fixed` — a defect, error condition, or incorrect behavior is corrected
- A single commit may produce bullets in more than one category if it genuinely introduces distinct effects (e.g., removes a broken behavior and replaces it with a new one)

**Breaking changes:** If a commit removes or renames a public API, changes a default in a backward-incompatible way, or requires callers to update their code, prefix the bullet with `**Breaking:**` before the category label. Example: `- **Breaking:** **Changed:** Renamed \`foo\` to \`bar\``. Surfacing breaking changes is mandatory — they must not be flattened into generic `Changed` bullets.

**"Related commits" definition:** Two or more commits are related when they implement the same feature or fix, evidenced by (a) shared or adjacent `FILES` entries in the same module or (b) explicit cross-referencing in their `BODY` text. When merging, list all contributing SHAs in findings.md. A commit may not be merged into another if doing so would suppress a distinct user-visible behavior — each distinct user-visible change must appear in at least one bullet.

**Synthesis is bounded to script output:** Bullets must be grounded solely in each commit's `SUBJECT`, `BODY`, and `FILES` from the script output. The agent must not inspect the actual diff or any file outside the script output.

**Root-level and out-of-surface files are intentionally excluded:** `README.md`, `CHANGELOG.md`, `scripts/**`, and root-level configs are classified `infra` by default and never contribute to any surface. This is a deliberate product boundary — changes to install scripts, root docs, and tooling configs do not appear in the changelog. If this boundary should change for a future release, update the lookup table in `gather_commits.sh` before running the skill.

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
