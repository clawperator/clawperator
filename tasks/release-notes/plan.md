# Release Notes — Plan

## Strategy

A single skill, `release-notes-author`, lives at `.agents/skills/release-notes-author/` in this repository. It gathers raw git data via a deterministic shell script, then the running agent synthesizes the data into formatted release notes. No external API calls and no separate LLM invocation — the agent executing the skill IS the LLM.

Notes are written to `CHANGELOG.md` at the repository root. The GitHub Release body is sourced from the relevant CHANGELOG block during the existing release workflow.

---

## Surface Boundaries

Surface classification is derived from **file diffs, not commit messages**. Commit messages are unreliable and must not be used for classification. A commit touching multiple surfaces appears in each relevant section.

| Surface | Paths | Notes |
|---------|-------|-------|
| 🤖 Node API & CLI | `apps/node/**` | |
| 📱 Android Operator APK | `apps/android/**` | |
| 📚 Documentation & Website | `docs/**`, `sites/docs/**`, `sites/landing/**` | Exclude `docs/internal/**` |
| *(omit)* | `docs/internal/**` | Internal only — never user-facing |
| *(omit)* | `.agents/**`, `.github/**`, `tasks/**`, build/CI config | Not user-facing |

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
- **Fixed:** ...
```

Sections that have no user-facing changes are omitted entirely. The date is the tag date of the end tag (`git log -1 --format="%as" <end-tag>`).

---

## Configurability

The skill accepts `--start-tag` and `--end-tag` (e.g., `v0.5.0` and `v0.5.1`). This supports both current-release and historical backfill use cases with the same invocation.

---

## CHANGELOG Insertion Rule

New entries are inserted **below the `## [Unreleased]` block header** and above any existing versioned entries. If the `[Unreleased]` block contains meaningful content, preserve it. If it contains only placeholder text, the agent may clear it. Never delete existing versioned entries.

---

## Scope of This Task

1. Implement the `release-notes-author` skill (script + SKILL.md) in this repo at `.agents/skills/release-notes-author/`.
2. Backfill `CHANGELOG.md` for `v0.5.1` (small, mostly docs — good first test).
3. Backfill `CHANGELOG.md` for `v0.5.0` (larger, major API refactor — stress test).
4. Document findings in `tasks/release-notes/findings.md` as work proceeds.

Out of scope: docs site version number display (separate task), GitHub Actions automation to invoke the skill during release (follow-on after skill is proven).
