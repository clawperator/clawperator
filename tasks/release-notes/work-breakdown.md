# Release Notes — Work Breakdown

Parent plan: `tasks/release-notes/plan.md`

Branch: `feat/release-notes`

This work ships as **2 PRs**, sequenced. PR-1 delivers the skill. PR-2 delivers the CHANGELOG backfill using the skill.

| PR | Scope | Phases |
|----|-------|--------|
| PR-1 | Skill implementation | Phase 1 + Phase 2 |
| PR-2 | CHANGELOG backfill and findings | Phase 3 + Phase 4 |

---

## Hard Rules

- **Diff determines surface, not message.** Never classify a commit by its subject line. Always inspect the changed file paths.
- **No raw commit messages in output.** Every bullet point in the final CHANGELOG must be a synthesized, user-facing sentence. Do not copy-paste commit subjects verbatim.
- **One commit per logical step.** Do not batch unrelated changes. The expected commit messages are listed in each task below.
- **findings.md is the running log.** Every phase must write or update `tasks/release-notes/findings.md` before committing. It is the paper trail — include script output, classification decisions, and any surprises.
- **Rerun safety.** The skill must be safe to run multiple times. Overwrite the generated block, do not append duplicates.
- **Proceed on uncertainty, log it.** If a commit's surface is ambiguous, make a judgment call, note it in findings.md, and continue.

---

## Context: Files to Read Before Starting

Read these before writing any code:

| File | Why |
|------|-----|
| `tasks/release-notes/plan.md` | Strategy and surface boundary rules |
| `.agents/skills/release-create/SKILL.md` | Reference format for a well-structured skill in this repo |
| `.agents/skills/release-create/scripts/create_release.sh` | Reference bash script style used in this repo |
| `.agents/skills/docs-build/SKILL.md` | Reference for a skill that runs a script then synthesizes output |
| `CHANGELOG.md` | Current state — understand what's there before inserting |
| `.github/workflows/release-apk.yml` | Understand how releases currently work (no changes needed now) |

---

## Phase 1: gather_commits.sh

**Goal:** Create a bash script that accepts positional `<start-tag> <end-tag>` arguments, iterates commits in that range, maps each commit's changed files to surfaces, and outputs structured text the agent can read and synthesize.

**Location:** `.agents/skills/release-notes-author/scripts/gather_commits.sh`

### Implementation

The script must:

1. Accept positional args: `<start-tag> <end-tag>` (e.g., `v0.5.0 v0.5.1`).
2. Print the release date line in a stable machine-readable form: `RELEASE_DATE: <YYYY-MM-DD>` using `git log -1 --format="%as" "$END_TAG"`.
3. Iterate commits in chronological order (oldest first): `git log --reverse --format="%H" "$START_TAG..$END_TAG"`.
4. For each commit SHA:
   - Get the subject: `git log -1 --format="%s" "$SHA"`
   - Get the body: `git log -1 --format="%b" "$SHA"`
   - Get changed files with `git diff-tree --no-commit-id --name-only -r -m "$SHA" | sort -u` so merge commits and direct commits are handled consistently
   - Extract PR number if present in subject (pattern: `(#NNN)` at end of subject line)
   - Classify surfaces by checking changed files against these exact rules:
     ```
     Node:    any file matching apps/node/*
     Android: any file matching apps/android/*
     Docs:    any file matching docs/*, sites/docs/*, or sites/landing/*
              MINUS any file matching docs/internal/*
              (a commit qualifies as Docs only if it has at least one non-internal docs file)
     ```
   - If no user-facing surface detected, mark surfaces as `INFRA` (version bumps, CI, tasks, .agents changes, lock-file-only changes)
5. Print each commit in this format:
   ```
   === COMMIT <sha> ===
   SUBJECT: <subject>
   PR: #<number>         (omit this line if no PR number found)
   SURFACES: node android docs   (space-separated, omit surfaces not touched)
   SURFACES: INFRA               (if no user-facing surface)
   FILES:
     apps/node/src/foo.ts
     docs/api/bar.md
   BODY:
     <body lines indented by 2 spaces, omit section if body is empty>
   === END ===
   ```

### Usage

```bash
cd "$(git rev-parse --show-toplevel)"
bash .agents/skills/release-notes-author/scripts/gather_commits.sh v0.5.0 v0.5.1
```

### Acceptance

- Script runs from repo root without error.
- Output contains one `=== COMMIT ===` block per commit in range.
- INFRA commits are marked clearly and do not leak into surface-tagged output.
- A commit touching both `apps/node/` and `docs/` shows `SURFACES: node docs`.
- A commit touching only `docs/internal/` shows `SURFACES: INFRA`.
- Add regression coverage for valid values, invalid values, missing values, and exit-code behavior.
- Structured output must remain stable enough for SKILL.md to parse the release date token without guessing.

### Expected commit

```
feat(release-notes): add gather_commits.sh script
```

---

## Phase 2: SKILL.md

**Goal:** Write the agent instructions that turn the script output into a finished CHANGELOG entry.

**Location:** `.agents/skills/release-notes-author/SKILL.md`

### Content the SKILL.md must cover

**Frontmatter:**
```yaml
---
name: release-notes-author
description: Generate and insert a CHANGELOG entry for a version range by gathering git commit data and synthesizing it into user-facing release notes grouped by product surface.
---
```

**Invocation section:** Show exactly how to call the skill:
```
Run: $release-notes-author v0.5.0 v0.5.1
```
Maps to:
```bash
bash .agents/skills/release-notes-author/scripts/gather_commits.sh <start-tag> <end-tag>
```

