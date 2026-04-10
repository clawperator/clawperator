---
title: Recording Promo Video Draft
purpose: |
  Script for a developer-facing promo/demo video that walks through the
  recording-to-orchestrated-skill workflow end-to-end. The script is written
  to be read aloud once the full recording program has shipped, so every
  command, file, and API referenced here is assumed to exist and work.
audience:
  - developers
  - OpenClaw tinkerers
  - tech-savvy users
  - agents reading subtitles or transcripts
status: draft
format: hybrid movie-script
reading_conditions: |
  This script assumes the whole recording program in `tasks/recording/` has
  landed. That means the `skill-author-by-recording` workflow exists, the
  Solax `-orchestrated` skill exists as an agent-driven runtime skill, the
  `SkillResult` contract is shipped and parsed by `runSkill`, declared skill
  contracts with the `indeterminate` status are shipped, and
  `clawperator recording compare` exists. Do not add "not yet shipped"
  language to the spoken content. If a scene describes something that is not
  true at recording time, the fix is to land that task pack, not to caveat
  the script.
clarity_rules:
  - The recording is evidence. The authoring-time agent uses that evidence to
    write the skill. At runtime, the orchestrated skill is executed by an
    embedded agent reading `SKILL.md` through a thin harness. That runtime
    agent is part of the feature, not a hidden detail.
  - Be explicit about the two brains in the system:
    OpenClaw is the outer brain that chooses the skill, and the embedded
    runtime agent inside the skill is the inner brain that reasons turn by
    turn against the current UI. Clawperator stays the deterministic hand.
  - Keep the spoken tone conversational. Audience is developers, OpenClaw
    tinkerers, and tech-savvy users, not a marketing panel.
  - Use explicit "On screen" and "Show this code" directions whenever the
    spoken words alone would leave the mechanism unclear.
  - Do not reference `tasks/recording/*` files on screen. The viewer should
    only ever see code, docs, CLI commands, and generated artifacts.
  - The video may stay focused on the orchestrated wow path, but it must not
    imply replay skills are second-class. Supporting docs and captions should
    preserve replay as a first-class maintained category for stable flows.
authoring_provenance:
  This script was written alongside the recording program task packs in
  `tasks/recording/` and describes the end-state those packs are building
  toward. It is kept in `tasks/` purely for authoring convenience. By the
  time the video is recorded, those task packs are expected to be deleted
  and the script read against the shipped system.
---

# Video Draft

## Scene 1 - The Hook

**On screen**

- Hold on a phone showing the SolaX Cloud app, buried several screens deep in
  the peak-export automation settings.
- Cut to a terminal with a single prompt typed into a chat:

```text
OpenClaw, set my battery export limit to 40% tonight.
```

- Cut back to the phone, now showing the new `Discharge to 40%` row.

**Spoken**

Today I want to show you something that, if you care about agent tools or
mobile automation, should make you sit up a little.

I have a real workflow in the SolaX Cloud app that is annoying enough that I
never want to do it by hand again. It is a bunch of taps, a modal, a text
field, and two saves. I am going to do that flow once, keep the evidence, turn
it into an inspectable skill, and then trigger it with one sentence to
OpenClaw. And I am not going to do it with a hopeful macro. I am going to do
it with something that can actually prove it worked.

## Scene 2 - Why This Is Not Just Macro Replay

**On screen**

- Full-screen statement card:

```text
Not a macro recorder.

At runtime:
- an agent reads the current UI
- Clawperator executes the physical actions
- the skill must prove the final app state before it can say "success"
```

**Spoken**

The first thing I want to make crystal clear is that this is not a macro
recorder with a fancy label on it.

In this system, Clawperator is the deterministic hand. It is the thing that
can snapshot, tap, type, wait, and report. The brain is an agent. And the
skill is the contract between them. At runtime, the thing driving the phone is
not a tape being replayed. It is an agent reasoning against the current UI and
then using Clawperator to do the actual work.

That distinction is the whole value prop. Macro replay says, "do these exact
steps and hope the app still looks the same." This says, "achieve this
outcome, prove the app really ended up there, and return a typed result the
brain can reason about."

