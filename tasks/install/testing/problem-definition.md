# Problem Definition: install.sh Testing Hardening

Created: 2026-04-16

## Background

`sites/landing/public/install.sh` is one of the highest-risk entrypoints in the
repo.

- It is the public one-command install path exposed at
  `https://clawperator.com/install.sh`.
- Users pipe it directly into `bash`.
- It is more than 1,100 lines long, runs with `set -euo pipefail`, and
  orchestrates the full host setup flow.
- It provisions Java, Node.js, adb, curl, git, the CLI itself, runtime skills,
  authoring skills, APK download and install, device setup, and final doctor
  validation.

Commits `868119e06a1886c6be975eeb7debe575adaab897` and
`4c35e3186cc12877afb1a99b98e810e4bde436e2` materially expanded the script. In
particular, `install.sh` now:

- calls `clawperator authoring-skills install --output json`
- parses JSON emitted by the CLI into shell variables
- updates the generated `~/.clawperator/AGENTS.md`
- changes final install reporting based on authoring-skills outcomes

Those changes improved product behavior, but they also increased the number of
branches, contracts, and external dependencies inside a script that was already
business-critical.

## Problem

There is already some testing for `install.sh`, but the current regression net
is not proportionate to the importance of the surface.

The main issue is not only that the script is large. The deeper problem is that
`install.sh` now contains contract-sensitive glue logic between several
surfaces:

- shell logic in `sites/landing/public/install.sh`
- JSON output contracts from the Node CLI
- filesystem side effects in `~/.clawperator`, `~/.claude`, `$CODEX_HOME`, and
  temporary download locations
- adb and doctor behavior that varies by connected-device state
- package-manager behavior that varies by host OS

This creates a specific risk pattern:

- the Node CLI can be correct in isolation
- the shell wrapper around it can still be wrong
- the shipped install path can therefore regress without existing tests catching
  it

That is especially risky here because `install.sh` is user-facing, hard to
reason about statically, and expensive to validate manually after the fact.

## What The Script Actually Does

The current `main()` flow is:

1. `validate_os`
2. `check_java`
3. `check_node`
4. `check_curl`
5. `check_adb`
6. `check_git`
7. `install_cli`
8. `run_doctor_and_fix`
9. `setup_skills_via_cli`
10. `setup_authoring_skills_via_cli`
11. `write_agent_guide`
12. final doctor check and final success or failure output

Important behavioral detail:

- Steps 1-8 are required install flow.
- Steps 9-11 are best-effort and should warn without aborting the full install.
- The final doctor result still determines whether the overall install is
  reported as healthy.

## Current Coverage

### Existing automated coverage

The repo already has meaningful coverage in a few places:

- `apps/node/src/test/integration/installScript.test.ts`
  covers `check_node()` upgrade behavior via sourced-shell execution and fake
  `nvm` state
- `validation/install/test_java.sh`
  covers several `check_java()` branches with mocked `brew`, `apt-get`, and
  `pacman`
- `validation/install/test_multidevice.sh`
  covers a `maybe_install_operator_apk()` multi-device path with mocked `adb`
  and `clawperator`
- `apps/node/src/test/unit/authoringSkills.test.ts`
  covers the Node-side authoring-skills install logic
- `apps/node/src/test/unit/authoringSkillsPack.test.ts`
  covers authoring-skills npm packaging behavior
- `apps/node/src/test/unit/doctor/`
  covers doctor service behavior at the Node layer

### CI execution today

The current PR workflow in `.github/workflows/pull-request.yml` does run the
existing install-related tests:

- `node-tests` runs `npm --prefix apps/node run build` and
  `npm --prefix apps/node run test`
- `validation-tests` runs:
  - `bash validation/test_doctor.sh`
  - `bash validation/install/test_multidevice.sh`
  - `bash validation/install/test_java.sh`

So the problem is not that `install.sh` has zero coverage. The problem is that
the coverage is fragmented and narrower than the behavior surface that now
exists.

## Key Gaps

### 1. Authoring-skills shell glue is untested

No committed shell-level test was found for:

