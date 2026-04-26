# SkillResult Contract Work Breakdown

This task spans two repositories:

- `~/src/clawperator`
- `~/src/clawperator-skills`

Each repository has its own branch and pull request:

- PR-C1 branch: `~/src/clawperator`, `codex/skill-result-contract-migration`
- PR-S1 branch: `~/src/clawperator-skills`, `codex/skill-result-contract`

Current state:

- PR-C1 Phases 1-3 are implemented, validated, committed, and review-clean.
- PR-S1 Phases 4-5 are implemented, validated, committed, and review-clean.
- PR-C2 Phases 6-7 are not started.
- PR-C2 should not start until PR-C1 and PR-S1 are merged or otherwise
  coordinated into validation.
- Public docs now intentionally describe only the canonical contract. Do not
  reintroduce legacy, old-shape, or migration-window public documentation.

## PR-C1: Clawperator Migration Contract

**Repo:** `~/src/clawperator`
**Suggested branch:** `codex/skill-result-contract-migration`
**Agent tier:** thinking
**Status:** done on branch; review-clean

### Phase 1: Add Migration-Phase `skillResult.result`

**Status:** done.

**Files:**

- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/fixtures/skills/com.test.skill-result/scripts/emit_skill_result.js`

**Tasks:**

1. Add `result?: SkillCheckpointEvidence | null` to the `SkillResult`
   interface before `status`.
2. Add `result: skillCheckpointEvidenceSchema.nullable().optional()` to the
   emitted SkillResult Zod schema (`emittedSkillResultSchema`) before
   `status`.
3. Add a `result-valid` mode to `emit_skill_result.js` that emits a
   `result` field shaped as `SkillCheckpointEvidence`, e.g.:
   ```js
   result: { kind: "json", value: { amount: "-$3.10" } }
   ```
4. Add a `result-plain-object` mode to `emit_skill_result.js` that emits a
   plain domain object as root `result` (not wrapped as `SkillCheckpointEvidence`),
   e.g. `result: { amount: "-$3.10" }`. This mode is used to prove the schema
   rejects malformed payloads.
5. In the `describe("runSkill")` block in `skills.test.ts`, add tests that
   run the fixture in `result-valid` mode and assert `skillResult.result` is
   present and matches the expected evidence shape.
6. Add a test that runs the fixture in `result-plain-object` mode and asserts
   the run fails with a schema validation error rather than silently stripping
   the field.
7. Add a test that runs the existing `valid` mode (no `result` field) and
   asserts `skillResult.result` is `undefined`, proving missing `result` is
   still accepted during the migration window.

**Acceptance criteria:**

- The runtime accepts `result` only when it matches `SkillCheckpointEvidence`.
- The nested `SkillResult` contract and test fixtures put `result` before
  `status`.
- Invalid plain-object `result` payloads fail validation with a clear error.
- Current framed fixtures without `result` still pass.
- The tests describe the temporary optional state clearly enough that PR-C2 can
  tighten it later.

### Phase 2: Deduplicate Framed Success Responses

**Status:** done.

**Files:**

- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/integration/serve.test.ts`

**Tasks:**

1. In `skills.ts`, for JSON success responses where `result.skillResult !== null`,
   omit duplicate top-level `status`, `skillId`, `exitCode`, and `output`.
   `skillResult` should lead with nested `result` and `status`.
2. In `skills.ts`, for JSON indeterminate responses where
   `result.skillResult !== null`, keep wrapper `status`, `code`, and `message`
   because they describe wrapper verification state. Omit duplicate `skillId`,
   `exitCode`, and `output`.
3. When `result.skillResult === null`, keep the existing runtime wrapper fields
   for compatibility. This is an implementation detail, not a public-doc
   teaching path.
4. In `skills.ts`, keep `output` on the `SKILL_OUTPUT_ASSERTION_FAILED` branch
   when `skillResult !== null` - this path uses `output` as a diagnostic showing
   what the skill printed when the assertion failed. Do not move `exitCode` into
   `SkillResult`; it is process metadata, not domain data.
