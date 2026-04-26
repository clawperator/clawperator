# SkillResult Contract - Authoritative Findings

**Date:** 2026-04-26
**Sources reconciled:** `findings-claude.md`, `findings-codex.md`, `findings-skill-survey.md`
**Review stance:** EM synthesis for implementation planning

**Verified against:**

- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/contracts/result.ts`
- `docs/api/overview.md`
- `docs/skills/runtime.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- representative scripts under `../clawperator-skills/skills/`

---

## Executive Summary

The current `clawperator skills run` JSON shape is optimized for complete
debug capture and backward compatibility. It is parseable, but it is not yet a
good general-purpose contract for agents or human operators who want the answer
to a skill run.

The blocking issue is not just noisy output. The runtime has no canonical,
schema-supported location for the skill's domain result. Some skill scripts
already emit a root `result`, but `apps/node/src/contracts/skillResult.ts` does
not define that field, so Zod strips it before the parsed `skillResult` reaches
CLI and serve consumers. That means there are currently zero reliable parsed
`skillResult.result` consumers, even where individual scripts tried to emit one.

The right implementation order is:

1. Add `skillResult.result` to the runtime schema as the canonical answer field.
2. Teach docs and agents to branch on wrapper `status` first, then read
   `skillResult.result` when present.
3. Migrate skills so primary outputs leave `diagnostics`, checkpoint-only
   evidence, and terminal-verification-only evidence.
4. Decide the raw stdout policy for JSON mode deliberately. Stripping the
   terminal frame from `output` improves usability, but changing `output` from
   "raw stdout" is a compatibility and documentation change, not a free
   one-line cleanup.

---

## Top Findings

### 1. High: The parsed contract has no canonical answer field

**Owning surface:** `apps/node/src/contracts/skillResult.ts`

`SkillResult` currently contains proof and diagnostics fields:

- `goal`
- `inputs`
- `status`
- `checkpoints`
- `terminalVerification`
- `execEnvelopes`
- `diagnostics`

It does not contain `result`.

This is visible in both the TypeScript interface and the Zod schema:

- `apps/node/src/contracts/skillResult.ts:97-108`
- `apps/node/src/contracts/skillResult.ts:190-200`

**Friction:**

An agent asking "what value did the skill return?" must inspect skill-specific
locations:

- `checkpoints[].evidence`
- `terminalVerification.observed`
- `diagnostics.<customKey>`
- root fields that may have been emitted by a script but stripped by the
  runtime parser

This forces per-skill knowledge into the caller. That is the opposite of a good
agent-facing contract.

**Important correction to the survey:**

`findings-skill-survey.md` says two skills are already correct because they emit
a root `result`. At the script layer that is true. At the parsed runtime
contract layer it is false. `emittedSkillResultSchema` is a plain `z.object`
without `.passthrough()`, so unknown root keys are stripped. Existing emitted
`result` and `results` fields are not available in parsed `skillResult` until
the schema adds them.

**Smallest implementation-ready fix:**

Add an optional field to both the TypeScript interface and emitted schema:

```ts
result?: SkillCheckpointEvidence | null;
```

Using the existing `SkillCheckpointEvidence` union keeps the result vocabulary
small:

- `{ kind: "text", text: "..." }`
- `{ kind: "json", value: ... }`
- `{ kind: "result_envelope_ref", execEnvelopeIndex: 0, stepResultId: "..." }`

**Compatibility risk:**

Low. Adding an optional parsed field is backward-compatible for existing
consumers. It will also make already-emitted script `result` fields start
surviving parsing, which is a positive behavior change but should still be
covered by tests.

---

### 2. High: Primary results are scattered across proof and diagnostics fields

**Owning surfaces:** runtime skill scripts in `../clawperator-skills/skills/`,
with contract support in `apps/node/src/contracts/skillResult.ts`

Across the surveyed skills, primary answers currently appear in inconsistent
locations:

