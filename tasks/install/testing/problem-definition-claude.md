# Problem Definition: install.sh Test Coverage

## Background

`sites/landing/public/install.sh` is the primary install entrypoint for Clawperator.
Users pipe it directly into bash. It is 1,100+ lines, runs with `set -euo pipefail`, and
orchestrates the full host setup sequence: Java, Node.js, ADB, git, curl, the CLI itself,
skills, authoring skills, APK download, device setup, and doctor validation.

Two recent PRs - `868119e` and `4c35e31` - expanded the script significantly. The first
added the `authoring-skills` CLI commands and their Node-level logic. The second wired
authoring skills installation into install.sh and added doctor coverage for it. Both were
iterative to land. The script is now more capable and correspondingly more complex, but
the shell-level test surface did not grow at the same pace as the feature surface.

This document defines the coverage problem and recommends what to do about it.

---

## What the Script Does (Code Path Map)

The `main()` function executes this sequence unconditionally (exit on failure except
where noted):

1. `validate_os` - detect darwin/linux, fail on other
2. `check_java` - detect/install JDK 17 or 21
3. `check_node` - detect/upgrade Node >= 24 via nvm
4. `check_curl`, `check_adb`, `check_git` - detect/install system tools
5. `install_cli` - `npm install -g clawperator@latest`
6. `run_doctor_and_fix` - run doctor, auto-repair missing adb/APK/permissions
7. `setup_skills_via_cli` - best-effort: `clawperator skills install`
8. `setup_authoring_skills_via_cli` - best-effort: `clawperator authoring-skills install`
9. `write_agent_guide` - write `~/.clawperator/AGENTS.md` summarizing installed skills
10. Final doctor check and success/failure output

Steps 7-9 are best-effort: failures produce warnings but do not abort the install.

---

## Existing Test Coverage

### What is tested

| Area | Location | Mechanism |
|------|----------|-----------|
| Node.js upgrade logic | `apps/node/src/test/integration/installScript.test.ts` | Sources install.sh functions, mocks nvm in temp dir |
| Java detection + install (6 scenarios) | `validation/test_install_java.sh` | Bash test harness, mocks brew/apt/pacman in temp dir |
| Multi-device APK install logic | `validation/test_install_multidevice.sh` | Bash test harness, mocks adb + clawperator bin |
| `copyAuthoringSkills()` CLI function (18+ cases) | `apps/node/src/test/unit/authoringSkills.test.ts` | Node unit tests, real fs in temp dir |
| Authoring skills npm pack behavior | `apps/node/src/test/unit/authoringSkillsPack.test.ts` | Node unit tests |
| Doctor service | `apps/node/src/test/unit/doctor/` | Node unit tests |

### CI execution

`.github/workflows/pull-request.yml` runs all of the above on every PR. The validation
scripts are invoked directly as bash on ubuntu-latest. Node tests run via `npm run test`.

### What is not tested

The existing validation tests for install.sh are unit-shaped: they isolate individual
install phases (Java, Node, multi-device) by sourcing specific functions with mocked
binaries. The CLI-level authoring skills logic is well-covered by Node tests. But the
shell-level glue introduced in `4c35e31` - the functions that run the CLI and interpret
its output - has no test coverage at the shell level.

Specific untested paths:

**1. `setup_authoring_skills_via_cli()` (lines 540-596)**
The function runs `clawperator authoring-skills install --output json`, parses the JSON
output via `parse_authoring_skills_install_result`, and extracts five global variables
(`AUTHORING_SKILLS_INSTALL_DIR`, `AUTHORING_SKILLS_CLAUDE_DIR`, etc.) from labeled
`key=value` lines. There is no test that:
- mocks the CLI binary and verifies the parsed variables are set correctly
- verifies that unknown label entries (e.g. `agentDiscoveryDir:gemini=...`) are silently
  ignored as intended
- verifies the failure path (CLI exits non-zero) sets `AUTHORING_SKILLS_SETUP_STATUS=failed`
  without aborting the install
- verifies `CLAWPERATOR_INSTALL_SKIP_SKILLS=1` suppresses authoring skills and prints the
  skip message

**2. `parse_authoring_skills_install_result()` (the JSON parser)**
The function translates JSON into `key=value` lines that `setup_authoring_skills_via_cli`
reads. No test verifies correct extraction of `installedDir` and `agentDiscoveryDirs`
entries from real-shaped CLI output, or graceful handling of malformed JSON.

**3. `write_agent_guide()` with authoring skills context**
The guide writer reads `AUTHORING_SKILLS_INSTALL_DIR` and enumerates symlinks to produce
a skill listing. No test verifies the listing is correct when authoring skills are
installed, shows a refresh prompt when `version.txt` is absent, or handles the case where
the install dir does not exist.