5. Apply the same policy in `serve.ts`. The serve endpoint independently builds
   success, indeterminate, and assertion-failure skill response objects. For
   framed success responses, keep `ok` and `skillResult`; omit `status`,
   `skillId`, `exitCode`, and `output`. For indeterminate responses, keep `ok`,
   `status`, `code`, `message`, and `skillResult`; omit `skillId`, `exitCode`,
   and `output`. Keep `output` in the assertion failure object regardless. `ok`
   is a serve-specific HTTP-layer field and is not present in the CLI command
   output.
6. Do not change `runSkill.ts` or the domain-layer tests. The domain function
   intentionally returns raw stdout. The existing agent-driven SkillResult test
   that asserts `result.output.includes("[Clawperator-Skill-Result]")` is
   testing the domain layer and must not be modified.
7. Add CLI-layer tests in the `describe("cmdSkillsRun preflight gate")` block
   using the injected `runSkillImpl` pattern. A suitable test:
   - Creates a `fakeRunSkill` that returns `output` containing the literal
     `[Clawperator-Skill-Result]` marker, plus a non-null `skillResult`.
   - Calls `cmdSkillsRun` with `{ format: "json", runSkillImpl: fakeRunSkill }`.
   - Asserts that the parsed JSON has `skillResult`.
   - Asserts that top-level `status`, `skillId`, `exitCode`, and `output` are
     `undefined`.
8. Add a test for the `skillResult === null` path: `fakeRunSkill` returns a
   non-null `output`, `skillId`, `exitCode`, and a null `skillResult`. Assert
   those legacy wrapper fields are present and unchanged.
9. Add serve integration coverage proving `/skills/:skillId/run` follows the
   same policy: deduplicate framed success and indeterminate responses and keep
   `output` for assertion failures.

**Acceptance criteria:**

- JSON framed success responses omit duplicate top-level `status`, `skillId`,
  `exitCode`, and `output`.
- JSON framed indeterminate responses keep distinct wrapper status fields but
  omit duplicate `skillId`, `exitCode`, and `output`.
- JSON assertion-failure responses keep `output` for diagnostic context.
- Runtime compatibility responses for `skillResult` null keep existing wrapper
  fields, but public docs do not teach this as an authored skill shape.
- Domain-layer `runSkill` tests are unchanged.
- Serve endpoint tests prove the same policy as the CLI command.

### Phase 3: Update Clawperator Docs And Bundled Authoring Guidance

**Status:** done.

**Files:**

- `docs/skills/runtime.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/api/serve.md`
- `docs/api/recording.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-recording/SKILL.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-recording/agents/openai.yaml`
- `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/agents/openai.yaml`

**Tasks:**

1. Document trust order separately from field order: consumers branch on wrapper
   `status` and `code` first, may inspect `skillResult.status` as child-authored
   state, and read the domain answer from `skillResult.result`. Nested
   `SkillResult` examples still put `result` first and `status` second for
   scanability.
2. Keep public docs focused on the canonical contract. Do not document
   migration-window optionality in public docs.
3. Document that nested `skillResult` objects should be authored and shown with
   `result` first and `status` second.
4. Document singular `result` for collection payloads.
5. In `docs/skills/runtime.md`, add an explicit ideal framed success response
   example. It must show:
   - a wrapper object with `skillResult` at the top level
   - nested `skillResult.result` as the first field
   - nested `skillResult.status` as the second field
   - no duplicate top-level `status`, `skillId`, `exitCode`, or `output`
   - proof fields after the answer and child-authored status
6. In `docs/skills/authoring.md`, add authoring best practices for
   `SkillResult`:
   - every new or migrated framed skill emits `result`
   - `result` uses `SkillCheckpointEvidence`
   - collections use singular `result` with a JSON payload such as
     `{ items: [...] }`
   - `terminalVerification` proves the result but is not the answer channel
   - `diagnostics` is debug and health metadata only
   - non-trivial flows prefer map/state-machine checkpoints
   - framed payloads put `result` first and `status` second