| Pattern | Examples | Why it is a problem |
| --- | --- | --- |
| Root `result` emitted by script | `get-battery`, `install-app` | Good author intent, but currently stripped by runtime schema. |
| Root `results` emitted by script | `search-app` | Non-contract plural field, currently stripped by runtime schema. |
| `diagnostics.<customKey>` | `get-climate-replay`, `search-products` | Diagnostics becomes an untyped result overflow bag. |
| `terminalVerification.observed` | many setter replay skills, `search-app` structured data | Verification evidence is treated as return data. |
| checkpoint evidence only | `get-yesterday-usage-cost-replay` | Caller must know skill-specific checkpoint ids. |

**Friction:**

Agents cannot learn one stable extraction path. Human operators also have to
scan a large nested object to find the answer.

**Likely root cause:**

The original `SkillResult` shape was built around proving what happened:
checkpoint audit trail, terminal verification, diagnostics, and optional nested
execution envelopes. It did not separately name the value being returned.

**Smallest implementation-ready fix:**

After adding schema support for `skillResult.result`, migrate skills in this
order:

1. Skills already emitting root `result`: verify the field survives runtime
   parsing and add regression coverage.
2. Skills emitting root `results`: rename to `result`, usually
   `{ kind: "json", value: { items: [...] } }`.
3. Skills using `diagnostics` as the primary result: move the primary output to
   `result`; leave only health, warnings, hints, and debug data in
   `diagnostics`.
4. Read skills with checkpoint-only answers: put the extracted scalar or object
   in `result`.
5. Setter skills: only populate `result` when there is a useful caller-facing
   confirmed value or state. Do not force a meaningless result for every setter.

**Compatibility risk:**

Medium across the skills repo. Existing private consumers may have learned
skill-specific paths such as `diagnostics.climate`. Keep those fields for one
transition if needed, but mark `result` as canonical in docs and tests.

---

### 3. High: JSON `output` includes the terminal SkillResult frame, but changing it is a contract decision

**Owning surface:** `apps/node/src/cli/commands/skills.ts`

On success and indeterminate paths, the CLI currently emits:

```ts
output: options.format === "pretty"
  ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
  : result.output,
```

The pretty path strips the terminal `[Clawperator-Skill-Result]` frame. The JSON
path preserves raw stdout, including progress lines, human-readable answer
lines, the frame marker, and the JSON frame that was already parsed into
`skillResult`.

**Friction:**

The sample GloBird output contains the answer twice:

- raw human output inside `output`
- structured proof inside `skillResult`

It also contains the framed JSON twice:

- escaped inside `output`
- parsed as `skillResult`

That makes default JSON hard for humans to scan and wastes agent context. It
also tempts agents to scrape `output` even when structured data exists.

**EM correction to earlier findings:**

This should not be described as a harmless one-line fix. Docs currently define
`output` as raw stdout, and raw stdout can be useful forensic evidence. Stripping
the frame from `output` in JSON mode may be the right product choice, but it is
a compatibility change and should be handled explicitly.

**Smallest safe path:**

Implement in two phases unless the project intentionally accepts the breaking
contract change:

1. Add a non-breaking field such as `displayOutput`, `stdoutWithoutResultFrame`,
   or a summary JSON mode that contains de-framed human progress text.
2. Document consumer precedence:
   - use wrapper `status` and `code` for run outcome
   - use `skillResult.result` for the answer
   - use `skillResult` proof fields for audit and verification
   - use `output` only as raw stdout/debug evidence
3. If `output` should become de-framed, update docs, tests, and changelog in
   the same change. Consider preserving `rawOutput` or `stdout` for full
   forensic capture.

**Compatibility risk:**

Medium. Consumers scraping the terminal frame out of `output` are undesirable,
but possible. Consumers relying on exact raw stdout for saved-run diagnostics
would also see a behavior change.

---

### 4. Medium: Wrapper status and nested `skillResult.status` need a hard precedence rule

**Owning surface:** `apps/node/src/domain/skills/runSkill.ts`,
`docs/skills/runtime.md`

When declared verification is not proved, `runSkill()` can return:

- wrapper `status: "indeterminate"`
- nested `skillResult.status: "success"`

