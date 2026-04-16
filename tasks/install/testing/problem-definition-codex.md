# Task: install.sh Testing Hardening

Created: 2026-04-16

## Problem

`sites/landing/public/install.sh` is one of the highest-risk entrypoints in the
repo:

- it is the public one-command install path exposed at `https://clawperator.com/install.sh`
- it provisions host prerequisites, installs the CLI, drives doctor-based setup,
  downloads and installs the operator APK, and now also configures runtime and
  authoring skills
- failures here are user-facing, easy to regress, and expensive to debug after
  release because they depend on OS, shell, package manager, Node, Java, adb,
  device state, and network behavior

Commits `868119e06a1886c6be975eeb7debe575adaab897` and
`4c35e3186cc12877afb1a99b98e810e4bde436e2` materially expanded `install.sh`
behavior. In particular, the script now:

- calls `clawperator authoring-skills install --output json`
- parses JSON emitted by the CLI to discover install and agent-wiring paths
- updates the generated `~/.clawperator/AGENTS.md`
- changes final install reporting based on authoring-skill outcomes

That expansion increased the number of branches, contracts, and external
dependencies inside a script that was already business-critical.

## Current Coverage

There is existing testing, but it is fragmented and narrower than the current
behavior surface:

- `apps/node/src/test/integration/installScript.test.ts`
  covers `check_node()` upgrade behavior through sourced-shell execution and
  fake `nvm` state
- `validation/test_install_java.sh`
  exercises several `check_java()` branches with stubbed tools
- `validation/test_install_multidevice.sh`
  exercises one `maybe_install_operator_apk()` multi-device path

Important gaps remain:

- no committed test was found for `setup_authoring_skills_via_cli()`
- no committed test was found for `parse_authoring_skills_install_result()`
- no committed test was found for `write_agent_guide()` authoring-skills output
- no committed test was found for `main()` sequencing around skills, authoring
  skills, doctor reruns, and final summary output
- no committed test was found for failure-handling branches where the CLI emits
  malformed JSON, partial JSON, non-zero exit codes, or unexpected path labels
- the shell validation scripts are outside the normal Node test suite and do not
  appear prominently in the default root-level test scripts

## Why This Is Risky

The main risk is not just "the script is big." The deeper problem is that
`install.sh` now contains contract-sensitive glue logic between multiple
surfaces:

- shell logic in `sites/landing/public/install.sh`
- JSON output contracts from the Node CLI
- filesystem side effects in `~/.clawperator`, `~/.claude`, `$CODEX_HOME`, and
  temporary download locations
- adb and doctor behavior that varies by connected-device state

This means regressions can happen even when each individual component seems
fine in isolation. Examples:

- the CLI changes its JSON shape and the shell parser silently falls back to
  defaults
- authoring skills install partially succeeds, but `AGENTS.md` claims the wrong
  directories
- output text changes break a "best effort" branch without causing a hard
  failure, so the install looks successful while leaving the host misconfigured
- a main-path refactor preserves `check_node()` tests while breaking the actual
  end-to-end `main()` flow

The current test layout is weighted toward helper functions, not toward the
full install contract users actually experience.

## Recommendation

Treat `install.sh` as a supported product surface with its own explicit test
strategy, not as incidental shell glue.

The right model is a testing pyramid with three layers:

1. Function-level shell harness tests
   - keep and expand the sourced-script style already used for `check_node()`,
     `check_java()`, and `maybe_install_operator_apk()`
   - add isolated tests for every behaviorally meaningful helper function

2. Contract tests across shell and CLI
   - test the exact JSON contract consumed by
     `parse_skills_registry_path()` and `parse_authoring_skills_install_result()`
   - pin success, partial-success, malformed-json, and schema-drift cases

3. End-to-end install-flow tests
   - run `main()` in a hermetic fake environment with stubbed `curl`, `npm`,
     `adb`, `clawperator`, package managers, and filesystem roots
   - assert final output, generated files, and call ordering for representative
     scenarios

Adequate coverage here means testing the install contract, not just the helper
functions.

## What Should Be Added

### 1. Promote install.sh testing into the normal validation path

