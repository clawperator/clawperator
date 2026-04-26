# `clawperator skills run` Output Contract - Audit Findings

**Date:** 2026-04-26
**Scope:** JSON output contract for `clawperator skills run`, grounded in the following source files:
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/contracts/result.ts`
- `.agents/skills/api-agent-ux/SKILL.md`
- `docs/skills/runtime.md`

---

## Summary

The contract is trying to serve two audiences simultaneously - streaming human output and a machine-parseable JSON envelope - and it partially succeeds at both while creating friction for each. Two findings are bugs in kind, not design tradeoffs. The most actionable fix is also the smallest.

---

## Finding 1 - High: `output` re-embeds the `[Clawperator-Skill-Result]` frame verbatim in JSON mode

**Agent/operator friction.** An agent consuming JSON gets `skillResult` as a parsed object and also gets the full `[Clawperator-Skill-Result]\n{...}` blob as a raw substring inside the `output` string. The structured result is duplicated - once parsed, once as raw text. Any agent that tries to parse `output` for the answer hits frame marker noise and potentially double-parses. Any agent that ignores `output` still receives and discards a large string payload only useful for human inspection.

**Root cause.** `skills.ts:547` applies `sanitizePrettySkillStdout` conditionally:

```ts
output: options.format === "pretty"
  ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
  : result.output,
