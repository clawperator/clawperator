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
  `-replay` and `-orchestrated` Solax skills both exist, the `SkillResult`
  contract is shipped and parsed by `runSkill`, declared skill contracts
  with the `indeterminate` status are shipped, and `clawperator recording
  compare` exists. Do not add "not yet shipped" language to the spoken
  content. If a scene describes something that is not true at recording
  time, the fix is to land that task pack, not to caveat the script.
clarity_rules:
  - The recording is evidence. The agent authors the orchestrated skill from
    that evidence. At runtime, the skill runs to completion and emits a
    single structured result. The brain does not sit inside the skill on
    every line, and the agent is not running inside helper functions at
    runtime. The agent's contribution is baked in at authoring time.
  - Keep the spoken tone conversational. Audience is developers, OpenClaw
    tinkerers, and tech-savvy users, not a marketing panel.
  - Use explicit "On screen" and "Show this code" directions whenever the
    spoken words alone would leave the mechanism unclear.
  - Do not reference `tasks/recording/*` files on screen. The viewer should
    only ever see code, docs, CLI commands, and generated artifacts.
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

- Cut back to the phone, now showing the new "Discharge to 40%" row.

**Spoken**

Hi. Today I'm going to show you how to take a messy multi-step mobile-app
workflow, and turn it into something I can trigger with one sentence to my
OpenClaw instance. The example is a real one. I've got a battery in my house
and I constantly end up digging through the SolaX Cloud app to change how
much energy I'm willing to push back to the grid. It's a bunch of taps, a
modal, a text field, and two saves. I am going to replace all of that with a
single message, and I am going to do it in a way that is actually verified,
not just hopeful.

## Scene 2 - Why This Is Not Just Macro Replay

**On screen**

- Split card:

```text
Macro replay            Clawperator + agent
  tap tap tap done        brain forms intent
  hope it worked          hand executes named checkpoints
                          hand verifies the final app state
                          brain reads a structured result
```

**Spoken**

And before anyone says "this is a macro recorder" - it's not. I want to
make that distinction early because it's the thing that makes this
interesting.

Clawperator is the deterministic "hand" that actually drives the Android
device. My agent, OpenClaw, is the "brain" that reasons about what to do.
What we are building is the thing in between: a skill that knows what it
was trying to achieve, names the checkpoints it is hitting on the way, and
reads the app state at the end to confirm it actually worked. If any of
that goes sideways, the brain gets a structured result it can reason about,
not a stdout blob.

That split is the whole point. Replay is "try and do these taps in order".
Orchestrated is "achieve this outcome, checkpoint by checkpoint, and prove
it".

## Scene 3 - Invoke The Guided Authoring Workflow

**On screen**

- Open Codex in the Clawperator repo.
- Show the exact prompt being sent to Codex:

```text
Use $skill-author-by-recording to create a
com.solaxcloud.starter.set-discharge-to-limit-orchestrated skill.
Guide me when I need to touch the phone.
```

**Spoken**

Here is the important part. I am not going to hand-stitch any of this
myself. I am going to ask Codex to use a repo-local workflow called
`skill-author-by-recording`. That workflow is the thing that guides the
entire process. It tells me when to go touch the phone. It runs the
recording lifecycle commands for me. It pulls the artifacts back into the
repo. And then it helps the agent turn those artifacts into a real skill.

So from my point of view as a developer, I literally just type that prompt
and then follow the instructions.

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

Under the hood, this is not magic. These four commands are real, first-class
Clawperator CLI commands. You can run them yourself any time. What the
workflow does is run them for me in the right order and hand me off to the
phone at the right moment, so I never have to remember the lifecycle by
heart.

## Scene 5 - Human Performs The Flow

**On screen**

- Codex prints "Recording started on <device>. Please perform the flow now."
- Cut to the phone. Show the full SolaX navigation: open the app, go to the
  Intelligence tab, open the peak-export card, open the device-discharging
  card, focus the "Discharge to" row, open the dialog, type 40, confirm,
  save, and save again.
- Cut back to the terminal. Codex prints "Recording stopped. Pulling
  artifacts." and then "Export written to ./recordings/<session>.export.json".

**Spoken**

