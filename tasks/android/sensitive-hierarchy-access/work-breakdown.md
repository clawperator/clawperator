# Sensitive hierarchy access implementation

Contract: [plan.md](plan.md). Release: [v0.10 R10](../../releases/v0.10/plan.md).

## PR-1 / Phase 1: Restore supported hierarchy access

Status: not started. Required base: R4 merged (`8cab7adb`). No later release PR
is a prerequisite. Complete behavior, validation, and docs in this one PR.

1. Confirm the selected service's runtime configuration and reproduce the
   Internet-screen failure with branch-local tools. Use the recorded A/B evidence
   to verify the selected declaration; the product decision is recorded in the plan.
2. Enable the selected declaration, implement per-node sensitivity in query and
   XML outputs, and update setup/upgrade handling. Inspect
   the packaged service metadata for development and release variants; distinguish
   a declaration in source from what Android actually loads. Remove temporary
   probes and restore any device settings changed during verification.
3. Write the automated Internet-screen capture regression below, plus focused
   configuration/serialization tests and genuine failure coverage. JVM mocks
   cannot prove Android's sensitive-view access rules; the device test is a
   required deliverable, not an optional manual smoke check.
4. Complete the live acceptance cases below, update durable/public docs, and mark
   R10 complete in release coordination only once all required evidence passes.

## Required automated device regression

Add a committed harness under `validation/sensitive-hierarchy-access/` that runs
against an explicit device serial and Operator package using the branch-local
Node CLI/API. Wire it into CI with an Android 15/API 35 emulator and a documented,
pinned Settings/system image and English locale. Keep this app-specific fixture
in the validation harness; production capture code must remain generic.

The harness must:

1. Verify prerequisites and navigate through Settings > Network & internet >
   Internet using canonical Clawperator actions and bounded readiness checks.
   Keep navigation/capture deadlines finite. Never turn a missing root into a
   skip or keep retrying until an overall test timeout hides the failing step.
2. Execute three consecutive queries and an XML snapshot. Assert successful
   envelopes, nonempty application content, the Internet heading and Wi-Fi
   control, and root sensitivity true. Compare the Wi-Fi control's state/bounds
   and sensitivity across query and XML using stable selectors. Match a connected
   network row when present, but do not require a network connection or exact
   node count. Do not change Wi-Fi, mobile-data, or other network settings.
3. Cover CLI/raw/MCP query entry points and confirm they identify the same
   application screen. Capture a decodable screenshot as supporting evidence;
   screenshot existence alone must not satisfy hierarchy assertions.
4. Check a normal native Settings screen as a control. Capture actionable failure
   output and artifacts, return nonzero for assertion failures, and leave the
   device in a documented state. Serialize device use to avoid competing tests.

Prove once during implementation that the harness detects the original defect:
run against an isolated build with the original false/omitted declaration and
record a failure at the hierarchy assertions; the fixed build must pass. Remove
any temporary configuration edits and reinstall the intended APK afterward.
The ordinary CI run tests the shipped declaration, without modifying source.

Document one command to run the harness and its device/image prerequisites.
Offline CI should also validate packaged metadata and the harness's assertion
logic with fixtures, but cannot replace the real emulator run. A missing emulator
may be reported as unavailable locally; it must not count as a passing v0.10
acceptance run. CI must actually execute the device regression, not merely syntax
check its script or install an APK. A missing CI capability is a completion
blocker to resolve, not permission to omit the test.

## Acceptance evidence

- On an explicit Android 15/API 35 target, navigate through Settings, Network &
  internet, and Internet. Use a bounded readiness check after navigation.
  Three consecutive structured queries and an XML snapshot must succeed with
  Internet, Wi-Fi, and the connected-network row when present. Match content and
  switch state/bounds to XML and a screenshot. Do not require exactly 67 nodes;
  dynamic network entries can change the count.
- CLI query, raw `query_ui`, and named MCP `query_ui` return equivalent application
  content. Confirm the root belongs to Settings, rather than another window.
- On the Internet page, an unfiltered query exposes root sensitivity as true;
  compare reported flags with XML on matching stable nodes. CLI/raw/MCP preserve
  values. Normal-screen flags must be observed, not presumed false.
- Generic mixed-node fixtures cover true, false, and null independently of
  labels, root sensitivity, visibility filtering, relationships, and result
  limits. Fallback nodes and API <34 must report unknown without invoking the
  API-34 method. Test XML omission for unknown and both known boolean values.
- Older query payloads lacking the new field remain readable and are treated as
  unknown. Keep schemaVersion 1, existing state fields, and response size guards.
  If R7 is present, verify compact projection preserves sensitivity metadata.
- Documentation/examples distinguish a reported sensitivity bit from private-mode
  correctness; no browser mode verdict is synthesized from true, false, or null.
- A normal native control screen (Display & touch) still returns expected nodes
  and state. Null/false distinctions and relational queries remain correct.
- Establish live success after installing over the previous development Operator
  and after a fresh service connection. Record any required service re-enable or
  restart in setup guidance. Verify the release variant has the intended packaged
  declaration and repeat the Internet query/XML smoke with that variant.
- Genuinely unavailable hierarchy still yields the existing structured failure,
  never an empty success. Exercise absent-service/root conditions offline where
  deterministic, preserve correlation/failed-step evidence, and keep independent
  screenshots available when supported.
- Record APK/CLI versions, device API, actual service declaration, commands,
  outcomes, and limitations. Keep private captures outside Git. Do not broaden
  compatibility claims to untested devices or Android versions.

## Validation and prerequisites

Use `AGENTS.md` for device selection and validation. Inspect connected devices,
unlock the selected target, and build branch-local Node before using its CLI.
Install matching APKs; use the development package by default and the release
package only for the explicit release-variant check. Avoid concurrent commands
that compete for the screen.

Required checks for the implementation:

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew :app:assembleDebug :app:assembleRelease
./gradlew testDebugUnitTest
./scripts/docs_build.sh
git diff --check
```

Run focused query/serialization/MCP tests in addition to the standard Node suite.
Exercise changed installer/setup scripts with their matching
validation harnesses. If release signing or a live-device prerequisite is missing,
record the exact blocker; do not substitute debug-only evidence for release proof.

Finish with narrow local commits, consistent plan/release status, and a concise
validation account. This task does not authorize publishing v0.10 or implementing
R5-R9. Cleanup may occur on the completed implementation branch under task-cleanup.
