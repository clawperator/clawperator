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

Current codebase facts that matter for this task:

- `apps/node/src/contracts/errors.ts` currently has `VERSION_INCOMPATIBLE` but not the more granular version error codes.
- `apps/node/src/cli/index.ts` already supports the global `--version` flag by reading `apps/node/package.json`.
- `apps/node/src/contracts/doctor.ts` and `apps/node/src/domain/doctor/DoctorService.ts` now use `criticalOk` semantics. Version mismatch should fit the current doctor model rather than reintroducing older all-or-nothing behavior.
- Android release `versionName` is derived from `apps/node/package.json` in `apps/android/app/app.gradle.kts`, so the repo already intends Node and Android versions to move together.
- Android debug builds currently add `versionNameSuffix = "-d"`, so compatibility parsing must treat debug suffixes deliberately instead of failing on them accidentally.

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
- handle the debug build suffix (`-d`) explicitly
- return a deterministic error when the APK version cannot be read

Implementation note:

- use `dumpsys package` as the source of truth for installed APK version
- do not try to infer APK version from handshake payloads or result envelopes
- prefer a small shared parser/normalizer utility so doctor and `version --check-compat` cannot drift

### 4. Doctor Integration

- add a version compatibility check after APK presence passes
- treat incompatible versions as a blocking doctor failure
- provide clear remediation steps for upgrading either the CLI or APK

Expected doctor behavior:

- if the APK is not installed, keep the current behavior: warn on APK absence and skip downstream checks that require the APK
- if the APK is installed but its version cannot be read, fail clearly with remediation
- if versions are incompatible, doctor should fail via the current `criticalOk` pathway
- pretty output and JSON output should both make the mismatch obvious

### 5. CLI Surface

- add `clawperator version`
- add `clawperator version --check-compat`
- keep the existing global `--version` behavior intact

Expected CLI behavior:

- `clawperator --version` should remain a simple version print
- `clawperator version` may print the same CLI version in a command-oriented form
- `clawperator version --check-compat` should report at least:
  - CLI version
  - detected APK version
  - receiver package checked
  - compatibility verdict
  - remediation guidance on mismatch
- follow the existing custom CLI dispatch style in `apps/node/src/cli/index.ts`

### 6. Execution Path Guardrail

- evaluate a lightweight compatibility pre-check in `runExecution`
- keep it optional or cached if latency becomes noticeable
- avoid turning normal execution into a slow path

### 7. Validation

- build/test Node changes
- add unit coverage for version parsing and compatibility decisions
- test compatible and incompatible version scenarios
- run at least one real-device validation pass before calling this done

Minimum automated validation:

- `npm --prefix apps/node run build`
- `npm --prefix apps/node run test`

Recommended repo validation before handoff completion:

- `./gradlew :app:assembleDebug`
- `./gradlew unitTest`
- `./scripts/test_doctor.sh`

Real-device validation target:

- one run with the release package path (`com.clawperator.operator`) if available
- one run with the debug package path (`com.clawperator.operator.dev`) if the local debug APK is what is installed
- confirm the version parser handles the actual `dumpsys package` output seen on device

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

## Open Decisions

- whether `VERSION_INCOMPATIBLE` stays as a top-level umbrella code or is replaced entirely by more specific codes
- whether patch mismatches should always be `pass`, or whether some cases should surface a warning without failing
- whether execution-time enforcement should ship in this task or remain a documented follow-up after doctor coverage is in place

## Related Files

- `apps/node/src/contracts/errors.ts`
- `apps/node/src/cli/index.ts`
- `apps/node/src/cli/commands/doctor.ts`
- `apps/node/src/domain/doctor/DoctorService.ts`
- `apps/node/src/domain/doctor/checks/`
- `apps/node/src/domain/executions/runExecution.ts`
- `apps/android/app/app.gradle.kts`
- `docs/troubleshooting.md`
- `docs/compatibility.md`

## Handoff Notes

- This task is ready for another agent to take over.
- The largest hidden gotcha is Android debug version naming (`-d`) on top of normal semver and prerelease labels.
- Keep the implementation narrow. The required outcome is explicit compatibility detection and reporting, not a broad redesign of execution or release versioning.
