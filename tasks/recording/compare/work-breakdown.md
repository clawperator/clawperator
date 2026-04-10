# Recording Compare Work Breakdown

Parent plan: `tasks/recording/compare/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 4.

- PR-1: compare model, fixtures, implementation, tests
- PR-2: Solax proving integration and docs cleanup

Current state: blocked until `tasks/recording/skill-result-contract/` lands.
Live proving also depends on W2b because the semantic compare cases need the
agent-driven orchestrated Solax skill.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 after W2 |
| Blockers | `tasks/recording/skill-result-contract/` must land first; P3 also waits on `tasks/recording/agent-driven-skills/` |

## Hard Rules

- Do not compare skill runs to raw recording events one-to-one.
- Do not depend on `record parse` as the only baseline artifact.
- Do not let tests read from `../clawperator-skills/` at runtime.
- Do not require a live device to exercise compare tests.
- Do not call the feature “replay validation” unless final persisted state is included in the proof path.
- If the compare output cannot explain the first divergence for the Solax flow, the compare design is not done.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/compare/plan.md` | Stable compare scope and blockers |
| `tasks/recording/brain-hand-contract/problem-definition.md` | Contract-first rationale for compare sequencing |
| `tasks/recording/skill-result-contract/plan.md` | Upstream contract compare must consume |
| `tasks/recording/agent-driven-skills/plan.md` | Why semantic compare is required for agent-driven runs |
| `docs/api/recording.md` | Recording export behavior and limits |
| `docs/skills/authoring.md` | Current authoring contract and durable docs destination |
| `apps/node/src/domain/recording/exportRecording.ts` | Recording export schema source |
| `tasks/recording/demo/findings.md` | Solax-specific divergence lessons and proof history |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Define and implement compare on top of `SkillResult` | P1, P2 | `thinking`, `default` | W2 landed |
| PR-2 | Prove with Solax and finish docs | P3, P4 | `default` | PR-1 merged locally and validated |

## Phase P1: Define The Compare Model

### Agent Tier

`thinking`

### Goal

Define checkpoint comparison and divergence classification on top of
`SkillResult`, including the rules for when compare is path-literal versus
terminal-outcome-semantic.

### Files or Surfaces To Change

- `tasks/recording/compare/`
- optionally a compact design note if the model cannot fit cleanly in implementation docs

### Steps

1. Define checkpoint comparison semantics for both supported modes:
   - `literal`: checkpoints are matched by identity and order
   - `semantic`: terminal outcome is authoritative; checkpoint drift is
     described but not treated as failure when the declared verification still
     holds
2. Define how raw recording export normalizes into the checkpoint baseline.
   This includes:
   - which export events become checkpoint identities
   - which events remain supporting evidence only
   - how package transitions and timeline facts contribute
   - how missing snapshots affect normalization
3. Define divergence classes:
   - `baseline_drift` (skill diverged from baseline at a named checkpoint)
   - `outcome_matches_path_differs` (agent-driven run reached the goal through
     a different valid route)
   - `verification_failed` (terminal verification did not match)
   - `verification_indeterminate` (declared verification not proved at all)
   - `upstream_failure` (the skill exited non-zero or `SkillResult.status`
     was `failed`; compare reports the upstream cause and stops walking)
   - `runtime_poisoned` (operator/accessibility/runtime evidence in
     `execEnvelopes` shows the runtime was in a stuck state)
   - `runtime_unavailable` (device disconnected, accessibility service down)
4. Decide whether v1 gets explicit runtime-state signaling from W2. If not,
   collapse `runtime_poisoned` and `runtime_unavailable` to
   `upstream_failure` and record that limitation instead of guessing.
5. Define the fixture plan for TDD using local sanitized fixtures only.
6. Define how compare handles a baseline that contains UI snapshots
   (`snapshotMode: include`) versus one that does not. Baselines without
   snapshots must still be sufficient for checkpoint-identity compare.

### Acceptance Criteria

- Compare model is defined without inventing a parallel trace mechanism.
- The plan defines a concrete export-to-checkpoint normalization step instead
  of assuming raw export already contains canonical checkpoints.
- Divergence classes are explicit, named, and exhaustive enough for the brain
  to branch on them.
- The plan explicitly states whether `runtime_poisoned` and
  `runtime_unavailable` are first-class v1 classes or postponed behind
  `upstream_failure`.
- Fixture plan enumerates the specific files and the divergence each one
  forces (see P2 file list).
- The CLI surface is finalized:
  `clawperator recording compare --baseline <file> --result <file> [--json]`.
- The plan explicitly defines when compare returns
  `outcome_matches_path_differs` instead of `baseline_drift`.

### Validation

