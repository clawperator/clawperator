# Task: Create Play Store Skills as an Agent UI Loop Learning Exercise
## Purpose
This task exists to support [plan.md](~/src/clawperator/tasks/agent-ui-loop/plan.md), not to bypass it.
The point is to make an agent do real exploratory UI automation work against a live
Android app with **no pre-written skill**, then turn what it learned into a small set
of reusable skills and a written record of how that process went.
This is a learning exercise first and a Play Store automation task second.
If this is done well, future agents working on zero-shot automation and
`docs/agent-ui-loop.md` should be able to use the output of this task as concrete
evidence for:
- what the Clawperator Node API feels like in real exploratory use
- which contracts were clear and which were confusing
- what action shapes an agent naturally expects
- where the observe-decide-act loop works well
- where the current API or docs create friction
## Why the Google Play Store
Use the Google Play Store app because it gives a narrow, realistic target with two
useful flows:
1. Search for an app.
2. Install an app that was found.
These flows are simple enough to be tractable, but still rich enough to expose the
practical ergonomics of skillless UI automation.
## Core Instruction
The agent doing this work must use the **Clawperator Node API and live UI inspection**
as its primary interface.
Treat the task the way one would treat a Playwright exploration session:
1. Open the target app.
2. Observe the current UI.
3. Inspect the tree.
4. Choose one action.
5. Execute it.
6. Re-observe.
7. Repeat until the objective is reached or blocked.
Do not start by hardcoding a full flow from assumptions about the Play Store UI.
Use the live UI hierarchy as the source of truth.
## Required Scope
Create two skills from scratch:
### 1. Search for an app in Google Play
The skill should support two paths:
- **Known package name path:** If the Android application ID is known, first try to
  reach the app details page directly. This may be via a Play Store URL, deep link, or
  another deterministic entrypoint the current runtime actually supports.
- **Unknown package name path:** If the package is not known, use the Play Store app's
  search UI to find the app by name.
The finished skill should make it easy for a later agent to get from "I need app X" to
"I am on the correct Play Store app details page for X."
### 2. Install the app that was found
Starting from the app details page, navigate the install flow and confirm the result as
far as the UI allows.
The skill should document:
- what signal means "ready to install"
- what signal means "installation in progress"
- what signal means "installed" or equivalent
- what blocking states exist, such as login prompts, compatibility warnings, update
  states, already-installed states, or purchase/paywall states
## How to Work
Default to a **single action, then re-observe** loop.
Use multi-action payloads only if the flow has already been confirmed and the loss of
intermediate visibility is acceptable. For this task, the learning value is usually in
the intermediate states, so favor observability over speed.
The agent should explicitly inspect and record:
- which snapshot path it used
- which matcher fields it relied on
- whether `resourceId`, `content-desc`, visible text, or role were actually useful
- how often it had to fall back from one matcher strategy to another
- whether sleeps were needed, and where `wait_for_node` was a better fit
- whether any step failed because the agent assumed a parameter or action shape that
  the API did not actually support
## Required Deliverables
This task is not complete when the flow merely works once.
The agent must leave behind both implementation and documentation artifacts.
### A. Skill implementation
Create the new skill artifacts in the appropriate skills repository/location for this
project's runtime-user-facing skills. Do not place runtime skills under
`.agents/skills/`, which is reserved for repo-local Codex workflows.
### B. A detailed execution log
Create a durable written log in this task folder, for example:
- `tasks/agent-ui-loop/google-play-skill-build-log.md`
This log should be chronological and should include:
- what the agent tried
- why it tried it
- the exact action shape or matcher strategy used
- what happened
- what worked
- what did not work
- what was ambiguous
- what was surprising
- what the agent changed next
This must read like a lab notebook, not like a polished summary.
### C. A findings summary
Create a concise synthesized summary, for example:
- `tasks/agent-ui-loop/google-play-skill-findings.md`
This summary should extract the important lessons:
- API strengths
- API holes
- mismatched naming or argument expectations
- documentation gaps
- implementation inconsistencies
- guidance future agents should follow
## What to Document While Building
Document every important step along the way, especially:
- when the API was straightforward and why
- when the API shape differed from what an agent would naturally guess
- when docs were enough to proceed without reading source
- when source code had to be consulted because the docs were not enough
- when a failure was caused by the app UI versus by Clawperator behavior
- when a failure exposed a true contract gap rather than an agent mistake
When relevant, include the exact field names and action types that caused confusion.
Examples:
- expected `type_text`, actual `enter_text`
- expected a param to exist, but it did not
- expected a param to work, but runtime behavior differed
- expected per-step error at one path, but it was delivered elsewhere
## Evaluation Criteria
A good outcome is not just "the Play Store skill works."
A good outcome means future agents can read the produced artifacts and quickly learn:
- how to approach a brand new app with Clawperator
- how to inspect a live UI and turn it into action payloads
- how to recover from wrong assumptions
- how to decide when a reusable skill is mature enough to extract
- which parts of the current API and docs should be improved
## Constraints and Guardrails
- Use the Clawperator Node API as the main control surface.
- Prefer live observation over assumption.
- Prefer deterministic and explainable actions over clever shortcuts.
- Do not hide failed attempts. Failed attempts are part of the deliverable.
- Do not rewrite history after the fact. Preserve the sequence of discovery.
- If a direct package-name path is attempted, verify it against the current runtime and
  document exactly how it was invoked.
- If the direct path is not practical or not supported cleanly, document that and fall
  back to the in-app search flow.
## Critique of the Current Plan
The overall direction is correct. Building a small real skill while documenting the
exploration process is a better foundation for `agent-ui-loop` than writing a purely
theoretical doc first.
The main refinements are:
- Do not frame this as only "add a couple of Play Store skills." Frame it as "perform a
  recorded zero-shot exploration session that happens to produce a couple of Play Store
  skills."
- Require persistent artifacts for failed attempts and API friction. Otherwise the most
  valuable learning will disappear.
- Keep the direct package-name path as a preferred experiment, not as an assumption.
  The task should verify what the runtime actually supports rather than presupposing the
  best entrypoint.
- Require the agent to separate app-specific problems from Clawperator API problems.
  That distinction matters for future product and docs work.
- Require a final synthesized findings document, not just raw notes. Future agents need
  both the messy record and the distilled lesson set.
## Suggested Execution Order
1. Read [plan.md](~/src/clawperator/tasks/agent-ui-loop/plan.md).
2. Review the Node API docs and only the source files needed to resolve contract
   uncertainty.
3. Attempt the known-package direct-entry path.
4. Attempt the in-app search path.
5. Stabilize the search skill.
6. Build and validate the install skill.
7. Write up the raw execution log.
8. Write up the synthesized findings.
9. Feed the lessons back into the larger `agent-ui-loop` documentation work.
## Definition of Done
This task is done when all of the following are true:
- a future agent can read this file and know exactly how to approach the work
- at least two Google Play skills have been created from scratch using exploratory UI
  automation
- the full path of discovery has been documented, including failures
- the resulting notes clearly identify where the Clawperator API and docs helped or hurt
- the outputs are useful input material for implementing
  [plan.md](~/src/clawperator/tasks/agent-ui-loop/plan.md)
