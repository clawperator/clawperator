---
title: Recording Promo Video Draft
purpose: |
  Draft script for a developer-facing promo/demo video that explains the
  recording-to-replay-to-orchestrated-skill workflow being built in the
  recording workstreams.
audience:
  - developers
  - agents reading subtitles/transcripts
status: draft
working_backwards: |
  This file is a "working backwards" artifact for the recording program. It
  plays a similar role to an internal press release: it forces the team to
  explain, in user-facing terms, what the finished workflow should feel like
  when Clawperator, Codex, and OpenClaw are working together well.
notes:
  - Keep the spoken tone conversational rather than polished marketing copy.
  - The script should describe the intended end-state clearly enough that it
    can be used as a touchstone while the task packs are implemented.
---

# Video Draft

Hi - today I'm going to demonstrate how to create a complex skill using Clawperator. In my case, I've got a battery in my home. I often find myself adjusting how much power I want to feed into the grid each night. The UI for doing this in the app has numerous steps, and we're going to use Clawperator to create a skill so we can automate this to the point that I can send a single message to my OpenClaw instance and the export limit will be changed. So let's get started.

Now, the first important thing to understand is that I'm not going to manually stitch all of this together myself. I'm going to ask Codex to use Clawperator's `skill-author-by-recording` workflow. That workflow is the thing that is going to guide the process. It will tell me when to perform the flow on the phone, it will manage the recording lifecycle, it will pull the artifacts back into the repo, and then it will help turn that captured flow into real skill code.

So in other words, yes, under the hood there are concrete commands involved here like `clawperator record start`, `clawperator record stop`, `clawperator record pull`, and `clawperator recording export`. But for the developer experience we're aiming for, I shouldn't need to manually remember and orchestrate those commands every time. The agent should do that with me.

So now Codex is going to tell me that the recording is active, and at that point I'm going to navigate through the various pages in the app, and I'm going to set the desired percentage I want to stop feeding my power back into the grid. I'm going to set it to stop at 40%.

Okay, that's done, and the workflow will now stop the recording and pull the captured artifacts into the project. So those operations have all been captured.

Now we're going to create a repeatable skill from this recording. If you're new to Clawperator, you should know that Clawperator works best in conjunction with an agent - the system has been architected so that Clawperator itself is your "hand" - it will reliably execute operations on your Android device on your behalf. And this hand works in conjunction with the "brain" that is your agent, in my case, my OpenClaw instance.

Now, UI automation can be fickle at times. There can be unpredictable load times, intermittent UI pop-ups displaying randomly and similar. So we're going to create an "orchestrated skill" out of this operation, where my agent will control Clawperator to reliably set my max battery export level.

And this is where the really interesting part starts.

The recording we just created is incredibly useful, but it's not the finished thing. The recording is evidence. It shows us the path I took through the app. It shows the clicks, the screens, the timing, the rough shape of the flow. But it doesn't yet give us a truly reliable automation. If we just blindly replayed every tap, we might get lucky a lot of the time, but the moment a screen loads a little slower, or a modal appears, or a UI element shifts, that replay starts to get brittle.

So what we're going to do instead is use that recording as the source material for something better.

We're going to create two different categories of skill in Clawperator. The first is a replay skill. A replay skill is useful because it gives us a deterministic baseline. It captures the direct path through the app and lets us prove that yes, there is a repeatable flow here. That's incredibly valuable. But the second category is where the magic really starts to happen, and that's the orchestrated skill.

And this is the bit I really want to call out for developers and for agents reading this later. The orchestrated part is not magically produced by the recording itself. Clawperator does not pretend that a recording is already a robust skill. The recording gives us the evidence. Then Codex, using the `skill-author-by-recording` workflow, inspects that evidence, scaffolds the replay skill, and authors the orchestrated sibling from it.

So there is a real "how" here.

The workflow captures the recording.

It exports the recording artifact.

It scaffolds the first replay skill from that recording context.

And then the agent uses that evidence to write the orchestrated skill code.

So if we look at what gets generated, we'll have a replay skill that is basically the direct path through the UI, and then we'll have an orchestrated skill that is much more deliberate about what it's doing.

The orchestrated skill code will have instructions and checkpoints that effectively say: open the app, make sure we're on the right tab, open the correct automation card, confirm that the discharge settings are visible, open the dialog, enter the requested value, save it, and then read the app state back to confirm the setting actually changed. And if any one of those checks fails, don't just pretend it worked. Report that failure back to the brain.

