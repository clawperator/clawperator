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
2. When `skillResult` is present, consumers read `skillResult.status` next.
3. The domain answer is `skillResult.result`.
4. `terminalVerification` proves the answer or final state. It is not the
   answer channel.
5. `checkpoints` explain progress and evidence. They are not the primary answer
   lookup path.
6. `diagnostics` is for runtime health, warnings, hints, and debug detail only.
7. JSON `output` should not include the terminal
   `[Clawperator-Skill-Result]` frame when a parsed `skillResult` exists.
8. `rawOutput` or a similar explicit raw stream field may be added later only if
   a concrete machine consumer needs it. It is not required for this task.

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
- Existing root `result` payloads that already match the evidence union survive
  runtime parsing.
- Invalid root `result` payloads fail validation instead of disappearing.
- `skills run` JSON strips the terminal SkillResult frame from `output` when a
  parsed `skillResult` exists.
- Pretty and JSON output follow the same frame-stripping policy for success,
  indeterminate, and `SKILL_OUTPUT_ASSERTION_FAILED` paths.
- Public docs in `docs/skills` explain the new extraction path and the temporary
  optional migration shape.
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
- Framed SkillResult fixtures, tests, docs, and bundled skill guidance no longer
  describe missing `result` as acceptable for newly framed skills.
- Compare, serve, and CLI docs continue to describe the wrapper object as the
  durable run artifact while naming `skillResult.result` as the domain answer.
- Validation includes at least one migrated read skill and one migrated setter
  skill from `~/src/clawperator-skills`.

## Required Reading

For all PRs:

- `tasks/skills/contract/findings.md`
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

For PR-C1, also run focused `skills run` fixture coverage that proves:

- a valid `result` survives parsing
- an invalid `result` fails validation
- JSON `output` strips the terminal SkillResult frame when parsed
- `SKILL_OUTPUT_ASSERTION_FAILED` follows the same output policy

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
- `result` is present on every newly authored or migrated framed SkillResult.
- Missing `result` is accepted only during PR-C1 and PR-S1 migration work.
- JSON `output` no longer duplicates parsed SkillResult frames.
- Docs and bundled authoring skills teach the same contract that the runtime
  enforces.
- The final Clawperator PR rejects missing `result` for framed SkillResult
  objects.
