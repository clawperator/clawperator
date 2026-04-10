# Skill Result Contract Work Breakdown

Parent plan: `tasks/recording/skill-result-contract/plan.md`

## Executive Summary

Total PRs: 2. Total phases: 4.

- PR-1: contract definition, runtime parsing, tests
- PR-2: Solax retrofit and downstream handoff update

Current state: ready after `tasks/recording/skill-checkpoints/` lands.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 after W1 |
| Blockers | `tasks/recording/skill-checkpoints/` should land first |

## Hard Rules

- Do not extend `ResultEnvelope` to carry skill semantics.
- Do not make tests depend on a live device or on `../clawperator-skills/` at runtime.
- Do not add `clawperator exec --trace` as a parallel mechanism.
- Do not require all existing skills to adopt the contract immediately.
- Put the contract tests in the same phase and commit as the runtime parsing changes.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-result-contract/plan.md` | Stable contract scope and boundaries |
| `tasks/recording/brain-hand-contract/problem-definition.md` | Architectural framing and recommended sequencing |
| `apps/node/src/contracts/result.ts` | Existing exec-level envelope that must remain separate |
| `apps/node/src/domain/skills/runSkill.ts` | Current skill runtime contract to retrofit |
| `docs/skills/authoring.md` | Current public authoring contract |
| `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/scripts/run.js` | Current replay baseline to preserve while retrofitting the contract |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Define contract and parse it in runtime | P1, P2 | `thinking`, `default` | none |
| PR-2 | Retrofit Solax and hand off to downstream packs | P3, P4 | `default` | PR-1 merged locally and validated |

## Phase P1: Define `SkillResult`

### Agent Tier

`thinking`

### Goal

Decide the shape and emission mechanism for the skill-level result contract.

### Files or Surfaces To Change

- `apps/node/src/contracts/`
- optionally a short design note if the decision cannot fit cleanly in code/comments

### Steps

1. Define the `SkillResult` shape.
2. Decide emission channel:
   - explicit stdout frame
   - last-line JSON
   - sidecar file
3. Define versioning and backward compatibility behavior for legacy skills.
4. Record any stable decisions back into the task files if needed.

### Acceptance Criteria

- `SkillResult` has a concrete shape for:
  - `contractVersion`
  - `skillId`
  - `goal`
  - `inputs`
  - `status` (`success` | `failed` | `indeterminate`)
  - `checkpoints` (ordered list with stable identity, status, and optional evidence)
  - `terminalVerification` (typed record or `null`)
  - `execEnvelopes` (embedded `ResultEnvelope[]` in order)
  - `diagnostics` (optional)
- A concrete TypeScript interface for `SkillResult` exists in
  `apps/node/src/contracts/` and is exported alongside `ResultEnvelope`.
- A `Checkpoint` type defines at minimum `id: string`, `status: "ok" | "failed"
  | "skipped"`, and optional `observedAt`, `evidence`, and `note` fields.
- `Checkpoint.evidence` is explicitly typed in v1. It must not default to a
  free-form map. P1 must choose one of:
  - a small typed union with `kind` plus payload
  - a typed reference into `execEnvelopes`
  - a hybrid of the two
  and record the exact shape in code or a design note.
- Runtime-state signaling for downstream compare is explicit. P1 must either:
  - add a typed `diagnostics.runtimeState` or equivalent contract field with
    values `healthy | poisoned | unavailable | unknown`, or
  - state clearly that v1 compare downgrades those cases to
    `upstream_failure`.
- Emission channel is decided explicitly. The plan's recommendation is the
  `[Clawperator-Skill-Result]` framed single-line JSON; if P1 chooses
  differently it must record why.
- Legacy behavior for skills that emit plain stdout is defined explicitly.
- All P1 decisions enumerated under "Required Decisions In P1" in
  `tasks/recording/skill-result-contract/plan.md` are committed in code or
  in-repo design notes.

### Validation

```bash
npm --prefix apps/node run build
```

### Expected Commit

```text
feat(skills): define skill result contract
```

## Phase P2: Parse `SkillResult` In `runSkill`

### Agent Tier

`default`

### Goal

Make `runSkill` parse and return `SkillResult` without breaking legacy skills.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/contracts/`
- `apps/node/src/test/`

### Steps

1. Add failing tests first.
2. Parse/validate framed `SkillResult`.
3. Surface `skillResult` on both success and error shapes as appropriate.
4. Keep the legacy plain-stdout path working.

### Acceptance Criteria

- Well-formed `SkillResult` is parsed and surfaced.
- Missing `SkillResult` keeps legacy skills working.
- Malformed or ambiguous framing is rejected clearly.
- New tests added under `apps/node/src/test/` run under the default
  `npm --prefix apps/node run test` path; if not, the PR updates CI in the
  same change.

Required cases:

- well-formed frame from scripted skill -> `source: { kind: "script" }` injected
  by `runSkill`, not by the emitter; `skillResult` returned on `SkillRunResult`
- well-formed frame from agent-driven skill -> `source: { kind: "agent",
  agentCli: <cli from skill.json> }` injected by `runSkill`
- frame that contains a `source` field -> rejected as malformed (the emitter
  must not self-report `source`)
- well-formed frame on a script that exits non-zero -> `skillResult` is still
  surfaced on the error shape so the brain can read structured failure
- malformed JSON inside a frame -> typed parse error, not silent legacy fallback
- missing frame -> legacy path still works, `skillResult: null`
- multiple frames -> reject as malformed
- newer minor `contractVersion` -> accept, log unknown fields
- newer major `contractVersion` -> reject with typed parse error
- round-trip: a `SkillResult` value serialized into a frame and parsed back
  is structurally identical (including injected `source`)
