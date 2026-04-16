---
name: task-cleanup
description: Close out a completed task pack under tasks/. Migrates durable knowledge to permanent homes, removes stale phase-reference comments from code, triages task-pack and plan-vs-code gaps, and deletes the task folder. Use when a task pack is done and ready to be retired.
---

# Task Cleanup

Close out a completed task pack safely. Do not delete the task folder until all three cleanup gates pass.

Run: `$task-cleanup <task-path>`

`<task-path>` is the path to the task folder relative to the repo root, e.g. `tasks/node/api-refactor` or `tasks/geo`.

If no path is given, list current task folders and ask which one to clean up.

## Agents Metadata

`agents/openai.yaml` is UI metadata for skill lists and default prompting. It is not an extra workflow document and it does not override `SKILL.md`.

Keep it aligned with this skill:

- `display_name` should stay human-readable
- `short_description` should describe the real job of the skill
- `default_prompt` should point the agent at the actual workflow in this file

When `SKILL.md` meaning changes materially, update `agents/openai.yaml` in the same change.

## Core Model

A task pack is temporary scaffolding. The cleanup agent's job is to make sure nothing important disappears with it.

The three cleanup gates are:

1. **Knowledge migration** - Every piece of information in the task pack that a future agent would need has been moved to a durable home.
2. **Code hygiene** - No stale phase or task references remain in the codebase.
3. **Plan fidelity** - The delivered code matches the task plan well enough to ship without concern; standout gaps are flagged.

All three gates must pass before the task folder is deleted.

## Workflow

1. Read the task pack.
   - Read every file in the task folder: `plan.md`, `work-breakdown.md`, `findings.md`, `finalization-items.md`, and any phase-specific files.
   - Build a complete picture of: what was planned, what decisions were made, what was deferred, what the task itself said should be migrated to durable docs, and what it failed to say explicitly.
   - Treat missing durable destinations, missing acceptance criteria, missing validation steps, or contradictory instructions in the task pack as cleanup findings, not as invisible background noise.
2. Run Gate 1: Knowledge migration.
   - See the Knowledge Migration section below.
3. Run Gate 2: Code hygiene.
   - See the Code Hygiene section below.
4. Run Gate 3: Plan fidelity.
   - See the Plan Fidelity section below.
5. Report results.
   - Summarize what was migrated, what was cleaned, and any flagged gaps.
   - For each gap, state whether it is fixed, deferred into durable follow-up, or accepted as intentional variance.
   - If any gate has an unresolved blocker, stop here and present it for user decision.
6. Delete the task folder.
   - Only after all gates pass and any blockers are resolved or explicitly accepted by the user.
   - Delete the entire task folder: `rm -rf <task-path>`.
   - Commit the deletion with a `chore:` commit.

## Gate 1: Knowledge Migration

Identify every piece of information in the task pack that belongs in a durable home and verify it has been placed there.

Also identify any durable knowledge that was only implied by the task pack but never written down clearly enough for a future agent to recover without guesswork. If the task pack leaves a required durable destination unstated, either route the content to the correct durable home and note the omission, or flag the omission as a prompt gap if it cannot be repaired safely from the available evidence.

### What to look for

Scan the task pack for:

- Design decisions and rationale that influenced implementation choices
- API behavior, contract constraints, or envelope semantics that were discovered or clarified during execution
- Warnings, caveats, or gotchas that a future agent would need to avoid mistakes
- Setup, configuration, or device-prep steps that are not yet in `docs/`
- Skill authoring guidance or agent-facing behavior notes
- Findings, anomalies, or measurement results (especially from `findings.md`) that describe current system behavior
- Deferred items from `finalization-items.md` that are still actionable
- Implied follow-up work that should have been captured in `finalization-items.md` or another durable home

### What to ignore

Do not try to migrate:

- Ephemeral execution notes with no future value (e.g., "ran step 3 on Tuesday")
- Task status tracking (phase progress, who did what)
- Content that is already captured verbatim in the permanent docs or code
- Change history or "we used to do X" context - the git log owns that

### Where knowledge goes

Use this routing table. The first matching row wins.

