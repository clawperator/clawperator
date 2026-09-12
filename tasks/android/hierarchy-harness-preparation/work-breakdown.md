# R12 implementation and evidence

Contract: [plan.md](plan.md). Coordination: [v0.10](../../releases/v0.10/plan.md).

## PR-1: deterministic preparation and failure staging

Status: not started.

1. Add a testable bounded preparation path that establishes the homepage before hierarchy regression assertions. Keep process setup separate from verification; never infer readiness from a successful launch intent alone.
2. Cover fresh homepage, restored ordinary subpage, restored search package, launch failure, wrong destination, deadline exhaustion, unavailable service and transport failure. Assert bounds on attempts and that failed preparation cannot enter the capture assertions. Verify cleanup does not mask the original failure.
3. On an explicit API-35 English emulator, intentionally leave Settings on its search activity using the matching CLI/APK. Run the checked-in harness from that state and from a fresh process. Record that both reach the same verified homepage and starting position. Do not change network state or delete Settings data.
4. Update the harness README with supported starting states, exact mutations and stage diagnostics. Record focused preparation success and full-harness outcome separately. Commit implementation, tests and docs together.

## Validation and completion

```sh
python3 -m unittest discover -s validation/sensitive-hierarchy-access -p 'test_*.py'
./validation/test_all.sh --suite validation
```

Build Node before the live run, install/enable the matching APK, and execute:

```sh
python3 validation/sensitive-hierarchy-access/run.py --device <device_serial> --operator-package com.clawperator.operator.dev --out <absolute_artifact_directory>
```

Use `com.clawperator.operator` for a separately prepared release-variant run. Only the selected Operator should be active. Record CLI/APK versions, source commit, device/API and both initial states. Offline tests cannot establish real activity-stack behavior.

Done for this PR requires verified preparation, regression tests, docs, accurate status and local commits. An R11/R13 failure after successful preparation remains a release blocker, not permission to skip a downstream assertion or expand this PR. Once those fixes are merged, run the combined release gate as described in the release plan. Do not publish a release or add automatic emulator PR jobs.