**Step-by-step instructions for the agent:**

1. Run the script. Print the full output before proceeding.
2. From `RELEASE_DATE:` line, extract the date.
3. The version is the end tag with the `v` prefix removed (e.g., `v0.5.1` → `0.5.1`).
4. Review every commit block:
   - Skip any commit with `SURFACES: INFRA` entirely.
   - Skip version-bump commits (`chore(build): set code version`) and published-version update commits (`docs(release): update published version`) even if they have surface tags — these are release mechanics, not user-facing changes.
   - For all remaining commits, group by surface: node, docs, android.
5. Synthesize each group into bullet points using the categories `Added`, `Changed`, `Fixed`. Rules:
   - Write in second-person imperative or past tense, user-facing (e.g., "Added `read-value` action for extracting text from UI elements").
   - Never copy a raw commit subject verbatim. Rewrite it as a user-facing benefit.
   - Merge related commits into a single bullet where appropriate.
   - If a section has no non-infra changes, omit the section entirely.
   - Order within each section: Added first, then Changed, then Fixed.
6. Write the high-level summary sentence (one or two sentences describing the release as a whole).
7. Assemble the full block per the format in `tasks/release-notes/plan.md`.
8. Insert the block into `CHANGELOG.md` immediately below the `## [Unreleased]` line and above any existing versioned `## [x.y.z]` entry. Do not delete or modify any existing entries.
9. Verify the insertion looks correct (no duplicate headers, correct chronological order).

**Surface section order** (must appear in this order, omit if empty):
1. `### 🤖 Node API & CLI`
2. `### 📚 Documentation & Website`
3. `### 📱 Android Operator APK`

### Acceptance

- SKILL.md contains frontmatter with correct `name` and `description`.
- All steps are explicitly numbered with exact commands.
- Format spec matches `tasks/release-notes/plan.md` exactly.
- The invocation syntax matches the script contract in Phase 1.

### Expected commit

```
feat(release-notes): add release-notes-author skill
```

---

## Phase 3: Backfill v0.5.0 → v0.5.1

**Goal:** Use the new skill to generate and insert the `0.5.1` CHANGELOG entry. Create `findings.md` documenting the process.

**This is the first real test.** The `v0.5.0`→`v0.5.1` range is small (mostly docs and a few Node additions), making it a good initial validation.

### Steps

1. Run the script and capture full output:
   ```bash
   bash .agents/skills/release-notes-author/scripts/gather_commits.sh v0.5.0 v0.5.1
   ```
2. Create `tasks/release-notes/findings.md`. Record:
   - Full script output (paste verbatim)
   - Which commits were classified as INFRA and why
   - Which commits contributed to which surfaces
   - Any mismatches found (commit message claimed X surface but diff showed Y)
   - The draft CHANGELOG entry before insertion
3. Follow SKILL.md instructions to synthesize and insert the `## [0.5.1]` entry into `CHANGELOG.md`.
4. Commit findings.md and CHANGELOG.md together.

### Expected CHANGELOG structure after this phase

```markdown
## [Unreleased]
...existing content...

## [0.5.1] - <date from tag>

<summary>

### 🤖 Node API & CLI
...

### 📚 Documentation & Website
...

## [0.1.0] - 2026-03-06
...
```

### Acceptance

- `CHANGELOG.md` contains a `## [0.5.1]` entry in correct position.
- `tasks/release-notes/findings.md` exists with script output and classification notes.
- No existing CHANGELOG entries were modified or deleted.
- The entry contains no raw commit subjects.

### Expected commit

```
docs(changelog): backfill release notes for v0.5.1
```

---

## Phase 4: Backfill v0.4.0 → v0.5.0

**Goal:** Run the skill on the larger `v0.4.0`→`v0.5.0` range (~22 commits, major API refactor). Update findings.md with observations.

The `v0.5.0` release introduced significant breaking changes to the CLI and API (flat command surface, registry-driven dispatch, new action types). The CHANGELOG entry should reflect this scope clearly.

### Steps

1. Run the script:
   ```bash
   bash .agents/skills/release-notes-author/scripts/gather_commits.sh v0.4.0 v0.5.0
   ```
2. Update `tasks/release-notes/findings.md` with a new section for this run. Record:
   - Full script output
   - Classification decisions for any ambiguous commits
   - Any cases where the commit message was misleading vs. the actual diff
   - Observations about synthesis quality compared to Phase 3
3. Follow SKILL.md instructions. Insert the `## [0.5.0]` entry into `CHANGELOG.md` below `## [0.5.1]` and above `## [0.1.0]`.
4. Commit findings.md update and CHANGELOG.md together.

### Expected CHANGELOG structure after this phase

```markdown
## [Unreleased]
...

## [0.5.1] - <date>
...

## [0.5.0] - <date>
...

## [0.1.0] - 2026-03-06
...
```

### Acceptance

- `## [0.5.0]` entry exists in correct chronological position.
- Entry captures the major API refactor and new action types under Node section.
- findings.md updated with Phase 4 observations.
- No existing entries modified.

### Expected commit

```
docs(changelog): backfill release notes for v0.5.0
```

---

## Done State

The task is complete when:

- [ ] `.agents/skills/release-notes-author/SKILL.md` exists
- [ ] `.agents/skills/release-notes-author/scripts/gather_commits.sh` exists and is executable
- [ ] `CHANGELOG.md` contains entries for `0.5.1` and `0.5.0` in correct order
- [ ] `tasks/release-notes/findings.md` contains observations from both runs
- [ ] All entries are user-facing prose, no raw commit subjects
- [ ] All 4 expected commits exist with the specified messages