7. In `docs/skills/overview.md`, update the high-level `skills run` examples so
   success examples show the clean canonical shape only.
8. In `docs/skills/runtime.md`, `docs/skills/overview.md`, and
   `docs/skills/authoring.md`, ensure examples and prose distinguish:
   - success: no duplicate top-level wrapper fields
   - indeterminate/failure: wrapper fields represent wrapper state
   - assertion failure: `output` is retained as diagnostic evidence
9. Document that success JSON responses omit `status`, `skillId`,
   `exitCode`, and `output`. Name those absent fields explicitly. Document that
   indeterminate wrappers keep distinct wrapper state (`status`, `code`,
   `message`). Document that `output` is present on assertion-failure paths.
   Document that failure wrappers expose process streams as `stdout` and
   `stderr`.
10. Document that `terminalVerification` is proof and `diagnostics` is debug
   metadata. Neither is the primary answer channel.
11. Document checkpoint presence semantics: existing skills may emit only reached
   checkpoints, but new and migrated non-trivial skills should prefer the
   map/state-machine pattern with unreached steps marked `skipped`.
12. Update examples that currently show framed SkillResult output without
   `result` when those examples are meant to guide new authoring.
13. In `apps/node/bundled-skills/clawperator-skill-author-by-recording/SKILL.md`,
   update the generated-skill expectations and the self-test inspection section:
   add `skillResult.result` first, keep `skillResult.status` second, state that
   framed success wrappers should not duplicate top-level wrapper fields, and
   state that authoring is incomplete until a self-test surfaces the canonical
   result path.
14. In `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md`,
   add equivalent guidance for discovery and recording handoff. Even though this
   skill does not author the durable runtime skill directly, its output should
   steer the recording workflow toward the same ideal SkillResult shape and
   should prefer nearby exemplars that already use `skillResult.result`.
15. Update the corresponding `agents/openai.yaml` files for both bundled skills
   if `default_prompt` or `short_description` reference skill-result inspection
   behavior, emitted SkillResult shape, self-test expectations, or recording
   handoff expectations.
16. Rebuild docs through the normal docs build workflow.

**Acceptance criteria:**

- No public doc tells agents to find primary answers in `diagnostics`,
  `terminalVerification`, or checkpoint ids.
- Public docs state that success JSON responses omit duplicate wrapper
  fields, name the four absent fields explicitly, and explain where `output` is
  kept and why.
- Public docs and bundled authoring guidance show nested `SkillResult` examples
  with `result` first and `status` second.
- `docs/skills/runtime.md` contains the ideal framed success response shape.
- `docs/skills/authoring.md` contains author-facing SkillResult best practices.
- `docs/skills/overview.md` teaches the clean success shape.
- Recording compare docs still say the full `skills run` wrapper is the durable
  compare input and uses `skillResult.checkpoints` and
  `skillResult.terminalVerification` for compare logic. Do not change the
  compare contract.
- Authoring docs prefer map/state-machine checkpoints for new and migrated
  non-trivial skills.
- Both bundled authoring skills ask agents to inspect and report
  `skillResult.result` and steer generated or handed-off skills toward the
  ideal shape.
- `./scripts/docs_build.sh` succeeds.

## PR-S1: Runtime Skills Migration

**Repo:** `~/src/clawperator-skills`
**Suggested branch:** `codex/skill-result-contract`
**Agent tier:** default
**Status:** done on branch; review-clean
**Can start:** done
**May run concurrently with:** done
**Must land before:** PR-C2

### Phase 4: Migrate Skill Outputs

**Status:** done.

**Files:**

