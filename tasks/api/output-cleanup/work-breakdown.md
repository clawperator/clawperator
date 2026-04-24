# API Output Cleanup Work Breakdown

Parent plan: `tasks/api/output-cleanup/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 lives in the main repo: Phase 1 updates Node CLI
behavior, help, errors, and tests; Phase 2 updates authored docs, generated
skill scaffolding, host guidance, and matching tests; Phase 3 runs docs
regeneration and final validation. PR-2 lives in the sibling
`../clawperator-skills` repo: Phase 4 updates reference-facing skill examples
and safely classified runtime helper usage. Phase 1 uses `default`, Phase 2
uses `default`, Phase 3 uses `fast`, and Phase 4 uses `default`.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Preserve JSON as the default output format.
- Keep `--json`, `--output json`, and `--format json` working.
- Do not add `--result-format` or any new output-format spelling.
- Do not remove or warn on `--json`; it remains a silent compatibility
  shorthand.
- Make `read --all` and `read-value --all` work with default JSON output.
- Do not hand-edit `sites/docs/.build/` or `sites/docs/site/`.
- Use `.agents/skills/api-agent-ux/SKILL.md` for API naming and output-contract
  judgment.
- Use `.agents/skills/docs-author/SKILL.md` for authored public docs edits.
- A phase that changes behavior must include tests for that behavior in the same
  phase and commit.
- Do the sibling `../clawperator-skills` updates in a dedicated PR. Do not mix
  sibling repo content changes into the main repo PR.
- In the sibling repo, classify `--json` references before editing. User-facing
  examples and reference guidance are expected to move to the default-JSON
  shape. Runtime script internals may keep `--json` when it is an intentional
  compatibility or parsing guard.
- If implementation contradicts `tasks/api/output-cleanup/findings.md`, append
  an `## Execution Notes` section there before committing.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/api/output-cleanup/plan.md` | Stable contract, scope, decision rules, and output target |
| `tasks/api/output-cleanup/findings.md` | Starter analysis and recommendation already accepted by the user |
| `.agents/skills/api-agent-ux/SKILL.md` | Required API agent-UX workflow for output-format work |
| `docs/internal/design/node-api-design-guiding-principles.md` | Current design guidance, including the older `--json` wording that may need adjustment |
| `apps/node/src/cli/index.ts` | Global output default and parser aliases |
| `apps/node/src/cli/registry.ts` | Command help, teaching errors, and `read --all` explicit JSON guard |
| `apps/node/src/cli/output.ts` | Output formatting helper and current JSON-default comment |
| `apps/node/src/contracts/result.ts` | Result envelope contract that must not churn |
| `apps/node/src/test/unit/readAllJsonOutput.test.ts` | Existing coverage for the explicit-JSON guard to replace |
| `apps/node/src/test/unit/executeCommand.test.ts` | CLI regression patterns for `read --all` and `read-value --all` |
| `apps/node/src/test/unit/cliHelp.test.ts` | Help-text regression patterns |
| `apps/node/src/domain/skills/scaffoldSkill.ts` | Generated skill command examples |
| `apps/node/src/domain/host/hostSetup.ts` | Host setup guidance that currently teaches `--json` examples |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for public docs edits in Phase 2 |
| `../clawperator-skills/AGENTS.md` | Sibling repo rules for runtime skills |
| `../clawperator-skills/README.md` | Sibling repo reference surface |
| `../clawperator-skills/skills/utils/common.js` | Shared helper path for many skill scripts |
| `../clawperator-skills/skills/utils/common.test.js` | Shared helper regression patterns |
| `../clawperator-skills/scripts/test_all.sh` | Sibling repo validation gate |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Formalize JSON-default API output in the main repo | 1, 2, 3 | default, default, fast | none |
| PR-2 | Align sibling skills repo references with JSON default | 4 | default | PR-1 merged or accepted as the source-of-truth direction |

## Phase 1: Node CLI Behavior, Help, and Tests

### Agent Tier

default

### Goal

Make the CLI behavior and help text match the JSON-default contract while
preserving all existing explicit JSON aliases.

### Files or Surfaces To Change

- `apps/node/src/cli/index.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/output.ts`
- `apps/node/src/test/unit/readAllJsonOutput.test.ts`
- `apps/node/src/test/unit/executeCommand.test.ts`
- `apps/node/src/test/unit/cliHelp.test.ts`
- adjacent CLI unit tests if the existing files are not the right home

### Steps

1. Confirm `getGlobalOpts()` still defaults `output` to `"json"`.
2. Replace the `readAllRequiresExplicitJsonError()` behavior with a guard that
   rejects only non-JSON output for `read --all` and `read-value --all`.
   Default JSON must pass.
3. Update the `read --all` and `read-value --all` teaching errors so they
   explain `--output pretty` is not valid for multi-result machine reads and
   show examples without `--json`.