| Knowledge type | Durable home |
| --- | --- |
| Public API, CLI behavior, error codes, result envelope | `docs/` (authored source), regenerated via `.agents/skills/docs-build/` |
| Device setup, install, or config steps | `docs/setup.md` or adjacent authored doc |
| Internal design guidance, engineering expectations | `docs/internal/design/` |
| Agent-facing skill behavior or skill authoring guidance | `.agents/skills/<skill-name>/SKILL.md` |
| Contract invariants that belong in code comments | `apps/node/src/contracts/` or the relevant source file |
| Android operator behavior or caveats | `apps/android/` source comments or `docs/` |
| Repo-local maintenance or skill workflow notes | `.agents/skills/<skill-name>/SKILL.md` or `docs/internal/` |

Do not write "update the docs" or "capture this somewhere." Name the destination file path.

### How to verify migration

For each piece of durable information:

1. Identify the target file from the routing table.
2. Read the target file.
3. Confirm the information is present and accurate.
4. If it is missing or incomplete, write it now before proceeding to Gate 2.

If the task pack explicitly named durable destinations in its `Durable Follow-Up` or `finalization-items.md` sections, treat those as the authoritative migration list and verify each one.

If the task pack leaves a durable destination implicit, use the routing table and repo context to choose the correct home. If the right home cannot be established confidently, report that as a task-pack gap and do not silently drop the knowledge.

If docs were updated, run `./scripts/docs_build.sh` and confirm it succeeds before treating the docs gate as closed.

### Commit cadence

Commit each migration as a focused `docs:` or `chore:` commit as you complete it. Do not batch all migrations into one commit.

## Gate 2: Code Hygiene

Find and remove all stale task or phase references that would be meaningless after the task folder is deleted.

### What to find

Search the entire codebase (source files, comments, strings, tests, docs under `docs/`, and scripts) for:

- Phase references: `Phase 1`, `Phase 2`, `Phase N`, `PR-1`, `PR-2`, `PR-N`
- Task-specific labels: `implemented in Phase`, `added in PR`, `see task`, `per task pack`, `TODO: Phase`, `FIXME: Phase`
- Direct references to the task folder path, e.g. `tasks/node/api-refactor`
- Any comment that anchors meaning to a task-pack artifact that will no longer exist

Use grep to find candidates:

```bash
grep -rn --include="*.ts" --include="*.kt" --include="*.md" --include="*.sh" \
  -E "(Phase [0-9]|PR-[0-9]|implemented in Phase|added in PR|see task|per task|TODO:.*[Pp]hase|FIXME:.*[Pp]hase)" \
  . --exclude-dir=tasks --exclude-dir=.git --exclude-dir=node_modules
```

Also search specifically for the task folder name:

```bash
grep -rn --include="*.ts" --include="*.kt" --include="*.md" --include="*.sh" \
  "<task-folder-name>" . --exclude-dir=tasks --exclude-dir=.git --exclude-dir=node_modules
```

### What to do with findings

For each match:

- If the comment describes behavior that is self-evident from the code: delete the comment.
- If the comment explains a non-obvious implementation decision: rewrite it to stand alone, without referencing a phase or task pack.
- If the reference is in a test file and refers to a phase-scoped test case label: rename it to describe behavior, not phase membership.
- If the reference is in a changelog or release note that is already published: leave it. Published history is not a dead link.

Do not delete comments that describe *why* something was done in a way that is not obvious from the code. Rewrite them to remove the phase anchor, keep the explanation.

### Commit cadence

Commit each set of hygiene fixes as a focused `chore:` or `fix:` commit. Do not batch code hygiene with knowledge migration.

## Gate 3: Plan Fidelity

Compare the final code state against what the task pack planned. Flag meaningful gaps; do not block on expected variance.

### What to compare

Read the task pack's `plan.md` and `work-breakdown.md` acceptance criteria. For each phase or deliverable:

1. Verify the primary deliverable exists and is in the expected location.
2. Check that the acceptance criteria listed in `work-breakdown.md` are met.
3. Run the validation commands listed in each phase's `Validation` section if they are still applicable and safe to run.

For Node changes:

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

