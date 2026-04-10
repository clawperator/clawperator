---
title: Recording Promo Video Draft
purpose: |
  Draft script for a developer-facing promo/demo video that explains the
  recording-to-orchestrated-skill workflow being built in the recording
  workstreams.
audience:
  - developers
  - agents reading subtitles/transcripts
status: draft
format: hybrid movie-script
working_backwards: |
  This file is a "working backwards" artifact for the recording program. It
  plays a similar role to an internal press release: it forces the team to
  explain, in user-facing terms, what the finished workflow should feel like
  when Clawperator, Codex, and OpenClaw are working together well.
notes:
  - Keep the spoken tone conversational rather than polished marketing copy.
  - The script should make the "how" visible through scenes, commands, files,
    and code callouts, not just through spoken claims.
  - Use explicit "On screen" and "Show this code" directions whenever the
    spoken words alone would leave the mechanism unclear.
---

# Video Draft

## Scene 1 - Setup / What We Are Solving

**On screen**

- Open the Solax app on the phone and briefly show the UI path that has to be
  navigated manually.
- Cut back to terminal and editor.

**Spoken**

Hi - today I'm going to demonstrate how to create a complex skill using Clawperator. In my case, I've got a battery in my home. I often find myself adjusting how much power I want to feed into the grid each night. The UI for doing this in the app has numerous steps, and we're going to use Clawperator to create a skill so we can automate this to the point that I can send a single message to my OpenClaw instance and the export limit will be changed. So let's get started.

## Scene 2 - Invoke The Guided Workflow

**On screen**

- Open Codex in the Clawperator repo.
- Open the future repo-local workflow file:
  - `.agents/skills/skill-author-by-recording/SKILL.md`
- Highlight that this is the workflow being used.
- Show the exact prompt being sent to Codex, something like:

```text
Use $skill-author-by-recording to create a Solax discharge-limit skill.
Guide me when I need to touch the phone.
```

**Spoken**

Now, the first important thing to understand is that I'm not going to manually stitch all of this together myself. I'm going to ask Codex to use Clawperator's `skill-author-by-recording` workflow. That workflow is the thing that is going to guide the process. It will tell me when to perform the flow on the phone, it will manage the recording lifecycle, it will pull the artifacts back into the repo, and then it will help turn that captured flow into real skill code.

## Scene 3 - Show The Underlying Recording Commands

**On screen**

- In the terminal, show the exact commands that the guided workflow is driving
  under the hood:

```bash
clawperator record start --session-id <session_id> --device <device_serial> --operator-package com.clawperator.operator.dev --json
clawperator record stop --device <device_serial> --operator-package com.clawperator.operator.dev --json
clawperator record pull --device <device_serial> --session-id <session_id> --out <recordings_dir> --json
clawperator recording export --input <recordings_dir> --out <export_file> --snapshots omit --json
```

- Then visually step back and make it clear the workflow is abstracting this.

**Spoken**

So in other words, yes, under the hood there are concrete commands involved here like `clawperator record start`, `clawperator record stop`, `clawperator record pull`, and `clawperator recording export`. But for the developer experience we're aiming for, I shouldn't need to manually remember and orchestrate those commands every time. The agent should do that with me.

## Scene 3A - Make The Future-State Explicit

**On screen**

- Add a lower-third card:

```text
This part of the demo is showing the intended Clawperator workflow
once skill-author-by-recording ships.
```

**Spoken**

And just to be really explicit, this part is showing the workflow we are building toward. So this isn't hand-wavy product language. This is meant to become a real skill in this repo that Codex can use to guide a developer through the whole process.

## Scene 4 - Human Performs The Recorded Flow

**On screen**

- Codex says recording is active.
- Cut to the phone.
- Show the founder navigating the Solax flow and setting the value to 40%.

**Spoken**

So now Codex is going to tell me that the recording is active, and at that point I'm going to navigate through the various pages in the app, and I'm going to set the desired percentage I want to stop feeding my power back into the grid. I'm going to set it to stop at 40%.

Okay, that's done, and the workflow will now stop the recording and pull the captured artifacts into the project. So those operations have all been captured.

## Scene 5 - Show The Captured Artifacts

**On screen**

- Open Finder or the editor file tree.
- Show the recording artifacts produced by the workflow.
- Highlight these files:

```text
recordings/solax-set-discharge-to-limit/<session>.ndjson
recordings/solax-set-discharge-to-limit/<session>.steps.json
recordings/solax-set-discharge-to-limit/<session>.export.json
```

- Open the export file and point at:
  - events
  - package transitions
  - timeline

**Spoken**

Now we're going to create a repeatable skill from this recording. If you're new to Clawperator, you should know that Clawperator works best in conjunction with an agent - the system has been architected so that Clawperator itself is your "hand" - it will reliably execute operations on your Android device on your behalf. And this hand works in conjunction with the "brain" that is your agent, in my case, my OpenClaw instance.

And this is where the really interesting part starts.