- `setup_authoring_skills_via_cli()`
- `parse_authoring_skills_install_result()`
- `write_agent_guide()` with authoring-skills-specific output

This is the most important gap introduced by `4c35e31`.

### 2. Shell-to-CLI contract drift is not pinned

`install.sh` depends on JSON fields emitted by the Node CLI and converts them
into shell variables. If the CLI output shape changes, the shell may silently
fall back to defaults or produce misleading output.

There is currently no explicit regression net that proves:

- the required JSON fields remain present
- malformed JSON is handled safely
- partial JSON falls back predictably
- unknown labels are ignored intentionally

### 3. Best-effort paths are under-tested

The script contains several places where failure should warn and continue rather
than abort. Those branches are exactly where silent misconfiguration can hide.

Examples include:

- `setup_skills_via_cli()`
- `setup_authoring_skills_via_cli()`
- `write_agent_guide()` behavior after partial setup

### 4. No real `main()`-level install-flow regression net exists

The existing tests are helper-shaped. They do not prove that the full install
sequence still behaves correctly when the pieces are exercised together.

That leaves gaps around:

- call ordering
- variable handoff between steps
- final summary output
- rerun behavior
- interaction between doctor-driven repair and later setup stages

### 5. Some parsing helpers remain untested

In addition to authoring-skills parsing, `install.sh` also contains parser-heavy
logic such as operator metadata parsing. Parser bugs are cheap to introduce and
cheap to test, which makes the lack of direct coverage here avoidable.

## Why This Matters

The risk here is not hypothetical. The recent authoring-skills work already took
multiple rounds to land, which is a sign that this script is difficult to
change safely without a stronger regression net.

A likely failure mode looks like this:

- a PR preserves Node unit tests
- the CLI still behaves correctly on its own
- the shell wrapper misinterprets the output or mishandles a warning path
- users run the public installer and get a subtly broken environment

Because this script is both a setup path and a repair path, rerun safety also
matters. The script explicitly tells users to fix prerequisites and run it
again. That means idempotency and partial-failure recovery are part of the real
product contract, not optional polish.

## Recommended Testing Model

Treat `install.sh` as a first-class supported surface with its own explicit test
strategy.

The right model is a three-layer test pyramid:

### 1. Function-level shell harness tests

Keep the sourced-script pattern already used in the current install validations
and expand it.

Use these tests for:

- individual helper functions
- parser functions
- branch-specific logic with mocked binaries in a temp `PATH`

### 2. Shell-to-CLI contract tests

Add focused tests around the exact contracts `install.sh` consumes from the
Node CLI.

Use these tests for:

- JSON field presence
- malformed JSON handling
- partial JSON handling
- unknown-label tolerance
- default-value fallback behavior

### 3. End-to-end install-flow tests

Add hermetic tests that source the script and run `main()` in a fully mocked
environment.

Use these tests for:

- call ordering
- exit codes
- final summary text
- generated files
- cross-step handoff and rerun behavior

Adequate coverage here means testing the install contract users experience, not
just isolated helpers.

## Recommended Work Items

### 1. Add `validation/install/test_authoring_skills.sh`

Model it after `validation/install/test_java.sh` and
`validation/install/test_multidevice.sh`.

It should:

- source `install.sh`
- mock the `clawperator` binary in a temp `PATH`
- run `setup_authoring_skills_via_cli()`
- assert the resulting global variables and output

Required scenarios:

- successful install with well-formed JSON
- unknown `agentDiscoveryDir:<label>=...` entries are ignored
- CLI exits non-zero and the function marks status as failed without aborting
- `CLAWPERATOR_INSTALL_SKIP_SKILLS=1` sets status to skipped and suppresses the
  work
- `CODEX_HOME` override is reflected in the derived Codex discovery dir

### 2. Add a focused parser test for authoring-skills output

Add a small parser test, either as its own script or inside the authoring-skills
harness, for `parse_authoring_skills_install_result()`.

Required scenarios:

- valid JSON with all expected fields
- valid JSON missing some optional fields
- malformed JSON
- empty input

This is a high-value test because parser regressions are easy to introduce and
easy to diagnose when isolated.

