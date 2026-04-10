# Brain / Hand Contract: Problem Definition

Created: 2026-04-10

## Purpose

Capture the deeper architectural problem that the Solax
`set-discharge-to-limit` work exposed, frame the solution space, and recommend
a concrete path forward. This file is a problem definition, not a task pack.
Task packs should be derived from it only after the framing is agreed.

## Crisp Problem Statement

The Clawperator `brain / hand` model is documented as an architectural
contract, but there is no actual *interface* between the brain and the hand at
the skill layer.

Concretely, this is what is missing today:

- A skill has no declared goal, no declared inputs schema, and no declared
  verification contract. `SKILL.md` is prose and `skill.json` is registry
  metadata. Nothing machine-readable says "this skill, when it returns success,
  means the device is in observable state X."
- A skill has no structured way to report what it did, what it observed, which
  checkpoints it reached, or what the terminal state was. Its return channel to
  the brain is literally the stdout string of `scripts/run.js`, as wrapped by
  `runSkill` which only surfaces `stdout`, `stderr`, `exitCode`, and an
  optional `expectContains` substring check.
- The exec-level `ResultEnvelope` in `apps/node/src/contracts/result.ts` is
  rich, but it only describes one `clawperator exec` invocation. A skill that
  makes several exec calls collapses them into opaque stdout. Everything the
  skill observed between calls is thrown away.
- As a consequence, the brain cannot reason about a skill's run. It can only
  observe "the script exited 0" or "the script exited non-zero", and if the
  skill chose to print some JSON it is doing so by private convention.

The brain / hand model therefore exists in the docs but not in the runtime.
In the runtime, a skill is a black-box shell script that returns a string.
That is why Solax `v0` ended up fusing navigation, interpretation, input
workaround, and state verification into one `run.js`: the shape of a skill
does not make any of those things separable.

This is the real brain / hand problem. It is an interface problem, not just a
reliability problem.

## Why The Solax Work Exposed It

`com.solaxcloud.starter.set-discharge-to-limit` is the first non-trivial skill
we authored from a recording. It is modest in goal ("set a numeric field") but
it required, in order to produce a truthful `v0`:

- two device-specific coordinate taps for container cards whose visible text
  was not the clickable node
- a runtime re-scoping of the `Discharge to` row after navigating two cards
  deeper than the recording suggested
- a key-event-driven text-entry workaround, because `enter_text` against the
  dialog field did not cause Solax to persist the new value
- two sequential `Save` clicks, with the second currently unscoped against the
  first
- manual, out-of-band verification of the persisted row in the Solax UI

None of those facts are derivable from the recording alone. They were found
by combining recording evidence, live screenshots, UI dumps, iterative runs,
and a brain (a human agent, in this case) holding state across runs.

Three things follow from that:

1. The skill script captures the resulting path, but throws away the reasoning
   that produced it. The next time Solax's layout shifts, the next author will
   have to re-derive all of that without any residual evidence from the first
   run.
2. The skill script uses Clawperator as a hand, but it also plays the role of
   the brain. It decides what to click next, how to recover from an input
   workaround, and whether the flow succeeded. The brain / hand split is not
   expressed in the artifact.
3. The brain (the agent that invoked the skill) cannot tell the difference
   between "the skill succeeded" and "the skill printed something that looked
   like success". The `exit(0) on any stdout` bug in `run.js` is not just a
   coding mistake; it is the only shape the current contract *allows*. A skill
   that wanted to report "I completed steps 1-5, observed value 40, could not
   verify step 6" has no protocol to do it in.

This is why the review suggested in-skill checkpoints and terminal
verification. Those are correct fixes, but they are treating a symptom. The
underlying issue is that the skill has no shape the brain can see into.

## What Is Failing In The Current Model

### 1. Skills have no declared intent

`skill.json` today is registry metadata: id, applicationId, intent string,
summary, scripts, artifacts. It does not declare what the skill is *for* in a
way the brain or a validator can check. There is no "inputs shape", "target
state", "post-conditions", or "required observations". An agent invoking
`clawperator skills run <id> -- 40` has no contract telling it what `40` means,
what the skill should observe on success, or what counts as a failure.

### 2. Skills have no structured result channel

`runSkill` returns a `SkillRunResult { ok: true, output: string, exitCode }` on
success. The `output` is whatever the script wrote to stdout. There is no
typed result schema, no checkpoint list, no evidence block, no terminal-state
assertion. Everything interesting the skill did is either lost or ad-hoc.