This happens because the skill child reported success, but the wrapper could
not verify the declared contract.

**Friction:**

An agent that branches on `skillResult.status` first can treat an indeterminate
wrapper result as successful. That is a correctness bug in downstream callers.

**Smallest fix:**

Document and test this consumer rule:

1. Branch first on the wrapper `status` and `code`.
2. Read `skillResult.status` only after wrapper `status === "success"`.
3. Treat nested `skillResult` as child-authored evidence that the wrapper can
   reject or mark indeterminate.

**Compatibility risk:**

Low for documentation and tests. Do not rewrite nested `skillResult.status` in
the wrapper, because preserving child-authored evidence is useful.

---

### 5. Medium: `terminalVerification` is proof, not the answer channel

**Owning surface:** `apps/node/src/contracts/skillResult.ts`,
`apps/node/src/domain/skills/runSkill.ts`

`terminalVerification` contains:

- `status`
- `expected`
- `observed`
- `note`

The declared verification matcher only extracts text evidence from
`terminalVerification.expected` and `terminalVerification.observed`. If
`observed` is `{ kind: "json" }`, declared text matching cannot use it.

**Friction:**

Structured values in `terminalVerification.observed.value` are easy for authors
to emit, but awkward for agents to discover and semantically wrong. The field
proves terminal state; it should not be the only location for returned data.

**Smallest fix:**

After `result` exists:

- skill authors may duplicate the same value into `result` and proof fields
  when appropriate
- callers should treat `terminalVerification` as proof and diagnostics
- structured read results should live in `result`, not only in
  `terminalVerification.observed`

**Compatibility risk:**

Low if this is documented as precedence rather than enforced immediately.

---

### 6. Medium: `diagnostics` is an untyped overflow bag and is already carrying primary data

**Owning surface:** `apps/node/src/contracts/skillResult.ts`,
runtime skill scripts

`SkillDiagnostics` allows arbitrary keys through its index signature and Zod
`.catchall(jsonValueSchema)`. That is useful for debug metadata, but it makes it
easy for skill authors to put primary results in diagnostics.

Known examples:

- `get-climate-replay`: climate object under `diagnostics.climate`
- `search-products`: product list under `diagnostics.results`

**Friction:**

An agent has no reason to inspect diagnostics for the answer. Diagnostics should
be safe to ignore for happy-path result extraction.

**Smallest fix:**

Do not remove the catchall immediately. Instead:

- add `skillResult.result`
- update authoring docs: diagnostics is for `runtimeState`, `warnings`,
  `hints`, paths, timings, and debug metadata
- add skill review guidance or tests that reject primary result fields under
  diagnostics for new or migrated skills

**Compatibility risk:**

Low for contract additions. Medium if existing diagnostics result keys are
removed without a transition.

---

### 7. Low: Success and failure wrappers use inconsistent stream field names

**Owning surface:** `apps/node/src/cli/commands/skills.ts`,
`docs/skills/runtime.md`

Current shapes:

- success: `output`
- indeterminate: `output`
- output assertion failure: `output`
- execution failure or timeout: `stdout` and `stderr`

**Friction:**

Callers need separate extraction logic for successful and failed runs. The name
`output` also reads like a domain result even though it means raw stdout.

**Smallest fix:**

Document the current shape immediately. Later, add `stdout` on success as an
alias while keeping `output` for compatibility.

**Compatibility risk:**

Low for adding fields and docs. High for renaming or removing `output`.

---

### 8. Low: Checkpoint presence semantics differ across skills

**Owning surface:** runtime skill authoring guidance in `docs/skills/authoring.md`
and skill scripts

Two patterns exist:

- map/state-machine checkpoints: all declared checkpoint ids are present, with
  unreached steps marked `skipped`
- push-based checkpoints: only reached checkpoints are emitted

**Friction:**

`checkpoints.find(...)` can return a skipped checkpoint in one skill and
`undefined` in another for equivalent early-failure progress.

**Smallest fix:**

