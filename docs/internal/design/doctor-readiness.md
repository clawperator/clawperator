# Doctor readiness policy and verification

The public contract is [Doctor](../../api/doctor.md), including the
`--check-only` migration. Log destination behavior belongs in
[Logging](../../api/logging.md); caller-controlled application-role preparation
belongs in [Setup](../../setup.md#caller-controlled-default-application-preparation).

## Source ownership

- `apps/node/src/domain/doctor/criticalChecks.ts` owns the required normal/full
  check order. Execution and readiness aggregation consume that same definition.
  Required warnings are incomplete verification; optional host-agent, settings,
  and logging diagnostics remain advisory.
- `DoctorService` records skipped required checks and their blocking IDs. After
  any shell-remediation attempt, it reruns the selected mode without another
  automatic repair pass. Returned readiness comes from fresh observations.
- `readinessChecks.ts` requires a successful ping step for handshake. Smoke must
  use `runExecution`: Android deliberately returns `UNSUPPORTED_RUNTIME_CLOSE`,
  while Node owns the targeted force-stop and only normalizes that rejection
  after host success. The same pipeline extracts the command-correlated snapshot
  hierarchy. Directly broadcasting the smoke action list bypasses both duties.
- `adapters/logger.ts` owns destination resolution. The append/open diagnostic
  retains the attempted destination even after file logging is disabled, closes
  its handle, and never truncates logs or writes synthetic test content. Write
  failures are tested through an injected filesystem seam so privileged test
  execution cannot hide permission failures.

No selected package is switched implicitly. A successful dispatch does not
assert application-specific postconditions. Doctor does not assign roles,
remove an alternate Operator installation, or own downstream recovery policy.

## Verification baseline

Implementation revisions `d3c2fff` and `74126cc` were verified with CLI `0.10.0`
and debug Operator `0.10.0-d`.

- At `d3c2fff`, the Node build and 304-test package selection passed, as did 89
  focused CLI, registry, logger, and operator-remediation tests. Six shell
  scenarios in `validation/test_doctor.sh` passed, including selected-variant
  mismatch with global flags before and after the command.
- At `74126cc`, the Node build and 306-test package selection passed, plus 83
  focused execution-pipeline and doctor CLI tests. The added pipeline tests prove
  that a failed host force-stop prevents broadcast and cannot become success.
- The debug APK build passed and its SHA-256 matched the installed emulator APK.
  Documentation builds passed route and inner-page link validation, with no
  organization warnings.
- On an explicitly selected API 35 emulator, normal doctor returned `ok=true`,
  `criticalOk=true`, and `skippedChecks=[]`, including version, handshake, and
  interactive-state verification. A bundled-skills warning remained advisory.
- A second live run used a regular file as the log directory. It preserved that
  file, reported `LOG_DIRECTORY_UNWRITABLE` and the attempted destination, and
  still passed readiness. Private reports were saved as `healthy.json`,
  `healthy.stderr`, `unwritable-logs.json`, and `unwritable-logs.stderr`.
- The revised smoke function passed live on the same emulator. All three steps
  succeeded and the extracted hierarchy contained `com.android.settings`.
  Private evidence includes `smoke.json` and `hierarchy.xml`. These local files
  are not tracked or required build inputs.
- The sibling runtime-skills repository had no references to doctor,
  `criticalOk`, or `--check-only`; no affected skill migration was required.

## Follow-up and limits

The required healthy-device proof is complete. Missing devices, ambiguous
selection, version failures, handshake failure, locked state, full-mode
incompleteness, and remediation outcomes use deterministic fake-runner coverage.
No real APK was removed to simulate an unavailable installation.

Before expanding live support claims, run doctor against a matching CLI/Operator
on the additional device/API combination and retain the report. Physical devices
and Android versions other than API 35 remain unverified.

The complete `doctor --full` build/install/launch/handshake/smoke invocation was
not live-run. To establish that integration claim, run it on a dedicated explicit
debug target and retain every required check result; the direct smoke proof does
not substitute for that complete invocation.

Browser-role help and readback were inspected without assigning roles. API 35
printed supported commands despite a nonzero help status; role-holder readback
succeeded. Before claiming assignment support, save the original holder, perform
caller-authorized assignment and readback on a dedicated target, and restore the
original state. Role assignment remains outside doctor.