**4. The `setup_skills_via_cli` + `setup_authoring_skills_via_cli` + `write_agent_guide`
sequence**
No test exercises all three in order. A regression that breaks the variable handoff
between steps (e.g. `AUTHORING_SKILLS_SETUP_STATUS` or the `AUTHORING_SKILLS_INSTALL_DIR`
default used in the guide) would not be caught.

**5. `CODEX_HOME` support**
`setup_authoring_skills_via_cli` substitutes `CODEX_HOME` as the base for the codex
discovery dir if set. This path is exercised by the Node unit tests for `copyAuthoringSkills`
but not by any shell-level test.

**6. APK metadata JSON parsing**
`parse_operator_metadata` (lines ~689-737) converts JSON to shell variables. No test
verifies it handles malformed or missing fields without crashing the script.

**7. End-to-end dry-run / main() integration**
No test runs `main()` against a fully mocked environment and verifies exit code, output,
and final state together.

---

## Why This Matters

install.sh is both the first thing users run and the hardest thing to test manually.
Changes to it require either a real device or careful manual simulation. The recent PRs
involved significant iteration precisely because shell behavior is hard to reason about
statically. A regression in the authoring skills parsing or the guide writer would not be
caught by any existing check before it ships.

The risk pattern is: a change that is correct at the Node level (covered by unit tests)
but broken at the shell wrapper level (not covered) makes it to production.

---

## Recommendations

### 1. Add a `validation/test_install_authoring_skills.sh` test harness

Model it after `test_install_java.sh` and `test_install_multidevice.sh`. The harness
should:

- Source install.sh functions from a temp working directory
- Provide a mock `clawperator` binary in `$PATH` that emits controlled JSON output
- Run `setup_authoring_skills_via_cli` and assert the resulting global variables
- Cover these scenarios:
  - Successful install: CLI emits well-formed JSON, variables extracted correctly
  - Unknown agent labels: extra `agentDiscoveryDir:gemini=...` entries are ignored
  - CLI failure: non-zero exit, `AUTHORING_SKILLS_SETUP_STATUS=failed`, install does not abort
  - `CLAWPERATOR_INSTALL_SKIP_SKILLS=1`: function skips with warning, status set to `skipped`
  - `CODEX_HOME` override: codex dir reflects the override, not the default

Wire this script into CI alongside the existing validation scripts.

### 2. Add a `validation/test_install_parse_authoring_skills.sh` parser test

Separately cover `parse_authoring_skills_install_result` with known-good and
known-bad JSON inputs. Parser bugs are easy to write and easy to test in isolation.
Scenarios:
- Well-formed JSON with all expected fields
- JSON missing optional fields (partial installs)
- Empty or non-JSON input (should produce no output, not crash)

This can be a short script (30-50 lines). Keeping it separate from the setup function
test makes failures easier to diagnose.

### 3. Add a `write_agent_guide` test to the authoring skills harness

After running `setup_authoring_skills_via_cli` with a successful mock, call `write_agent_guide`
and verify:
- `AGENTS.md` is written to the expected location
- The skill listing reflects installed skills (symlinks in the install dir)
- When `version.txt` is absent, the guide suggests running `clawperator authoring-skills update`

### 4. Add a `CLAWPERATOR_INSTALL_SKIP_SKILLS` regression test

This flag should suppress both `setup_skills_via_cli` and `setup_authoring_skills_via_cli`.
Neither the existing Node tests nor the validation scripts verify the flag's behavior for
both functions together. Add a single scenario to the authoring skills harness (or a
separate skip test) that sets the flag and confirms both skip messages appear and neither
CLI is invoked.

### 5. Consider a minimal `main()` smoke test

A full end-to-end test of `main()` would require mocking every external binary and network
call. That is high effort, but a minimal version is achievable: mock all CLI dependencies
(java, node, adb, git, curl, clawperator) to return success stubs and verify that `main()`
exits 0 with expected output patterns. This is the most valuable regression surface because
it catches integration failures that function-level tests miss (wrong call order, missing
variable initialization, unset exits).

If a full main() mock is too expensive to maintain, prioritize the function-level harnesses
above. They already provide most of the value.

### 6. Document the test harness pattern for contributors

The existing `test_install_java.sh` and `test_install_multidevice.sh` are good models but
are not documented as such. A brief note in `validation/README.md` explaining the pattern
(source functions, mock binaries in temp PATH, assert globals and output) would make it
easier for contributors to add tests when they extend install.sh. Contributors adding new
install phases should know they are expected to add a corresponding validation script, just
as they would add Node unit tests for CLI changes.

---

## Priority Order

| Priority | Work item |
|----------|-----------|
| High | `test_install_authoring_skills.sh` harness with 5 scenarios |
| High | `test_install_parse_authoring_skills.sh` parser test |
| Medium | `write_agent_guide` assertions added to authoring skills harness |
| Medium | `CLAWPERATOR_INSTALL_SKIP_SKILLS` combined-flag regression |
| Low | Minimal `main()` smoke test |
| Low | `validation/README.md` contributor guide |