This is the single most load-bearing gap. Compare cannot work well without it.
Authoring guidance cannot improve much without it. Reliability work cannot
generalize without it. The brain has nothing to reason about.

### 3. Skills fuse three distinct roles

A skill today is simultaneously:

- a path executor (which CLI exec calls to make)
- a runtime interpreter (which hacks to apply when the path doesn't behave)
- a state verifier (deciding whether success actually happened)

Solax `v0` fuses all three into one file. There is no seam. That means:

- the path executor's assumptions (e.g. Samsung coordinates) cannot be swapped
  without rewriting the skill
- the runtime workaround (key-event input) is fused with the path, so a future
  Solax version that fixes the input path cannot be adopted incrementally
- the state verifier is missing entirely, because there is no natural place in
  the shape to put it without polluting the execution body

### 4. No observation primitive

Clawperator has `snapshot_ui` and `wait_for_node`, which are imperative. A
skill that wants to observe "the row currently shows Discharge to 40%" has to
hand-parse snapshots. There is no `read_observation` or `assert_observation`
that emits structured observation records into the result envelope. So even if
a skill wanted to report "I verified the terminal state", it has no primitive
that produces durable evidence of the observation.

### 5. Recordings are treated as generators, not evidence

The current workflow says: record, export, scaffold `--recording-context`.
The framing implicitly encourages treating the recording as "most of the skill,
minus a bit of cleanup". In practice the recording is only:

- a candidate path
- a set of candidate selectors
- a set of screen-transition observations
- a set of timing hints

It is not the skill. It never was. The scaffold output makes it look like it
almost is, which is the source of the brittleness.

### 6. No formal distinction between deterministic and judgment-heavy subflows

The Solax navigation path is deterministic for a given Samsung layout and a
given app version. The text-entry workaround is a compensating hack. The
terminal verification requires observation. These are three different
reliability regimes, and the skill has no way to declare which part is which.
The brain therefore cannot pick different strategies for different regimes.

## The Solution Space

I see four architectural pieces. They are independent in spec but sequenced in
implementation.

### A. Skill result contract (central)

Define a structured result that every non-trivial skill returns. Shape:

```
{
  "skillId": "com.solaxcloud.starter.set-discharge-to-limit",
  "goal": { "kind": "set", "target": { "discharge_limit_percent": 40 } },
  "status": "success" | "failed" | "indeterminate",
  "checkpoints": [
    {
      "id": "navigate.intelligence_tab",
      "status": "reached",
      "evidence": { "kind": "node_visible", "matcher": "resourceId=...tab_intelligent" }
    },
    ...
  ],
  "terminalVerification": {
    "expected": { "textContains": "Discharge to 40%" },
    "observed": { "textContains": "Discharge to 40%" },
    "status": "verified"
  },
  "runtimeEnvelope": [ <exec ResultEnvelope per step>, ... ],
  "diagnostics": { "first_failure": null, "hints": [] }
}
```

The skill's stdout becomes a JSON document conforming to this contract.
`runSkill` parses and validates it. The brain reads typed fields, not a string.

This is the load-bearing change. Everything else downstream gets easier.

### B. Skill goal and verification declaration

Add a declarative block to `skill.json` (or a sidecar) so that the skill's
intent is machine-readable without running it:

```
{
  "goal": { "kind": "set", "parameters": { "percent": "integer[0,100]" } },
  "verification": {
    "kind": "node_text_matches",
    "matcher": "Discharge to {percent}%"
  }
}
```

The skill runtime enforces the declared verification. If the skill does not
prove it, the result is `indeterminate`, not `success`. This is what turns
"terminal state verification" from a convention into a contract.

### C. Observation primitives in the runtime

Add a small primitive to the exec contract: `observe_node` that returns a
structured observation into `StepResult.data` (or a new typed field). This is
what skills use to populate `terminalVerification.observed`. Non-trivial
because `StepResult.data` is currently `Record<string,string>`; extending it
means a contract version bump. A lightweight first cut can serialize structured
observations into known string keys and defer the typed field until later.

### D. Skill role separation: path vs interpretation vs verification

At the skill-script level, provide a small helper that takes declared
checkpoints, executes them, and emits the structured result automatically.
Skill authors write the *content* of checkpoints, not the glue that logs them.
This moves skills from "macro scripts" to "checkpointed orchestrations" without
inventing a new language.

None of this requires the runtime to become a planner. The brain stays in the
agent. The hand stays in Clawperator. What changes is that the hand now
reports back in a shape the brain can actually read.

## Alternative Framings I Considered And Rejected

### "Just add checkpoints to skills"

This is what the current `skill-checkpoints` task pack does, and it is
correct as far as it goes. But without a structured result contract, every
skill implements checkpoints differently and the brain still sees a stdout
blob. Checkpoints without a contract is a convention; checkpoints on top of a
contract is an interface.

Keep `skill-checkpoints` as the immediate integrity fix for Solax, and treat
its generalized guidance as a *consequence* of the contract work, not as a
replacement for it.

### "Make compare the primary diagnostic surface"

Compare is valuable but it is fundamentally a consumer. If compare has to
reconstruct what a skill did from opaque stdout plus a recording baseline, it
is doing forensic work that the skill itself should have reported in the
first place. Build compare on top of structured skill results, not under them.

### "Extend `ResultEnvelope` to cover skill runs"

Tempting. But `ResultEnvelope` is the per-exec contract, and a skill is a
sequence of execs plus orchestration logic. Trying to collapse a whole skill
into one `ResultEnvelope` forces exec semantics onto the skill runtime and
makes it harder to describe skill-specific things (goals, verification,
checkpoints). A new skill-level envelope that *embeds* exec envelopes is
cleaner.

### "Generate skills from recordings more intelligently"

Appealing, but still wrong shape. A smarter generator without a skill result
contract still produces a black-box script. A generator on top of a contract
can produce skills whose outputs are reasoned about, not just replayed.

## Recommended Path Forward

My recommendation: treat the **skill result contract** (A above) as the
central piece, and sequence everything else around it.

### Stage 0. Finish the integrity fixes (already scoped)

Run `tasks/recording/skill-checkpoints/` as planned. Land:

- non-zero exit on exec failure
- terminal-state verification of `Discharge to <n>%`
- scoped second `Save` click

This is cheap and is a prerequisite for trusting Solax as the proving case for
anything else. Do not wait on the contract work.

Additional tightening to fold in: ensure a forced failure in a sub-exec causes
`runSkill` to return `ok:false`. Add a focused regression that exercises this
path so silent-success cannot regress.

### Stage 1. Define and ship the skill result contract

Add a new type, something like `SkillResult`, in `apps/node/src/contracts/`.
Update `runSkill` so that when a skill emits a JSON object matching the
contract on stdout's last line (or via an explicit marker), `runSkill` parses
it and returns it as a typed field alongside the existing fields. Skills that
don't emit structured output keep working unchanged; non-trivial skills opt in.

Retrofit Solax to emit a minimal `SkillResult` with:

- declared goal and inputs
- checkpoint list for the navigation path
- terminal verification of the persisted row

At this point the brain can finally see into the skill. This is the moment the
brain / hand contract becomes real.

### Stage 2. Declare goal and verification in `skill.json`

Add an optional `contract` block to `skill.json` that declares:

- inputs schema
- goal shape
- verification shape

`runSkill` validates the declared verification against the emitted
`SkillResult.terminalVerification`. A skill that declares verification but does
not emit a verified observation returns `indeterminate`, not `success`. Solax
is the first skill to declare this.

### Stage 3. Re-scope the compare work

Once skills emit structured results, compare becomes a diff over checkpoint
sequences and terminal observations, not a forensic reconstruction from exec
envelopes. The current `tasks/recording/compare/` P1 decision "how is a run
trace produced" collapses to: the skill's `SkillResult` *is* the trace. No
`--trace` flag on `exec` is needed.

Compare then does one specific thing well: diff a `SkillResult` against a
recording-export baseline, identify the first checkpoint divergence, classify
the failure category (baseline drift, runtime poisoned, runtime unavailable,
verification failed), and emit a structured diagnosis the brain can act on.

### Stage 4. Authoring guidance graduates to docs

Update `docs/skills/authoring.md` to describe:

- the contract shape
- how to author a non-trivial skill as a checkpointed orchestration
- what recordings contribute and what they do not
- how to declare goal and verification

Graduate the durable learnings currently trapped in
`tasks/recording/demo/findings.md` into this doc. Delete demo task files
except for any still-live problem summary.

### Stage 5. Optional runtime primitives

Only after stages 1-4, consider adding an `observe_node` primitive or an
extended `StepResultData` shape to make observation emission typed rather
than string-encoded. Defer until the contract work has revealed what
observations skills actually need to emit. Doing this earlier risks inventing
primitives without use cases.

### Stage 6. Repo-local skill authoring skill

`.agents/skills/skill-author-by-recording/` becomes safe to write only after
stages 1-4. Before then it would codify the current brittleness as convention.

## Workstreams Implied

| Workstream | Owner | Status |
| --- | --- | --- |
| W1. Skill integrity retrofit (Solax) | skill-checkpoints task | active |
| W2. Skill result contract | new task pack | not yet created |
| W3. Skill goal/verification declaration | new task pack | not yet created |
| W4. Recording compare diagnostic | compare task, re-scoped after W2 | active, adjust |
| W5. Skill authoring guidance graduation | docs work, after W2 and W3 | not yet created |
| W6. Observation primitives in the runtime | future, after W2-W5 | deferred |
| W7. Repo-local skill-author-by-recording | future, after W5 | blocked on W5 |

## What Should Happen First

1. Finish W1 as planned. Small, cheap, unblocks trust in the Solax proving
   case. Within one or two focused commits in the skills repo.
2. Create a W2 task pack for the skill result contract. Design the type,
   decide how `runSkill` parses it, retrofit Solax to emit it. This is the
   central change. Build it test-first with real Solax evidence.
3. Create a W3 task pack for the declarative goal/verification block in
   `skill.json`. Small surface, high leverage, validates W2 contract in
   practice.
4. Adjust the compare task pack: replace the P1 "how is a run trace produced"
   decision with "compare consumes `SkillResult`" and tighten the fixtures
   accordingly.
5. Execute compare on top of the new contract. It becomes a smaller, clearer
   feature.
6. Graduate durable recording-demo findings into `docs/skills/authoring.md`
   and `docs/api/recording.md` as part of W5.

Ordering matters because doing W4 before W2 forces compare to invent a trace
shape that W2 will then replace. Doing W6 before W2 invents runtime primitives
without a contract to anchor them. Doing W7 before W5 codifies brittle practice.

## What Should Explicitly Not Happen Yet

- Do not codify current recording-to-skill practice into
  `.agents/skills/skill-author-by-recording/`. Wait until the contract and
  authoring guidance exist.
- Do not add a `--trace` flag to `clawperator exec`. The skill result contract
  subsumes that need. Adding `--trace` now would create a parallel, partly
  overlapping mechanism.
- Do not retrofit every existing skill to the new contract in one pass. Solax
  is the proving case. Other skills opt in as they are touched.
- Do not treat compare as the brain / hand fix. Compare is a consumer.
- Do not extend `ResultEnvelope` (the exec envelope) to try to carry skill
  semantics. Introduce a new, skill-level envelope that embeds exec envelopes.
- Do not invent new runtime primitives (`observe_node`, typed observation
  slots) before the contract work has shown which primitives are actually
  missing.
- Do not treat `record parse` output as a basis for either compare or
  authoring. It is lossy and has always been inspection-only.
- Do not keep durable lessons trapped in `tasks/`. Graduate them to docs as
  each stage lands.

## Open Questions To Resolve In W2 Design

- Exactly how does a skill emit its `SkillResult`? Last-line JSON, explicit
  marker, file sidecar, or a dedicated stdout frame similar to
  `[Clawperator-Result]`? A dedicated frame is the most robust and aligns with
  the existing envelope idiom.
- Does the contract version live in the skill result itself, in `skill.json`,
  or both? Probably both, with the result carrying the runtime contract
  version and `skill.json` carrying the authored version.
- Where do `checkpoint.id` values come from? Free-form strings chosen by the
  author are fine for v1. A registry of common checkpoint kinds can emerge
  later.
- What happens to legacy skills that emit only stdout text? `runSkill` should
  remain backward compatible: absence of a structured result means
  `SkillResult` is null and the caller falls back to the old fields. Only
  non-trivial skills are expected to adopt the contract immediately.
- Is `terminalVerification` required for all non-trivial skills, or only
  declared? I recommend: required to be *emitted* if `skill.json` declares a
  verification block; otherwise optional. This gives a gradient from trivial
  to contract-bound.

## Appendix: Specifically Why Solax v0 Cannot Be "Good Enough" Without This

Even after the W1 integrity fixes, Solax `v0` still has these properties:

- it is a single `run.js` fusing path, workaround, and verification
- its terminal verification will live inline inside `run.js`, not in a
  declared contract block
- its output to the brain will still be stdout, not a structured skill result
- its checkpoints will be implicit in code, not enumerated in the result
- its divergence from a baseline will require compare to reconstruct meaning
  from exec envelopes

So the W1 fixes make Solax *truthful*. The W2 contract makes Solax
*legible* to the brain. Both are needed. W1 without W2 produces honest black
boxes. W2 without W1 produces legible lies. Do them in order, do not skip
either.