The recording we just created is incredibly useful, but it's not the finished thing. The recording is evidence. It shows us the path I took through the app. It shows the clicks, the screens, the timing, the rough shape of the flow. But it doesn't yet give us a truly reliable automation. If we just blindly replayed every tap, we might get lucky a lot of the time, but the moment a screen loads a little slower, or a modal appears, or a UI element shifts, that replay starts to get brittle.

## Scene 5A - Show Exactly What The Export Gives Us

**On screen**

- Open the export JSON and visually highlight:
  - event list
  - package transitions
  - event counts
  - timeline
- Add an annotation card:

```text
Recording export is evidence, not a finished skill.
```

**Spoken**

This is important. The export does not contain a magically completed skill. What it gives us is evidence the agent can inspect. It can see the raw event timeline, package changes, and the broad structure of the path I took through the app. That's enough to scaffold and reason from. It's not enough to pretend the job is done.

## Scene 6 - Explain Replay Vs Orchestrated

**On screen**

- Show a simple split card:

```text
Replay skill:
- direct path
- good for simple stable flows

Orchestrated skill:
- named checkpoints
- terminal verification
- structured result for the brain
```

**Spoken**

So what we're going to do instead is use that recording as the source material for something better.

Clawperator has two categories of skill that matter here. A replay skill is the simpler kind. That's what you use when a direct path through the UI is stable enough that replaying that route is basically the whole job. But in this case, that's not enough. This Solax flow is multi-step, stateful, and high-consequence enough that what we actually want to end up with is an orchestrated skill.

## Scene 7 - The Missing "How"

**On screen**

- Show a simple artifact flow:

```text
record on phone
  -> pull/export artifacts
  -> scaffold code
  -> Codex authors orchestrated skill
  -> OpenClaw invokes it later
```

**Spoken**

And this is the bit I really want to call out for developers and for agents reading this later. The orchestrated part is not magically produced by the recording itself. Clawperator does not pretend that a recording is already a robust skill. The recording gives us the evidence. Then Codex, using the `skill-author-by-recording` workflow, inspects that evidence, scaffolds the initial code, and authors the orchestrated skill from it.

So there is a real "how" here.

The workflow captures the recording.

It exports the recording artifact.

It scaffolds the initial skill code from that recording context.

And then the agent uses that evidence to write the orchestrated skill code that will actually be invoked later by OpenClaw.

## Scene 8 - Show The Same Operation In Replay And Orchestrated Form

**On screen**

- Show one side-by-side code frame.

**Spoken**

So if we look at the actual code shape, the easiest way to understand this is to compare the same operation in replay mode and orchestrated mode.

**Show this code**

```js
// replay shape
await openDischargeToDialog();

// orchestrated shape
await checkpoint("dialog_opened", async () => {
  await openDischargeToDialog();
  return await assertDialogVisible("Discharge to");
});
```

**Spoken**

This is the critical difference.

In replay mode, we're basically saying: perform the operation.

In orchestrated mode, we're saying: perform the operation, name the checkpoint, confirm the expected state was actually reached, and preserve that observation in the structured result.

And just to be very precise here, `checkpoint(...)` is not the agent itself. It's helper code inside the skill. The agent wrote this code when authoring the skill, and later the brain reads the structured result that comes out of it. The agent is not sitting inside this function on every line. The helper is just what makes the skill's behavior observable and legible.

## Scene 9 - Show The Orchestrated Skill

**On screen**

- Show a simplified orchestrated skill snippet.
- Highlight:
  - goal
  - inputs
  - checkpoints
  - terminal verification
  - emitted `SkillResult`

**Spoken**

And the skill we end up with here is an orchestrated skill that is much more deliberate about what it's doing.

The orchestrated skill code will have instructions and checkpoints that effectively say: open the app, make sure we're on the right tab, open the correct automation card, confirm that the discharge settings are visible, open the dialog, enter the requested value, save it, and then read the app state back to confirm the setting actually changed. And if any one of those checks fails, don't just pretend it worked. Report that failure back to the brain.

That is the key difference.

Replay gives us the route.

Orchestration gives us the observable, verifiable outcome.

**Show this code**

```js
// orchestrated skill shape - goal plus checkpoints
const goal = { kind: "set_discharge_limit", limit };

await checkpoint("app_opened", () => openSolax());
await checkpoint("intelligence_tab_opened", () => ensureIntelligenceTab());
await checkpoint("peak_export_card_opened", () => openPeakExportCard());
await checkpoint("device_discharging_opened", () => openDeviceDischarging());
await checkpoint("dialog_opened", () => openDischargeToDialog());
await checkpoint("limit_entered", () => enterLimit(limit));
await checkpoint("save_completed", () => confirmAndSave());

const terminalVerification = await verifyPersistedRow(limit);
emitSkillResult({ goal, checkpoints, terminalVerification });
```

**Spoken**

And this is the key "how". The orchestrated skill is authored by the agent from the recording evidence. The agent is not just copying taps. It's writing code that names the goal, names the checkpoints, verifies the end state, and emits a structured result the brain can reason about.

## Scene 10 - Show The Contract And Result

**On screen**

- Show the intended `SkillResult` fields:

```json
{
  "goal": "...",
  "inputs": "...",
  "status": "success | failed | indeterminate",
  "checkpoints": [],
  "terminalVerification": {},
  "execEnvelopes": []
}
```

