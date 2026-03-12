[![](https://clawperator.com/clawperator-logo.png)ClawperatorAndroid automation for agents](#top)

[Install](#install)[Skills](#skills)[How it works](#how-it-works)[FAQ](#faq)[Docs](https://docs.clawperator.com)[GitHub](https://github.com/clawpilled/clawperator)

Many services don't have APIs…  
But they do have apps!

![](https://clawperator.com/clawperator-logo.png)

Clawperator

# YOUR AGENT THINKS.  
CLAWPERATOR ACTS.

Clawperator makes Android apps programmable - think Playwright for mobile apps.

Clawperator is a deterministic execution layer that lets agents run skills on real Android apps to read data and take action on behalf of users.

🧠 Your OpenClaw/agent is the brain.  
✋ Clawperator is the hand.

Connect a dedicated Android burner phone, run your own private skills, and get answers your agent can trust.

![Diagram showing how OpenClaw and Clawperator let AI agents control real Android apps and return results to chat. This image was made with human claws.](https://static.clawperator.com/img/hero/clawperator-hero.webp "this image was made with human claws")

Any cheap Android phone works. Log in to the accounts you care about and leave your burner ready for your agent. You do not need to switch from iPhone to Android.

Don't have an Android device? No problem. Clawperator can create a Google Play-equipped Android emulator for you.

## What you can do with Clawperator

Clawperator is most useful where the real interface only exists in a mobile app.

### Home battery and energy apps

Read Powerwall, battery, or inverter status from mobile-only apps and trigger actions when thresholds are crossed.

### Google Home and thermostat control

Check temperature, switch device state, and turn heating or cooling on without waiting for a public API that may never exist.

### School app notification filtering

Monitor a noisy school app, filter the clutter, and surface only the updates that actually matter.

### Family location flows

Check Life360-style apps and send updates or screenshots until someone gets home, then stop automatically.

### Shopping, delivery, and status checks

Build private workflows around grocery, courier, or account apps that only really exist as mobile interfaces.

### App-only balances and alerts

Pull statuses, balances, or alerts from user-installed Android apps that do not expose a usable public API.

## Quick Start

One command installs the CLI, fetches the latest Clawperator Operator Android app, verifies it, and helps prepare an Android device for your agent.

One-linernpm

\# Install Clawperator on macOS/Linux

```
curl -fsSL https://clawperator.com/install.sh | bash
```

No Android device handy? Have Clawperator create a Google Play equipped Android emulator.

```
clawperator provision emulator
```

Clawperator has comprehensive documentation, setup guides, and API references at [docs.clawperator.com](https://docs.clawperator.com).

For agents

Prefer the technical docs over this overview page. Start with the [Node API guide](https://docs.clawperator.com/ai-agents/node-api-for-agents/), the [Operator LLM playbook](https://docs.clawperator.com/design/operator-llm-playbook/), or the machine-oriented [markdown landing page](https://clawperator.com/index.md).

</agents></index.md>[CLI reference](https://docs.clawperator.com/reference/cli-reference/)[API overview](https://docs.clawperator.com/reference/api-overview/)

## Built for agent loops

More than UI automation. Each command does one thing, returns one result, and never hides retries.

action→execution→structured result

Example agent loop (pseudocode - see [docs.clawperator.com](https://docs.clawperator.com) for the full API)

```
open_app(<google_home_app_id>)
snapshot_ui()
click(<climate_tab>)
snapshot_ui()
scroll_and_click(<device_labeled_"Living room">)
snapshot_ui()
if <hvac_state> == "Off":
  click(<turn_on>)
```

## Deterministic

Each command does one thing, returns one result, and never hides retries.

## Structured

Agents get machine-readable UI state, explicit errors, and results they can branch on.

## Built for loops

Clawperator is designed for reasoning systems that need predictable execution, not best-effort automation.

## Skills

Clawperator automations are unlocked through skills.

Clawperator includes an open source, ever-expanding skills repository for common Android workflows.

But you are not blocked waiting for an official skill. Agents do not need a prebuilt skill to automate your apps.

Our dedicated build-your-own-skill-from-scratch documentation walks agents through the process step by step. Point your agent at the right app and tell it to make a skill. It can use the `clawperator` API to inspect the app's UI, find a reliable path to the state or action you need, and create a private, personalized skill for your exact workflow.

### Included with install

* Open source skills repository
* Reusable building blocks for common workflows
* Discoverable and runnable through the same runtime

### Yours to create

* Private skills for your own apps and accounts
* Agent-built skills from live app exploration
* Public and private skills mixed in the same runtime

**You are not blocked waiting for a public skill.** Start with included skills, adapt them to your setup, or let your agent create private ones through Clawperator's documented API.

## How it actually works

Your agent is the brain. Clawperator is the hand. Skills sit above the runtime as reusable app-specific workflows. Whether the agent runs a skill or drives the UI step by step, Clawperator is the execution layer that talks to the Android device and returns structured results.

AI Agent / LLM

the brain

Node API / CLI / Skills

Clawperator

runtime / hand

ADB

Android Device

physical or emulator

Mobile Apps

the app is the api

The runtime includes the CLI on your host machine and the Clawperator Operator Android app on the Android device. The agent decides what to do next. Skills give the agent reusable ways to handle app-specific workflows it already understands, whether those come from the open source skills repository or from private skills the agent created for you. Clawperator executes the Android side of the workflow and returns data your agent can use.

### When a skill exists

* The agent picks a skill for a known app workflow
* The skill packages the reliable path to the state or action needed
* Clawperator still executes the underlying Android actions and returns the result

### When no skill exists yet

* The agent opens the app and inspects the live UI
* It finds a reliable path step by step using the documented API
* Once the flow is understood, it can turn that path into a private skill

The operating loop is simple: observe, decide, execute, return.

01

### Observe

Capture the current Android UI as structured state so the agent can reason on a real snapshot of the app.

02

### Decide

The agent chooses the next action or runs a skill. Clawperator does not plan, improvise, or decide on its own.

03

### Execute

Clawperator performs the requested tap, type, scroll, read, or app action on the connected Android device.

04

### Return

Return one machine-readable result so the agent can continue, recover, or stop with confidence.

## FAQ

Can I use this if I have an iPhone?

Yes. Clawperator does not require you to switch your primary phone to Android. The normal setup is to keep using your iPhone and connect your agent to a separate Android burner phone or a local Android emulator.

I do not have an Android phone. Can I still use Clawperator?

Yes. Clawperator can provision a local Google Play-equipped Android emulator. That is useful for getting started, local development, and many automation flows.

Do I need a dedicated burner phone?

A cheap dedicated burner phone is the preferred setup for compatibility and long-running reliability, but it is not the only option. A local Android emulator is available when you do not have a device handy.

What if the skill I need does not exist yet?

That is fine. Clawperator includes a growing open source skills library, but you are not blocked on prebuilt skills. Your agent can use Clawperator's structured, documented API to explore an app, operate it, and build a private skill for your own workflow.

Does Clawperator do the thinking for my agent?

No. The agent decides what to do next. Clawperator executes validated Android actions and returns structured results.

Clawperator

Open source execution infrastructure for agent-driven Android burner-device workflows.

[docs](https://docs.clawperator.com)[github](https://github.com/clawpilled/clawperator)[npm](https://www.npmjs.com/package/clawperator)