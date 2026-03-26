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
- **Rerun safety is structural only.** Reruns never corrupt `CHANGELOG.md` — the upsert rule prevents duplicate blocks and the header/section structure is deterministic. Bullet prose may differ between runs; that is expected and acceptable. The structural guarantee is: same `## [x.y.z]` header, same sections present/absent (determined by which surfaces have `keep` commits), no duplicate version blocks. Once an entry is committed it is canonical — prefer hand-editing over full regeneration.
- **The LLM does not filter commits.** Every `keep` commit must produce at least one bullet or be explicitly escalated (logged in findings.md as "no user-facing change despite keep classification" with the SHA and reason). The LLM cannot silently omit a `keep` commit. Drop decisions are the script's responsibility only.
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
2. Print the release date line: `RELEASE_DATE: $(git for-each-ref --format='%(creatordate:short)' "refs/tags/$END_TAG")`. For annotated tags this is the tag creation date; for lightweight tags it falls back to the commit's committer date — both are acceptable. If the output is empty (tag does not exist), exit non-zero with `error: tag '<END_TAG>' not found`.
3. Iterate commits in chronological order (oldest first): `git log --reverse --format="%H" "$START_TAG..$END_TAG"`.
4. For each commit SHA:
   - Get the subject: `git log -1 --format="%s" "$SHA"`
   - Get the body: `git log -1 --format="%b" "$SHA"`
   - Get changed files with `git diff-tree --no-commit-id --name-only -r -m "$SHA" | sort -u` so merge commits and direct commits are handled consistently
   - Extract PR number if present in subject (pattern: `(#NNN)` at end of subject line)
   - For each changed file, assign a type using this hardcoded lookup (first match wins):
     ```
     infra:     apps/node/src/test/**, apps/android/app/src/test/**,
                apps/android/app/src/androidTest/**,
                apps/node/node_modules/**, apps/node/dist/**, apps/node/coverage/**,
                apps/android/build/**, apps/android/app/build/**, apps/android/**/generated/**,
                .agents/**, .github/**, tasks/**, docs/internal/**,
                sites/docs/AGENTS.md, sites/docs/requirements.txt,
                sites/landing/public/sitemap.xml, sites/landing/public/landing-sitemap.xml,
                detekt*.yml, detekt-baseline.xml

     generated: apps/node/package-lock.json,
                sites/docs/static/llms-full.txt, sites/docs/static/llms.txt,
                sites/landing/public/llms-full.txt, sites/landing/public/llms.txt

     config:    apps/node/package.json,
                sites/docs/mkdocs.yml, sites/docs/source-map.yaml,
                gradle/**, build.gradle.kts, settings.gradle.kts,
                gradle.properties, local.properties

     src:       everything else IN a named surface path (default for in-surface files)

     infra:     everything else NOT in any named surface path (default for out-of-surface
                files — covers CHANGELOG.md, README.md, scripts/**, root-level configs,
                sites/docs/.build/**, sites/docs/site/**)
     ```
   - Determine the surface(s) touched: a file contributes to a named surface (`node`, `android`, `docs`) if its type is `src`, `generated`, or `config` (NOT `infra`) and it falls under that surface's path prefix. Files typed `infra` never contribute to any surface.
   - Determine the commit classification:
     - `keep` — at least one `src` file in any named surface
     - `drop:no-src` — named-surface files exist (config and/or generated), but none are `src`
     - `drop:infra` — no named-surface files at all
5. Print each commit in this exact format:
   ```
   === COMMIT <sha> ===
   SUBJECT: <subject>
   PR: #<number>         (omit if no PR number)
   SURFACES: node docs   (named surfaces with src/generated/config files; omit if none)
   CLASSIFICATION: keep
   FILES:
     apps/node/src/foo.ts  [src]
     docs/api/bar.md  [src]
     sites/docs/static/llms-full.txt  [generated]
   BODY:
     <body indented 2 spaces; omit section if empty>
   === END ===
   ```
   For a dropped commit:
   ```
   === COMMIT <sha> ===
   SUBJECT: chore(build): set code version to 0.5.1
   SURFACES: node
   CLASSIFICATION: drop:no-src
   FILES:
     apps/node/package.json  [config]
     apps/node/package-lock.json  [generated]
   === END ===
   ```

### Usage

```bash
cd "$(git rev-parse --show-toplevel)"
bash .agents/skills/release-notes-author/scripts/gather_commits.sh v0.5.0 v0.5.1
```

### Tests

Create `.agents/skills/release-notes-author/scripts/test_gather_commits.sh`. It must:

- Pass: `gather_commits.sh v0.5.0 v0.5.1` exits 0 and `RELEASE_DATE:` is the first non-empty output line.
- Pass: output contains at least one `=== COMMIT` block with a `CLASSIFICATION:` line.
- Pass: commit `b2f7234` (version-bump, touches `package.json` + test files) has `CLASSIFICATION: drop:no-src` — test files are `infra`, package.json is `config`, so no `src` files in any surface.
- Pass: a known `src`-touching commit in the `v0.5.0→v0.5.1` range has `CLASSIFICATION: keep`.
- Pass: `apps/node/src/test/unit/foo.test.ts` is annotated `[infra]`, not `[src]`.
- Fail: `gather_commits.sh` with no args exits non-zero and prints usage to stderr.
- Fail: `gather_commits.sh invalid-tag v0.5.1` exits non-zero.

