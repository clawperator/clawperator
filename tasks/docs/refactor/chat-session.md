<user>
https://docs.clawperator.com/

Look at the groupings of different pages on here. This reeks of disorganized, piecemeal ai slop 
</user>

<agent>

Diagnosis: why it feels like “AI slop”

You’re right. The structure is not accidental. It’s a classic failure mode of docs generated incrementally from multiple intents:

1) Multiple competing taxonomies

From the index:
	•	“Getting Started”
	•	“Recommended paths”
	•	“For AI Agents”
	•	“Reference”
	•	“Architecture”
	•	“Skills”
	•	“Troubleshooting”

These are orthogonal dimensions, not a hierarchy. You’re mixing:
	•	user journey (getting started)
	•	persona (agents vs humans)
	•	content type (reference vs guide)
	•	system layer (architecture)
	•	feature domain (skills)

→ This guarantees duplication and confusion.

⸻

2) Repeated entry points (bad signal)

Same pages appear in multiple sections:
	•	Node API guide appears in:
	•	Recommended paths
	•	For AI Agents
	•	Setup appears in:
	•	Getting Started
	•	Recommended paths

This is visible directly in the docs index  ￼

→ Signal: author didn’t commit to a single navigation model.

⸻

3) Concept vs task vs reference mashed together

Example:
	•	“Project Overview” → conceptual
	•	“First-Time Setup” → task
	•	“CLI Reference” → lookup
	•	“Operator LLM Playbook” → strategy

These should never live at the same level.

⸻

4) Docs mirror repo structure instead of user mental model

You’ve leaked internal structure:
	•	apps/android
	•	apps/node
	•	../clawperator-skills

Seen in architecture + overview  ￼

→ That’s a developer-centric ontology, not an agent-builder or user one.

⸻

5) Landing page vs docs duplication

Landing page:
	•	“What you can do”
	•	“How it works”
	•	“Skills”
	•	“Agent loops”

Docs:
	•	repeats same conceptual framing

→ No clean separation of:
	•	marketing
	•	conceptual docs
	•	API docs

⸻

What the structure should be

You need one axis only: user intent.

Proposed top-level (strict)

1. Quickstart
2. Core Concepts
3. API
4. Skills
5. Runtime & Devices
6. Troubleshooting


⸻

1. Quickstart (single path, no branching)

Quickstart
  - Install
  - Connect device
  - Run first command

No alternatives. No duplication.

⸻

2. Core Concepts (clean mental model)

Core Concepts
  - Brain vs Hand
  - Execution model (observe → decide → execute → return)
  - Determinism guarantees
  - Result envelope

Move:
	•	Project Overview
	•	Terminology (merge, not separate)

⸻

3. API (single canonical surface)

API
  - Overview
  - Actions (tap, scroll, etc)
  - Result schema
  - Error model
  - CLI

Kill:
	•	“For AI Agents” section entirely
→ redundant label

⸻

4. Skills (separate domain)

Skills
  - What is a skill
  - How skills run
  - Writing a skill
  - Debugging skills

Do NOT mix with API.

⸻

5. Runtime & Devices

Runtime
  - Architecture (1 page, simplified)
  - Android operator app
  - Emulator vs physical
  - Permissions

Keep infra here, not scattered.

⸻

6. Troubleshooting

Keep as-is, but flat.

⸻

Key structural rules (non-negotiable)

Rule 1: No page appears in 2 places

If it does → structure is wrong.

⸻

Rule 2: No persona-based sections

“AI Agents”, “Developers”, etc
→ encode that in page content, not nav

⸻

Rule 3: No “Recommended paths”

That’s a smell. It means hierarchy failed.

⸻

Rule 4: One concept = one home

Example:
	•	Node API → only in API
	•	Setup → only in Quickstart

⸻

High-leverage fixes (fast)

1. Delete entire sections
	•	“Recommended paths”
	•	“For AI Agents”

Immediate improvement.

⸻

2. Collapse Getting Started

Merge:
	•	First-Time Setup
	•	Running on Android
	•	OpenClaw First Run

→ into one linear doc

⸻

3. Merge terminology into concepts

Separate glossary = friction

⸻

4. Rewrite index page

Current index is a link dump  ￼
It should be:
	•	5 sections max
	•	each with 1–2 sentences
	•	no duplication

⸻

Deeper issue (root cause)

This is the real problem:

The docs are trying to serve both humans and agents simultaneously.

