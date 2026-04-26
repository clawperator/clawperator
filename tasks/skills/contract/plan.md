# SkillResult Contract Implementation Plan

**Status:** ready for implementation
**Source findings:** `tasks/skills/contract/findings.md`
**Scope:** `~/src/clawperator` and `~/src/clawperator-skills`

## Goal

Make `clawperator skills run` return one discoverable domain answer for every
framed skill run while keeping proof, diagnostics, and raw process capture in
their own lanes.

The canonical answer field is:

```ts
result?: SkillCheckpointEvidence | null
```

This field is optional only during the migration window. New and migrated
framed skills must always emit `result`, using `null` only when the skill cannot
truthfully report a domain result. After the skills repo has migrated, tighten
the runtime schema to:

```ts
result: SkillCheckpointEvidence | null
```

Collections still live in singular `result`, for example:

```json
{
  "kind": "json",
  "value": {
    "items": []
  }
}
```

## Non-Goals

- Do not preserve old noncontract root `result` or `results` payload shapes.
- Do not keep duplicated primary answers under `diagnostics`,
  `terminalVerification`, or checkpoint-only evidence once a skill is migrated.
- Do not create a task pack for a later implementation agent to reinterpret the
  core contract decision. The decision is to add canonical singular
  `skillResult.result`.
- Do not update generated docs output by hand.

## Contract Decisions

1. Wrapper consumers branch on wrapper `status` and `code` first.
2. Inside `skillResult`, put `result` first and `status` second. Object member
   order is not semantic for parsers, but it matters for humans and agents
   scanning JSON under token pressure.
3. The domain answer is `skillResult.result`.
4. Consumers may inspect `skillResult.status` after wrapper `status` and
   `code`, but `skillResult.result` remains the first field inside the nested
   object for discoverability.
5. `terminalVerification` proves the answer or final state. It is not the
   answer channel.
6. `checkpoints` explain progress and evidence. They are not the primary answer
   lookup path.
7. `diagnostics` is for runtime health, warnings, hints, and debug detail only.
8. Drop the `output` field from JSON success and indeterminate responses when
   `skillResult !== null`. Agents use `skillResult.result`. Progress text is
   available in pretty mode; it is pure token waste in JSON mode.
9. Keep `output` for legacy unframed skills where `skillResult === null`.
   Also keep `output` for `SKILL_OUTPUT_ASSERTION_FAILED`, where it shows what
   the skill printed when the assertion failed.
10. Apply the same policy in `serve.ts` as in `skills.ts`. Both currently pass
   `result.output` through independently and both need updating.
11. New and migrated non-trivial skills should prefer map/state-machine
    checkpoints: include known checkpoint ids and mark unreached steps
    `skipped`.

## Findings Coverage

| Finding | Covered by |
| --- | --- |
| 1. No canonical answer field | PR-C1 Phase 1, PR-C2 Phase 6 |
| 2. Primary results are scattered | PR-S1 Phase 4, PR-S1 Phase 5 |
| 3. JSON `output` includes frame | PR-C1 Phase 2, PR-C1 Phase 3 |
| 4. Wrapper status precedence | PR-C1 Phase 3, PR-C2 Phase 7 |
| 5. `terminalVerification` is proof | PR-C1 Phase 3, PR-S1 Phase 4 |
| 6. `diagnostics` carries primary data | PR-C1 Phase 3, PR-S1 Phase 4 |
| 7. Stream field names are inconsistent | PR-C1 Phase 2, PR-C1 Phase 3, PR-C2 Phase 7 |
| 8. Checkpoint presence semantics differ | PR-C1 Phase 3, PR-S1 Phase 4, PR-C2 Phase 7 |

The source corrections in `findings.md` are also covered: PR-C1 tests prove
root `result` survives only when evidence-shaped, and PR-C1 deliberately
supersedes the initial frame-stripping recommendation by dropping JSON `output`
on framed success-like responses.

## Repository PRs

### PR-C1: Clawperator Migration Contract

**Repo:** `~/src/clawperator`
**Can start immediately:** yes
**Must land before PR-C2:** yes

Add the migration-phase runtime contract and make the CLI output easier for
agents and operators to consume.

Required outcomes:

- `SkillResult` TypeScript and Zod schemas accept
  `result?: SkillCheckpointEvidence | null`.
- `SkillResult` TypeScript and Zod definitions place `result` before `status`
  so parsed and authored examples naturally lead with the answer.
- Existing root `result` payloads that already match the evidence union survive
  runtime parsing.
- Invalid root `result` payloads fail validation instead of disappearing.
- `skills run` JSON omits `output` on success and indeterminate responses when
  a parsed `skillResult` exists.
- `skills run` JSON keeps `output` for legacy unframed skills and
  `SKILL_OUTPUT_ASSERTION_FAILED` diagnostics.
