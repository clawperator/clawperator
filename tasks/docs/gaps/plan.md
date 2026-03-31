# Docs Gaps for Eval Fairness

## Executive Summary

Patch two pre-existing gaps in the public docs that will make the
`android-version` eval produce misleading results if left unfixed. Both gaps
are cases where good content existed in the old doc surface, was removed during
the Phase 2/3 docs refactor, and was not replaced with equivalent agent-facing
guidance in the new doc structure.

1 PR, 2 phases, docs-only surface. No code changes. Must land before the
Phase 1 eval harness produces results that are treated as meaningful.

## Status

| Item | Value |
| --- | --- |
| State | done |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | 1, 2 |
| Remaining | none |
| Current / Next | - |
| Blockers | none |

## Goal

An unfamiliar agent arriving at `docs.clawperator.com` with no prior Clawperator
knowledge should be able to:

1. Understand the observe-decide-act automation loop from a single entry page.
2. Read a snapshot result and understand the XML structure well enough to
   locate any visible on-screen element.

Both capabilities are required for the `android-version` eval to be a fair
test of agent capability rather than a test of docs quality.

## Why Now

The eval task pack (`tasks/evals/`) is the forcing function. The
`android-version` eval operates in `public-surface` mode: the agent may only
reference `docs.clawperator.com` and the installed `clawperator` binary. If
the docs do not cover the basic loop or provide a usable snapshot example, a
failing eval run tells us nothing about the agent - it only tells us the docs
are thin.

These gaps were introduced when `dc51c46` deleted the legacy doc tree that
contained:

- `docs/agent-quickstart.md` - cold-start loop, snapshot reading, basic actions
- `docs/navigation-patterns.md` - default observe-decide-act loop for unknown apps
- `docs/snapshot-format.md` - rich annotated Android Settings XML example

The replacements written in the Phase 2/3 refactor are technically correct and
code-verified but are organized as API reference rather than agent quickstart
material. The annotated example and the cold-start workflow pattern were not
carried forward.

## In Scope

- Add a rich annotated snapshot example to `docs/api/snapshot.md`.
  The example must be created fresh from a real device run. The API and
  logging pipeline changed substantially after the old example was written;
  copying the old example verbatim is incorrect.
- Add a new `docs/quickstart.md` page that describes the observe-decide-act
  loop end-to-end with a concrete worked example.
- Add `quickstart.md` to the `sites/docs/mkdocs.yml` nav between Setup and API.
- Regenerate `sites/docs/.build/` and verify `./scripts/docs_build.sh` passes.

## Out of Scope

- Changes to any code under `apps/`.
- Rewriting existing `docs/api/` reference pages beyond the snapshot example.
- Adding llms.txt or sitemap regeneration (handled by the existing release flow).
- Any change to `sites/landing/`.
- Eval harness implementation (that is `tasks/evals/`).
- Environment variable reference documentation (`CLAWPERATOR_BIN`,
  `CLAWPERATOR_OPERATOR_PACKAGE`, `ANDROID_SERIAL`, resolution order).
  In `public-surface` eval mode the harness injects these values directly,
  so the agent never needs to know the resolution order. This is a real
  documentation gap but not a Phase 1 eval prerequisite. It is tracked
  separately in `tasks/docs/envvars/` and should land before Phase 3 evals
  (`full-repo` mode + `published` runtime) are treated as meaningful.

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `docs/api/snapshot.md` | Add the annotated example section. All existing sections preserved as-is. |
| `docs/api/navigation.md` | Preserved. The quickstart page links to it for composition patterns. |
| `docs/quickstart.md` | New file. Does not exist today. |
| `sites/docs/mkdocs.yml` | One nav entry added under the top level. |
| `sites/docs/.build/` | Regenerated. Do not hand-edit. |

## Surfaces and Ownership