```bash
git diff -- tasks/recording/compare
```

### Expected Commit

```text
chore(tasks): define recording compare model
```

## Phase P2: Implement Compare

### Agent Tier

`default`

### Goal

Implement compare against recording export baselines using `SkillResult`.

### Files or Surfaces To Change

- `apps/node/src/`
- `apps/node/src/test/fixtures/recording-compare/`
- `apps/node/src/test/`

### Steps

1. Add failing tests first using local fixtures.
2. Implement export-to-checkpoint normalization for recording baselines,
   including `snapshotMode: omit`.
3. Implement compare against the derived checkpoint baseline using
   `SkillResult`, with both literal and semantic handling.
4. Add CLI behavior and tests for the
   `clawperator recording compare --baseline <file> --result <file> [--json]`
   surface, covering:
   - both files present and well-formed
   - missing `--baseline` value
   - missing `--result` value
   - file not found
   - malformed JSON in either file
5. Ensure `--json` output carries the typed divergence report and exit code
   matches plan Decision Rules.
6. Ensure human-readable output names the first divergent checkpoint and its
   class.

**Fixture format note:** Compare logic operates on a bare `SkillResult` object
after the CLI layer extracts it from the `skills run --json` wrapper. Unit
tests for compare logic therefore use bare `SkillResult` fixtures. CLI
integration tests use full wrapper-format files (the saved output of
`clawperator skills run --json`). Keep these two sets distinct in the
fixture tree.

Required fixtures under `apps/node/src/test/fixtures/recording-compare/`:

Logic-layer fixtures (bare `SkillResult`, used by compare unit tests):

- `solax-baseline-success.export.json` — Solax-shaped recording export with
  the raw export evidence for the canonical sequence
- `solax-baseline-success.normalized.json` — expected normalized checkpoint
  baseline derived from the export fixture above
- `solax-baseline-sanitized.export.json` — retained-baseline variant of the
  export fixture above with placeholders such as `<device_serial>`,
  `<person_name>`, `<place_name>`, and `<account_email>` substituted for
  sensitive values while preserving the structural facts compare relies on
- `solax-baseline-sanitized.normalized.json` — expected normalized checkpoint
  baseline derived from the sanitized export fixture above; should match the
  canonical normalized baseline wherever placeholder-only changes occurred
- `solax-result-replay-success.skillresult.json` — bare `SkillResult` with
  `source: { kind: "script" }` whose checkpoint sequence matches the baseline
  exactly; proves literal mode against the preserved replay skill
- `solax-result-success.skillresult.json` — bare `SkillResult` whose
  checkpoints match the baseline, `source: { kind: "agent", agentCli: "codex" }`,
  and `terminalVerification` proves the goal; proves semantic success on the
  same outcome
- `solax-result-success-path-differs.skillresult.json` — bare `SkillResult`
  with `source.kind: "agent"`, terminal verification proved, but checkpoint
  sequence differs from baseline (valid for agent-driven run)
- `solax-result-baseline-drift.skillresult.json` — bare `SkillResult` that
  diverges at one named checkpoint (e.g. `device_discharging_card_opened`
  missing or replaced)
- `solax-result-verification-failed.skillresult.json` — bare `SkillResult`
  whose checkpoints match but `terminalVerification` shows the persisted
  value did not equal the requested value
- `solax-result-indeterminate.skillresult.json` — bare `SkillResult` whose
  checkpoints match but `terminalVerification` is `null`
- `solax-result-upstream-failure.skillresult.json` — bare `SkillResult` with
  `status: "failed"` and a partial checkpoint list
- `solax-result-runtime-poisoned.skillresult.json` — only if W2 ships an
  explicit runtime-state signal for `poisoned`
- `solax-result-runtime-unavailable.skillresult.json` — only if W2 ships an
  explicit runtime-state signal for `unavailable`

CLI-layer fixtures (full `skills run --json` wrapper, used by CLI integration
tests for the `--result` flag):

- `solax-skills-run-replay-success.json` — full saved `skills run --json`
  output for the replay success fixture above; proves compare extracts the
  wrapper's `skillResult` and auto-selects literal mode from `source.kind`
- `solax-skills-run-success.json` — full saved `skills run --json` output
  wrapping the success `SkillResult` above; used to confirm compare correctly
  extracts `skillResult` from the wrapper
- `solax-skills-run-malformed-wrapper.json` — a file that parses as JSON but
  lacks the `skillResult` field; must produce a typed parse error from compare

Each logic-layer fixture exists to force one specific divergence class. A test
must pin every fixture to its expected class so a regression fails loudly.

### Acceptance Criteria

