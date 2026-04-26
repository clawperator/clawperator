# SkillResult Contract Work Breakdown

This task spans two repositories:

- `~/src/clawperator`
- `~/src/clawperator-skills`

Each repository must receive its own branch and pull request. Work in the skills
repo may begin while the first Clawperator PR is under review once the
migration-phase contract shape is stable.

## PR-C1: Clawperator Migration Contract

**Repo:** `~/src/clawperator`
**Suggested branch:** `codex/skill-result-contract-migration`
**Agent tier:** thinking

### Phase 1: Add Migration-Phase `skillResult.result`

**Files:**

- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/fixtures/skills/com.test.skill-result/scripts/emit_skill_result.js`

**Tasks:**

1. Add `result?: SkillCheckpointEvidence | null` to the `SkillResult`
   interface.
2. Add `result: skillCheckpointEvidenceSchema.nullable().optional()` to the
   emitted SkillResult Zod schema (`emittedSkillResultSchema`).
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
- Invalid plain-object `result` payloads fail validation with a clear error.
- Current framed fixtures without `result` still pass.
- The tests describe the temporary optional state clearly enough that PR-C2 can
  tighten it later.

### Phase 2: Clean JSON `skills run` Output

**Files:**

- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/test/unit/skills.test.ts`

**Tasks:**

1. In `skills.ts`, change the `output` field on the success, indeterminate,
   and `SKILL_OUTPUT_ASSERTION_FAILED` branches to apply
   `sanitizePrettySkillStdout` whenever `result.skillResult !== null`,
   regardless of format. The recommended change from `findings.md` is:
   ```ts
   output: (options.format === "pretty" || result.skillResult !== null)
     ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
     : result.output,
   ```
   Apply this to all three response branches that currently use `output`.
   General execution failure and spawn-failure branches use `stdout`/`stderr`
   and do not need to change.
2. Do not change `runSkill.ts` or the domain-layer tests. The `runSkill`
   domain function intentionally returns raw stdout including the frame; the
   existing agent-driven SkillResult test that asserts
   `result.output.includes("[Clawperator-Skill-Result]")` remains correct and
   must not be modified.
3. Add CLI-layer tests in the `describe("cmdSkillsRun preflight gate")` block
   using the injected `runSkillImpl` pattern already used in that block. A
   suitable test:
   - Creates a `fakeRunSkill` that returns `output` containing the literal
     `[Clawperator-Skill-Result]` marker followed by JSON, plus a non-null
     `skillResult`.
   - Calls `cmdSkillsRun` with `{ format: "json", runSkillImpl: fakeRunSkill }`.
   - Asserts that `JSON.parse(stdout).output` does NOT contain
     `[Clawperator-Skill-Result]`.
4. Add a corresponding test for the case where `skillResult` is null and
   `output` IS raw (frame-inclusive) stdout, to prove the non-framed path is
   unchanged.

**Acceptance criteria:**

- JSON success output does not contain `[Clawperator-Skill-Result]` when
  `skillResult` is parsed.
- JSON indeterminate output follows the same rule.
- JSON output-assertion failure follows the same rule.
- Malformed frame failures (where `skillResult` is null) still expose raw
  stdout including any partial frame content for debugging.
- Domain-layer `runSkill` tests are unchanged.

### Phase 3: Update Clawperator Docs And Bundled Authoring Guidance

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

1. Document wrapper extraction order:
   wrapper `status` and `code`, then `skillResult.status`, then
   `skillResult.result`, then proof fields.
2. Document `result` as optional only during migration.
3. Document singular `result` for collection payloads.
4. Document `output` as display/progress text when retained on success-like
   wrappers, not raw stdout and not the domain answer. Document that failure
   wrappers may expose process streams as `stdout` and `stderr`.
5. Document that `terminalVerification` is proof and `diagnostics` is debug
   metadata. Neither is the primary answer channel.
6. Document checkpoint presence semantics: existing skills may emit only reached
   checkpoints, but new and migrated non-trivial skills should prefer the
   map/state-machine pattern with unreached steps marked `skipped`.
7. Update examples that currently show framed SkillResult output without
   `result` when those examples are meant to guide new authoring.
8. In `apps/node/bundled-skills/clawperator-skill-author-by-recording/SKILL.md`,
   add `skillResult.result` to the inspection list at the section that currently
   lists `skillResult.status`, `skillResult.source`, `skillResult.checkpoints`,
   `skillResult.terminalVerification`, and `skillResult.diagnostics`. Add a note
   that `result` is the canonical domain answer when present.
9. In `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md`,
   add equivalent guidance. If the skill does not have an explicit field list,
   add `skillResult.result` to the skill-result inspection step.
10. Update the corresponding `agents/openai.yaml` files for both bundled skills
   if `default_prompt` or `short_description` reference skill-result inspection
   behavior.
11. Rebuild docs through the normal docs build workflow.

**Acceptance criteria:**

- No public doc tells agents to find primary answers in `diagnostics`,
  `terminalVerification`, or checkpoint ids.
- Public docs define `output` as display/progress text if retained, while
  reserving `skillResult.result` for the domain answer.
- Recording compare docs still say the full `skills run` wrapper is the durable
  compare input and uses `skillResult.checkpoints` and
  `skillResult.terminalVerification` for compare logic. Do not change the
  compare contract.
- Authoring docs prefer map/state-machine checkpoints for new and migrated
  non-trivial skills.