```

`sanitizePrettySkillStdout` calls `stripTrailingSkillResultFrame` (`skills.ts:194-199`) which correctly removes the frame. It only runs on the `pretty` path. JSON mode receives raw stdout, frame and all.

**Smallest fix.** Apply `stripTrailingSkillResultFrame` to `output` on the JSON path too, when `skillResult !== null`. The parsed result is already in `skillResult`; `output` should carry only the pre-frame human-readable progress lines.

**Backward-compatibility risk.** Any consumer currently scraping the `[Clawperator-Skill-Result]` JSON blob out of `output` would break. Those consumers are doing the wrong thing (the `skillResult` field exists for them), but they may exist. A deprecation note in the changelog is warranted.

---

## Finding 2 - High: No top-level result field - the answer is 3 levels deep

**Agent/operator friction.** An agent asked "what was yesterday's usage cost?" must navigate to either:

- `skillResult.checkpoints[N].evidence.text` (requires knowing the checkpoint id, e.g. `parsed-yesterday-usage-cost`)
- `skillResult.terminalVerification.observed.text` (requires knowing the `observed` field carries the labeled answer text)

Neither path is at a predictable location. To find the checkpoint, the agent must iterate over `checkpoints` by `id`. Different skills use different checkpoint ids. There is no `skillResult.result` or `skillResult.value` that carries the answer directly.

**Root cause.** The `SkillResult` interface (`skillResult.ts:97-108`) was designed around audit-trail concepts - checkpoints prove the steps, `terminalVerification` proves the matcher - but no field was added to carry the primary output directly. The design is internally consistent but optimized for provability, not discoverability.

**Smallest fix.** Add an optional `result` field to `SkillResult`:

```ts
result?: SkillCheckpointEvidence | null;
```

Skills that have a primary output set it explicitly (e.g. `{ kind: "text", text: "-$3.10" }`). The existing checkpoints and verification structure stays for audit purposes. An agent can shortcut to `skillResult.result` without iterating checkpoints.

**Backward-compatibility risk.** None for existing consumers - it is a new optional field. Skill authors need to adopt it, but existing skills continue to work without it.

---

## Finding 3 - Medium: Two overlapping channels carry the same answer with no clear winner

In a typical skill run:

- `skillResult.checkpoints[N].evidence.text` = `"-$3.10"` (raw extracted value)
- `skillResult.terminalVerification.observed.text` = `"GloBird yesterday usage cost: -$3.10"` (labeled terminal text)

Both fields contain the answer. An agent may use either and get subtly different text. The checkpoint value is cleaner for programmatic use; the terminal verification text has a label prefix that breaks a downstream parser expecting a bare dollar amount.

**Root cause.** `terminalVerification` is a proof mechanism - it records what was compared against the declared matcher to confirm the skill worked. It was not designed as an answer carrier. Because it is filled with observed text, it visually looks like "the answer" and sits near the top of `skillResult`. The checkpoint `evidence` field is the intended carrier but is buried in an array with no index guarantee.

**Smallest fix.** With Finding 2's proposed `result` field, this ambiguity disappears: skills set `result` to the canonical answer, `terminalVerification` stays as the proof artifact. Short of that, document explicitly that `terminalVerification.observed` is a verification artifact, not the answer, and that the answer lives in the checkpoint `evidence` for the checkpoint whose `id` the skill documents.

**Backward-compatibility risk.** Documentation change only. No code impact.

---

## Finding 4 - Medium: `output` field has no defined contract for JSON consumers

For an agent using JSON mode, `output` is the raw process stdout: progress banners, status lines, the frame marker, and the embedded JSON blob. There is no documentation of what `output` means in JSON mode or when it would be useful to a machine consumer. The reference in `docs/skills/runtime.md:110` ("inspect the raw `output`") is written for human debugging, not agents.

If the agent ignores `output` (correct behavior), it is still paying deserialization and token cost for a large string. If it tries to parse `output` for the answer, it hits unstructured progress lines.

**Root cause.** `output` was included in the JSON envelope because it is useful for debugging and because the pretty-mode streaming path also uses it. No distinction was drawn between "what does an agent do with this" and "what does a human operator do with this."

**Smallest fix.** After resolving Finding 1 (strip the frame from `output` in JSON mode), document that `output` in JSON mode is pre-structured human-readable progress text, intended for logging and diagnostics only. Agents should use `skillResult` for all programmatic decisions. Consider whether `output` should be gated behind a `--verbose` flag in a future machine-only mode.

**Backward-compatibility risk.** None for a documentation-only change.

---

## Finding 5 - Low: `pretty` format is indented JSON, not a human summary

`output.ts:14` - the `pretty` format path calls `JSON.stringify(data, null, 2)`. It is indented JSON. There is no format that renders a clean human-readable line such as `Cost: -$3.10`. A human running `skills run` in a terminal gets the streamed progress lines (good, and the frame is correctly stripped during streaming by `createPrettyStdoutForwarder`), followed by a full JSON blob at the end (less good).

For pre-alpha this is acceptable. It becomes friction when non-developer operators try to use the CLI directly.

**Smallest fix.** No immediate change required. When it matters: a `--quiet` flag that suppresses the JSON blob after a successful run, or a `--summary` format mode that prints only `skillResult.result.text`, would address it. Track as a future quality-of-life gap.

---

## Finding 6 - Low: `skillResult` is silently null for unframed script skills

`runSkill.ts:57` - `skillResult: SkillResult | null`. For script-driven skills that do not emit a `[Clawperator-Skill-Result]` frame, `skillResult` is `null`. An agent that dot-chains into `result.skillResult.status` will crash or hit a null-dereference equivalent.

The type is honest about this but there is no guidance in docs or error output on what an agent should do when `skillResult` is null.

**Smallest fix.** Add a note to the `skills run` JSON output docs: "`skillResult` is present only when the skill emits a `[Clawperator-Skill-Result]` frame. When null, the skill ran as an unstructured script and only `output`, `exitCode`, and `durationMs` are available." Long term, consider whether unframed script skills should emit a minimal default `skillResult` shape rather than null.

---

## Overall Assessment

Not acceptable for agent consumption as-is on Findings 1 and 2. An agent receives a duplicated embedded blob it must ignore, and to get the actual answer it must pattern-match against a checkpoint array with no stable index.

The human streaming experience (pretty mode) is actually good - progress lines are clean, the frame is stripped during streaming, and the banner gives useful diagnostics. The problem is entirely on the JSON contract side: the internal domain object (`SkillRunSuccess`) was lifted into the output without asking "what does an agent do with each field?"

## Priority Order

1. Strip the frame from `output` in JSON mode - one-line code change, note compat risk
2. Add `result?: SkillCheckpointEvidence | null` to `SkillResult` - additive, no compat risk
3. Document what `output` means in JSON mode and when `skillResult` is null
4. Clarify that `terminalVerification.observed` is a proof artifact, not the answer