For docs changes:

```bash
./scripts/docs_build.sh
```

For Android changes: check whether assemble and unit tests pass if a device is not available.

### What variance is acceptable

Expected variance - do not flag these:

- Implementation details differ from the plan as long as the observable behavior matches the acceptance criteria
- Phase ordering was adjusted during execution
- A planned file was renamed or reorganized for clarity
- The implementation is simpler or more complete than planned

Flag these as standout gaps:

- A deliverable named in `plan.md` is missing from the codebase entirely
- A contract, API shape, or CLI behavior described in `plan.md` was not implemented
- An acceptance criterion in `work-breakdown.md` explicitly fails
- A durable follow-up item in `plan.md` or `finalization-items.md` has no corresponding docs or code change
- A test was explicitly required but is absent

### Gap Triage

When Gate 3 surfaces a gap, or when the task pack itself is under-specified, classify the issue before deciding whether the task pack can be deleted:

- **Fix now** - The gap is small, local, and can be resolved without reopening the task pack or changing the intended scope.
- **Defer** - The gap is real work that should survive cleanup. Move it into durable follow-up, a new task pack, or another durable home with enough detail for the next agent to act on it.
- **Accept** - The gap is deliberate variance, already risk-assessed, and does not block shipping.

For each unresolved gap, write down:

- what was planned
- what exists now
- why the gap matters
- the recommended disposition
- whether the disposition needs user confirmation

Do not treat a gap as resolved until it has one of those three dispositions.

### Prompt Gaps

Some cleanup findings are gaps in the task pack, not in the delivered code. Treat these as first-class cleanup work.

Examples:

- a task pack says "document this somewhere durable" but never names the destination
- a task pack implies follow-up work but never records it in `finalization-items.md`
- a task pack asks for validation but does not say which checks prove success
- a task pack contains contradictory instructions that would make execution ambiguous

For prompt gaps:

- repair the task pack if the missing detail can be recovered confidently from repo context
- otherwise record the omission as a gap and recommend the correct durable home or follow-up task
- if the gap would change the meaning of the task pack materially, stop and ask the user before deleting anything

### How to report

Produce a short gap report with two sections:

**Verified complete:**
- List deliverables and acceptance criteria that passed.

**Flagged gaps:**
- List each gap with: what was planned, what exists, and a suggested resolution.
- For each gap, state the recommended disposition and ask the user to confirm if it is not already fixed.

Do not delete the task folder until the user has resolved or accepted all flagged gaps.

## Deletion

After all three gates pass and any flagged gaps are resolved or accepted:

```bash
rm -rf <task-path>
```

Commit:

```text
chore(tasks): delete <task-name> task pack after cleanup
```

If the task pack was the last entry in its scoped directory (e.g., `tasks/node/` is now empty), delete the empty directory in the same commit.

## Hard Rules

- Do not delete the task folder until all three gates pass.
- Do not skip Gate 1 because "the docs look fine." Read the task pack and verify explicitly.
- Do not batch Gate 1 migrations and Gate 2 hygiene fixes in the same commit.
- Do not flag implementation variance as a gap unless an acceptance criterion explicitly fails or a named deliverable is missing.
- Do not rewrite published release notes or changelogs to remove phase references.
- If a migration requires docs regeneration, run `./scripts/docs_build.sh` and confirm it passes before committing the docs change.
- When in doubt about whether a piece of knowledge is durable, ask: "Would a future agent working on this surface need this to avoid a mistake?" If yes, migrate it.

## Common Failure Patterns

Prevent these explicitly:

- Deleting the task folder before verifying Gate 1 - this is the most common failure mode
- Migrating knowledge to the wrong surface (e.g., writing impl notes to `tasks/` instead of `docs/internal/design/`)
- Treating "the docs were updated during the task" as proof of migration without reading the docs to verify
- Removing a comment that explains a non-obvious decision instead of rewriting it to stand alone
- Running Gate 3 validation only against the task pack text and not against the actual code
- Accepting a flagged gap without presenting it to the user for an explicit decision
- Leaving `finalization-items.md` deferred items unresolved and untracked after deletion
