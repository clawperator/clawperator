# Recover History Plan

## Context

This repository currently contains two unrelated git root histories:

- `441ffb4` - old `clawpilled` lineage
- `6157722` - current `clawperator` lineage used by `main`

Current `main` is on the new lineage. The old lineage is still present in the local repository and is still referenced by several local and remote-tracking refs, so it is not safe to prune yet.

This became visible during investigation of missing Node source files. A repair commit already landed on `main`:

- `1a03334` - restores 8 missing `apps/node/src/**/*.ts` files needed for build/test

That repair appears correct as far as production Node source is concerned, but it does not complete the migration audit.

## Findings So Far

### Git state

- `main` and `origin/main` are on the new `6157722 -> ...` lineage
- `441ffb4` has no merge-base with current `main`
- old lineage refs still exist locally and as remote-tracking refs
- because those refs still exist, `git gc --prune=now` would not remove the old chain

### `apps/node`

Comparison of old-lineage tip `3c780ef` against current `main` found:

- previously missing production TypeScript files are now restored by `1a03334`
- one old-lineage-only Node test file still remains absent:
  - `apps/node/src/test/unit/output.test.ts`

Additional note:

- `apps/node/tsconfig.json` existed on the old lineage but is absent on current `main`
- this does not look like an immediate breakage because `apps/node` currently builds and tests without it
- this should be treated as audit-only unless a concrete current need emerges

### Other old-lineage-only files

Initial comparison against the old lineage also found old-only files outside `apps/node`:

- `docs/crash-logs.md`
- `scripts/apply_coding_standards.sh`
- `scripts/clawperator_integration_canonical.sh`
- `scripts/clawperator_smoke_skills.sh`
- `scripts/test_all`
- `scripts/test_all_local`

These require intentional review before recovery. Some may have been replaced, renamed, or intentionally dropped.

## Goals

1. Recover any missing current-value code or tests from the old lineage
2. Avoid further git surgery while the migration audit is incomplete
3. Leave a written inventory of what was checked and why each item was or was not restored
4. Do not push anything to `main` without explicit user permission

## Execution Plan

### Phase 1 - Safe recovery on current `main`

1. Restore `apps/node/src/test/unit/output.test.ts` from the old lineage
2. Run Node validation:
   - `npm --prefix apps/node run build`
   - `npm --prefix apps/node run test`
3. Commit that recovery as a narrow follow-up commit

### Phase 2 - Migration audit inventory

1. Inspect each remaining old-lineage-only file outside `apps/node`
2. Classify each as one of:
   - intentionally obsolete
   - replaced elsewhere
   - should be restored
3. Record disposition in this task folder while the work is in progress

### Phase 3 - Only after audit completion

1. Verify which old-lineage refs still exist on GitHub versus only locally
2. Delete stale refs deliberately, not implicitly
3. Only after all required recoveries are complete, consider pruning unreachable history

## Risks

- Pruning or deleting old refs too early could permanently hide migration omissions
- Recovering files blindly from the old lineage could reintroduce obsolete behavior
- Test gaps are especially risky because the recent recovery restored production files but not every historical test

## Immediate Next Change

Restore `apps/node/src/test/unit/output.test.ts`, validate `apps/node`, and commit that test recovery separately from any broader audit work.