You already partially solved this with:
	•	llms.txt
	•	llms-full.txt

But you didn’t fully commit.

⸻

Better approach (contrarian, high payoff)

Split the docs:

1. Human docs (current site)

Clean, minimal, narrative

2. Agent docs (machine-first)
	•	flat
	•	canonical
	•	no duplication
	•	strict schema

You already have the primitives.

⸻

Summary

This is not “AI slop” randomly. It’s:
	•	multiple taxonomies
	•	duplicated entry points
	•	repo-structure leakage
	•	unresolved audience split

Fix = enforce a single axis: user intent, then delete anything that doesn’t fit.

If you want, I can rewrite your entire sidebar + index into a production-ready MkDocs config.
</agent>

<user>
Direction: commit fully to agent-first docs

Your instinct is correct. The mistake is trying to satisfy both.

You already have the right primitives:
	•	llms.txt
	•	llms-full.txt
	•	structured pages
	•	deterministic API

What’s missing is radical simplification + strict contracts

⸻

Target model

1) Docs = API surface, not content

Think:

docs.clawperator.com == /api surface for reasoning systems

Not:
	•	tutorials
	•	narratives
	•	“learn” sections
	•	duplicated explanations

⸻

2) One canonical hierarchy

Flatten aggressively:

/quickstart.md
/api/
  overview.md
  actions.md
  result-envelope.md
  errors.md
  cli.md
/runtime/
  android.md
  emulator.md
  permissions.md
/skills/
  overview.md
  authoring.md
  execution.md
/troubleshooting/
  index.md

No:
	•	“getting started vs recommended paths”
	•	“for agents”
	•	“concept vs guide split”

Everything is just facts + contracts

⸻

What to delete immediately

From current structure:

Kill entire sections
	•	Recommended paths
	•	For AI Agents
	•	Architecture (as a section)

Collapse into:
	•	/runtime/android.md
	•	/runtime/emulator.md

⸻

Rewrite style (critical)

Every page follows this schema:

# <Topic>

## Purpose
What this enables (1–2 lines)

## When to use
Concrete triggers

## Inputs
Exact parameters / state

## Behavior
Deterministic description

## Output
Exact shape

## Failure modes
Enumerated

## Example
Minimal

No prose. No storytelling.

⸻

Example transformation

Current: “Project Overview”
	•	marketing
	•	philosophy
	•	repetition

Replace with:

# Execution Model

## Purpose
Define how agents interact with Clawperator.

## Loop
observe → decide → execute → return

## Guarantees
- one command → one result
- no hidden retries
- single-flight execution

## Non-goals
- no planning
- no autonomy


⸻

Key insight

Agents do not browse. They resolve.

Your docs must optimize for:
	•	chunk retrieval
	•	precision
	•	non-ambiguity

⸻

Critical upgrades (high ROI)

1) Make llms-full.txt the primary artifact

Right now it’s secondary.

Flip it:
	•	docs site = human fallback
	•	llms-full.txt = canonical truth

⸻

2) Add strict anchors everywhere

Agents rely on stable anchors:

## Actions {#actions}
## Result Envelope {#result-envelope}


⸻

3) Remove all synonyms

Pick one term only:
	•	“Android device” ✅
	•	never also “actuator device”, “runtime device”, etc

You already started this in terminology, but it must be enforced globally.

⸻

4) Encode contracts, not descriptions

Bad:

“Clawperator allows agents to…”

Good:

Action: click

Input:
- selector

Output:
- success | failure
- errorCode?


⸻

5) Kill cross-linking noise

Agents don’t follow narrative links well.

Prefer:
	•	self-contained pages
	•	minimal dependencies

⸻

Landing page role (human only)

Keep:
	•	concept
	•	positioning
	•	use cases

But enforce:

Landing → "Install + 1 example" → Docs

Nothing more.

⸻

Contrarian but correct

You should not:
	•	optimize for readability
	•	explain concepts repeatedly
	•	add “helpful” guides

You should:
	•	optimize for machine parsing + retrieval
	•	reduce tokens
	•	eliminate ambiguity

⸻

What success looks like

An agent can:
	1.	Fetch llms-full.txt
	2.	Never browse the site again
	3.	Reliably execute flows without hallucination

⸻

Final take

You’re 80% of the way there.

The problem isn’t quality — it’s lack of commitment to a single audience.

Fix:
	•	delete 40–60% of current structure
	•	enforce schema
	•	treat docs as a protocol, not content

⸻

</user>