# API Output Cleanup

## Executive Summary

Make the existing JSON-by-default behavior the formal agent-facing contract and
remove the remaining places that teach or require `--json` as the normal API
path. This is two PRs across four phases. PR-1 updates the main repo: Node CLI
behavior and help cleanup, authored docs and scaffold cleanup, then validation
and generated-doc rebuild. PR-2 updates the sibling `../clawperator-skills`
reference-facing examples and any safe shared helpers. The current state is
planned, with findings already captured in `tasks/api/output-cleanup/findings.md`.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships, Clawperator's agent-facing CLI examples and behavior
should communicate a simple contract: commands return parseable JSON by default;
`--json` remains a supported compatibility shorthand; `--output pretty` is the
explicit human-readable mode.

## Why Now

Intro-video API framing exposed a mismatch between the intended model and the
examples agents see. The code already defaults to JSON, but docs, help text,
runtime hints, generated skill scaffolding, and one `read --all` guard still
make `--json` look required. That friction teaches agents the wrong first
command shape.

## In Scope

- Formalize JSON as the default agent-facing CLI result format.
- Preserve `--json`, `--output json`, and `--format json` as accepted forms.
- Remove the explicit JSON opt-in requirement for `read --all` and
  `read-value --all`.
- Update CLI help and teaching errors so primary examples omit `--json`.
- Update authored docs under `docs/` to present the simpler common path.
- Update scaffolded skill examples and runtime hints that unnecessarily append
  `--json`.
- Update user-facing reference examples in the sibling `../clawperator-skills`
  repo in a dedicated PR.
- Audit sibling repo runtime script internals and shared helpers for `--json`
  usage, changing only cases that are safe under the supported Clawperator
  version contract.
- Add focused regression coverage proving JSON output without `--json`.
- Regenerate docs outputs through the repo docs workflow after authored docs
  change.

## Out of Scope

- Adding a new `--result-format` flag or any other format-spelling alias.
- Removing support for `--json`.
- Changing the result envelope schema.
- Changing Android runtime behavior.
- Rewriting unrelated API examples beyond output-format cleanup.
- Changing generated docs by hand.
- Broadly removing `--json` from sibling runtime scripts without checking
  whether the explicit flag is needed for compatibility, parsing, debug mode,
  or saved artifact semantics.

## Existing Artifact Scope

`tasks/api/output-cleanup/findings.md` is in scope as the starter analysis and
recommendation. Preserve the existing findings. If implementation uncovers a
material contradiction, append an `## Execution Notes` section rather than
rewriting the original recommendation.

Existing docs and help examples are in scope only where they teach output
format, parseability, or command examples affected by the JSON-default contract.
Do not use this task to broadly rewrite page structure or unrelated API prose.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/cli/index.ts` | Preserve JSON default and output aliases; adjust only if tests expose a needed parser fix | Phase 1 |
| `apps/node/src/cli/registry.ts` | Remove explicit JSON requirement for `read --all` and `read-value --all`; update help and teaching errors | Phase 1 |
| `apps/node/src/cli/output.ts` | Source-of-truth comment may be tightened if useful; no schema churn | Phase 1 |
| `apps/node/src/domain/skills/scaffoldSkill.ts` | Stop scaffolding unnecessary `--json` in new skill examples | Phase 2 |
| `apps/node/src/domain/host/hostSetup.ts` and runtime hints | Prefer default-JSON examples unless a specific pretty-mode instruction is intended | Phase 2 |
| `apps/node/src/test/unit/` | Regression coverage for output defaults, all-read behavior, aliases, errors, and help | Phases 1 and 2 |
| `docs/` | Authored public docs updated through docs-author workflow | Phase 2 |
| `sites/docs/.build/`, `sites/docs/site/` | Generated only through docs build, never hand-edited | Phase 3 |
| `../clawperator-skills/skills/**/SKILL.md` | User-facing skill examples and reference guidance updated in a dedicated sibling PR | Phase 4 |
| `../clawperator-skills/skills/**/*.js` | Runtime script internals audited and changed only when safe | Phase 4 |
| `../clawperator-skills/skills/utils/` | Shared helpers audited for whether explicit JSON remains intentional | Phase 4 |
| `../clawperator-skills/scripts/test_all.sh` | Sibling repo validation gate for pure JS changes | Phase 4 |
| `tasks/api/output-cleanup/findings.md` | Append execution notes only if implementation changes the plan | Any phase |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| API agent UX principles | `docs/internal/design/node-api-design-guiding-principles.md`, `.agents/skills/api-agent-ux/SKILL.md` |
| CLI parsing and global output defaults | `apps/node/src/cli/index.ts` |
| CLI commands, help text, and teaching errors | `apps/node/src/cli/registry.ts` |
| Output formatting behavior | `apps/node/src/cli/output.ts` |
| Result envelope contract | `apps/node/src/contracts/result.ts` |
| Skill scaffolding examples | `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Host setup guidance generated by Node | `apps/node/src/domain/host/hostSetup.ts` |
| Existing CLI tests | `apps/node/src/test/unit/cliRegistry.test.ts`, `apps/node/src/test/unit/cliHelp.test.ts`, `apps/node/src/test/unit/executeCommand.test.ts`, `apps/node/src/test/unit/readAllJsonOutput.test.ts` |
| Authored docs | `docs/` |
| Docs generation boundaries | `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` |
| Sibling runtime-skill references | `../clawperator-skills/README.md`, `../clawperator-skills/AGENTS.md`, `../clawperator-skills/skills/**/SKILL.md` |
| Sibling skill runtime code | `../clawperator-skills/skills/**/*.js`, especially `../clawperator-skills/skills/utils/common.js` and colocated tests |

