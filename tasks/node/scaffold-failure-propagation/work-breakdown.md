# Preserve scaffold execution failures Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Template and subprocess proof | 1 | None |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Template and subprocess proof

Ship the narrow fix with tests of generated scripts.

### Work

- Generate a temporary skill using the real scaffold function. Run its actual generated script against a fake executable via CLAWPERATOR_BIN; do not test only template substrings.
- Fix stream/status propagation. If retaining execFileSync makes successful stderr inaccessible, use spawnSync with the same timeout and argument array; preserve command resolution.
- Cover all decision rows plus quoting and missing device regressions. Align the scaffold explanation with nonzero failure requirements.

### Affected Sources

- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `docs/skills/authoring.md`

### Acceptance Evidence

- Fake child exit 7 with JSON stdout and stderr causes generated script exit 7 with both streams intact once.
- Exit 0 with both streams preserves both; no stdout on failure still fails.
- ENOENT/spawn failure, signal termination, timeout handling, and non-JSON failure cannot exit zero. Use an injected short timeout seam or isolated helper test rather than waiting 120 seconds.
- No existing runtime skills are edited or silently regenerated.

## Validation and Completion

Use AGENTS.md for shared validation policy. Build Node before tests that consume dist. Relevant checks for this pack are:

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

The generated-script subprocess tests need no Android device.

Use `.agents/skills/docs-author/SKILL.md` for the named public docs and `.agents/skills/docs-build/SKILL.md` for regeneration. Run checks for each behavior change; repeat successful checks only after new changes or an unresolved integration concern.

Keep concise findings with versions, reproduction inputs, observed results/artifact paths, decisions, and remaining limitations. Preserve private captures outside tracked files. Update progress and commit validated logical units. Completion includes correcting in-scope failures, not merely producing a first implementation.