Run tests as part of the Phase 1 commit — they must pass before committing.

### Acceptance

- Script runs from repo root without error.
- `RELEASE_DATE:` is the first non-empty line of output, format `RELEASE_DATE: YYYY-MM-DD`.
- Every commit block has a `CLASSIFICATION:` line (`keep`, `drop:no-src`, or `drop:infra`).
- Every file in the `FILES:` list has a type annotation (`[src]`, `[generated]`, `[config]`, or `[infra]`).
- The version-bump commit `b2f7234` shows `CLASSIFICATION: drop:no-src` (package.json is config, test files are infra — no src files).
- A commit touching `apps/node/src/**` shows `CLASSIFICATION: keep`.
- All six test cases in `test_gather_commits.sh` pass.

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
4. Review every commit block using only the `CLASSIFICATION:` line — do not re-derive keep/drop from the file list:
   - `CLASSIFICATION: drop:no-src` or `drop:infra` → skip entirely, log SHA + classification in findings.md **classification summary table**. Never drop silently.
   - `CLASSIFICATION: keep` → include; group by surface using the `SURFACES:` line.
   - The SKILL.md must include this quick-reference table so the agent does not second-guess the script:

     | Path example | Type | Classification result |
     |---|---|---|
     | `apps/node/src/cli/index.ts` | src | keep |
     | `apps/node/src/test/unit/foo.test.ts` | infra | drop:infra (test files never keep) |
     | `apps/node/package.json` alone | config | drop:no-src |
     | `apps/node/package.json` + `package-lock.json` | config + generated | drop:no-src |
     | `sites/docs/static/llms-full.txt` alone | generated | drop:no-src |
     | `docs/api/actions.md` + `llms-full.txt` | src + generated | keep (src present) |
5. Synthesize `keep` commits into bullet points using the categories `Added`, `Changed`, `Fixed`. Rules:
   - Write in second-person imperative or past tense, user-facing (e.g., "Added `read-value` action for extracting text from UI elements").
   - Never copy a raw commit subject verbatim. Rewrite it as a user-facing benefit.
   - Merge related commits into a single bullet where appropriate; note the merged SHAs in findings.md.
   - Multi-surface commits appear in each relevant section. The wording may differ per section to reflect what changed in that surface specifically.
   - If a section has no `keep` commits, omit the section entirely.
   - Order within each section: Added first, then Changed, then Fixed.
   - **Traceability:** before writing the CHANGELOG block, record in findings.md a mapping of every `keep` commit SHA → the bullet(s) it contributes to. Every `drop:*` commit must already be logged from step 4. No commit may be silently unaccounted for.
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
   | Commit | Subject | Classification | Surfaces | Notes |
   |--------|---------|---------------|----------|-------|
   | abc1234 | feat(node): ... | keep | node | |
   | def5678 | chore(build): set code version | drop:no-src | node | package.json [config] + test files [infra] |

   ### Mismatches
   List any commits where the subject line claimed one surface but the diff showed another.
   Example: "abc1234 subject says feat(node) but diff also touched docs/api/ → classified as node, docs"

   ### Synthesis choices
   Note any judgment calls made during synthesis:
   - Which related `keep` commits were merged into a single bullet (list all SHAs)
   - Any `keep` commits escalated as "no user-facing change despite classification" (SHA + reason)
   - Tone or wording decisions that were non-obvious
   - Note: `drop:*` commits are logged in the classification summary, not here

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
- `tasks/release-notes/findings.md` exists with all five sections: script output, classification summary table, mismatches, synthesis choices (with commit→bullet mapping for every `keep` commit), and draft entry.
- Every commit in the script output is accounted for in findings.md: `keep` commits map to a bullet (or are escalated with reason); `drop:*` commits are logged with their classification. No silent omissions.
- No existing CHANGELOG entries were modified or deleted.
- The entry contains no raw commit subjects.
- Rerunning the skill produces no duplicate `## [0.5.1]` block and the same sections are present/absent (structural idempotency). Bullet prose may differ between runs.

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
- findings.md `## v0.5.0 Run` section accounts for every commit in script output: `keep` commits mapped to bullets (or escalated), `drop:*` commits logged. No silent omissions.
- No existing entries modified.
- Rerunning the skill produces no duplicate `## [0.5.0]` block and the same sections are present/absent. Bullet prose may differ between runs.

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
   if not re.match(r'^\d+\.\d+\.\d+$', version):
       print(f"Error: version '{version}' is not in 0.0.0 format; cannot match CHANGELOG entry.", file=sys.stderr)
       sys.exit(1)

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