- Add labels beside the JSON:
  - "what I was trying to do"
  - "what I observed on the way"
  - "what proves it really worked"

**Spoken**

That's the thing I find exciting here. We're not building a dumb macro recorder. We're building a system where the hand can act with precision, and the brain can guide it with judgement.

The hand, Clawperator, is responsible for doing concrete things well. Open the app. Wait for this node. Click this element. Type this text. Read this value back from the UI. Take a snapshot. Return structured output. It's the precise, deterministic layer.

The brain, in my case OpenClaw, or it could be Codex, is responsible for the reasoning. It can inspect what Clawperator observed. It can decide whether the app is actually on the right screen. It can notice that a popup appeared. It can choose whether to retry, whether to take a slightly different path, whether to verify a value, whether to fail safely, or whether to continue.

So if you want the simple version of the architecture here, it's this:

- the recording gives the agent evidence
- the agent authors an orchestrated skill from that evidence
- that orchestrated skill turns the route into named checkpoints and verified outcomes
- the `SkillResult` gives the brain something structured enough to reason over

## Scene 11 - Why This Needs Orchestration

**On screen**

- Show the app path again.
- Optionally show the side-by-side replay/orchestrated snippet again.

**Spoken**

So in this battery-export example, that matters a lot.

This is not a one-click skill. We have to open the app, move to the right tab, open the correct automation, get down into the right discharge settings, open a dialog, enter a new percentage, confirm it, save it, and then make sure the new value actually persisted. That is a very different thing from just tapping a single button.

And importantly, success here is not "the script ran". Success is "the export limit in the app is now actually changed to the value I asked for."

That distinction is massive.

Because if I ask my OpenClaw instance to set the export limit to 40%, I don't want a best effort. I don't want a tool that says "well, I clicked some things, hope for the best." I want the brain to drive the hand all the way to a verified outcome. I want it to know what it was trying to do, observe the current state, issue the right actions, and only report success once the app itself shows that the value has actually been updated.

## Scene 12 - Show The Runtime Loop

**On screen**

- Show a simple terminal or diagram loop:

```text
OpenClaw intent
  -> invoke orchestrated skill
  -> Clawperator executes checkpoint step
  -> Clawperator returns observation
  -> OpenClaw decides next action
  -> Clawperator verifies final state
```

**Spoken**

So the way this will look in practice is something like this:

I'll tell OpenClaw, in natural language, to set my export limit to 40%.

OpenClaw will then decide to invoke the orchestrated Solax skill.

That orchestrated skill will use Clawperator to navigate the app in a reliable, observable way. It won't just say "tap tap tap done". The skill itself contains named checkpoints and verification logic. Clawperator executes those operations and returns what it observed. Then OpenClaw gets back a structured result it can reason about.

If something goes wrong, that's also where the brain/hand split becomes so powerful.

Maybe the app loads slowly.

Maybe a random popup appears.

Maybe the app opens on a different tab than expected.

Maybe the save didn't actually persist.

In all of those cases, Clawperator still remains simple and deterministic. It keeps being the hand. It keeps doing the exact operations it is asked to do, and it keeps reporting exactly what it observed. And the brain can use that information to decide what to do next.

## Scene 12A - Make The Demo Inspectable

**On screen**

- Open these files side by side:

```text
recordings/solax-set-discharge-to-limit/<session>.export.json
../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/scripts/run.js
```

- Draw boxes around:
  - evidence
  - orchestrated logic

**Spoken**

And if you're a developer watching this, this is the part I'd pause on. These two things together are the whole story. The export shows the evidence. The orchestrated code shows what the agent added - checkpoints, verification, and a structured result. That's the exact "how" of the system.

## Scene 13 - Developer Trust / Inspectability

**On screen**

- Open the file tree and show that the workflow leaves behind inspectable
  artifacts:

```text
recordings/.../<session>.export.json
skills/...-orchestrated/...
```

**Spoken**

And I think this is the really important developer point. This isn't hand-wavy. It's not "trust the AI". It's inspectable. It's code. It's artifacts. It's a recording export. It's an orchestrated skill. And it's an agent using those pieces to drive Clawperator in a way that is much more powerful than blind replay alone.

## Scene 14 - Close

**On screen**

- Return to terminal and show a natural-language request to OpenClaw.
- End on the verified result in the app.

**Spoken**

And once that's in place, the user experience becomes kind of magical.

Instead of me opening the Solax app, navigating through multiple screens, editing a dialog, saving it, and double-checking it worked, I can just send a single message to my OpenClaw instance. Something like "set my export limit to 40% tonight."

Then OpenClaw becomes the brain. Clawperator becomes the hand. The orchestrated skill becomes the bridge between them. And together they can take that intent, drive the Android UI, and come back with a result that isn't just plausible, but verified.

So that's what we're going to build.

We're going to take this recording, turn it into an orchestrated skill, and show how Clawperator plus an agent like OpenClaw or Codex lets you automate a real, messy, high-value mobile app workflow in a way that actually feels robust.

Let's keep going.
