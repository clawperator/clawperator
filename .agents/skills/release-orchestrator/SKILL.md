---
name: release-orchestrator
description: Orchestrates the full Clawperator release flow from an optional unreleased code-version bump through release creation, release verification, published-version updates, and the next code-version bump. Use when you need to run or resume the complete release workflow end to end and keep prerelease-stage versions in the `0.x.y` series.
---

# Release Orchestrator

## Overview

Use this skill to move one Clawperator release through the full release phase while keeping the unreleased code version separate from the published release version.
At the start, confirm both the intended release version and the intended next unreleased version with the user if either is ambiguous.
For now, only accept prerelease-stage versions in the `0.x.y` series. Do not proceed with `4.0`, `v4.0`, or any release version that does not start with `0.`.

## Workflow

1. Establish the target versions.
   - Confirm the intended release version and the intended next code version before making changes.
   - If the unreleased code version does not already match the intended release version, run `$release-set-code-version-number` first.
   - Treat the release version as the version that will be tagged and published.
   - Treat the next code version as the post-release unreleased version.
2. Verify CHANGELOG entry exists before tagging.
   - Check that `CHANGELOG.md` contains a `## [<version>]` block for the intended release version.
   - If the block is absent, run `$release-notes-author` for the appropriate tag range, review the generated entry, then merge it before proceeding.
   - Do not proceed to step 3 until the CHANGELOG entry is on the main branch.
3. Create the release.
   - Run `$release-create` for the intended release version.
   - Pass the exact release commit when needed.
   - Keep the release-create validations intact.
3. Verify the release.
   - After the release workflows complete, run `$release-verify` for the same version.
   - Stop if any verification surface fails.
5. Update published surfaces.
   - Once npm and GitHub Releases are live, run `$release-update-published-version` for the released version.
   - Keep the published-version commit separate from the code-version bump commit.
6. Advance the unreleased code version.
   - Run `$release-set-code-version-number` again for the next unreleased version.
   - Default to the next patch version unless the user explicitly asks for a different bump.
   - Keep the next version in the `0.x.y` series unless the user explicitly requests otherwise and the repo policy has changed.

## Guardrails

- Keep code-facing and published-facing versions separate.
- Reject non-`0.` release versions up front.
- Do not update public docs before the release is live.
- If `release-create` already produced the published-version follow-up commit, review it instead of recreating it.
- Do not push `main` directly.
- If the user has already completed one of the steps, resume from the first incomplete step.
