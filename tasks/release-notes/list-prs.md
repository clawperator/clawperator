# Release Notes PR Index Migration

## Summary

Append a `Pull requests:` subsection to every release block in `CHANGELOG.md`, while preserving the existing generated release-note prose unchanged. The release-notes-author skill will gain a dedicated PR-gathering helper so future releases automatically include the landed PR list.

## Key Changes

- Add `.agents/skills/release-notes-author/scripts/gather_prs.sh` as a separate helper that uses `gh` for PR metadata and `git` only to determine landed order.
- Keep `gather_commits.sh` focused on changelog prose generation.
- Update `.agents/skills/release-notes-author/SKILL.md` so the release workflow runs both helpers and appends the PR section as the last subsection of each release block.
- Backfill existing changelog entries one release at a time, oldest to newest, by appending:
  - `Pull requests:`
  - one bullet per PR in landed order
  - each bullet as `[PR title](PR URL)`
  - `None found` when a release truly has no landed PRs
- Preserve the current changelog body exactly as generated; only add the new PR list section.
- Update the release-notes task docs so the migration process and future automation live here instead of `tasks/release-notes/followup.md`.

## Test Plan

- Add shell coverage for `gather_prs.sh` with:
  - a valid release range
  - an invalid ref or missing tag
  - an empty or PR-less range
  - duplicate commit-to-PR resolution
- Verify the helper emits PRs in the same landed order as the release-range history.
- Verify the helper prints `None found` for a PR-less release range.
- Run the release-notes skill end to end against a known release range and confirm the changelog block ends with the new PR index.
- After the one-off migration, verify every release header in `CHANGELOG.md` has exactly one `Pull requests:` section and that the release blocks still remain in descending version/date order.

## Assumptions

- “Landed order” means the order implied by repository history for the release range, not PR number order.
- `gh` is the only source of PR title and URL data.
- Each release block should end with the PR list section, after the existing prose.
- Historical releases will be migrated incrementally if needed, but the final state should cover all existing entries.

## CHANGELOG Insertion Rule (Upsert)

| State | Behavior |
|---|---|
| `CHANGELOG.md` does not exist | Create the file with `# Changelog\n\n`, then apply the no-version-blocks case |
| Target `## [x.y.z]` block present | Replace from that header line up to, but not including, the next `## [` line |
| Target block absent, `## [Unreleased]` present | Insert the new block after the unreleased section and before the next versioned block or EOF |
| Target block absent, no `## [Unreleased]`, at least one `## [x.y.z]` exists | Insert the new block before the first versioned block |
| No version blocks at all | Append the new block at end of file |
