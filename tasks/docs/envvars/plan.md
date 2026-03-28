# Environment Variable Reference Documentation

## Executive Summary

Add a `docs/configuration.md` reference page documenting Clawperator's
environment variables: what they control, the resolution order for each,
default values, and what happens when they are set incorrectly.

1 PR, 1 phase. Docs-only surface.

Must land before Phase 3 evals (`full-repo` mode, `published` runtime) are
treated as meaningful benchmarks. An agent operating in `full-repo` mode can
read the repo and may attempt to configure its own runtime; without this page,
it has no documented contract to follow.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 1 |
| Completed | none |
| Remaining | 1 |
| Current / Next | 1 |
| Blockers | `tasks/docs/gaps/` must land first (establishes doc quality baseline) |

## Goal

An agent or developer arriving at `docs.clawperator.com` can answer the
following questions from a single page:

1. Which environment variables does Clawperator recognize?
2. What is the resolution order when both a flag and an env var are set?
3. What is the default when neither is set?
4. What error surfaces when the value is wrong or missing?

## Why Now (Relative to Evals)

In `public-surface` eval mode (Phase 1), the harness injects all env vars
directly - the agent never needs to know they exist. In `full-repo` eval mode
(Phase 3), the agent has access to the repo and may inspect `CLAUDE.md`,
source files, and docs. Without a canonical public reference, a `full-repo`
agent has to infer resolution order from source code. That conflates "can the
agent use Clawperator" with "can the agent read TypeScript source."

Timing: this PR should merge before Phase 3 eval results are collected.
It does not block Phase 1 or Phase 2.

## In Scope

- New `docs/configuration.md` page covering all public-facing env vars
- Nav entry in `sites/docs/mkdocs.yml` (under Setup or as a top-level
  reference entry)
- Regenerate `sites/docs/.build/` and verify `./scripts/docs_build.sh` passes

## Out of Scope

- Internal-only env vars used by the eval harness (`CLAWPERATOR_CMD` is
  harness-internal and not a public API surface)
- Changes to any code under `apps/`
- Changes to existing `docs/` pages beyond adding a link to
  `docs/configuration.md` from `docs/setup.md`

## Env Vars to Document

Verify each exists as a real resolution path in the Node CLI source before
documenting it. Do not document aspirational vars.

| Env Var | Controls | Resolution order |
| --- | --- | --- |
| `ANDROID_SERIAL` | Target device serial | Explicit `--device` flag > `ANDROID_SERIAL` env var > auto-select if exactly one device connected |
| `CLAWPERATOR_BIN` | Which binary to invoke | `CLAWPERATOR_BIN` env var > local sibling build (`apps/node/dist/cli/index.js`) > global `clawperator` on PATH |
| `CLAWPERATOR_OPERATOR_PACKAGE` | Which Operator APK to target | `--operator-package` flag > `CLAWPERATOR_OPERATOR_PACKAGE` env var > auto-detect if exactly one variant installed > `com.clawperator.operator` |

The table above reflects the intended contract. Verify the actual resolution
order in source before writing the docs page - see Source Of Truth below.

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `docs/configuration.md` | New file. Does not exist today. |
| `docs/setup.md` | Add one cross-reference link to `configuration.md`. No other changes. |
| `sites/docs/mkdocs.yml` | One nav entry added. |
| `sites/docs/.build/` | Regenerated. Do not hand-edit. |

## Surfaces and Ownership

| Surface | Path | Change |
| --- | --- | --- |
| Authored docs | `docs/configuration.md` | New page |
| Authored docs | `docs/setup.md` | One cross-reference link added |
| Docs-site nav | `sites/docs/mkdocs.yml` | One nav entry |
| Docs-site build | `sites/docs/.build/` | Regenerated output |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| `ANDROID_SERIAL` resolution | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| `CLAWPERATOR_BIN` resolution | `apps/node/src/cli/` (look for env var reads at startup or in binary resolution logic) |
| `CLAWPERATOR_OPERATOR_PACKAGE` resolution | `apps/node/src/cli/selectorFlags.ts` and any operator package resolution code |
| CLI flag names | `apps/node/src/cli/registry.ts` |
| Error codes for wrong values | `apps/node/src/contracts/errors.ts` |
| Existing flag documentation | `docs/setup.md` sections on `--device` and `--operator-package` |

## Deterministic Versus Judgment

| Aspect | Type | Rule |
| --- | --- | --- |
| Resolution order per var | Deterministic | Read the source. Write exactly what the code does. |
| Default values | Deterministic | Read the source. Do not invent defaults. |
| Error codes for invalid values | Deterministic | Read `errors.ts`. Quote the exact error code. |
| Prose explanation | Judgment | Concise, second-person, matches existing docs style. |
| Nav placement | Judgment | Place under Setup section or as a top-level Reference entry - choose based on what makes it most findable for a cold-start agent. |

## Decision Rules

| Question | Rule |
| --- | --- |
| What if a var is only partially implemented (e.g. read but not validated)? | Document the actual behavior. Note if the fallback is silent. |
| What if the source resolution logic differs from CLAUDE.md? | The code is correct. Write from the code. Flag the CLAUDE.md discrepancy in findings.md. |
| Should I document `CLAWPERATOR_CMD`? | No. It is an eval harness internal. Not a public env var. |
| Where should the nav entry go? | Verify where `docs/setup.md` appears in `sites/docs/mkdocs.yml` and place `configuration.md` immediately after it. |
| Do I need to update `docs/index.md`? | Only if the index page has a "reference" or "configuration" section. Otherwise, the nav entry is sufficient. |

## Failure Modes To Prevent

- Documenting aspirational resolution order that differs from what the code
  actually does. Always read source before writing.
- Documenting `CLAWPERATOR_CMD` as a public env var. It is not.
- Writing examples that use the `.dev` operator package without noting that
  this is the local-dev variant. Always distinguish release from debug.
- Hand-editing `sites/docs/.build/`. It is generated output.

## Acceptance Criteria

1. `docs/configuration.md` exists and covers all three env vars with their
   resolution order, defaults, and error cases.
2. The resolution order documented matches the source code (verified via
   Source Of Truth files above).
3. `docs/setup.md` contains a cross-reference link to `docs/configuration.md`.
4. `sites/docs/mkdocs.yml` nav includes `configuration.md`.
5. `./scripts/docs_build.sh` completes without errors.

## Durable Follow-Up

| Item | Permanent home |
| --- | --- |
| Env var reference | `docs/configuration.md` |
| Nav registration | `sites/docs/mkdocs.yml` |

After this task is complete and the PR merges, `tasks/docs/envvars/` may be
deleted.