- Compare works without a live device.
- Local fixtures listed above all exist and are exercised in tests.
- Normalization from raw export to checkpoint baseline is covered by tests and
  does not rely on implicit assumptions.
- At least one test proves normalization against a placeholder-templated
  retained baseline export and confirms compare still reaches the same
  checkpoint conclusions as the unsanitized equivalent.
- Each divergence class enumerated in P1 is exercised by at least one
  fixture-driven test.
- The `outcome_matches_path_differs` case is exercised by at least one
  fixture-driven test and returns a non-error compare outcome.
- New tests added under `apps/node/src/test/` run under the default
  `npm --prefix apps/node run test` path; if not, the PR updates CI in the
  same change.
- If runtime-state classes are postponed behind `upstream_failure`, no
  poisoned/unavailable fixtures exist in v1 and the limitation is documented
  in the compare docs and task status.
- Baselines created with `snapshotMode: omit` are supported.
- The CLI surface returns exit code `0` for compare outcomes with no meaningful
  divergence, including:
  - the literal replay success fixture
  - the semantic `outcome_matches_path_differs` fixture
  and returns non-zero for true divergence, upstream failure, or parse/input
  errors.

### Validation

```bash
npm --prefix apps/node run build
```

```bash
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(recording): compare skill results to recording baselines
```

## Phase P3: Prove With Solax

### Agent Tier

`default`

### Goal

Show the compare output is useful on the real Solax orchestrated proving skill.

### Files or Surfaces To Change

- `../clawperator-skills/`
- local fixture copies in `apps/node/src/test/fixtures/recording-compare/`

### Steps

1. Run the preserved replay Solax skill on-device, capture both the retained
   baseline export and the emitted `SkillResult`, and compare them; expect
   literal success.
2. Run a happy-path orchestrated Solax invocation against that same retained
   baseline. Compare it; expect semantic success, not literal mode.
3. Capture an agent-driven orchestrated run that takes a different valid path
   than the recording baseline but still reaches terminal verification.
   Compare it; expect `outcome_matches_path_differs`, not failure.
4. Force a `baseline_drift` divergence on-device (e.g. by changing the
   skill's checkpoint sequence in a sanitized branch) and compare; expect
   the first divergent checkpoint to be reported by identity.
5. Force a `verification_failed` divergence on-device (e.g. by requesting a
   value the skill records as set but the persisted row does not actually
   show) and compare; expect the verification class.
6. Sanitize and copy the captured artifacts into
   `apps/node/src/test/fixtures/recording-compare/` so the P2 tests are
   anchored to evidence from real runs, not hand-written shapes.
7. From that same captured baseline, create a placeholder-templated retained
   baseline fixture and confirm compare normalization produces the same
   checkpoint baseline as the non-sanitized version wherever only sensitive
   leaf values changed.
8. Capture forced-divergence artifacts from a throwaway local branch or local
   uncommitted patch in `../clawperator-skills` that is discarded after
   evidence capture. Do not merge the forced-divergence implementation.

### Acceptance Criteria

- One literal replay-backed live run is proven.
- One semantic orchestrated live run against the same retained baseline is
  proven.
- One valid agent-driven path-different run is proven and classified as
  `outcome_matches_path_differs`.
- A `baseline_drift` divergence is proven against a live forced run.
- A `verification_failed` divergence is proven against a live forced run.
- The fixtures listed in P2 are derived from these live runs (where
  practical) rather than hand-authored from scratch.
- The normalization fixture is derived from the captured export, not invented
  independently of it.
- The placeholder-templated retained baseline fixture is proven against the same
  normalization logic as the canonical baseline and does not exist only as prose.
- The forced-divergence implementation used for evidence capture is not
  merged into either repo; only the sanitized fixtures persist.
- Compare identifies the first meaningful difference and classifies it
  using the P1 divergence classes.

### Validation

```bash
# Save a live run as the --result input (full skills run --json wrapper):
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
  --device <device_serial> --json -- 40 \
  > /tmp/solax-run.json

# Run compare against the recording baseline:
node <clawperator_root>/apps/node/dist/cli/index.js recording compare \
  --baseline ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json \
  --result /tmp/solax-run.json \
  --json
```

### Expected Commit

```text
test(recording): prove compare with solax fixtures
```

## Phase P4: Finish Docs And Cleanup

### Agent Tier

`default`

### Goal

Capture durable compare guidance and close the task cleanly.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- `tasks/recording/compare/`

### Steps

1. Move durable compare guidance into docs.
2. Update task status and remaining follow-ons.
3. Note whether repo-local authoring-skill work is now unblocked.

### Acceptance Criteria

- Durable compare guidance exists outside `tasks/`.
- Task state is updated truthfully.

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(recording): document compare workflow
```