The existing validation scripts should not be easy to miss. At minimum:

- add a dedicated repo-level install test entrypoint, for example
  `scripts/test_install`
- make it invoke:
  - `npm --prefix apps/node run build`
  - `npm --prefix apps/node run test -- installScript.test.js` or equivalent
  - `validation/test_install_java.sh`
  - `validation/test_install_multidevice.sh`
- wire that entrypoint into the default pre-merge validation guidance for any
  change touching `sites/landing/public/install.sh`

Longer term, the shell validations should be callable from one obvious command
and from CI, not only by repo-specific memory.

### 2. Add missing authoring-skills coverage

Add focused tests for:

- `parse_authoring_skills_install_result()`
  - valid JSON with all expected labels
  - valid JSON with unknown labels
  - valid JSON missing some fields
  - malformed JSON
  - empty output
- `setup_authoring_skills_via_cli()`
  - success path
  - skip path with `CLAWPERATOR_INSTALL_SKIP_SKILLS=1`
  - CLI failure path that must remain non-fatal
  - success path with partial JSON that falls back to default directories
- `write_agent_guide()`
  - install tree with skills and `version.txt`
  - install tree with skills but no `version.txt`
  - empty or missing install tree

These should be treated as regression tests for the behavior added by
`868119e...` and `4c35e31...`.

### 3. Add end-to-end `main()` scenario tests

Add hermetic tests that source the script and execute `main` with all external
commands stubbed. Start with a small but representative matrix:

- fresh success path on macOS
- fresh success path on Linux/apt
- authoring-skills CLI failure that should warn but still complete
- multi-device environment where APK install is deferred
- final doctor failure path
- repeat install / idempotent rerun path

Each scenario should assert:

- exit code
- key final summary text
- generated `AGENTS.md` contents
- whether skills and authoring-skills steps ran
- whether unexpected fallback messages appeared

### 4. Pin shell-to-CLI contracts explicitly

The contract between shell and CLI is currently implicit in string parsing.
Harden it by:

- documenting the expected JSON fields consumed by `install.sh`
- adding tests in the Node CLI that guarantee those fields remain present
- adding shell-side tests that fail if those fields disappear or rename

The goal is to catch contract drift before release, not after users pipe the
script from the website.

### 5. Verify idempotency and partial-failure repair

Because `install.sh` is a recovery tool as much as an installer, tests should
cover:

- rerunning after partial setup
- rerunning after authoring-skills failure
- rerunning when Java or Node is already valid
- rerunning when device state changes between doctor runs

This area is especially important because the script itself tells users to
re-run it after fixing prerequisites.

## Recommended Hardening Rules

Any future PR that changes `sites/landing/public/install.sh` should be expected
to ship with:

- at least one new or updated automated test proving the changed behavior
- explicit validation of both success and failure branches for new logic
- a check that the script remains safe to re-run
- a review of whether the change introduces a new shell-to-CLI or shell-to-tool
  contract that needs pinned coverage

If a change adds a new helper function or a new external command dependency, it
should be assumed untested until a harness covers it directly.

## Practical Next Step

Create a dedicated install-test hardening PR with this scope:

1. add a single obvious `scripts/test_install` entrypoint
2. migrate or wrap the current shell validations under that entrypoint
3. add missing authoring-skills shell tests
4. add at least one hermetic `main()` success-path test and one failure-path
   test
5. wire the new command into CI and repo validation guidance

That would move the project from "some install.sh testing exists" to
"install.sh has a deliberate regression net."

## Definition Of Done For This Hardening Work

Testing for `install.sh` should be considered adequate when all of the
following are true:

- there is one obvious command developers can run to validate install behavior
- CI runs that command automatically
- the current critical branches are covered:
  - Java detection/provisioning
  - Node detection/upgrade
  - multi-device APK handling
  - skills setup
  - authoring-skills setup
  - `AGENTS.md` generation
  - final summary / install outcome reporting
- shell-to-CLI JSON contracts are pinned by tests
- rerun and partial-failure recovery paths are covered

Until then, `install.sh` should be treated as under-protected relative to its
importance.
