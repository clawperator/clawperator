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

**Classification vs synthesis:** Classification determines which surfaces a commit touched. It does not guarantee a changelog bullet. The synthesis step must further filter release-mechanic noise within a named surface (e.g., a version field bump in `package.json`, a regenerated `llms-full.txt`). Any non-INFRA commit dropped during synthesis must be logged in findings.md.

---

## Skill Design

Two files only:

```
.agents/skills/release-notes-author/
  SKILL.md               — agent instructions: run script, synthesize, write
  scripts/
    gather_commits.sh    — deterministic data gathering; structured text output
```

The script handles the deterministic work. The agent handles all judgment: synthesis, tone, signal vs. noise filtering, and writing the final CHANGELOG entry.

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

Sections that have no user-facing changes are omitted entirely. The date is the annotated tag's creation date, not the tagged commit's author date: `git for-each-ref --format='%(creatordate:short)' refs/tags/<end-tag>`.

---

## Configurability

The skill accepts positional tags `<start-tag> <end-tag>` (e.g., `v0.5.0` and `v0.5.1`). This supports both current-release and historical backfill use cases with the same invocation.

---

## CHANGELOG Insertion Rule (Upsert)

The skill is idempotent. The rule depends on whether a `## [x.y.z]` block for the target version already exists:

- **Block absent:** Insert the new block immediately above the first existing `## [x.y.z]` entry (i.e., below any `## [Unreleased]` content).
- **Block present:** Replace the entire existing block — from its `## [x.y.z]` header line up to (but not including) the next `## [` line — with the newly generated block.

Never delete or modify any other versioned entries. If the `[Unreleased]` block contains meaningful content, preserve it.

---

## Scope of This Task

1. Implement the `release-notes-author` skill (script + SKILL.md) in this repo at `.agents/skills/release-notes-author/`.
2. Backfill `CHANGELOG.md` for `v0.5.1` (small, mostly docs — good first test).
3. Backfill `CHANGELOG.md` for `v0.5.0` (larger, major API refactor — stress test).
4. Document findings in `tasks/release-notes/findings.md` as work proceeds.
5. Wire the CHANGELOG block into `.github/workflows/release-apk.yml` so GitHub Releases include it.

Out of scope for this task: docs site version number display (separate follow-on task).
