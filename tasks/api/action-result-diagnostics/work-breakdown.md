# Report action outcomes and failures precisely Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Receipts and failure preservation | 1 | R4 merged; await R5 merge (strict selection is locally complete; see `docs/internal/design/selector-inspection.md`) |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Receipts and failure preservation

Ship bounded, truthful action diagnostics.

### Work

- Rebase onto merged selector work. Trace current thrown-failure and returned-failure behavior before editing; preserve ordering policy and capture completed steps on thrown failures.
- Thread actual resolution/dispatch receipts through UI manager and task engine; use the selector NodeSummary serializer.
- Replace misleading scroll classifications and update every consumer of TaskScrollOutcome and termination reasons. Cover changed behavior with regression tests.
- Use generic fixtures for a wrapper click with no postcondition, duplicate layered containers, missing progress signatures, and disappearing containers. Live verify unique click plus wait and scroll plus before/after observation.
- Update result/action/error docs with explicit action-versus-assertion semantics and compatibility notes for new scroll enum values. Audit sibling skill consumers only for affected contracts; if a consumer requires changes, update its version and smoke checks in lockstep per AGENTS.md.

### Affected Sources

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/`
- `apps/node/src/contracts/result.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/adapters/android-bridge/envelopeParser.ts`
- `apps/node/src/cli/output.ts`
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt`
- `apps/node/src/test/unit/envelopeParser.test.ts`
- `apps/node/src/test/unit/cliExitCode.test.ts`
- `docs/api/actions.md`
- `docs/api/errors.md`
- `docs/api/overview.md`

### Acceptance Evidence

- A wait timeout after one completed step retains both that step and one failed wait result with WAIT_TIMEOUT.
- Missing-root diagnostics distinguish unavailable service/root/metadata, and do not make the app root a prerequisite for raw overlay actions. Existing ON_SCREEN_LOG_* failures remain unchanged.
- Known missing root and target failures carry codes; unknown exceptions preserve text; timeout/cancellation emits one terminal result.
- Ancestor-click and coordinate-fallback receipts name the actual dispatch target/method while retaining the matched target.
- Click accepted without screen change remains accepted, never a fabricated verified success.
- Lost/missing/unchanged/changed scroll evidence maps exactly to the table; loops stay bounded and strict ambiguous container dispatch count is zero.
- Node CLI exits nonzero on failed terminal envelopes while preserving JSON and correlation IDs.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
# Set DEVICE_ID to a dedicated, connected test target before these commands.
: "${DEVICE_ID:?Select a dedicated test device}"
ANDROID_SERIAL="$DEVICE_ID" ./gradlew :app:installDebug
adb -s "$DEVICE_ID" shell monkey -p com.clawperator.operator.dev -c android.intent.category.LAUNCHER 1
node apps/node/dist/cli/index.js doctor --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev
```

## Validation and Completion

Use AGENTS.md for shared validation policy. Build Node before tests that consume dist. Relevant checks for this pack are:

```sh
./gradlew :app:assembleDebug
./gradlew testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

Live verification requires a dedicated, explicitly selected device, an unlocked screen, enabled accessibility, and the matching debug Operator. Offline tests prove the stated contracts; device checks prove integration and pixels. Record unavailable live evidence rather than treating it as passed.

Use `.agents/skills/docs-author/SKILL.md` for the named public docs and `.agents/skills/docs-build/SKILL.md` for regeneration. Run checks for each behavior change; repeat successful checks only after new changes or an unresolved integration concern.

Keep concise findings with versions, reproduction inputs, observed results/artifact paths, decisions, and remaining limitations. Preserve private captures outside tracked files. Update progress and commit validated logical units. Completion includes correcting in-scope failures, not merely producing a first implementation.
