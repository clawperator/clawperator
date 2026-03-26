# Release Notes — Work Breakdown

Parent plan: `tasks/release-notes/plan.md`

Branch: `feat/release-notes`

This work ships as **3 PRs**, sequenced. Do not start a PR until the previous one is merged.

| PR | Scope | Phases |
|----|-------|--------|
| PR-1 | Skill implementation | Phase 1 + Phase 2 |
| PR-2 | CHANGELOG backfill and findings | Phase 3 + Phase 4 |
| PR-3 | Wire CHANGELOG into release workflow | Phase 5 |

---

## Hard Rules

- **Diff determines surface, not message.** Never classify a commit by its subject line. Always inspect the changed file paths.
- **No raw commit messages in output.** Every bullet point in the final CHANGELOG must be a synthesized, user-facing sentence. Do not copy-paste commit subjects verbatim.
- **One commit per logical step.** Do not batch unrelated changes. The expected commit messages are listed in each task below.
- **findings.md is the running log.** Every phase must write or update `tasks/release-notes/findings.md` before committing. It is the paper trail — include script output, classification decisions, and any surprises.
- **Rerun safety is structural, not content-identical.** The skill is safe to run multiple times in the sense that reruns never corrupt `CHANGELOG.md` (the upsert rule prevents duplicate blocks). However, the LLM synthesis step may produce different prose on rerun — that is expected and acceptable. Once a CHANGELOG entry is committed, it is the canonical form. Do not regenerate it without intent; editing the committed entry by hand is preferable to a full regeneration.
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
2. Print the release date line using the annotated tag's creation date (not the tagged commit's author date): `RELEASE_DATE: $(git for-each-ref --format='%(creatordate:short)' "refs/tags/$END_TAG")`. This is the correct "when was this version released" date for annotated tags.
3. Iterate commits in chronological order (oldest first): `git log --reverse --format="%H" "$START_TAG..$END_TAG"`.
4. For each commit SHA:
   - Get the subject: `git log -1 --format="%s" "$SHA"`
   - Get the body: `git log -1 --format="%b" "$SHA"`
   - Get changed files with `git diff-tree --no-commit-id --name-only -r -m "$SHA" | sort -u` so merge commits and direct commits are handled consistently
   - Extract PR number if present in subject (pattern: `(#NNN)` at end of subject line)
   - Classify surfaces by checking changed files against these exact rules (exclusions take precedence over inclusions):
     ```
     Node:    INCLUDE apps/node/**
              EXCLUDE apps/node/node_modules/**, apps/node/dist/**, apps/node/coverage/**

     Android: INCLUDE apps/android/**
              EXCLUDE apps/android/build/**, apps/android/app/build/**, apps/android/**/generated/**

     Docs:    INCLUDE docs/**, sites/docs/**, sites/landing/**
              EXCLUDE docs/internal/**,
                      sites/docs/AGENTS.md, sites/docs/requirements.txt,
                      sites/landing/public/sitemap.xml, sites/landing/public/landing-sitemap.xml
              (qualify as Docs only if at least one non-excluded file remains)
     ```
   - If no user-facing surface detected after applying exclusions, mark as `INFRA`
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

### Tests

Create `.agents/skills/release-notes-author/scripts/test_gather_commits.sh`. It must:

- Pass: `gather_commits.sh v0.5.0 v0.5.1` exits 0 and output contains `RELEASE_DATE:` on first non-empty line.
- Pass: output for the range contains at least one `=== COMMIT` block.
- Fail: `gather_commits.sh` with no args exits non-zero and prints usage to stderr.
- Fail: `gather_commits.sh invalid-tag v0.5.1` exits non-zero (git will error; script must not silently produce empty output).

Run tests as part of the Phase 1 commit — they must pass before committing.

### Acceptance