- Both bundled authoring skills ask agents to inspect and report
  `skillResult.result`.
- `./scripts/docs_build.sh` succeeds.

## PR-S1: Runtime Skills Migration

**Repo:** `~/src/clawperator-skills`
**Suggested branch:** `codex/skill-result-contract`
**Agent tier:** default

### Phase 4: Migrate Skill Outputs

**Files:**

- `skills/com.solaxcloud.starter.get-battery/**`
- `skills/com.android.vending.install-app/**`
- `skills/com.android.vending.search-app/**`
- `skills/com.google.android.apps.chromecast.app.get-climate-replay/**`
- `skills/com.amazon.mShop.android.shopping.search-products/**`
- `skills/com.globird.energy.get-yesterday-usage-cost-replay/**`
- setter replay and orchestrated skills that emit framed SkillResult output
- `skills/skills-registry.json` only if metadata changes
- `skills/generated/**` only after running the generator when metadata changes

**Tasks:**

1. For existing root `result` skills, wrap the payload as
   `{ kind: "json", value: ... }`.
2. For root `results` skills, rename to singular `result` and represent the
   collection as `{ kind: "json", value: { items: [...] } }`.
3. Move primary answer data out of `diagnostics`, `terminalVerification`, and
   checkpoint-only evidence into `result`.
4. Keep checkpoints and terminal verification as proof of how the answer was
   obtained.
5. For non-trivial migrated skills, prefer map/state-machine checkpoints:
   include the known checkpoint ids and mark unreached steps `skipped` instead
   of omitting expected path nodes.
6. Use `result: null` only when the skill cannot truthfully report a domain
   value or confirmed final state.
7. Fix isolated quality issues called out by `findings.md` while touching the
   affected skills, including conditional diagnostics in
   `set-discharge-to-limit-replay` if still useful and
   `set-my-list-state-replay` expected/observed duplication if still accurate
   after the result migration.
8. Update parser tests and local examples to assert the canonical `result`
   shape.
9. Regenerate generated indexes if any skill metadata changes:

   ```bash
   ./scripts/generate_skill_indexes.sh
   ```

**Acceptance criteria:**

- Every migrated framed skill emits a root `result` field in its SkillResult.
- No migrated skill keeps its primary answer only in `diagnostics`,
  `terminalVerification`, or checkpoint evidence.
- Collection skills use singular `result`.
- Setter skills report confirmed final state where the UI can prove it.
- Migrated non-trivial skills use map/state-machine checkpoints unless the skill
  has a documented reason to remain push-only.
- `./scripts/test_all.sh` succeeds.

### Phase 5: Validate Against The PR-C1 Node Build

**Files:**

- no required file edits unless validation exposes bugs

**Tasks:**

1. Build the Node CLI from the PR-C1 branch in `~/src/clawperator`.
2. Run migrated skill parser tests from `~/src/clawperator-skills`.
3. Run at least these representative skill checks when prerequisites are
   available:
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

### Phase 6: Tighten Runtime Schema

**Files:**

- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/test/fixtures/skills/**`

**Tasks:**

1. Change the TypeScript field to `result: SkillCheckpointEvidence | null`.
2. Change the Zod schema to require `result`.
3. Update tests and fixtures so framed SkillResult objects include `result`.
4. Add a regression test proving missing `result` now fails validation.
5. Keep `result: null` valid for failures or actions with no truthful domain
   value.

**Acceptance criteria:**

- Missing `result` is rejected for framed SkillResult objects.
- `result: null` remains valid when semantically correct.
- Existing wrapper behavior for legacy skills with no framed SkillResult remains
  explicit through `skillResult: null`.

### Phase 7: Final Docs And Cross-Repo Smoke

**Files:**

- `docs/skills/runtime.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/api/serve.md`
- `docs/api/recording.md`
- bundled skill authoring guidance if wording still mentions optional `result`

**Tasks:**

1. Remove migration-window language from docs and bundled guidance.
2. Keep old-shape migration history out of public docs unless it describes
   still-shipped behavior.
3. Confirm stream field wording is final: `skillResult.result` is the answer,
   `output` is display/progress text if retained, and process streams are
   named `stdout` and `stderr` where exposed.
4. Confirm checkpoint guidance is final: map/state-machine checkpoints are the
   preferred shape for new and migrated non-trivial skills.
5. Build Node and run tests.
6. Build public docs.
7. Validate at least one migrated read skill and one migrated setter skill from
   `~/src/clawperator-skills` with the branch-local Node CLI.

**Acceptance criteria:**

- Public docs describe required `skillResult.result`.
- Bundled skill authoring guidance matches the enforced schema.
- Public docs do not describe `output`, `diagnostics`, checkpoints, or
  `terminalVerification` as primary answer channels.
- Node build and tests pass.
- Docs build succeeds.
- Representative migrated skills parse successfully through `skills run`.

## Cross-Repo Coordination Notes

- PR-S1 can be developed while PR-C1 is under review, but it should test against
  the PR-C1 branch-local Node CLI.
- PR-C2 should not land until migrated skills are available for validation.
- Keep Clawperator and Clawperator Skills commits separate. Do not mix sibling
  repo edits into one repository's PR.
- If PR-C1 changes the exact `SkillCheckpointEvidence` shape, update PR-S1
  before merging either PR.
- If live-device validation is blocked by account state or device availability,
  record the blocker and still complete parser, replay, and fixture validation
  that does not require external state.