- `clawperator skills run --json` includes the parsed `skillResult` in the
  CLI output when present, and omits or nulls it for legacy skills
- if `diagnostics.runtimeState` or equivalent exists, parser tests cover:
  - known values accepted
  - unknown value rejected or downgraded per the P1 decision
- if P1 creates a typed checkpoint evidence union, parser tests cover at least
  one representative of each allowed `kind`

### Validation

```bash
npm --prefix apps/node run build
```

```bash
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(skills): parse structured skill results
```

## Phase P3: Retrofit The Replay Solax Skill To Emit `SkillResult`

### Agent Tier

`default`

### Goal

Retrofit the preserved Solax `-replay` baseline to emit `SkillResult` so the
recording program does not ship a first-class replay skill that still talks to
the brain through opaque stdout. The agent-driven `-orchestrated` proving skill
now lives in W2b.

### Files or Surfaces To Change

- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/`

### Steps

1. Retrofit
   `com.solaxcloud.starter.set-discharge-to-limit-replay` to emit a
   `SkillResult`. The replay emitter should:
   - use the same frame marker and contract version W2 defines for every skill
   - declare the same `goal` kind and `inputs` shape W2b will later reuse for
     the orchestrated sibling
   - emit a terminal verification record
   - enumerate a stable coarse checkpoint subset that W2b can later align the
     orchestrated skill to (see coarse-subset policy below)
2. Validate the replay skill live on the Samsung target.
3. Record any checkpoint-name or evidence-shape decisions W2b must mirror.

Replay checkpoint coarse-subset policy: the replay skill must emit, at
minimum, `app_opened`, `discharge_to_row_focused`, `target_text_entered`,
`save_completed`, and `terminal_state_verified`. Intermediate navigation
checkpoints are optional for the replay skill because replay treats the
full path as one cleaned-up traversal. `save_completed` is a replay-only
identifier that collapses the `toolbar_save_clicked` and
`bottom_sheet_save_clicked` pair into a single successful-save checkpoint.
W2b will later define how the orchestrated checkpoint set maps onto this
coarse replay subset for compare purposes.

Required replay checkpoint identities for v1 (stable strings, in order):

- `app_opened`
- `discharge_to_row_focused`
- `target_text_entered`
- `save_completed`
- `terminal_state_verified`

If the live replay retrofit shows one of these checkpoints cannot be observed
deterministically, drop or rename it deliberately and document the reason in
`SKILL.md`. Do not invent new checkpoint identities silently. W2b will own the
finer-grained orchestrated checkpoint list.

### Acceptance Criteria

- The retrofitted replay skill emits a parseable `SkillResult` using the
  shared frame marker and `contractVersion`, with the coarse-subset checkpoint
  list defined above and a real terminal verification record. The emitted frame
  must NOT include a `source` field - `runSkill` injects `source: { kind: "script" }`
  at parse time. An emitter that includes `source` will be rejected as malformed.
- The emitted replay result is consumable by the Clawperator runtime tests via
  the copied fixture path used by W4 compare; round-tripping the live frame
  through `runSkill` parsing returns a structurally valid `SkillResult`.
- The replay skill's docs describe the new result behavior accurately,
  including the exact checkpoint identities it emits and the failure shape on
  verification mismatch.
- Any checkpoint identities dropped as unstable are listed explicitly in the
  replay skill's `SKILL.md` with the reason they were dropped so W4 fixtures
  do not silently drift.
- Any follow-on alignment W2b must honor is recorded explicitly in P4 rather
  than assumed.

### Validation

```bash
CLAWPERATOR_SKILLS_REGISTRY=<clawperator_skills_root>/skills/skills-registry.json \
CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev \
node <clawperator_root>/apps/node/dist/cli/index.js skills run com.solaxcloud.starter.set-discharge-to-limit-replay --device <device_serial> --json -- 40
```

Confirm that the invocation returns `skillResult` on the CLI JSON envelope and
that the round-tripped `SkillResult` value parses cleanly through `runSkill`.

### Expected Commit

```text
feat(solax): emit skill result from discharge limit replay skill
```

## Phase P4: Prepare Downstream Handoff

### Agent Tier

`default`

### Goal

Update the downstream task packs so compare, W2b, and declaration work consume
the new contract instead of inventing parallel mechanisms.

### Files or Surfaces To Change

- `tasks/recording/agent-driven-skills/`
- `tasks/recording/compare/`
- `tasks/recording/skill-contract-declaration/`

### Steps

1. Confirm W2b consumes the emitted contract without redefining it.
2. Confirm compare consumes `SkillResult`.
3. Confirm declaration work now targets the actual runtime contract.
4. Record any follow-on work discovered during implementation.

### Acceptance Criteria

- Downstream task packs no longer assume a separate trace mechanism.
- W2b explicitly owns the agent-driven orchestrated proving skill and does not
  drift back into "scripted orchestrated" wording.
- Any unresolved follow-on is explicitly captured.
- If P1 made contract decisions that are not self-evident from code alone
  (frame marker policy, version compatibility, typed checkpoint evidence,
  runtime-state semantics), a durable note is added under `docs/internal/design/`
  or explicitly scheduled as the immediate next follow-on.

### Validation

```bash
git diff -- tasks/recording/agent-driven-skills tasks/recording/compare tasks/recording/skill-contract-declaration
```

### Expected Commit

```text
chore(tasks): align recording work with skill result contract
```
