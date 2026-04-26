# `clawperator skills run` Output Contract Review

## Executive Verdict

The current `skills run` output is primarily optimized for machine archival and
debuggability, not for human scanning. It is parseable and intentionally
preserves raw stdout, but the actual task answer is not first-class in either
the CLI wrapper or the `SkillResult` contract.

The contract is close to usable for agents that already know the Clawperator
skill-result conventions. It is not yet ergonomic for an agent encountering an
arbitrary skill result and asking the natural question: "what value did this
skill return?"

## Findings

### 1. High: The actual skill answer is hidden in verification evidence rather than exposed as a first-class result

**Grounding:**

- `apps/node/src/contracts/skillResult.ts:97` defines `SkillResult` with
  `goal`, `inputs`, `status`, `checkpoints`, `terminalVerification`,
  `execEnvelopes`, and `diagnostics`, but no `result` or `output` field for the
  skill's domain answer.
- `apps/node/src/domain/skills/runSkill.ts:282` returns the parsed
  `SkillResult` verbatim after injecting trusted `source` metadata.
- `docs/skills/authoring.md:1008` documents the current v1 fields and likewise
  lists no domain-result field.

**User and agent friction:**

For the GloBird example, the answer appears in at least two places:

- checkpoint evidence: `skillResult.checkpoints[].evidence.text == "-$3.10"`
- terminal verification observed text:
  `"GloBird yesterday usage cost: -$3.10"`

Neither location is named as the answer. A human has to scan a large escaped
JSON blob. An agent has to infer that the last verified text evidence, or a
specific checkpoint id such as `parsed-yesterday-usage-cost`, is the business
return value. That is brittle across skills because checkpoint ids are
skill-authored narrative labels, not a universal output contract.

**Likely root cause:**

The structured result was designed as a proof and diagnostics object: progress
checkpoints, terminal verification, runtime state, and optional execution
envelopes. That is valuable, but it leaves "what did the skill return?" as an
implicit convention rather than an API field.

**Smallest fix:**

Add an optional first-class domain result to `SkillResult`, for example:

```json
{
  "result": {
    "kind": "text",
    "text": "-$3.10"
  }
}
```

or, if richer typed outputs are expected:

```json
{
  "result": {
    "kind": "json",
    "value": {
      "amount": -3.1,
      "currency": "AUD",
      "display": "-$3.10"
    }
  }
}
```

Reuse the existing `SkillCheckpointEvidence` shape if possible so the contract
does not grow a second evidence vocabulary. Keep checkpoints and terminal
verification as proof, not as the primary answer channel.

**Backward-compatibility risk:**

Low if added as optional in the same major contract version. Existing consumers
can keep reading `skillResult.checkpoints` and `terminalVerification`. New
consumers can prefer `skillResult.result` when present and fall back to the
older proof fields while skills migrate.

### 2. High: Default JSON is parseable but too noisy for operators, and pretty mode does not fully solve answer discovery

**Grounding:**

- `docs/api/overview.md:22` says CLI commands return JSON by default and agents
  should parse stdout with `JSON.parse()`.
- `docs/skills/overview.md:531` says `output` is raw stdout from the script.
- `docs/skills/overview.md:535` says progress lines remain inside `output` in
  JSON mode.
- `apps/node/src/cli/commands/skills.ts:542` builds the success JSON wrapper
  with `status`, `skillId`, raw `output`, `exitCode`, `durationMs`, and
  `skillResult`.
- `apps/node/src/cli/commands/skills.ts:502` streams child stdout only in
  non-JSON mode, and `apps/node/src/cli/commands/skills.ts:532` strips the
  terminal frame from pretty-mode streaming when a `skillResult` is present.

**User and agent friction:**

The default output shown in the prompt is one compact JSON object containing:

- human progress lines
- a human answer line
- the literal `[Clawperator-Skill-Result]` frame
- an escaped JSON copy of the structured result
- the parsed `skillResult` again as JSON

That is good forensic evidence, but poor operator UX. The human answer is
visible only after reading through escaped stdout or nested evidence. Pretty
mode improves live streaming and strips the terminal frame from streamed stdout,
but the contract still lacks a concise final answer field to render.

**Likely root cause:**

The CLI is preserving legacy stdout behavior and structured result parsing in
one wrapper. That makes sense for compatibility and replay comparison, but the
same shape is being used for archival, machine parsing, and human inspection.