- Script runs from repo root without error.
- Output contains one `=== COMMIT ===` block per commit in range.
- `RELEASE_DATE:` is the first non-empty line of output, format `RELEASE_DATE: YYYY-MM-DD`.
- INFRA commits are marked clearly and do not leak into surface-tagged output.
- A commit touching both `apps/node/` and `docs/` shows `SURFACES: node docs`.
- A commit touching only `docs/internal/` shows `SURFACES: INFRA`.
- All four test cases in `test_gather_commits.sh` pass.

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
   - For every commit with a named surface, inspect the `FILES:` list to determine whether the changes are user-facing. Classification says what was touched; synthesis decides whether it warrants a bullet. Examples of non-bullet-worthy changes despite touching a named surface:
     - `apps/node/package.json` with only a version field bump (release mechanic, not a feature)
     - `sites/docs/static/llms-full.txt` or `sites/landing/public/llms-full.txt` updates that are regenerated site artifacts (no bullet unless the content change is substantive and user-driven)
     - Any file where the entire change is a version string, timestamp, or auto-generated metadata
   - When dropping a non-INFRA commit as noise, log it explicitly in findings.md under "Synthesis choices" with the SHA and reason. Never drop silently.
   - For all remaining commits, group by surface: node, docs, android.
5. Synthesize each group into bullet points using the categories `Added`, `Changed`, `Fixed`. Rules:
   - Write in second-person imperative or past tense, user-facing (e.g., "Added `read-value` action for extracting text from UI elements").
   - Never copy a raw commit subject verbatim. Rewrite it as a user-facing benefit.
   - Merge related commits into a single bullet where appropriate; note the merged SHAs in findings.md.
   - Multi-surface commits appear in each relevant section. The wording may differ per section to reflect what changed in that surface specifically.
   - If dropping a commit as noise (lock files, generated content, infra-only), note the SHA and reason in findings.md under "Synthesis choices".
   - If a section has no non-infra changes, omit the section entirely.
   - Order within each section: Added first, then Changed, then Fixed.
   - **Traceability:** before writing the CHANGELOG block, record in findings.md a mapping of every non-INFRA commit SHA → the bullet(s) it contributes to (or "dropped: <reason>"). This is the audit trail.
6. Write the high-level summary sentence (one or two sentences describing the release as a whole).
7. Assemble the full block per the format in `tasks/release-notes/plan.md`.
8. Apply the upsert rule to `CHANGELOG.md`:
   - Search for an existing `## [<version>]` header.
   - **If found:** replace the entire block from that header up to (but not including) the next `## [` line with the newly generated block.
   - **If not found:** insert the new block above the first existing `## [x.y.z]` entry (below any `## [Unreleased]` content).
   - Never modify any other versioned entry.
9. Verify: confirm no duplicate version headers exist and entries are in descending chronological order.

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
2. Create `tasks/release-notes/findings.md`. Use this structure:

   ```markdown
   ## v0.5.1 Run

   ### Script output
   <paste full output verbatim>

   ### Classification summary
   | Commit | Subject | Surfaces | Notes |
   |--------|---------|----------|-------|
   | abc1234 | feat(node): ... | node | |
   | def5678 | chore(build): ... | INFRA | version bump |

   ### Mismatches
   List any commits where the subject line claimed one surface but the diff showed another.
   Example: "abc1234 subject says feat(node) but diff also touched docs/api/ → classified as node, docs"

   ### Synthesis choices
   Note any judgment calls made during synthesis:
   - Which related commits were merged into a single bullet
   - Any commits omitted as noise (lock files, generated content) and why
   - Tone or wording decisions that were non-obvious

   ### Draft entry (before insertion)
   <paste the full markdown block before it was written to CHANGELOG.md>
   ```
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
- `tasks/release-notes/findings.md` exists with all five sections: script output, classification summary table, mismatches, synthesis choices (with commit→bullet mapping for every non-INFRA commit), and draft entry.
- Every non-INFRA commit from the script output is accounted for in the commit→bullet mapping — either mapped to a bullet or explicitly dropped with a reason. No silent omissions.
- No existing CHANGELOG entries were modified or deleted.
- The entry contains no raw commit subjects.
- Rerunning the skill produces the same CHANGELOG entry without creating a duplicate `## [0.5.1]` block.

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
2. Update `tasks/release-notes/findings.md` with a new `## v0.5.0 Run` section using the same structure as Phase 3. Additionally record:
   - Any ambiguous commits and how they were resolved (this range is larger and more likely to have ambiguity)
   - Any cases where the commit message was misleading vs. the actual diff
   - Observations about synthesis quality compared to Phase 3 (did the approach scale? anything the SKILL.md should say differently?)
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
- findings.md `## v0.5.0 Run` section contains the commit→bullet mapping for all non-INFRA commits. No silent omissions.
- No existing entries modified.
- Rerunning the skill produces the same entry without a duplicate `## [0.5.0]` block.