And the nice part is that this is not a SolaX-only party trick. SolaX is just
the proving case I am using on camera. The same recording-driven workflow is
meant to help you author your own weird, personal, app-specific skill too.

## Scene 3 - Invoke The Guided Authoring Workflow

**On screen**

- Open Codex in the Clawperator repo.
- Show the exact prompt being sent to Codex:

```text
Use $skill-author-by-recording to create
com.solaxcloud.starter.set-discharge-to-limit-orchestrated
from a fresh recording. Guide me when I need to touch the phone.
```

**Spoken**

Here is the part that should feel kind of wild. I am not going to manually
stitch this together file by file. I am going to ask Codex to use a repo-local
workflow called `skill-author-by-recording`.

That workflow is the authoring-time guide. It starts the recording for me, tells
me when to touch the phone, pulls the artifacts back into the repo when I am
done, and then hands those artifacts to an authoring-time agent that reads the
recording evidence and writes the actual skill.

In the happy path I am showing here, my job as the developer is very small: I
type that one prompt, I pick up the phone when the workflow asks me to, I do
the thing I want to automate once, and I put the phone down. If the recording
is ambiguous, the authoring workflow may ask me one clarifying question about
intent. Then the authoring agent does the rest: recording lifecycle, artifact
export, SKILL.md, skill.json, run.js, and an initial self-test run to confirm
the skill works before it calls itself done.

That is the part that feels kind of nuts the first time you watch it. You are
not hand-authoring a brittle script from scratch. You are teaching the system a
real workflow by performing it once and then letting the authoring agent turn
that evidence into a runnable, inspectable skill.

## Scene 4 - The Recording Lifecycle, Uncovered

**On screen**

- Terminal shows the commands the workflow runs under the hood:

```bash
clawperator record start --session-id <session_id> --device <device_serial> --operator-package com.clawperator.operator.dev --json
clawperator record stop --device <device_serial> --operator-package com.clawperator.operator.dev --json
clawperator record pull --device <device_serial> --session-id <session_id> --out ./recordings --json
clawperator recording export --input ./recordings --snapshots omit --json
```

**Spoken**

Under the hood, none of this is magic. These are real Clawperator commands.
You can run them yourself. The value of the workflow is that it runs them in
the right order, on the right device, and hands me off to the phone at the
right moment so I do not have to keep the lifecycle in my head.

## Scene 5 - Human Performs The Flow

**On screen**

- Codex prints `Recording started on <device>. Please perform the flow now.`
- Cut to the phone. Show the full SolaX navigation: open the app, go to the
  Intelligence tab, open the peak-export card, open the device-discharging
  card, focus the `Discharge to` row, open the dialog, type `40`, confirm,
  save, and save again.
- Cut back to the terminal. Codex prints `Recording stopped. Pulling
  artifacts.` and then `Export written to ./recordings/<session>.export.json`
  followed by `Sanitized baseline retained at
  ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json`.
- Add a small note card beside the retained baseline path:

```text
Reference evidence only.
Not a runtime input.
Not in skill.json.artifacts.
```

**Spoken**

Once recording is active, I just do the thing I want to automate. I open the
app, navigate to the control, set the discharge limit to forty percent, and
save it. Then the workflow stops the recording, pulls the raw NDJSON off the
device, and writes an export artifact into the repo.

## Scene 6 - The Export Is Evidence, Not A Skill

**On screen**

- Open `./recordings/<session>.export.json`.
- Highlight these top-level fields visually:
  - `events`
  - `packageTransitions`
  - `counts`
  - `timeline`
- Annotation card:

```text
Recording export = evidence.
Not a finished skill.
Not a replayable plan.
```

**Spoken**

This file matters a lot, but it is not the automation.

It is evidence. It tells us what the Operator saw while I was driving the
phone: clicks, window transitions, package changes, timings, text changes. An
agent can learn a lot from that. But the export is not a reusable skill. It is
the raw material the skill will be authored from.

That distinction is important, because if you blur it, you end up pretending a
recording magically became a robust automation. It did not. The recording is
the evidence. The skill still has to be written.

And one more important detail: the retained sanitized baseline lives there for
authoring evidence, compare, and future maintenance. It is not listed under
`skill.json.artifacts`, and it is not sent to the runtime agent when the skill
actually runs.

