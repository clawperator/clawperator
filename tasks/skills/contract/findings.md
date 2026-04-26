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
CLI and serve consumers. Those existing script-level `result` payloads are also
plain JSON objects, not `SkillCheckpointEvidence`, so they still need migration
into the canonical evidence shape after schema support lands.

The right implementation order is:

1. Add `skillResult.result` to the runtime schema as the canonical answer field.
2. Teach docs and agents to branch on wrapper `status` first, then read
   `skillResult.result` when present.
3. Migrate skills so primary outputs leave `diagnostics`, checkpoint-only
   evidence, and terminal-verification-only evidence.
4. Strip the terminal frame from `output` in JSON mode. Pretty mode already
   strips it; JSON mode should be consistent. This is a compatibility change that
   requires docs and a changelog entry, not a silent one-line cleanup.

---

## Findings

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

`emittedSkillResultSchema` is a plain `z.object` without `.passthrough()`, so
unknown root keys are stripped. `get-battery` and `install-app` already emit a
root `result` field at the script layer, and `search-app` emits a root `results`
field - but none of these fields survive Zod parsing. They are silently dropped
before the parsed `skillResult` reaches CLI and serve consumers. There are
currently zero reliable parsed `skillResult.result` consumers.

The existing script-level `result` fields are plain domain objects, not
`SkillCheckpointEvidence`. Adding `result?: SkillCheckpointEvidence | null`
will make the location legal, but those scripts still need to wrap their current
payloads as `result: { kind: "json", value: ... }` before they pass the proposed
schema.

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
consumers. Existing scripts that already emit root `result` show the intended
authoring direction, but their payload shape must be migrated to the canonical
evidence union before those fields survive parsing.

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

1. Skills already emitting root `result`: wrap the existing plain object as
   `{ kind: "json", value: ... }`, verify the field survives runtime parsing,
   and add regression coverage.
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

### 3. Medium: JSON `output` includes the terminal SkillResult frame - stripping it is the right call but is a contract change

**Owning surface:** `apps/node/src/cli/commands/skills.ts`

On success, indeterminate, and output-assertion failure paths, the CLI currently
emits an `output` field. Success and indeterminate use this shape:

```ts
output: options.format === "pretty"
  ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
  : result.output,
```

The pretty path strips the terminal `[Clawperator-Skill-Result]` frame. The JSON
path preserves raw stdout, including progress lines, human-readable answer
lines, the frame marker, and the JSON frame that was already parsed into
`skillResult`. The `SKILL_OUTPUT_ASSERTION_FAILED` path has the same pretty-vs-
JSON conditional and should follow the same policy.

**Friction:**

The sample GloBird output contains the answer twice:

- raw human output inside `output`
- structured proof inside `skillResult`

It also contains the framed JSON twice:

- escaped inside `output`
- parsed as `skillResult`

That makes default JSON hard for humans to scan and wastes agent context. It
also tempts agents to scrape `output` even when structured data exists.

**Analysis:**

Stripping the frame from `output` in JSON mode is the right fix. The fix is
one conditional in `skills.ts:546-548`. The reason it requires care is not
technical complexity - it is that docs define `output` as raw stdout, so
stripping silently changes an established field.

The two modes should behave consistently. Pretty mode already strips the frame
(`sanitizePrettySkillStdout`). JSON mode does not. That inconsistency means the
field `output` carries different content depending on the format flag, which is
its own documentation problem.

**Recommendation:**

Strip the terminal frame from `output` in JSON mode when `skillResult !== null`.
Apply this to success, indeterminate, and `SKILL_OUTPUT_ASSERTION_FAILED`
responses. Do not add a new field - that is over-engineering for a consistency
fix. Do document the change as a contract update and add a compat note in the
changelog.

**Minimal fix:**

```ts
output: (options.format === "pretty" || result.skillResult !== null)
  ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
  : result.output,
```

Apply the same pattern to every wrapper branch that returns `output`.

Document in `docs/skills/runtime.md`: `output` contains pre-frame human-readable
progress text; the parsed result is in `skillResult`. Consumers scraping the
frame from `output` should use `skillResult` instead.

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

### Correction A: Root `result` and `results` fields emitted by scripts are currently stripped

Earlier source findings describe `get-battery` and `install-app` as already
having a `result` field, and `search-app` as having a non-contract `results`
field at the root. These claims are accurate at the script layer but false at the
parsed contract layer.

`emittedSkillResultSchema` is `z.object({...})` without `.passthrough()`. Zod
strips unknown root keys by default. Both the `result` fields (in `get-battery`,
`install-app`) and the `results` field (in `search-app`) are silently dropped
before the parsed `skillResult` reaches CLI and serve consumers. No consumer
currently receives them through the runtime contract.

This makes adding `result` to the schema more urgent - it is not fixing a gap,
it is validating intent that already exists in two scripts. Migration tests must
confirm that emitted `result` actually survives `runSkill()` parsing after the
schema change. Because the proposed contract reuses `SkillCheckpointEvidence`,
existing plain-object `result` payloads must also be migrated to
`{ kind: "json", value: ... }`.

### Correction B: Stripping the frame from JSON `output` is a contract change, not a bug fix

Earlier findings describe this as a one-line bug fix with low compat risk. The
code fix is one line, but the semantics change is not low risk. Docs define
`output` as raw stdout. The fix should be shipped with a changelog entry and
updated docs, not silently. This document's recommendation (see Finding 3) is to
make the change deliberately rather than avoid it.

---

## Implementation Plan

### PR 1 - Runtime Contract

- Add `result?: SkillCheckpointEvidence | null` to `SkillResult`.
- Add `result: skillCheckpointEvidenceSchema.nullable().optional()` to
  `emittedSkillResultSchema`.
- Add unit tests proving:
  - emitted `result` in `SkillCheckpointEvidence` shape survives `runSkill()`
    parsing
  - emitted unknown root fields are still stripped or otherwise intentionally
    handled
  - emitted plain-object root `result` is rejected or stripped according to the
    chosen schema policy
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
- Strip the terminal frame from `output` in JSON mode (see Finding 3). Update
  `docs/skills/runtime.md` to define `output` as pre-frame human-readable
  progress text. Apply this consistently to success, indeterminate, and
  output-assertion failure branches. Add changelog entry.
- Add CLI tests for success, indeterminate, output assertion failure, and
  execution failure shapes.

### PR 3 - Skills Migration

In `../clawperator-skills`, migrate high-value skills first:

1. Existing scripts that emit root `result`: wrap current payloads in
   `{ kind: "json", value: ... }` and confirm parsed output after the
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