OK, the workflow tells me recording is active, and I do the thing I want to
automate. I open the app, I navigate down to the right control, I set the
discharge limit to forty percent, and I save it. Then the workflow stops
the recording, pulls the raw NDJSON off the device, and writes a clean
export artifact into the repo.

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
Not a finished skill. Not a replayable plan.
```

**Spoken**

Now this is the part I see people get wrong most often. This file is not a
skill. It is evidence.

It tells us, truthfully, the sequence of events that the Operator observed
while I was driving the phone. It's got the click targets, the window
transitions between apps, the rough timeline, and the package changes.
That is genuinely useful to an agent that has to figure out what I did and
why. But it is not a reusable automation. If I just blindly replay these
events, the first time the app loads a little slower, or a popup shows up,
or a layout shifts, that replay starts to drift. It is the raw material.
The orchestrated skill still has to be written.

## Scene 7 - The Agent Authors Two Skills

**On screen**

- Codex begins streaming code into the editor. On the left, the export JSON.
  On the right, two new skill folders being authored in
  `../clawperator-skills`:

```text
skills/com.solaxcloud.starter.set-discharge-to-limit-replay/
skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/
```

- Draw arrows: `export.json` -> replay skill, `export.json` -> orchestrated
  skill.
- Lower-third card:

```text
Both skills emit a SkillResult.
Replay:       path-centric. Walk the captured route and verify the outcome.
Orchestrated: goal-centric. Declare the goal and verification up front;
              the runtime cross-checks them and can return "indeterminate".
```

**Spoken**

Here is where the brain/hand split becomes concrete.

The workflow writes out two skills side by side. Same recording as the
starting point. Same Android app. Same end result in the UI. Two different
authoring shapes.

The first is a `replay` skill. That is the direct path, cleaned up,
preserved as a durable baseline. It is what you use when the UI is stable
and you just want to get from A to B the same way every time. It is
cheap, it is inspectable, and a lot of the time it's all you actually
need.

The second is the `orchestrated` sibling. Same path, but it also declares
its goal and its verification up front, inside `skill.json`. That
declaration is what lets Clawperator cross-check what the skill *claimed*
it would prove against what it *actually* proved, and give you back a
third outcome beyond success and failed: `indeterminate`, the case where
the script ran cleanly but did not satisfy its own contract.

But here is the part I want to be really explicit about, because I know
how people are going to hear this otherwise: **both of these skills emit
a `SkillResult`**. Every modern skill does. That is not a property of
`orchestrated`. That is the universal contract any skill under Clawperator
uses to talk back to the brain. The agent authors the result emission
into both skills, from the same recording evidence. The difference
between replay and orchestrated is *what the skill declares* and *how
much reasoning lives in the script*, not whether the brain gets
structured output.

## Scene 8 - Replay Shape Versus Orchestrated Shape

**On screen**

- Side-by-side code view of the two authored `run.js` files. Above each
  block, a header card:
  - left: `set-discharge-to-limit-replay / scripts/run.js`
  - right: `set-discharge-to-limit-orchestrated / scripts/run.js`

**Show this code**

```js
// replay: path-centric, still emits a SkillResult
const checkpoints = [];
async function step(id, fn) {
  try { await fn(); checkpoints.push({ id, status: "ok" }); }
  catch (err) { checkpoints.push({ id, status: "failed", note: String(err) }); throw err; }
}

await step("app_opened",                  openApp);
await step("discharge_to_row_focused",    navigateToDischargeToRow);
await step("target_text_entered",         () => enterLimit(40));
await step("save_completed",              completeSave);

const terminalVerification = await verifyDischargeToRow(40);
checkpoints.push({
  id: "terminal_state_verified",
  status: terminalVerification.ok ? "ok" : "failed",
});

emitSkillResultFrame({
  contractVersion: "1.0.0",
  skillId: "com.solaxcloud.starter.set-discharge-to-limit-replay",
  goal:   { kind: "set_discharge_limit", percent: 40 },
  inputs: { percent: 40 },
  status: terminalVerification.ok ? "success" : "failed",
  checkpoints,
  terminalVerification,
});
```

```js
// orchestrated: goal-centric, declared contract, richer checkpoints
const checkpoints = [];
async function reached(id, fn) {
  try { await fn(); checkpoints.push({ id, status: "ok" }); }
  catch (err) { checkpoints.push({ id, status: "failed", note: String(err) }); throw err; }
}

await reached("app_opened",                    openApp);
await reached("intelligence_tab_opened",       openIntelligenceTab);
await reached("peak_export_card_opened",       openPeakExportCard);
await reached("device_discharging_card_opened", openDeviceDischargingCard);
await reached("discharge_to_row_focused",      focusDischargeToRow);
await reached("dialog_input_focused",          focusDialogInput);
await reached("target_text_entered",           () => enterLimit(40));
await reached("dialog_confirm_clicked",        confirmDialog);
await reached("toolbar_save_clicked",          saveOnToolbar);
await reached("bottom_sheet_save_clicked",     saveOnBottomSheet);

