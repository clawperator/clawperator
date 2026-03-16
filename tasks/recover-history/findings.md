# Recover History Findings

## Recovered on current `main`

### Commit `de81413`

- `apps/node/tsconfig.json`
- `apps/node/src/test/unit/output.test.ts`

Result:

- `npm run build` in `apps/node` now works again
- `npm run test` in `apps/node` passes after restoring the missing test and config

### Working tree changes prepared after that commit

- `docs/crash-logs.md`
- `scripts/apply_coding_standards.sh`
- `scripts/clawperator_integration_canonical.sh`
- `scripts/clawperator_smoke_skills.sh`
- `scripts/test_all`
- `scripts/test_all_local`

Reason:

- `docs/crash-logs.md` is still referenced by `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml`, `docs/index.md`, and generated doc indexes
- the restored scripts are still referenced by `AGENTS.md` and should exist in the repo if those instructions are to remain valid

## Notes and follow-up

- `scripts/test_all` uses `./gradlew testDebug`, which may reflect older Gradle task naming and should be reviewed against current Android build expectations
- `scripts/apply_coding_standards.sh` was restored because it is referenced, not because its internal Gradle task names have been re-validated end to end
- a docs build succeeded after restoring `docs/crash-logs.md`, which confirms the source tree is internally consistent again
- generated `llms-full.txt` files were intentionally not kept from that build because the regeneration introduced unrelated churn outside the scope of this recovery pass

## Still open

- audit whether the restored helper scripts need modernization rather than mere presence restoration
- audit old-lineage refs before any prune or cleanup attempt
- confirm whether any non-Node old-lineage-only files beyond the restored set still matter