Document both patterns for existing skills. Prefer the map/state-machine pattern
for new non-trivial skills because it gives callers a complete progress map.

**Compatibility risk:**

Low for docs. Medium if existing skill outputs are normalized all at once.

---

## Corrections To Source Findings

### Correction A: Root `result` and `results` are currently stripped

Earlier source findings treat root `result` and `results` fields emitted by
some scripts as visible parsed output. They are not visible unless the schema is
updated. Plain Zod objects strip unknown root keys by default, and
`emittedSkillResultSchema` does not call `.passthrough()`.

This increases the priority of adding `result` to the schema. It also means
migration work should include tests that prove emitted `result` survives
`runSkill()` parsing.

### Correction B: `search-app` root `results` is a non-contract field, not an accepted extension

`search-app` emits `results` at the root of the frame. That is not a stable
contract extension today. The runtime parser strips it. The accessible
structured data, where present, is through schema-defined fields such as
`terminalVerification.observed.value`.

### Correction C: Stripping the frame from JSON `output` is not purely a bug fix

It is a product/API decision. It likely improves agent and operator UX, but it
also changes a documented raw stdout field. Treat it as a contract change with
tests and docs, or add a new sanitized field/mode first.

---

## Implementation Plan

### PR 1 - Runtime Contract

- Add `result?: SkillCheckpointEvidence | null` to `SkillResult`.
- Add `result: skillCheckpointEvidenceSchema.nullable().optional()` to
  `emittedSkillResultSchema`.
- Add unit tests proving:
  - emitted `result` survives `runSkill()` parsing
  - emitted unknown root fields are still stripped or otherwise intentionally
    handled
  - legacy framed skills without `result` still parse
  - unframed skills still return `skillResult: null`
- Update docs in:
  - `docs/skills/authoring.md`
  - `docs/skills/runtime.md`
  - `docs/skills/overview.md`

### PR 2 - Consumer Rules And Output Policy

- Document wrapper status precedence:
  - wrapper `status` and `code`
  - then `skillResult.status`
  - then `skillResult.result`
  - then proof fields
- Decide JSON stdout policy:
  - keep `output` raw and add a sanitized field or summary mode, or
  - strip the terminal frame from `output` and add/preserve a raw stdout field
- Add CLI tests for success, indeterminate, output assertion failure, and
  execution failure shapes.

### PR 3 - Skills Migration

In `../clawperator-skills`, migrate high-value skills first:

1. Existing scripts that emit root `result`: confirm parsed output after the
   Clawperator schema change.
2. `com.google.android.apps.chromecast.app.get-climate-replay`: move the
   climate object to `result`.
3. `com.amazon.mShop.android.shopping.search-products`: move product results to
   `result`.
4. `com.android.vending.search-app`: replace root `results` with canonical
   `result`.
5. `com.globird.energy.get-yesterday-usage-cost-replay`: put the cost scalar in
   `result`.
6. Setter replay skills: populate `result` only when the confirmed final value
   is useful to callers.

### PR 4 - Cleanup And Conventions

- Update authoring guidance for checkpoint construction.
- Prefer map/state-machine checkpoints for new non-trivial skills.
- Keep diagnostics present when useful, but do not require empty diagnostics on
  every skill unless callers need it.
- Fix isolated quality issues:
  - `set-discharge-to-limit-replay` conditional diagnostics if still useful
  - `set-my-list-state-replay` `expected`/`observed` duplication if still
    accurate after the result migration

---

## Definition Of Done

- Default machine consumers can extract a skill answer from
  `parsed.skillResult.result` when a skill returns a value.
- Callers can branch safely on wrapper status before trusting nested skill
  status.
- Raw process output remains available somewhere documented, whether as
  `output`, `stdout`, or another explicit field.
- Pretty or summary output has a clear human-scannable answer when `result` is
  present.
- Docs describe the authored source of truth, not generated output.
- Tests cover:
  - schema parsing of `result`
  - unknown root key behavior
  - JSON CLI wrapper shape
  - failure and indeterminate wrapper shapes
  - at least one migrated real skill output fixture or smoke path