That's the thing I find exciting here. We're not building a dumb macro recorder. We're building a system where the hand can act with precision, and the brain can guide it with judgement.

The hand, Clawperator, is responsible for doing concrete things well. Open the app. Wait for this node. Click this element. Type this text. Read this value back from the UI. Take a snapshot. Return structured output. It's the precise, deterministic layer.

The brain, in my case OpenClaw, or it could be Codex, is responsible for the reasoning. It can inspect what Clawperator observed. It can decide whether the app is actually on the right screen. It can notice that a popup appeared. It can choose whether to retry, whether to take a slightly different path, whether to verify a value, whether to fail safely, or whether to continue.

So in this battery-export example, that matters a lot.

This is not a one-click skill. We have to open the app, move to the right tab, open the correct automation, get down into the right discharge settings, open a dialog, enter a new percentage, confirm it, save it, and then make sure the new value actually persisted. That is a very different thing from just tapping a single button.

And importantly, success here is not "the script ran". Success is "the export limit in the app is now actually changed to the value I asked for."

That distinction is massive.

Because if I ask my OpenClaw instance to set the export limit to 40%, I don't want a best effort. I don't want a tool that says "well, I clicked some things, hope for the best." I want the brain to drive the hand all the way to a verified outcome. I want it to know what it was trying to do, observe the current state, issue the right actions, and only report success once the app itself shows that the value has actually been updated.

So the way this will look in practice is something like this:

I'll tell OpenClaw, in natural language, to set my export limit to 40%.

OpenClaw will then decide to invoke the orchestrated Solax skill.

That orchestrated skill will use Clawperator to navigate the app in a reliable, observable way. It won't just say "tap tap tap done". It can stop at checkpoints. It can inspect the current UI. It can confirm it has opened the correct card. It can verify that it has reached the discharge dialog. It can enter the new limit. It can save. And then it can read the resulting UI state back and confirm that the row now says 40%.

If something goes wrong, that's also where the brain/hand split becomes so powerful.

Maybe the app loads slowly.

Maybe a random popup appears.

Maybe the app opens on a different tab than expected.

Maybe the save didn't actually persist.

In all of those cases, Clawperator still remains simple and deterministic. It keeps being the hand. It keeps doing the exact operations it is asked to do, and it keeps reporting exactly what it observed. And the brain can use that information to decide what to do next.

That's why I think this is such an exciting pattern.

We're taking something that would normally be annoying, repetitive, and frankly very easy to get wrong by hand, and we're turning it into a system where I can express intent at a high level, my agent can reason about that intent, and Clawperator can carry out the physical UI operations on my behalf.

And that's especially powerful for all of the annoying app-only workflows that still dominate real life.

A lot of important systems don't have good APIs. Or they do, but not for users. Or they hide critical settings inside mobile apps with lots of taps and nested pages. Traditionally, automating those tasks has meant writing brittle scripts and hoping the UI doesn't change. What we're building here is much more interesting than that.

We're building a model where the recording helps us understand the shape of the task, the replay skill proves the path is real, and the orchestrated skill elevates that into something the agent can reliably control.

So after this recording step, what we're going to do is let Codex use the `skill-author-by-recording` workflow to inspect the captured output, scaffold the replay skill, and then separate the simple replay baseline from the orchestrated version.

And if we open the generated code, that's where developers will really see the value.

You'll be able to look at the replay skill and understand the raw route through the app.

Then you'll be able to look at the orchestrated skill and see the actual logic that makes this robust: the checkpoints, the waits, the reads, the verification, and the failure behavior.

So this isn't hand-wavy. It's not "trust the AI". It's inspectable. It's code. It's artifacts. It's a recording export. It's a replay skill. It's an orchestrated skill. And it's an agent using those pieces to drive Clawperator in a way that is much more powerful than replay alone.

And once that's in place, the user experience becomes kind of magical.

Instead of me opening the Solax app, navigating through multiple screens, editing a dialog, saving it, and double-checking it worked, I can just send a single message to my OpenClaw instance. Something like "set my export limit to 40% tonight."

Then OpenClaw becomes the brain. Clawperator becomes the hand. The orchestrated skill becomes the bridge between them. And together they can take that intent, drive the Android UI, and come back with a result that isn't just plausible, but verified.

So that's what we're going to build.

We're going to take this recording, turn it into a replay skill, evolve that into an orchestrated skill, and show how Clawperator plus an agent like OpenClaw or Codex lets you automate a real, messy, high-value mobile app workflow in a way that actually feels robust.

Let's keep going.