const terminalVerification = await verifyDischargeToRow(40);
checkpoints.push({
  id: "terminal_state_verified",
  status: terminalVerification.ok ? "ok" : "failed",
});

emitSkillResultFrame({
  contractVersion: "1.0.0",
  skillId: "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
  goal:   { kind: "set_discharge_limit", percent: 40 },
  inputs: { percent: 40 },
  status: terminalVerification.ok ? "success" : "failed",
  checkpoints,
  terminalVerification,
});
```

- Cut to the orchestrated skill's `skill.json` and highlight the `contract`
  block:

```json
{
  "id": "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
  "contract": {
    "inputs": { "percent": "integer[0,100]" },
    "goal":   { "kind": "set_discharge_limit" },
    "verification": {
      "kind": "node_text_matches",
      "matcher": "Discharge to {percent}%"
    }
  }
}
```

**Spoken**

OK look at these two side by side.

The replay version on the left is short and linear. It names a handful of
coarse-grained checkpoints - opened the app, focused the right row,
entered the value, saved - and then reads the "Discharge to 40%" row back
out of the UI as its terminal verification. And then, crucially, it does
the same thing the orchestrated version does: it emits a `SkillResult`
frame. Goal, inputs, checkpoints, terminal verification, status. The full
contract. Replay is not excused from talking back to the brain in a
structured way.

The orchestrated version on the right does more. It enumerates every
intermediate step as its own named checkpoint, so if the UI shifts and
the flow breaks somewhere in the middle, the brain can see exactly how
far the run got and where it diverged. And then here, over in
`skill.json`, it declares its contract: its inputs schema, its goal
shape, and its verification rule. That declaration is what Clawperator
cross-checks at the end. If the declared verification isn't satisfied,
the runtime gives the brain back `indeterminate`, not `success`. That is
what stops a skill from lying by omission, and it is the superpower the
orchestrated shape adds.

So the simple mental model is this. Both skills emit `SkillResult`. Both
verify the final state of the app. The replay skill trusts the path. The
orchestrated skill declares the goal and lets the runtime hold the skill
to it.

One thing I want to be crystal clear about, because people get this part
wrong. Those `step(...)` and `reached(...)` wrappers in the code are
ordinary skill code. They are not the agent. There is no agent sitting
inside those functions at runtime. The agent wrote this code once,
during authoring. The code runs. The code emits a result. The agent
reads the result later. That is the seam.

## Scene 9 - The SkillResult Contract, Up Close

**On screen**

- Show the `SkillResult` shape as a labeled JSON card. This is the
  orchestrated Solax skill's result, picked because it has the fullest
  checkpoint list to point at; the replay skill emits a structurally
  identical document, just with fewer checkpoint entries:

```json
{
  "contractVersion": "1.0.0",
  "skillId": "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
  "goal":   { "kind": "set_discharge_limit", "percent": 40 },
  "inputs": { "percent": 40 },
  "status": "success",
  "checkpoints": [
    { "id": "app_opened",                     "status": "ok" },
    { "id": "intelligence_tab_opened",        "status": "ok" },
    { "id": "peak_export_card_opened",        "status": "ok" },
    { "id": "device_discharging_card_opened", "status": "ok" },
    { "id": "discharge_to_row_focused",       "status": "ok" },
    { "id": "dialog_input_focused",           "status": "ok" },
    { "id": "target_text_entered",            "status": "ok" },
    { "id": "dialog_confirm_clicked",         "status": "ok" },
    { "id": "toolbar_save_clicked",           "status": "ok" },
    { "id": "bottom_sheet_save_clicked",      "status": "ok" },
    { "id": "terminal_state_verified",        "status": "ok" }
  ],
  "terminalVerification": {
    "expected": { "textContains": "Discharge to 40%" },
    "observed": { "textContains": "Discharge to 40%" },
    "status":   "verified"
  }
}
```

- Annotation labels beside the JSON:
  - "what I was trying to do"
  - "which checkpoints I hit"
  - "what proves it actually worked"

- Lower-third card:

```text
SkillResult frame is emitted on stdout inside [Clawperator-Skill-Result].
runSkill parses it and hands it back to the caller as a typed object.
```

**Spoken**

And here is what the brain gets back from any modern Clawperator skill.
Not a stdout blob. A typed object. Goal, inputs, the full checkpoint
list, terminal verification with expected and observed side by side, and
a status that is one of `success`, `failed`, or `indeterminate`.

That `indeterminate` state is worth a beat. That is the state where the
script ran fine, no exec call blew up, but the skill did not actually
prove the thing it said it would prove. The runtime only hands that
status back when a skill has a declared contract in its `skill.json` to
compare against, which is why I called that out on the orchestrated skill
a moment ago. It means the brain knows the difference between "I
verified it" and "I think it worked", and it's what stops any skill with
a declared contract from lying by omission.

## Scene 10 - The Runtime Loop

**On screen**

- Diagram:

```text
OpenClaw intent
  "set discharge limit to 40%"
       |
       v
  pick a skill
  (orchestrated preferred; replay sibling available as fallback)
       |
       v
  invoke the skill with inputs
       |
       v
  Clawperator hand runs the whole skill straight through
  - executes each exec step
  - records every checkpoint as it is reached
  - reads back the discharge-to row
       |
       v
  skill emits one SkillResult frame on stdout
       |
       v
  OpenClaw brain reads the SkillResult
  - status == success? done
  - status == indeterminate? retry differently, or escalate
  - status == failed? inspect the last ok checkpoint and reason