### Expected commit

```
docs(changelog): backfill release notes for v0.5.0
```

---

---

## Phase 5: Wire CHANGELOG into GitHub Release

**Goal:** Modify the "Create release notes" step in `.github/workflows/release-apk.yml` so that each GitHub Release body includes the corresponding CHANGELOG block, in addition to the existing install links and artifact metadata.

**Prerequisite:** PR-2 merged — `CHANGELOG.md` must contain entries for `0.5.0` and `0.5.1` before this step is wired.

**Context:** Read `.github/workflows/release-apk.yml` lines 145–175. The "Create release notes" step currently writes `release-notes.md` with install links only. This phase appends the changelog block to that file.

### Steps

1. In the "Create release notes" step, after the existing `cat <<'EOF' > release-notes.md` block, add a Python extraction step:

   ```bash
   python - <<'PY'
   import re, sys

   version = "${{ steps.release_meta.outputs.version }}"
   try:
       with open("CHANGELOG.md", "r", encoding="utf-8") as f:
           content = f.read()
   except FileNotFoundError:
       print(f"Error: CHANGELOG.md not found. Run release-notes-author before tagging.", file=sys.stderr)
       sys.exit(1)

   pattern = rf'(## \[{re.escape(version)}\].*?)(?=\n## \[|\Z)'
   match = re.search(pattern, content, re.DOTALL)
   if match:
       with open("release-notes.md", "a", encoding="utf-8") as out:
           out.write("\n\n---\n\n")
           out.write(match.group(1).strip())
           out.write("\n")
   else:
       print(f"Error: No CHANGELOG entry found for {version}. Run release-notes-author before tagging.", file=sys.stderr)
       sys.exit(1)
   PY
   ```

2. The step fails hard if `CHANGELOG.md` is missing or if no block exists for the version. This enforces the operational precondition: `release-notes-author` must be run and the CHANGELOG entry merged before cutting the release tag.

### Acceptance

- GitHub Release body for a future release contains both the install links block and the changelog block separated by `---`.
- If `CHANGELOG.md` is missing or has no entry for the version, the workflow step exits non-zero and the release fails with a clear error message.
- No other steps in the workflow are modified.

### Expected commit

```
feat(release): include CHANGELOG entry in GitHub Release body
```

---

## Done State

The task is complete when:

- [ ] `.agents/skills/release-notes-author/SKILL.md` exists
- [ ] `.agents/skills/release-notes-author/scripts/gather_commits.sh` exists and is executable
- [ ] `.agents/skills/release-notes-author/scripts/test_gather_commits.sh` exists and all cases pass
- [ ] `CHANGELOG.md` contains entries for `0.5.1` and `0.5.0` in correct chronological order
- [ ] `tasks/release-notes/findings.md` contains commit→bullet mapping for both runs with no silent omissions
- [ ] All entries are user-facing prose, no raw commit subjects
- [ ] Rerunning the skill for an already-present version replaces the block without creating a duplicate
- [ ] `.github/workflows/release-apk.yml` appends the CHANGELOG block to the release body
- [ ] All 5 expected commits exist with the specified messages
