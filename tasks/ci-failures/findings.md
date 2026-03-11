# Task: CI Test Failures - Investigation

## Finding: No real failures - cwd sensitivity

All 155 Node unit tests pass when run correctly:

  cd apps/node && node --test dist/test/**/*.test.js
  # tests 155 / pass 155 / fail 0

The 13 apparent failures only occur when tests are invoked from the repo root:

  node --test apps/node/dist/test/**/*.test.js  # WRONG - produces 13 false failures

## Root cause

`apps/node/src/test/unit/cliHelp.test.js` and `emulatorCli.test.js` spawn the
CLI binary using `join(process.cwd(), "dist", "cli", "index.js")`. When cwd is
the repo root, that path does not exist and every spawned process exits with
code 1.

`skills.test.js` (`loadRegistry`, `compileArtifact`) has a similar dependency
on cwd for resolving local fixture or registry paths.

## Current state

The npm script is correct:

  # apps/node/package.json
  "test": "node --test dist/test/**/*.test.js"

`npm --prefix apps/node run test` sets cwd to apps/node/ before running,
so all tests pass. The build/test sequence in CLAUDE.md is correct.

## Fragility to address

Tests that spawn subprocesses or resolve file paths relative to `process.cwd()`
will silently produce false failures when invoked from the wrong directory.
Options:

1. Resolve paths relative to `import.meta.url` (the test file itself) rather
   than `process.cwd()`. This is portable regardless of invocation directory.

2. Add a guard at the top of affected test files that asserts or corrects cwd
   before running (e.g., `process.chdir(new URL("../../..", import.meta.url))`).

3. Document the constraint explicitly and add a repo-root wrapper script that
   routes to the correct directory.

Option 1 is the most robust and matches the pattern already used in
`runtimeConfig.ts` (`dirname(fileURLToPath(import.meta.url))`).

## Affected test files

- `apps/node/src/test/unit/cliHelp.test.js` - CLI binary path via process.cwd()
- `apps/node/src/test/unit/emulatorCli.test.js` - same pattern
- `apps/node/src/test/unit/skills.test.js` (`loadRegistry`, `compileArtifact`)
  - needs investigation to confirm same root cause