## Scene 7 - The Agent Authors The Orchestrated Skill

**On screen**

- Codex begins streaming code into the editor.
- Show one new skill folder being authored in `../clawperator-skills`:

```text
skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/
  SKILL.md
  skill.json
  scripts/run.js
```

- Draw an arrow from `export.json` to that skill folder.
- Lower-third card:

```text
The recording is evidence.
The authored skill is:
- an agent program (SKILL.md)
- a declared contract (skill.json)
- a thin harness that starts the runtime agent (run.js)
```

**Spoken**

This is where the recording turns into something genuinely powerful.

The authoring-time agent reads the export and writes one orchestrated skill.
Not a giant scripted macro. An orchestrated skill. And it writes it in three
pieces.

`SKILL.md` is the runtime agent's program. `skill.json` is the declared
contract. `scripts/run.js` is the thin harness that starts the runtime agent on
that program. That separation is the whole trick. It means the reasoning is
inspectable, the contract is inspectable, and the hand stays clean.

This is also the moment where "orchestrated skill" stops sounding like branding
and starts meaning something precise. An orchestrated skill is a skill whose
runtime decisions are made by an embedded agent reading `SKILL.md`, while
Clawperator remains the only thing actually touching the device.

## Scene 8 - The Orchestrated Skill, Up Close

**On screen**

- Three stacked editor panels.

**Show this code**

Panel 1: `SKILL.md`

```md
# Goal
Set the SolaX "Discharge to" value to `{percent}` and prove the persisted row
really shows that value before reporting success.

# Allowed Clawperator primitives
- `clawperator snapshot`
- `clawperator exec`

# Required checkpoints
- `app_opened`
- `intelligence_tab_opened`
- `peak_export_card_opened`
- `device_discharging_card_opened`
- `discharge_to_row_focused`
- `target_text_entered`
- `terminal_state_verified`

# Recovery
- If the app opens on the wrong screen, close and reopen once.
- If the expected row is still missing, emit a failed SkillResult.

# Emission rule
Emit exactly one `[Clawperator-Skill-Result]` frame at the end of the run.
```

Panel 2: `scripts/run.js`

```js
const program = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
const skill = JSON.parse(readFileSync(new URL("../skill.json", import.meta.url), "utf8"));
const child = spawn(resolveAgentCli(skill.agent, process.env), buildAgentArgs(program), {
  env: {
    ...process.env,
    CLAWPERATOR_SKILL_INPUTS: JSON.stringify(inputs),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on("exit", (code) => process.exit(code ?? 1));
```

Panel 3: `skill.json`

```json
{
  "id": "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
  "agent": {
    "cli": "codex",
    "timeoutMs": 300000
  },
  "contract": {
    "inputs": { "percent": "integer[0,100]" },
    "goal": { "kind": "set_discharge_limit" },
    "verification": {
      "kind": "node_text_matches",
      "matcher": "Discharge to {percent}%"
    }
  }
}
```

**Spoken**

This is the scene where the whole architecture either lands or it doesn't, so
let's slow down for a second.

This first file, `SKILL.md`, is the brain inside the skill. It is a plain
English program for the runtime agent. It says what the goal is, what inputs it
takes, which checkpoints matter, what recovery is allowed, and how it has to
report the result.

This second file, `run.js`, is not the skill logic. That is really important.
It is just a harness. It reads `SKILL.md`, resolves the configured agent CLI,
passes the inputs in, forwards stdout and stderr, and exits. That is how
Clawperator starts the runtime agent. The harness is not the brain.

And then `skill.json` is the declared contract. It says what inputs are valid,
what the goal kind is, and what the verification rule is. So now the skill is
not just "whatever this script happened to do." It has a declared shape the
runtime can hold it to.

That is the part that should make you go, OK, this is not just automation. This
is an inspectable agent program bound to a deterministic hand and a declared
contract.

## Scene 9 - The SkillResult Contract, Up Close

**On screen**

- Show a `SkillResult` JSON card from a successful orchestrated run:

```json
{
  "contractVersion": "1.0.0",
  "skillId": "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
  "source": { "kind": "agent", "agentCli": "codex" },
  "goal": { "kind": "set_discharge_limit", "percent": 40 },
  "inputs": { "percent": 40 },
  "status": "success",
  "checkpoints": [
    { "id": "app_opened", "status": "ok" },
    { "id": "intelligence_tab_opened", "status": "ok" },
    { "id": "peak_export_card_opened", "status": "ok" },
    { "id": "device_discharging_card_opened", "status": "ok" },
    { "id": "discharge_to_row_focused", "status": "ok" },
    { "id": "target_text_entered", "status": "ok" },
    { "id": "terminal_state_verified", "status": "ok" }
  ],
  "terminalVerification": {
    "expected": { "textContains": "Discharge to 40%" },
    "observed": { "textContains": "Discharge to 40%" },
    "status": "verified"
  }
}
```

- Lower-third card:

```text
`runSkill` parses the `[Clawperator-Skill-Result]` frame,
injects `source` from the known skill configuration,
and hands this back as a typed object.
```

**Spoken**

And this is what the brain gets back. Not a blob of stdout. A typed result.

Goal. Inputs. The checkpoints the skill actually reached. Terminal verification
showing what it expected to prove and what it actually observed. And a status
that is one of `success`, `failed`, or `indeterminate`.

That `indeterminate` state is a big deal. It is the case where the run did not
blow up, but the skill also did not prove the thing it declared in
`skill.json`. That means the brain can distinguish "I know this worked" from "I
got to the end and I think it probably worked." That is the kind of seam you
need if you want agents to behave like engineering tools instead of vibes.

## Scene 10 - The Runtime Loop

**On screen**

- Diagram:

```text
OpenClaw intent
  "set discharge limit to 40%"
       |
       v
  OpenClaw chooses the orchestrated skill
       |
       v
  Clawperator runSkill starts the skill
       |
       v
  run.js spawns the configured agent CLI on SKILL.md
       |
       v
  embedded runtime agent
    read SKILL.md
    snapshot current UI
    reason
    act via clawperator exec
    record checkpoints
    run terminal verification
    emit one [Clawperator-Skill-Result] frame
       |
       v
  OpenClaw reads SkillResult
    success -> done
    indeterminate -> retry or escalate
    failed -> inspect checkpoints and reason
```

- Beside the diagram, show a live terminal panel with the runtime agent's stderr
  reasoning and the exact `clawperator` calls it makes, for example:

```text
[runtime-agent] snapshot: looking for Intelligence tab
[runtime-agent] exec: tap Intelligence
[runtime-agent] snapshot: peak export card visible
[runtime-agent] exec: tap Device discharging
[runtime-agent] exec: type 40
[runtime-agent] verification: row reads "Discharge to 40%"
```

- If live stderr is not readable enough on camera, use a prerecorded terminal
  panel built only from the archived stderr transcripts captured during W2b
  reliability validation. If those transcripts do not exist, the scene is not
  ready to record yet; fix W2b instead of inventing a substitute artifact.

**Spoken**

This is the runtime loop, and it is where the "brain and hand" model becomes
real.

There are two brains here. OpenClaw is the outer brain. It decides that the
intent maps to this skill and invokes it with the right inputs.

Then inside the skill there is an inner brain: the runtime agent that reads
`SKILL.md`, looks at the current UI, decides what to do next, and uses
Clawperator to do it.

Clawperator is still the hand at both layers. The runtime agent does not bypass
it. It snapshots through Clawperator. It taps through Clawperator. It types
through Clawperator. It verifies through Clawperator. That is what keeps the
execution substrate deterministic even though the reasoning is flexible.

And that is also why this is powerful. Reliability here does not mean the
agent must take the exact same path every time. It means the final outcome is
reliably proved before the skill is allowed to claim success.

That is the thing I want to be undeniable on screen. You can literally watch
the inner brain read the UI, decide, call the hand, and then hand a typed proof
back to the outer brain.

## Scene 11 - When The Path Changes

**On screen**

- Split view. Left: the recording export from Scene 6. Right: a saved
  `clawperator skills run --json` result file from a later run, with the
  wrapper's `skillResult` field highlighted before compare reads it.