4. Update primary help blocks in `registry.ts` so common action examples omit
   `--json`. Keep global help discoverability for `--json` as a compatibility
   shorthand and `--output pretty` as human-readable output.
5. Keep parser compatibility unchanged for:
   - `--json`
   - `--output json`
   - `--format json`
   - global placement before the command
   - command-local placement after the command
6. Update or replace tests that expected explicit JSON for `read --all`.
7. Add focused regression cases.

Required test cases:

- `read --text "Price" --all --validate-only` succeeds without `--json`.
- `read-value --label "Battery" --all --validate-only` succeeds without
  `--json`.
- `read --text "Price" --all --output pretty --validate-only` fails with a
  teaching error that names JSON output and includes an example.
- `read-value --label "Battery" --all --output pretty --validate-only` fails
  with a teaching error that names JSON output and includes an example.
- `--json`, `--output json`, and `--format json` still select JSON output.
- At least one representative command returns parseable JSON without `--json`
  on an error path that does not require a device.
- CLI help says output defaults to JSON and presents `--json` as shorthand or
  compatibility, not as required.

### Acceptance Criteria

- Default JSON output still works.
- `read --all` and `read-value --all` no longer require explicit JSON when the
  effective format is JSON.
- Pretty mode remains rejected for all-read surfaces unless tests prove a stable
  supported pretty shape.
- Tests prove both default and explicit output-format paths.
- Help text no longer makes `--json` look mandatory for normal API calls.

Human review checklist:

- Output-format vocabulary is simpler than before.
- Compatibility aliases remain discoverable but secondary.
- Error messages teach the next valid command without over-explaining.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
fix(node): make default json satisfy all-read output
```

## Phase 2: Authored Docs, Scaffolds, and Runtime Guidance

### Agent Tier

default

### Goal

Update authored examples and generated guidance so agents learn the simpler
default command shape.

### Files or Surfaces To Change

- `docs/quickstart.md`
- `docs/api/overview.md`
- `docs/api/snapshot.md`
- `docs/api/doctor.md`
- `docs/api/environment.md`
- `docs/api/navigation.md`
- `docs/api/recording.md`
- `docs/api/selectors.md`
- `docs/skills/overview.md`
- `docs/skills/runtime.md`
- `docs/skills/authoring.md`
- `docs/skills/development.md`
- `docs/host-agents.md`
- `docs/setup.md`
- `docs/internal/design/node-api-design-guiding-principles.md`
- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/host/hostSetup.ts`
- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- `apps/node/src/domain/executions/timeoutGuidance.ts`
- `apps/node/src/cli/commands/record.ts`
- tests that assert generated guidance strings

This list is intentionally broad. Use `rg -n -- "--json"` to identify the
actual affected files, then apply the decision rules from the parent plan.

### Steps

1. Read `.agents/skills/docs-author/SKILL.md` before editing public docs.
2. Run:
   ```bash
   rg -n -- "--json" docs apps/node/src
   ```
3. Classify each match with the parent plan's decision rules.
4. Update primary API examples to omit `--json`.
5. Keep or rewrite `--json` references only when they are explicitly about:
   - compatibility shorthand
   - output-format aliases
   - saved historical artifacts that literally contain `--json`
   - a copy-paste hint that must remain compatible with older installed
     versions, with the reason captured in the commit message or execution
     notes
6. Update the node API design note so its principles no longer claim `--json`
   is preferred over `--output json`. The new primary should be default JSON,
   with `--json` as an accepted shorthand.
7. Update generated skill scaffolding examples in `scaffoldSkill.ts` to omit
   unnecessary `--json`.
8. Update host setup guidance and runtime hints so normal examples omit
   `--json` while error payloads remain parseable.
9. Update tests that assert old generated strings.
10. Run a final grep pass and inspect remaining matches.

Remaining `--json` references are allowed only in these categories:

- Compatibility or alias documentation.
- Explicit output-format discussions.
- Fixture data or historical artifacts where changing text would alter test
  intent.
- Commands documenting older saved artifact formats, such as a saved
  `skills run` wrapper, if code still calls that artifact by its historical
  name.
- Task files under `tasks/`, unless the active task pack itself requires an
  update.

### Acceptance Criteria

- Primary docs examples for observe, decide, act commands omit `--json`.
- Docs clearly state that CLI output defaults to JSON.
- `--json` is still documented as accepted shorthand, not removed.
- Generated skill scaffolds stop teaching unnecessary `--json`.
- Runtime hints and error suggestions no longer overuse `--json`.
- Tests that assert generated guidance strings are updated in the same phase.

Human review checklist:

