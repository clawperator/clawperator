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
- any existing skill-result fixtures under `apps/node/src/test/fixtures/skills/`

**Tasks:**

1. Add `result?: SkillCheckpointEvidence | null` to the `SkillResult`
   interface.
2. Add `result: skillCheckpointEvidenceSchema.nullable().optional()` to the
   emitted SkillResult Zod schema.
3. Add tests proving a valid evidence-shaped `result` survives parsing.
4. Add tests proving a plain domain object in root `result` is rejected instead
   of silently stripped.
5. Add tests proving missing `result` remains accepted during the migration
   window.

**Acceptance criteria:**

- The runtime accepts `result` only when it matches `SkillCheckpointEvidence`.
- Current framed fixtures without `result` still pass.
- The tests describe the temporary optional state clearly enough that PR-C2 can
  tighten it later.

### Phase 2: Clean JSON `skills run` Output

**Files:**

- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/test/unit/skills.test.ts`
- related CLI fixture files as needed

**Tasks:**

1. Reuse the existing pretty-output frame stripping policy for JSON `output`
   whenever a parsed `skillResult` exists.
2. Apply the same policy to success, indeterminate, and
   `SKILL_OUTPUT_ASSERTION_FAILED`.
3. Keep real raw process diagnostics available on parse failures where there is
   no trusted parsed `skillResult`.
4. Add regression tests for the changed output shape.

**Acceptance criteria:**

- JSON success output does not contain `[Clawperator-Skill-Result]` when
  `skillResult` is parsed.
- JSON indeterminate output follows the same rule.
- JSON output-assertion failure follows the same rule.
- Malformed frame failures still expose enough stdout to debug the parse error.

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
4. Update examples that currently show framed SkillResult output without
   `result` when those examples are meant to guide new authoring.
5. Update bundled authoring guidance so generated or repaired skills emit
   `skillResult.result` and surface it during self-test inspection.
6. Rebuild docs through the normal docs build workflow.

**Acceptance criteria:**

- No public doc tells agents to find primary answers in `diagnostics`,
  `terminalVerification`, or checkpoint ids.
- Recording compare docs still say the full `skills run` wrapper is the durable
  compare input.
- Bundled authoring guidance asks agents to inspect and report
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
5. Use `result: null` only when the skill cannot truthfully report a domain
   value or confirmed final state.
6. Update parser tests and local examples to assert the canonical `result`
   shape.
7. Regenerate generated indexes if any skill metadata changes:

   ```bash
   ./scripts/generate_skill_indexes.sh
   ```

**Acceptance criteria:**

- Every migrated framed skill emits a root `result` field in its SkillResult.
- No migrated skill keeps its primary answer only in `diagnostics`,
  `terminalVerification`, or checkpoint evidence.
- Collection skills use singular `result`.
- Setter skills report confirmed final state where the UI can prove it.
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
3. Build Node and run tests.
4. Build public docs.
5. Validate at least one migrated read skill and one migrated setter skill from
   `~/src/clawperator-skills` with the branch-local Node CLI.

**Acceptance criteria:**

- Public docs describe required `skillResult.result`.
- Bundled skill authoring guidance matches the enforced schema.
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