- Terminal shows two compare invocations: one for a successful run where the
  agent took a different path, and one for a forced-failure run where the app
  was put in a bad starting state.

```bash
# Successful run saved earlier:
clawperator skills run com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
  --json -- 40 > ./runs/solax-run-01.skill-result.json

# Compare it against the retained sanitized recording baseline:
clawperator recording compare \
  --baseline ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json \
  --result ./runs/solax-run-01.skill-result.json \
  --json
```

- First show a successful compare result (agent took a different path,
  terminal verification still matched):

```json
{
  "compareMode": "semantic",
  "outcome": "outcome_matches_path_differs",
  "summary": "terminal verification matched even though the runtime path differed from the recording baseline"
}
```

- Then cut to a forced-failure compare result (app was put in a wrong
  starting state before this run):

```bash
clawperator recording compare \
  --baseline ../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json \
  --result ./runs/solax-forced-failure.skill-result.json \
  --json
```

```json
{
  "compareMode": "semantic",
  "outcome": "baseline_drift",
  "firstDivergence": {
    "baselineCheckpoint": "device_discharging_card_opened",
    "actualCheckpoint": "failed_before_expected_checkpoint"
  }
}
```

**Spoken**

This is the other half of why the workflow matters. Because the recording is
evidence, and because the orchestrated skill emits a structured result, I can
compare them.

Compare reads the SkillResult and sees that it came from an agent-driven
skill, so it uses semantic matching: it cares whether the terminal outcome
was reached, not whether every intermediate step matched the recording
exactly. If the runtime agent took a slightly different path but still
proved the final state, compare reports that as "outcome matches, path
differs" - not a failure.

And to make that workflow concrete: compare is reading the saved
`skills run --json` file from the earlier invocation, extracting the
`skillResult`, and using that as the runtime artifact. There is no manual
copy-paste or hand-built JSON in the loop.

But if the run actually drifts in a meaningful way - say the app was not in
the right starting state and the skill never reached its target checkpoint -
compare tells me exactly where the first divergence happened. That means the
next time the SolaX UI shifts, I do not have to spelunk through screenshots
and terminal noise. I get a typed diagnosis I can act on.

## Scene 12 - Inspectability

**On screen**

- Open Finder or file tree. Show:

```text
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/SKILL.md
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json
./runs/<run>.skill-result.json
```

- Draw boxes:
  - sanitized reference evidence for compare and maintenance
  - agent program
  - harness that starts the runtime agent
  - declared contract
  - typed runtime result

**Spoken**

This is the part I really want developers to take away.

None of this is "trust the AI." It is evidence, code, JSON, and a typed result.
You can open every artifact in this tree and inspect it. You can read the
sanitized retained baseline export that future compare runs use. You can read
the exact program the runtime agent was given. You can read the harness that
starts it. You can read the declared contract. You can read the result from a
real run.

And because that retained baseline is reference evidence instead of runtime
state, you can keep it around safely for maintenance without accidentally
teaching the runtime agent to depend on a stale recording.

That is why this feels powerful instead of spooky. The brain is inspectable.
The hand is inspectable. The contract is inspectable. The evidence is
inspectable.

## Scene 13 - Close: One Sentence, Verified Outcome

**On screen**

- Return to the original chat prompt:

```text
OpenClaw, set my battery export limit to 40% tonight.
```

- Cut to the phone: the `Discharge to 40%` row is live.
- Cut to the terminal: `status: success` and
  `terminalVerification.status: verified` highlighted.

**Spoken**

So this is what I built. I type one sentence. OpenClaw decides this intent maps
to the
`com.solaxcloud.starter.set-discharge-to-limit-orchestrated` skill. The skill
starts an embedded runtime agent. That agent reads the current UI, uses
Clawperator as the hand, proves the final state, and emits a `SkillResult`.
OpenClaw reads that result and tells me it is done.

And for me, that is the exciting part. We are not talking about macro replay
any more. We are talking about turning a real recorded mobile workflow into an
inspectable agent program that can run against a live device, prove the
outcome, and hand a structured result back to another agent.

That is a real brain-and-hand system. And once you see it work, it is very hard
not to start making a list of every annoying phone workflow you want back.