- `skills/com.solaxcloud.starter.get-battery/**`
- `skills/com.android.vending.install-app/**`
- `skills/com.android.vending.search-app/**`
- `skills/com.google.android.apps.chromecast.app.get-climate-replay/**`
- `skills/com.amazon.mShop.android.shopping.search-products/**`
- `skills/com.globird.energy.get-yesterday-usage-cost-replay/**`
- setter replay and orchestrated skills that emit framed SkillResult output
- follow-up review fixes also covered:
  - `skills/com.google.android.apps.chromecast.app.set-power-replay/**`
  - `skills/com.google.android.apps.chromecast.app.set-temperature-replay/**`
  - `skills/com.solaxcloud.starter.set-discharge-to-limit-replay/**`
  - `skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/**`
  - `skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/**`
  - `skills/com.netflix.mediaclient.set-my-list-state-replay/**`
  - `skills/au.com.polyaire.airtouch5.set-zone-state/**`
  - `skills/au.com.polyaire.airtouch5.set-power-state/**`
  - `skills/au.com.polyaire.airtouch5.set-mode/**`
  - `skills/au.com.polyaire.airtouch5.set-fan-level/**`
  - `skills/utils/airtouch5_home_controls.js`
- `skills/skills-registry.json` only if metadata changes
- `skills/generated/**` only after running the generator when metadata changes

**Tasks:**

1. Migrate `com.globird.energy.get-yesterday-usage-cost-replay` first. Use it
   as the seed proof from `tasks/skills/contract/before-and-after.md`; its
   scalar answer must move to `skillResult.result` as
   `{ kind: "text", text: "<signed dollar amount>" }`.
2. In every migrated framed SkillResult payload, emit `result` first and
   `status` second.
3. For existing root `result` skills, wrap the payload as
   `{ kind: "json", value: ... }`.
4. For root `results` skills, rename to singular `result` and represent the
   collection as `{ kind: "json", value: { items: [...] } }`.
5. Move primary answer data out of `diagnostics`, `terminalVerification`, and
   checkpoint-only evidence into `result`.
6. Keep checkpoints and terminal verification as proof of how the answer was
   obtained.
7. For non-trivial migrated skills, prefer map/state-machine checkpoints:
   include the known checkpoint ids and mark unreached steps `skipped` instead
   of omitting expected path nodes.
8. Use `result: null` only when the skill cannot truthfully report a domain
   value or confirmed final state.
9. Fix isolated quality issues called out by `findings.md` while touching the
   affected skills, including conditional diagnostics in
   `set-discharge-to-limit-replay` if still useful and
   `set-my-list-state-replay` expected/observed duplication if still accurate
   after the result migration.
10. Update parser tests and local examples to assert the canonical `result`
   shape.
11. Regenerate generated indexes if any skill metadata changes:

   ```bash
   ./scripts/generate_skill_indexes.sh
   ```

**Acceptance criteria:**

- Every migrated framed skill emits a root `result` field in its SkillResult.
- Every migrated framed skill emits nested fields in the agent-scannable order:
  `result`, then `status`, then proof and diagnostics fields.
- `com.globird.energy.get-yesterday-usage-cost-replay` is the first migrated
  skill and matches the expected shape in
  `tasks/skills/contract/before-and-after.md`.
- No migrated skill keeps its primary answer only in `diagnostics`,
  `terminalVerification`, or checkpoint evidence.
- Collection skills use singular `result`.
- Setter skills report confirmed final state where the UI can prove it.
- Migrated non-trivial skills use map/state-machine checkpoints unless the skill
  has a documented reason to remain push-only.
- `./scripts/test_all.sh` succeeds.

### Phase 5: Validate Against The PR-C1 Node Build

**Status:** done.

**Files:**

- no required file edits unless validation exposes bugs

**Tasks:**

1. Build the Node CLI from the PR-C1 branch in `~/src/clawperator`.
2. Run migrated skill parser tests from `~/src/clawperator-skills`.
3. Run at least these representative skill checks when prerequisites are
   available:
   - `com.globird.energy.get-yesterday-usage-cost-replay` as the first migrated
     scalar read skill
   - one read skill with scalar text result
   - one read skill with JSON object result
   - one collection search skill
   - one setter skill with confirmed final state or truthful `null`
4. Save any validation command output needed for PR review notes.

**Acceptance criteria:**

- The branch-local Clawperator runtime parses migrated SkillResult objects and
  exposes `skillResult.result`.
- No validation relies on the globally installed `clawperator` binary.