**Smallest fix:**

Keep the current default JSON as the stable full wrapper, but add a quieter
human-oriented rendering once `skillResult.result` exists. For example:

- `--output pretty`: stream progress, then print a short final status and
  result line when available.
- `--output json`: keep the full wrapper.
- optionally add `--output summary-json` or `--json-summary` only if agents need
  a smaller machine object without raw stdout.

Do not remove `output` from the full JSON wrapper.

**Backward-compatibility risk:**

Medium if existing users parse pretty-mode's final JSON dump. The docs already
state that default JSON is the machine contract and pretty mode is for humans,
so this is defensible, but it should still be called out in release notes. A new
`--output summary-json` would be lower risk than changing pretty output.

### 3. Medium: Raw stdout duplication is justified, but the field name `output` underspecifies its role and makes consumers choose between duplicate sources

**Grounding:**

- `runSkill()` captures child stdout and stderr separately in
  `apps/node/src/domain/skills/runSkill.ts:833` through
  `apps/node/src/domain/skills/runSkill.ts:864`.
- On success, `runSkill()` returns `output: stdout` plus parsed
  `skillResult` in `apps/node/src/domain/skills/runSkill.ts:1017`.
- The CLI success wrapper preserves that same `output` field in
  `apps/node/src/cli/commands/skills.ts:543`.
- Failure shapes use `stdout` and `stderr` in
  `apps/node/src/cli/commands/skills.ts:586`, while assertion failures keep
  using `output` in `apps/node/src/cli/commands/skills.ts:572`.
- `docs/skills/runtime.md:231` documents `output` as raw stdout, and
  `docs/skills/runtime.md:240` documents `stdout` and `stderr` as failure
  fields.

**User and agent friction:**

Returning both raw stdout and parsed `skillResult` is the right compatibility
choice. Legacy skills may only write stdout, `--expect-contains` depends on raw
stdout, and debug logs need the original stream. The problem is that `output`
sounds like the skill's result, while it is actually raw stdout. In framed
skills, it can include progress lines and the raw frame that produced the parsed
`skillResult`.

Agents can waste effort parsing `output` even when a structured `skillResult`
exists, or they may incorrectly treat the first human-readable answer line as
more authoritative than the parsed frame.

**Likely root cause:**

The field predates the structured `SkillResult` frame and remains the legacy
success field. Failure paths were later modeled more like process execution,
using `stdout` and `stderr`.

**Smallest fix:**

Document and, in a future additive shape, expose the stream role explicitly:

```json
{
  "stdout": "...",
  "stderr": "",
  "output": "..."
}
```

For now, keep `output` as an alias on success. If adding fields, prefer
`stdout` as the clearer canonical name and define consumer precedence:

1. Use `skillResult.result` for the domain answer when present.
2. Use `skillResult` proof fields for verification and diagnostics.
3. Use `stdout` or legacy `output` only for logs, compatibility, and legacy
   skills with `skillResult: null`.

**Backward-compatibility risk:**

Low for adding `stdout` as an alias. High for renaming or removing `output`,
because docs, tests, recording compare workflows, and existing skills rely on
the saved full wrapper.

### 4. Medium: `terminalVerification` is a proof channel, not an ergonomic answer channel

**Grounding:**

- `SkillTerminalVerification` in `apps/node/src/contracts/skillResult.ts:83`
  contains `status`, `expected`, `observed`, and `note`.
- Declared verification checks in `runSkill()` inspect
  `terminalVerification.status`, `expected`, and `observed` in
  `apps/node/src/domain/skills/runSkill.ts:546` through
  `apps/node/src/domain/skills/runSkill.ts:563`.
- `docs/api/recording.md:451` says recording compare uses
  `skillResult.checkpoints` plus `skillResult.terminalVerification`.

**User and agent friction:**

For a read-only skill like "get yesterday usage cost", it is tempting to treat
`terminalVerification.observed` as the answer. That works in the sample, but the
field name means "what was observed to prove terminal state," not "the return
value." Some skills may observe a whole sentence, a screen label, or a result
envelope reference. Others may put the concise answer in checkpoint evidence.

That makes answer extraction skill-specific. It also couples result extraction
to verification wording, which skill authors may change for clarity without
intending to change the machine output.

**Likely root cause:**