| Surface | Path | Change |
| --- | --- | --- |
| Authored docs | `docs/api/snapshot.md` | Annotated example section added |
| Authored docs | `docs/quickstart.md` | New page |
| Docs-site nav | `sites/docs/mkdocs.yml` | One nav entry |
| Docs-site build | `sites/docs/.build/` | Regenerated output |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current snapshot contract | `apps/node/src/domain/executions/snapshotHelper.ts`, `apps/node/src/domain/observe/snapshot.ts` |
| Current snapshot step data fields | `docs/api/snapshot.md` (existing sections) |
| Current node attributes in XML | Run a fresh `clawperator snapshot --json` on a connected device |
| CLI command names and flags | `apps/node/src/cli/registry.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Docs-site nav | `sites/docs/mkdocs.yml` |
| Docs-build pipeline | `sites/docs/source-map.yaml`, `./scripts/docs_build.sh` |
| Old deleted docs (reference only - do not copy) | `git show dc51c46^:docs/agent-quickstart.md`, `git show dc51c46^:docs/navigation-patterns.md`, `git show dc51c46^:docs/snapshot-format.md` |

## Deterministic Versus Judgment

| Aspect | Type | Rule |
| --- | --- | --- |
| Snapshot example XML | Deterministic | Captured from a real device run. Use the output verbatim, trimmed to the illustrative subset. Do not invent node attributes. |
| Annotated comments in example | Judgment | Write inline comments that explain what each node type demonstrates. Follow the annotation style from the old `snapshot-format.md`. |
| Quickstart page structure | Deterministic | Must include the exact sections defined in `work-breakdown.md`. |
| Prose quality | Judgment | Match the style of existing docs: direct, second-person, no marketing. |
| Nav placement | Deterministic | `quickstart.md` goes between `setup.md` and the API section in `mkdocs.yml`. |

## Decision Rules

| Question | Rule |
| --- | --- |
| Can I copy text from old deleted docs? | No. Read them for structural reference. Write all new content from the current code and a fresh device run. |
| Which device should I use for the snapshot example? | Any connected Android device or emulator. Record the device model or Android version in findings.md. |
| Should the quickstart be in the API section? | No. It is a top-level page placed between Setup and API in the nav. |
| Should I update `docs/index.md` to link to the quickstart? | Yes. Add a link or reference to `quickstart.md` from the index page. |
| How long should the annotated example be? | Long enough to show: a scroll container, an icon-only button (no text, uses content-desc), a clickable row with title and summary children, a static label, and at least one node with a stable resource-id. Trim surrounding context; do not include the full device dump. |

## Failure Modes To Prevent

- Copying old snapshot examples that were written against a different result
  envelope shape. The `actual_format`, `foreground_package`, `has_overlay`,
  and `window_count` field semantics changed. Use the current contract.
- Writing a quickstart that assumes the agent has repo access. The eval runs
  in `public-surface` mode. Every link must point to a page on
  `docs.clawperator.com`, not a local file.
- Regenerating `.build/` before the authored docs are complete. Always finish
  the authored content first, then regenerate once at the end.
- Hand-editing `sites/docs/.build/`. It is generated output.
- Adding a `findings.md` that contains only tool output without the required
  annotation (see Output Contract below).

## Output Contract

`findings.md` must be created at the start of Phase 1 and updated by each
phase. Required sections:

```
## Device Used
<model, Android version, device serial (redacted to placeholder)>

## Fresh Snapshot Output
<raw JSON from clawperator snapshot --json, trimmed to the illustrative subset>

## XML Subset Selected for Example
<the specific XML nodes chosen and why>

## Old Docs Reference
<brief notes on what the old docs had that informs structure - not copied prose>

## Phase 1 Decisions
<annotation approach chosen, any nodes removed or added and why>

## Phase 2 Decisions
<quickstart structure chosen, links added, any content deferred>
```

## Idempotency

Running `./scripts/docs_build.sh` again after the PR merges must produce the
same `.build/` output. No state outside `docs/`, `sites/docs/mkdocs.yml`, and
`sites/docs/source-map.yaml` should be required.

## Durable Follow-Up

| Item | Permanent home |
| --- | --- |
| Annotated snapshot example | `docs/api/snapshot.md` |
| Cold-start workflow guide | `docs/quickstart.md` |
| Nav registration | `sites/docs/mkdocs.yml` |

After this task is complete and the PR merges, `docs/gaps/` may be deleted.
The knowledge lives in `docs/` permanently.