## Deterministic Versus Judgment

Deterministic - do not re-derive:

- The default output format remains JSON.
- `--json` remains accepted as a compatibility shorthand.
- `--output json` and `--format json` remain accepted.
- `--output pretty` remains the human-readable opt-in.
- Do not add `--result-format`.
- Primary API examples should omit `--json` unless the sentence is explicitly
  documenting output-format aliases or compatibility.
- `read --all` and `read-value --all` must work with the default JSON output.
- Generated docs must be produced by the docs build workflow, not edited by
  hand.
- Sibling repo user-facing examples should follow the same default-JSON contract
  once PR-1 has established it in main-repo docs and help.
- Sibling repo runtime code must be classified before editing. Do not assume a
  script-internal `--json` is merely documentation.

Judgment required:

- Which historical or troubleshooting examples should keep `--json` because
  they are explicitly documenting compatibility or quoting existing output.
- How much CLI help text to shorten while still making `--json` discoverable.
- Whether any runtime hint should keep `--json` for copy-paste compatibility
  with older installed Clawperator versions. If kept, record the reason in the
  phase notes or commit message.
- In the sibling skills repo, whether a script-internal `--json` is safe to
  remove or should remain as an explicit compatibility guard.

## Decision Rules

| Question | Rule |
| --- | --- |
| Should an example include `--json`? | No, unless the surrounding text is specifically about output-format aliases, backwards compatibility, or a saved historical artifact. |
| What is the documented primary machine-readable path? | Run the command with no output-format flag. |
| How should humans request readable output? | Use `--output pretty`. |
| What happens to `--json`? | Keep accepting it forever as a compatibility shorthand. Do not remove it or make it noisy. |
| Should `--format json` stay? | Yes. It is already an alias for `--output json`. |
| Should `read --all` require explicit JSON? | No. The default JSON output is sufficient. |
| Should pretty mode be allowed for `read --all`? | No, unless implementation proves a stable pretty shape already exists and tests cover it. Prefer teaching `--output pretty` users to switch to JSON for multi-result reads. |
| Where do docs changes belong? | Authored changes go under `docs/`; generated docs are rebuilt through scripts. |
| Should sibling repo updates be in the same PR as main repo updates? | No. Use a dedicated `../clawperator-skills` PR after or alongside the main repo PR. Keep cross-repo review boundaries clear. |
| Which sibling repo `--json` references should change? | User-facing examples and reference guidance should usually drop `--json`. Runtime script internals change only after classifying compatibility and parsing impact. |

## Failure Modes To Prevent

- Shipping docs that say JSON is default while `read --all` still rejects the
  default output path.
- Removing or breaking `--json` compatibility.
- Adding a new output-format flag and increasing vocabulary instead of reducing
  friction.
- Updating docs but leaving CLI help and errors teaching the old pattern.
- Updating help but leaving generated skill scaffolds to cargo-cult `--json`.
- Hand-editing `sites/docs/.build/` or `sites/docs/site/`.
- Letting tests assert old example strings without proving the new behavior.
- Leaving `../clawperator-skills` reference examples teaching the old pattern
  after the main repo says JSON is default.
- Removing `--json` from sibling skill internals and breaking compatibility
  with currently supported installed Clawperator versions.

## Output Contract

After this task:

- `clawperator snapshot` returns parseable JSON by default.
- `clawperator read --text "Price" --all` returns parseable JSON by default.
- `clawperator read-value --label "Battery" --all` returns parseable JSON by
  default.
- `clawperator <command> --json` still works.
- `clawperator <command> --output json` and `--format json` still work.
- `clawperator <command> --output pretty` remains the explicit pretty mode.
- CLI help and primary docs examples teach commands without `--json`.
- Docs explain `--json` as compatibility shorthand, not as a required API flag.

After PR-2:

- Sibling skill `SKILL.md` examples use the default-JSON command shape unless a
  specific compatibility or artifact reason requires `--json`.
- Sibling runtime scripts either omit unnecessary `--json` or retain it with a
  deliberate reason documented in the PR.
- `../clawperator-skills/scripts/test_all.sh` passes.

## Idempotency

- Re-running docs cleanup should not repeatedly churn examples that already omit
  `--json`.
- Re-running tests should not depend on a connected Android device unless the
  specific test already required one before this task.
- Re-running docs build should deterministically regenerate the same generated
  docs from authored sources.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| JSON-default API contract | `docs/api/overview.md`, `docs/quickstart.md`, and CLI help in `apps/node/src/cli/registry.ts` |
| Output-format compatibility aliases | `docs/internal/design/node-api-design-guiding-principles.md` and CLI help |
| Result envelope shape | `apps/node/src/contracts/result.ts` and `docs/api/overview.md` |
| Agent-UX rationale | `docs/internal/design/node-api-design-guiding-principles.md` |