## PR-C2: Clawperator Required Result

**Repo:** `~/src/clawperator`
**Suggested branch:** `codex/require-skill-result`
**Agent tier:** thinking
**Depends on:** PR-C1 and PR-S1
**Status:** not started

### Phase 6: Tighten Runtime Schema

**Status:** not started.

**Files:**

- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/fixtures/skills/**`

**Tasks:**

1. Change the TypeScript field to `result: SkillCheckpointEvidence | null`.
2. Change the Zod schema to require `result`.
3. Keep `result` before `status` in the TypeScript interface, Zod schema,
   fixtures, and examples.
4. Update tests and fixtures so framed SkillResult objects include `result`.
5. Add a regression test proving missing `result` now fails validation.
6. Keep `result: null` valid for failures or actions with no truthful domain
   value.

**Acceptance criteria:**

- Missing `result` is rejected for framed SkillResult objects.
- Required-result fixtures preserve nested field order with `result` first and
  `status` second.
- `result: null` remains valid when semantically correct.
- Wrapper behavior for `skillResult: null` remains an implementation
  compatibility path, not a public authored skill shape.

### Phase 7: Final Docs And Cross-Repo Smoke

**Status:** not started. Most public-doc cleanup was pulled forward into PR-C1
commit `027aff0e`; Phase 7 should verify those docs after Phase 6 rather than
reintroduce migration-history content.

**Files:**

- `docs/skills/runtime.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/api/serve.md`
- `docs/api/recording.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-recording/SKILL.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-recording/agents/openai.yaml`
- `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/agents/openai.yaml`

**Tasks:**

1. Confirm public docs and bundled guidance contain no migration-window or
   old-shape language.
2. Keep old-shape migration history out of public docs.
3. Confirm wrapper wording is final: `skillResult.result` is the answer,
   success JSON responses do not duplicate top-level `status`, `skillId`,
   `exitCode`, or `output`, `output` is retained only for assertion-failure
   diagnostics, and process streams are named `stdout` and `stderr` where
   exposed.
4. Confirm nested SkillResult field ordering is final: `result`, then `status`,
   then proof and diagnostics fields.
5. Confirm checkpoint guidance is final: map/state-machine checkpoints are the
   preferred shape for new and migrated non-trivial skills.
6. Confirm `docs/skills/runtime.md`, `docs/skills/overview.md`, and
   `docs/skills/authoring.md` all describe the same ideal SkillResult shape.
7. Confirm both bundled skill-author workflows teach the same shape and surface
   `skillResult.result` before `status`, checkpoints, or diagnostics during
   self-test review.
8. Build Node and run tests.
9. Build public docs.
10. Validate at least one migrated read skill and one migrated setter skill from
   `~/src/clawperator-skills` with the branch-local Node CLI.

**Acceptance criteria:**

- Public docs describe canonical `skillResult.result`.
- Public docs and examples put `result` first and `status` second inside nested
  `SkillResult` objects.
- Public docs and examples avoid duplicate success wrapper fields.
- Bundled skill authoring guidance matches the enforced schema.
- Both bundled skill-author workflows teach the ideal shape and surface
  `skillResult.result` first during self-test review.
- Public docs do not describe `output`, `diagnostics`, checkpoints, or
  `terminalVerification` as primary answer channels.
- Node build and tests pass.
- Docs build succeeds.
- Representative migrated skills parse successfully through `skills run`.

## Cross-Repo Coordination Notes

- PR-C1 and PR-S1 are both implemented and review-clean on their respective
  branches.
- PR-S1 tested against the PR-C1 branch-local Node CLI.
- PR-C2 should not land until migrated skills are available for validation.
- Keep Clawperator and Clawperator Skills commits separate. Do not mix sibling
  repo edits into one repository's PR.
- If PR-C1 changes the exact `SkillCheckpointEvidence` shape during review,
  update PR-S1 before merging either PR.
- If live-device validation is blocked by account state or device availability,
  record the blocker and still complete parser, replay, and fixture validation
  that does not require external state.