Verification and returned value were conflated because many early skills had a
single terminal assertion. As skills move toward user-on-behalf tasks, the final
assertion and the value returned to the caller need separate names even when
they contain the same evidence.

**Smallest fix:**

Treat `terminalVerification` as proof only. Add docs saying agents should not
use it as the primary result when `skillResult.result` exists. Skill authors can
duplicate the same evidence into both fields when the proof and answer are the
same.

**Backward-compatibility risk:**

Low. Existing compare logic can continue using terminal verification. New result
consumers get a clearer field without changing proof semantics.

### 5. Medium: The wrapper and nested statuses are useful, but their relationship needs a clearer consumer rule

**Grounding:**

- `runSkill()` can return wrapper `status: "indeterminate"` while preserving a
  nested `skillResult.status: "success"` in
  `apps/node/src/domain/skills/runSkill.ts:1003`.
- `docs/skills/overview.md:533` documents wrapper status values.
- `docs/skills/overview.md:534` says an unproved declared verification returns
  wrapper `status: "indeterminate"` without rewriting the emitted
  `skillResult`.

**User and agent friction:**

This separation is technically correct: the skill may report success while the
wrapper refuses to endorse the declared contract. But consumers need a simple
branching rule. Without one, agents may look at nested `skillResult.status` and
miss that the wrapper status is indeterminate or failed.

**Likely root cause:**

The contract preserves both provenance layers: child-authored result and
wrapper-authenticated run status. That is the right model, but the output shape
does not make precedence obvious.

**Smallest fix:**

Document a short precedence rule near the success shape:

1. Branch first on wrapper `status` and wrapper `code`.
2. Read `skillResult.status` only after wrapper `status == "success"`.
3. Treat `skillResult` as child-authored evidence that the wrapper may reject or
   mark indeterminate.

If adding a summary object, include a wrapper-authenticated field such as:

```json
{
  "verified": true,
  "result": { "kind": "text", "text": "-$3.10" }
}
```

only when wrapper status is success and declared verification passed or was not
required.

**Backward-compatibility risk:**

Low for docs. Medium for adding derived wrapper fields if consumers start
preferring them over the nested child-authored result without understanding the
verification policy.

## Direct Answers To The Review Questions

### Why return both `output` and `skillResult`?

The code returns both because `output` is raw captured stdout and
`skillResult` is parsed from an optional terminal frame. This preserves legacy
skills that only write stdout, supports `--expect-contains`, and keeps full
diagnostic evidence. The duplication is justified, but the names and precedence
rules need tightening.

### Is the current JSON too noisy for humans?

Yes. The sample output is valid JSON, but it is not operator-friendly. The
actual answer is buried in raw escaped stdout and repeated inside nested proof
objects.

### Is `SkillResult` ergonomic for agents?

Partially. It is good for verification, replay comparison, diagnostics, and
failure localization. It is not good enough as a generic "skill returned a
value" contract because it lacks a first-class result field.

### Would `skillResult.result` improve discoverability?

Yes. An optional `skillResult.result` is the smallest high-value additive change.
It would let agents reliably extract the answer while preserving checkpoints and
terminal verification as proof. A wrapper-level derived `result` can be added
later or exposed in a summary mode, but the durable source should live inside
`SkillResult`.

### Are checkpoints or terminal verification the right place for the actual answer?

No. They are the right place for evidence and proof. They should be allowed to
contain the same value, but they should not be the only answer channel.

### Should the CLI offer a quieter default JSON shape or a separate machine mode?

Do not make the current default JSON quieter by removing fields. It is already
the documented machine wrapper and saved-run artifact. Prefer an additive
summary mode or a more result-oriented pretty mode. If there is a machine summary
mode, it should be explicit and small, while `--output json` remains the full
diagnostic wrapper.

## Recommended Incremental Path

1. Add optional `result` to the v1 `SkillResult` schema, reusing existing
   evidence kinds.
2. Update skill authoring docs to require `result` for read/query skills and
   recommend it for any skill whose purpose is to return a value.
3. Update one or two real skills, including the GloBird replay skill, to emit
   `skillResult.result`.
4. Add tests proving the CLI preserves `skillResult.result` in default JSON and
   that legacy framed and unframed skills still behave unchanged.
5. Add a human-friendly pretty summary or an explicit summary JSON mode after
   the result field exists.
