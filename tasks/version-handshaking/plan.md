# Version Compatibility and Handshaking

## Context

The soft-launch roadmap is now effectively complete through Phase 7.

Work completed over the last 72 hours covers:

- docs restructuring and first-time setup guidance
- npm packaging and install flow cleanup
- landing site and docs site rollout
- release automation, APK hosting, and stable redirect flow
- skills install/update/search/run integration
- doctor severity handling, handshake gating, and output fixes

The remaining engineering gap is explicit version compatibility between the Node CLI and the Android operator APK.

## Objective

Catch CLI/APK version mismatches early, report them clearly, and document the supported compatibility rule:

- `major.minor` must match between the Node CLI and the installed APK
- patch differences are acceptable
- prerelease suffixes should not break compatibility parsing

## Scope

### 1. Compatibility Contract

- add `docs/compatibility.md`
- document the compatibility rule and examples
- link the doc from troubleshooting or other user-facing setup docs as needed

### 2. Error Codes

- add granular version-related error codes in `apps/node/src/contracts/errors.ts`
- preserve the existing `ERROR_CODES` const pattern
- keep `VERSION_INCOMPATIBLE` only if it still serves a distinct purpose

### 3. APK Version Detection

- query the installed APK version via `adb shell dumpsys package <receiverPackage>`
- parse `versionName`
- normalize prerelease suffixes before comparison
- return a deterministic error when the APK version cannot be read

### 4. Doctor Integration

- add a version compatibility check after APK presence passes
- treat incompatible versions as a blocking doctor failure
- provide clear remediation steps for upgrading either the CLI or APK

### 5. CLI Surface

- add `clawperator version`
- add `clawperator version --check-compat`
- keep the existing global `--version` behavior intact

### 6. Execution Path Guardrail

- evaluate a lightweight compatibility pre-check in `runExecution`
- keep it optional or cached if latency becomes noticeable
- avoid turning normal execution into a slow path

### 7. Validation

- build/test Node changes
- add unit coverage for version parsing and compatibility decisions
- test compatible and incompatible version scenarios
- run at least one real-device validation pass before calling this done

## Acceptance Criteria

- the CLI can report its own version and the installed APK version together
- doctor fails clearly on incompatible versions
- troubleshooting docs explain mismatch symptoms and fixes
- compatibility behavior is deterministic and covered by tests

## Suggested Execution Order

1. Add version parsing and comparison utilities.
2. Add error codes.
3. Integrate the check into doctor.
4. Add the `version` subcommand.
5. Update docs.
6. Decide whether execution-time enforcement should ship now or stay follow-up work.

## Related Files

- `apps/node/src/contracts/errors.ts`
- `apps/node/src/cli/index.ts`
- `apps/node/src/domain/doctor/DoctorService.ts`
- `apps/node/src/domain/doctor/checks/`
- `apps/node/src/domain/executions/runExecution.ts`
- `docs/troubleshooting.md`
- `docs/compatibility.md`

### Deferred Items (Not in This Roadmap)

- `--safe-logs` flag
- animated demos or video walkthroughs
- community/repository hygiene docs such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`
- CI for skills repo validation
- comprehensive integration tests
- `execute best-effort --goal`