- The serve endpoint applies the same JSON response policy.
- Public docs in `docs/skills` explain the new extraction path and the temporary
  optional migration shape.
- Docs define where `output` is absent and where it is retained. Retained
  `output` is diagnostic or legacy data, not the domain answer.
- Relevant bundled skill authoring guidance under
  `apps/node/bundled-skills/clawperator-*` teaches agents to emit and inspect
  `skillResult.result`.

### PR-S1: Runtime Skills Migration

**Repo:** `~/src/clawperator-skills`
**Can start after PR-C1 contract shape is stable:** yes
**May run concurrently with PR-C1 review:** yes
**Must land before PR-C2:** yes

Move primary outputs in runtime skills to canonical singular
`skillResult.result`.

Required outcomes:

- Skills that already emit root `result` wrap it as `SkillCheckpointEvidence`.
- Skills that emit root `results` rename it to `result` and wrap collections as
  `{ kind: "json", value: { items: [...] } }`.
- Skills that store primary answers in `diagnostics`, checkpoints, or
  `terminalVerification` move the answer to `result`.
- Setter skills emit the confirmed final state in `result` when available, or
  `result: null` when no truthful final state can be reported.
- New and migrated non-trivial skills prefer map/state-machine checkpoints
  where the known path is represented and unreached steps are marked `skipped`.
- Skill docs and parser tests match the migrated contract.
- Generated skill indexes are regenerated when skill metadata changes.
- Validation uses the branch-local Clawperator Node build from PR-C1, not the
  globally installed `clawperator` binary.

### PR-C2: Clawperator Required Result

**Repo:** `~/src/clawperator`
**Can start after PR-S1 is merged or otherwise coordinated into validation:** yes

Close the migration window and make `result` required for framed `SkillResult`
objects.

Required outcomes:

- Runtime TypeScript and Zod schemas require
  `result: SkillCheckpointEvidence | null`.
- Runtime TypeScript and Zod definitions keep `result` as the first nested
  `SkillResult` field and `status` as the second.
- Framed SkillResult fixtures, tests, docs, and bundled skill guidance no longer
  describe missing `result` as acceptable for newly framed skills.
- Compare, serve, and CLI docs continue to describe the wrapper object as the
  durable run artifact while naming `skillResult.result` as the domain answer.
- Validation includes at least one migrated read skill and one migrated setter
  skill from `~/src/clawperator-skills`.

## Required Reading

For all PRs:

- `tasks/skills/contract/findings.md`
- `tasks/skills/contract/before-and-after.md`
- `~/src/clawperator/AGENTS.md`
- `~/src/clawperator-skills/AGENTS.md`

For PR-C1 and PR-C2:

- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `docs/skills/runtime.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/api/serve.md`
- `docs/api/recording.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-recording/SKILL.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-recording/agents/openai.yaml`
- `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md`
- `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/agents/openai.yaml`

For PR-S1:

- `~/src/clawperator-skills/skills/skills-registry.json`
- `~/src/clawperator-skills/skills/skills-registry.schema.json`
- `~/src/clawperator-skills/scripts/test_all.sh`
- representative skill scripts named in `findings.md`
- `~/src/clawperator-skills/skills/com.globird.energy.get-yesterday-usage-cost-replay/**`
- generated indexes under `~/src/clawperator-skills/skills/generated/`
  when metadata changes

## Validation

### Clawperator PRs

Run from `~/src/clawperator`:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

For PR-C1, also run focused CLI and serve fixture coverage that proves:

- a valid `result` survives parsing
- an invalid `result` fails validation
- JSON success and indeterminate responses omit `output` when `skillResult` is
  parsed
- `SKILL_OUTPUT_ASSERTION_FAILED` keeps `output` for diagnostic context

For PR-C2, also validate at least one migrated read skill and one migrated
setter skill through the branch-local Node CLI.

### Clawperator Skills PR

Run from `~/src/clawperator-skills`:

```bash
./scripts/test_all.sh
```

When a skill can run in replay or parser-only mode without external account
state, run that focused test as well. For live-device skill checks, use the
branch-local Clawperator Node CLI from PR-C1 and pass `--device` explicitly when
multiple devices are connected.

## Definition Of Done

- Every framed skill has one primary answer path: `skillResult.result`.
- Nested `skillResult` JSON examples and emitted migrated skills put `result`
  first and `status` second.
- `result` is present on every newly authored or migrated framed SkillResult.
- Missing `result` is accepted only during PR-C1 and PR-S1 migration work.
- JSON success and indeterminate responses no longer include `output` when a
  parsed `skillResult` exists.
- Docs and bundled authoring skills teach the same contract that the runtime
  enforces.
- Checkpoint guidance is explicit: existing push-only shapes may be read, but
  new and migrated non-trivial skills should use map/state-machine checkpoints.
- The final Clawperator PR rejects missing `result` for framed SkillResult
  objects.