- The docs match code behavior from Phase 1.
- The examples are easier for a first-time agent to guess.
- No docs claim a behavior the code does not support.
- Remaining `--json` references have a clear reason to remain.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
rg -n -- "--json" docs apps/node/src
```

The final `rg` is an inspection aid, not a zero-match gate. Review every
remaining match against the allowed categories above.

### Expected Commit

```text
docs(api): teach json as the default output
```

## Phase 3: Docs Build and Final Validation

### Agent Tier

fast

### Goal

Regenerate docs outputs through the official workflow and prove the whole PR is
ready for review.

### Files or Surfaces To Change

- `sites/docs/.build/`
- `sites/docs/site/`
- any generated docs artifacts produced by the repo docs build
- `tasks/api/output-cleanup/findings.md` only if execution notes are required

### Steps

1. Run the docs build workflow from the repo root.
2. Inspect generated changes and confirm they follow authored docs changes.
3. Run Node build and tests again after generated output changes.
4. Run a targeted grep for obsolete required-JSON phrasing.
5. Check `git diff` for accidental unrelated edits.
6. Update the task pack status only if the implementer is intentionally using
   the task files as an active execution record. Otherwise leave task status for
   final cleanup.

Targeted grep checks:

```bash
rg -n -- "requires explicit JSON|requires JSON output|Pass --json|Use --json|--json output mode|snapshot --json|doctor --json|skills list --json" docs apps/node/src
```

This command is an inspection aid. Some matches may remain valid, especially in
compatibility documentation, logging docs, or historical artifact descriptions.
Each remaining match must be intentionally kept.

### Acceptance Criteria

- `./scripts/docs_build.sh` succeeds.
- Node build and tests pass.
- Generated docs changes correspond to authored docs or code-derived content.
- No remaining primary example makes `--json` look required.
- The final diff is scoped to output-format cleanup.

Human review checklist:

- The PR reads as one coherent cleanup.
- The API story is consistent across code, help, docs, and scaffolds.
- The task did not silently change result envelope fields or Android behavior.

### Validation

```bash
./scripts/docs_build.sh
npm --prefix apps/node run build
npm --prefix apps/node run test
git diff --stat
```

### Expected Commit

```text
chore(docs): regenerate output docs for json default
```

## Phase 4: Sibling Skills Repo Reference Cleanup

### Agent Tier

default

### Goal

Update `../clawperator-skills` so skills used as references teach the same
default-JSON command shape, while preserving explicit `--json` in runtime
internals when it is intentionally needed.

### Files or Surfaces To Change

- `../clawperator-skills/README.md`
- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/skills/**/SKILL.md`
- `../clawperator-skills/skills/**/*.js`
- `../clawperator-skills/skills/**/*.test.js`
- `../clawperator-skills/skills/utils/common.js`
- `../clawperator-skills/skills/utils/common.test.js`

### Steps

1. Work in the sibling `../clawperator-skills` repo on a dedicated branch and
   PR. Do not commit these changes to the main `clawperator` repo.
2. Read `../clawperator-skills/AGENTS.md` before editing.
3. Run:
   ```bash
   rg -n -- "--json|clawperator snapshot|clawperator click|clawperator exec|clawperator skills run" \
     ../clawperator-skills/README.md \
     ../clawperator-skills/AGENTS.md \
     ../clawperator-skills/skills
   ```
4. Classify every match into one of these buckets:
   - user-facing reference example
   - skill `SKILL.md` usage example
   - runtime script command that parses CLI JSON output
   - debug-only command string shown to a nested agent
   - fixture or test data
   - historical artifact description
5. Update user-facing reference examples and skill usage examples to omit
   unnecessary `--json`.
6. Audit runtime script internals separately. Remove `--json` only when all of
   these are true:
   - the supported Clawperator version for the skill already defaults to JSON
   - tests can prove the helper still parses the returned shape
   - the flag is not part of a saved artifact name, debug instruction, or
     compatibility path
7. Prefer central helper changes where safe. If a shared helper like
   `runJsonCommand()` or a local `runClawperator()` wrapper intentionally means
   "force machine-readable output", it may keep passing `--json` and should be
   treated as an internal compatibility guard rather than a public example.
8. Update colocated tests for any changed script or helper behavior in the same
   commit.
9. Regenerate skill indexes only if manifest or registry-facing content changed.
   Do not regenerate indexes for script-only or prose-only edits unless the
   sibling repo's generator proves they are affected.

### Acceptance Criteria

- Sibling repo user-facing examples no longer imply `--json` is required for
  normal API calls.
- Any remaining `--json` in sibling runtime code is intentional and explainable
  in the PR description.
- Runtime helpers still parse Clawperator command output correctly.
- Sibling repo tests pass.
- The dedicated sibling PR is reviewable independently from the main repo PR.

Human review checklist:

- Reference skills now model the default-JSON API story.
- Runtime safety was not sacrificed for cosmetic cleanup.
- Remaining explicit JSON flags are classified, not accidental leftovers.

### Validation

```bash
(cd ../clawperator-skills && ./scripts/test_all.sh)
(cd ../clawperator-skills && rg -n -- "--json" README.md AGENTS.md skills)
```

The final `rg` is an inspection aid, not a zero-match gate. Review each
remaining match and describe why it remains in the PR.

### Expected Commit

```text
docs(skills): align examples with json-default cli output
```