### 3. Add `write_agent_guide()` assertions

After a successful mocked authoring-skills setup, call `write_agent_guide()` and
verify:

- `~/.clawperator/AGENTS.md` is written
- the skill listing reflects installed skills
- missing `version.txt` triggers the refresh guidance
- empty or missing install trees produce the fallback guidance

### 4. Add a combined skip-path regression

`CLAWPERATOR_INSTALL_SKIP_SKILLS=1` should suppress both:

- `setup_skills_via_cli()`
- `setup_authoring_skills_via_cli()`

That behavior should be pinned directly so future edits do not accidentally
split the two code paths.

### 5. Add at least one hermetic `main()` smoke test

A full end-to-end matrix can come later, but the hardening work should include
at least:

- one success-path `main()` test
- one failure-path `main()` test

Representative scenarios to grow toward:

- fresh success path on macOS
- fresh success path on Linux with `apt`
- authoring-skills CLI failure that warns but still completes
- multi-device environment where APK install is deferred
- final doctor failure path
- repeat install or idempotent rerun path

Each `main()` scenario should assert:

- exit code
- key summary text
- whether skills and authoring-skills steps ran
- generated `AGENTS.md` contents
- absence of unexpected fallback or error text

### 6. Add one obvious top-level entrypoint

The existing tests are spread across Node tests and validation scripts. Add a
single obvious developer command, for example
`validation/install/test_install.sh`, that runs
the install-related regression suite.

At minimum it should orchestrate:

- `npm --prefix apps/node run build`
- targeted Node install-related tests
- `validation/install/test_java.sh`
- `validation/install/test_multidevice.sh`
- new authoring-skills validation scripts

This is partly a testing improvement and partly a usability improvement.

### 7. Wire the expanded install suite into CI and contributor guidance

Once the new tests exist:

- add them to the validation workflow
- make them part of expected validation for any PR touching
  `sites/landing/public/install.sh`
- document the harness pattern so contributors know how to extend install
  coverage when they add new install phases

## Priority Order

| Priority | Work item |
| --- | --- |
| High | `validation/install/test_authoring_skills.sh` |
| High | parser coverage for `parse_authoring_skills_install_result()` |
| High | one obvious `validation/install/test_install.sh` entrypoint |
| High | one success-path and one failure-path `main()` smoke test |
| Medium | `write_agent_guide()` assertions |
| Medium | combined `CLAWPERATOR_INSTALL_SKIP_SKILLS` regression |
| Medium | parser coverage for other shell parsers such as operator metadata |
| Low | contributor-facing validation harness documentation |

## Hardening Rules Going Forward

Any future PR that changes `sites/landing/public/install.sh` should be expected
to ship with:

- at least one automated test proving the changed behavior
- validation of both success and failure branches for new logic
- explicit consideration of rerun safety
- explicit consideration of any new shell-to-CLI or shell-to-tool contract

If a change adds a new helper function, parser, or external dependency, it
should be treated as unprotected until a harness covers it directly.

## Practical Next Step

The best immediate hardening PR is:

1. add `validation/install/test_authoring_skills.sh`
2. add parser coverage for `parse_authoring_skills_install_result()`
3. add `write_agent_guide()` assertions
4. add one success-path and one failure-path hermetic `main()` test
5. add `validation/install/test_install.sh`
6. wire the new command into CI and validation guidance

That would move the project from "some install.sh testing exists" to
"install.sh has a deliberate regression net."

## Definition Of Done

Testing for `install.sh` should be considered adequate when all of the
following are true:

- there is one obvious command developers can run to validate install behavior
- CI runs that command or its exact underlying install-related steps
- the critical branches are covered:
  - Java detection and provisioning
  - Node detection and upgrade
  - multi-device APK handling
  - runtime skills setup
  - authoring-skills setup
  - `AGENTS.md` generation
  - final summary and install outcome reporting
- shell-to-CLI JSON contracts are pinned by tests
- rerun and partial-failure recovery paths are covered

Until then, `install.sh` should be treated as under-protected relative to its
importance.
