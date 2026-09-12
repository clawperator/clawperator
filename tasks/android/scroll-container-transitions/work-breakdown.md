# R11 implementation and evidence

Contract: [plan.md](plan.md). Coordination: [v0.10](../../releases/v0.10/plan.md).

## PR-1: identity, observation and bounded search

Status: not started. Complete the runtime fix, regression coverage and docs in one PR.

1. Reproduce the nested Settings transition with the matching local CLI/APK and inspect the before/after scope. Add deterministic fixtures for present-but-nonscrollable, true replacement/disappearance, ambiguity, and unavailable hierarchy.
2. Correct shared resolution and target-observation behavior. Cover target revealed versus still absent, strict explicit scope and legacy unscoped selection, a target outside the original scope, and no additional gesture after accepted dispatch. Preserve normal moved/no-movement evidence and cancellation.
3. Verify on a dedicated unlocked API-35 English emulator. Start at the Settings homepage top with the target initially absent from the on-screen query. Exercise both the default search and an explicit outer-container selector; verify the destination with `Brightness level`, not merely a successful click receipt. Keep the exact reproduction rather than replacing it with an inner-container workaround.
4. Run relevant checks, update durable docs and release status, and commit validated logical work. Record any unrelated R12/R13 obstruction separately with the original failed evidence.

## Validation

```sh
./gradlew :app:assembleDebug unitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

After installing/enabling the matching Operator on an explicit device, run:

```sh
node apps/node/dist/cli/index.js scroll-until down --text 'Display & touch' --click --device <device_serial> --operator-package com.clawperator.operator.dev --no-daemon
python3 validation/sensitive-hierarchy-access/run.py --device <device_serial> --operator-package com.clawperator.operator.dev --out <absolute_artifact_directory>
```

Reset to the stated initial screen before each reproduction; also test `--container-id com.android.settings:id/settings_homepage_container --strict`. Capture before/after queries and receipt JSON. Offline fixtures prove decision rules; live observations prove the real transition. Keep device captures untracked and examples generic.

Done means the scoped behavior and its tests/docs pass, status is accurate, and commits exist. A missing live prerequisite remains explicit unfinished evidence. Do not implement R12/R13 or media features here. Final release-candidate validation is coordinated by the release plan, not an automatic PR emulator workflow.
