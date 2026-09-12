# Repository test execution

## Current entry points

There is no repository-wide test runner. Test commands are split between the
Android Gradle tasks, Node package scripts, Python eval tests, and validation
harnesses. CI repeats those commands in separate jobs.

- `./gradlew unitTest` runs debug unit tests across Android modules.
- `npm --prefix apps/node run build` builds Node; its tests consume `dist/`.
- `npm --prefix apps/node run test` uses shell-expanded patterns that do not
  reliably discover every test file.
- `.github/workflows/pull-request.yml` contains additional Python and validation
  commands that are not included in either command above.
- `scripts/test_all` and `scripts/test_all_local` cover Android only. Their final
  successful `echo` can mask a failed test command.

On the R10 branch, comparing the built test inventory with the Node test
command's `/bin/sh` expansion found 68 test files and only 13 selected files.
The 55 omitted files included `query.test.js`. These are file counts, not test
case counts, and should be remeasured on the implementation branch. A passing
standard Node suite is not evidence that all Node tests passed.

The R10 checks explicitly ran `query.test.js`, `mcpHelpers.test.js`, and
`integration/mcp.test.js` in addition to the standard command. The manual
sensitive-hierarchy workflow includes those explicit checks.

## Separate PR follow-up

Consolidate test execution in a separate PR because discovery fixes affect all
surfaces and can expose existing failures unrelated to sensitive hierarchy
access. Keep this work outside R10.

1. Inventory Android, Node, Python, and validation tests against CI. Classify
   off-device tests separately from tests requiring a device or external service.
2. Add a canonical runner under `validation/`, with off-device suites as the
   default and suite selection for CI jobs. Build Node before testing and use
   explicit recursive discovery independent of shell glob behavior.
3. Report each suite's result and return nonzero when a selected suite fails or
   a required prerequisite is missing. Verify this using injected failures;
   later successful commands must not overwrite failure status.
4. Make existing wrappers and CI jobs delegate to the same suite definitions.
   Document one local command and the prerequisites for each optional suite.
5. Require explicit opt-in and a selected device for device tests. Keep the
   sensitive-hierarchy emulator workflow manual-only; do not add emulator startup
   to routine pull-request checks.
6. Run the complete discovered off-device set, triage newly exposed failures,
   and record any unresolved failures explicitly before claiming full coverage.

Until consolidation is complete, choose checks from the owning surface and
invoke relevant flat Node test files explicitly. The repository's existing
validation requirements still apply.