```

**Spoken**

Here's the actual runtime loop, because I think a lot of people picture
this wrong. The brain does not micromanage the hand checkpoint by
checkpoint. The brain forms intent. It picks the orchestrated skill. It
invokes it with inputs. Clawperator then runs the skill straight through
without asking the brain anything on the way. When the skill finishes, it
emits one structured result. The brain reads that result, once, and
decides what to do next.

That is what keeps the hand deterministic. The hand never has to guess. It
executes. It observes. It reports. The brain only gets involved at
boundaries - to choose the skill, to read the result, and to decide the
next move if something wasn't quite right.

And if things did go wrong, the brain actually has enough to reason about.
It can see the last checkpoint that succeeded. It can see where the
divergence started. It can see whether the terminal verification matched
or not. It can decide to retry with different inputs, to try a different
skill, or to tell me. That is the whole reason the `SkillResult` exists.

## Scene 11 - When Replay And Orchestrated Disagree

**On screen**

- Split view. Left: the recording export from Scene 6. Right: a
  `SkillResult` from a failed run.
- Terminal shows:

```bash
clawperator recording compare \
  --baseline ./recordings/<session>.export.json \
  --result ./runs/<run>.skill-result.json \
  --json
```

**Spoken**

And here's the bonus. Because the recording export is evidence, and
because the orchestrated skill emits a structured result, you can compare
them. You point the compare command at the original recording baseline and
at a specific skill run, and it tells you the first checkpoint that
diverged, classifies what kind of divergence it was, and gives the brain
something concrete to act on. So when the SolaX UI shifts in a future app
update, the first run that drifts tells you exactly where it drifted. You
don't have to go spelunking through screenshots.

## Scene 12 - Inspectability

**On screen**

- Open Finder or file tree. Show, side by side:

```text
recordings/<session>.export.json
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-replay/scripts/run.js
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/skill.json
```

- Draw boxes:
  - evidence
  - replay path
  - orchestrated logic
  - declared contract

**Spoken**

And I want to pause on this, because if you are a developer watching
this, this is the part you should take away. None of this is "trust the
AI". It is code. It is JSON. It is an NDJSON recording. It is two
Git-tracked skills. It is a declared contract. You can open every one of
these files and read them yourself. The agent's contribution is exactly
visible: it wrote the orchestrated script, it named the checkpoints, it
added the verification, it filled in the declared contract. That's the
"how". There is no black box.

## Scene 13 - Close: One Sentence, Verified Outcome

**On screen**

- Return to the original chat prompt:

```text
OpenClaw, set my battery export limit to 40% tonight.
```

- Cut to the phone: the "Discharge to 40%" row is live.
- Cut to the terminal: the `SkillResult.status == "success"` line
  highlighted.

**Spoken**

So this is what I built. I type one sentence into my OpenClaw instance.
OpenClaw decides this is the
`com.solaxcloud.starter.set-discharge-to-limit-orchestrated` skill. It
invokes it. Clawperator drives the app. The skill hits every checkpoint,
reads the persisted row back, and emits a `SkillResult` with
`status: success` and `terminalVerification.status: verified`. OpenClaw
tells me it is done.

And the reason I find this exciting, beyond the obvious "I didn't have to
touch my phone" thing, is that this is a genuine brain-and-hand system.
The hand stays deterministic and boring. The brain stays in the agent.
The skill is the contract between them. The recording is the evidence the
skill was written from. And every single piece of that is inspectable
code, inspectable artifacts, or a shipped CLI command.

That's the workflow. Let's keep going.
