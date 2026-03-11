# Task: CI Test Failures - Investigation (RESOLVED)

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

## Fix applied

All three affected files were updated to derive a `packageRoot` constant from
`import.meta.url` instead of `process.cwd()`:

  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

This matches the pattern already used in `runtimeConfig.ts`. The two-candidate
`resolveTestRegistryPath()` workaround in `skills.test.ts` was replaced with a
single direct path relative to `packageRoot`.

All 155 tests now pass regardless of invocation directory:

  node --test apps/node/dist/test/**/*.test.js   # from repo root - 155/155
  cd apps/node && node --test dist/test/**/*.test.js  # from package - 155/155

## Fixed files

- `apps/node/src/test/unit/cliHelp.test.ts`
- `apps/node/src/test/unit/emulatorCli.test.ts`
- `apps/node/src/test/unit/skills.test.ts`
