# Node API Alpha Release Checklist

Use this as a release gate for the initial public alpha.

Status values:

- `[ ]` not started
- `[-]` in progress
- `[x]` complete
- `[n/a]` not applicable for this alpha

## 1) Packaging and distribution

- [ ] Publishable install path is defined and tested (`npm`, `npx`, or equivalent).
- [ ] Versioning policy for alpha builds is documented.
- [ ] Release tagging flow is documented and repeatable.
- [ ] A short install/upgrade note exists for alpha users.

Exit criteria:
- A new user can install the CLI and run `--help` without repo-local setup.

## 2) API/contract stability (alpha scope)

- [ ] Alpha command schema is documented (execute/observe/inspect/action/skills surface).
- [ ] Alpha result/error schema is documented with stable error codes.
- [ ] Canonical terminal contract is explicit: `[Clawperator-Result]` only.
- [ ] Unstable/experimental areas are clearly marked.

Exit criteria:
- Breaking changes are avoided within alpha patch releases unless explicitly announced.

## 3) Compatibility matrix and prerequisites

- [ ] Supported Android versions/devices are listed.
- [ ] Required operator app build/channel is listed.
- [ ] Required device settings are listed (accessibility, permissions, etc.).
- [ ] Known OEM quirks/limitations are documented.

Exit criteria:
- A tester can determine if their device is in-scope before setup.

## 4) Reliability and execution safety

- [ ] Timeout/size limits are enforced and documented.
- [ ] Single-flight behavior is tested and documented.
- [ ] Failure diagnostics are actionable (`code`, `message`, context fields).
- [ ] Retry guidance is documented (what to retry vs not retry).

Exit criteria:
- Common failures can be triaged from CLI output without code changes.

## 5) Test and quality gates

- [ ] Node build passes.
- [ ] Node unit tests pass.
- [ ] Canonical envelope parser regression test is present and passing.
- [ ] Stage 1 smoke passes on real device (canonical terminal source).
- [ ] Stage 2 smoke passes on real device (compile-artifact + execute).
- [ ] Optional integration script passes when enabled (`CLAWPERATOR_RUN_INTEGRATION=1`).

Suggested commands:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
CLAWPERATOR_SMOKE_SUMMARY=/tmp/clawperator-smoke-summary.json ./scripts/clawperator_smoke_core.sh
CLAWPERATOR_SMOKE_SUMMARY=/tmp/clawperator-smoke-summary.json ./scripts/clawperator_smoke_skills.sh
CLAWPERATOR_RUN_INTEGRATION=1 DEVICE_ID=<device> ./scripts/clawperator_integration_canonical.sh
```

Exit criteria:
- All required gates pass on the release branch commit.

## 6) Security and privacy baseline

- [ ] No secrets/tokens are hardcoded in code/docs/scripts.
- [ ] No personal/local device serials (`DEVICE_ID` / adb serials) are committed in code/docs/scripts.
- [ ] Logging behavior is documented for sensitive app data scenarios.
- [ ] Receiver package targeting and command dispatch assumptions are documented.

Exit criteria:
- No known high-risk leakage path remains unaddressed for alpha.

## 7) Documentation and onboarding

- [ ] 5-minute quickstart exists (install -> connect device -> first success).
- [ ] Troubleshooting guide covers top failure modes.
- [ ] Examples exist for: `observe snapshot`, `execute`, `skills compile-artifact`, `skills list/get`.
- [ ] Canonical-only migration note is clear for users of older builds.

Exit criteria:
- A new agent developer can self-serve setup and first execution.

## 8) Skills/artifacts alpha policy

- [ ] Artifact variable substitution behavior is documented.
- [ ] Compile errors are deterministic and documented (`COMPILE_VAR_MISSING`, etc.).
- [ ] Skill registry source/override behavior is documented.

Exit criteria:
- Artifact compile behavior is predictable and test-covered.

## 9) Launch readiness and feedback loop

- [ ] Alpha release notes are prepared.
- [ ] Known issues list is published.
- [ ] Feedback channel and template are defined.
- [ ] Triage ownership is assigned for alpha bug reports.

Exit criteria:
- Users know how to report issues and what support to expect.

## 10) Canonical validation baseline

Record the most recent real-device validation used for this release decision:

- Device: `<device_serial>`
- Receiver package: `com.clawperator.operator.dev` (or release equivalent)
- Terminal contract: canonical-only (`[Clawperator-Result]`)

Baseline command set:

```bash
./scripts/apply_coding_standards.sh -f
./gradlew :shared:data:operator:testDebugUnitTest --tests "clawperator.operator.agent.ClawperatorResultEnvelopeTest"
npm --prefix apps/node run build
npm --prefix apps/node run test
CLAWPERATOR_SMOKE_SUMMARY=/tmp/clawperator-smoke-summary.json ./scripts/clawperator_smoke_core.sh
CLAWPERATOR_SMOKE_SUMMARY=/tmp/clawperator-smoke-summary.json ./scripts/clawperator_smoke_skills.sh
CLAWPERATOR_RUN_INTEGRATION=1 DEVICE_ID=<device_serial> ./scripts/clawperator_integration_canonical.sh
```

Latest recorded outcome:

- [ ] Recorded in this checklist before release decision
- [ ] `execute` / `observe` / `inspect` succeed without `RESULT_ENVELOPE_TIMEOUT`
- [ ] Success responses include `terminalSource: "clawperator_result"` and `isCanonicalTerminal: true`

## 11) Release risk check

Before alpha release, explicitly confirm:

- [ ] Operator builds in scope emit `[Clawperator-Result]`
- [ ] Older non-canonical Operator builds are documented as unsupported
- [ ] CI behavior is clear for device-required checks (smoke/integration)
- [ ] Single-flight conflict behavior is documented (`EXECUTION_CONFLICT_IN_FLIGHT`)
- [ ] Skills registry path behavior is documented (`CLAWPERATOR_SKILLS_REGISTRY`)

---

## Go/No-Go

- [ ] **GO for public alpha**

Release decision notes:

- Date:
- Commit/tag:
- Approved by:
- Blocking issues (if NO-GO):
