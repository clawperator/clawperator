# Task: Landing Page Copy Polish

## Goal

Sharpen the landing page so a technical human skimming `clawperator.com`
immediately understands three things:

1. what category Clawperator belongs to
2. why it matters in practice
3. why it is credible enough to try

This is not a visual redesign task. The current page structure is already
strong. The opportunity is to improve message hierarchy, value articulation,
and the specificity of the examples.

The page should feel less like "Android automation" and more like a credible,
deterministic execution layer for agents.

## Copywriting diagnosis

The current page already has one strong line:

- "Your agent thinks. Clawperator acts."

That line is memorable and should remain central.

The weakness is that the page takes too long to state the category and the
practical payoff. A technical reader should not have to infer the thesis from
multiple sections.

Right now the strongest ideas are present, but they are under-compressed:

- mobile apps are where the real functionality lives
- Clawperator makes those apps programmable
- the runtime is deterministic, structured, and machine-readable
- this is useful inside agent loops, not just for one-off scripts
- skills make the system reusable and personal

Those ideas should be promoted earlier and stated more bluntly.

## Audience

Primary audience:

- technical users
- AI-agent builders
- developers who understand Playwright, APIs, and automation primitives
- curious power users who want private workflows on top of real apps

This audience does not need beginner framing. They do need fast legibility.

The page should answer these skim-questions within seconds:

- What is this?
- Why would I care?
- Is this just brittle tap automation?
- Why is Android the surface?
- Can this help with real apps I already use?
- Is there an ecosystem or do I have to build everything myself?

## Core messaging shift

The page should pivot from:

- "AI agents can control Android apps"

to:

- "Clawperator makes Android apps programmable for agents."

That is the more important claim.

Recommended category framing to introduce near the top:

- Clawperator makes Android apps programmable.
- Playwright for mobile apps.
- A deterministic execution layer for Android agents.
- Turn mobile apps into machine-readable interfaces.

The exact final wording can be tuned, but the category must be explicit.

The strongest chosen version of this category claim is:

- Clawperator makes Android apps programmable - Playwright for mobile apps.

This is stronger than a generic "control Android apps" formulation because it
names the category, the payoff, and the closest technical analogue in one
sentence.

## Messaging principles

### 1. Lead with category, then mechanism

Do not make the reader wait to understand the category.

The hero should state:

- what Clawperator is
- what it enables
- why Android apps matter

Then the body can explain brain/hand separation and dedicated device setup.

This is a meaningful improvement over the current plan's broader category
language. The hero should not merely imply programmability. It should state it
directly.

### 2. Emphasize deterministic primitives over "automation"

"Automation" is too soft and too generic.

The more defensible and interesting idea is:

- deterministic
- structured
- machine-readable
- one action in, one result out

The page should make clear that the innovation is not "it can tap buttons". It
is that the action contract is reliable enough for agent loops.

This should be stated explicitly, not left as an inference.

Recommended framing:

- Not just Android automation.
- More than UI automation.

Then immediately explain why:

- Each command does one thing, returns one result, and never hides retries.

### 3. Keep the runtime disciplined

The best trust-building lines are the strict ones:

- each command does one thing
- each command returns one result
- no hidden retries
- explicit machine-readable errors

Those constraints communicate engineering seriousness very quickly.

### 4. Make the examples feel like real life

The current examples do not carry enough emotional or practical weight.

The examples section should prove that Clawperator is useful where public APIs
do not exist and where real people already live inside awkward mobile apps.

### 5. Expand "skills" from a feature into a system

The skills section currently risks sounding like a nice extra.

It should instead communicate:

- install comes with open source skills
- users can create private, personalized skills
- skills are how repeatable workflows get captured
- skills are where reuse and ecosystem value compound

## Recommended page-level changes

## 1. Hero

### Current strength

- "Your agent thinks. Clawperator acts." is strong and should stay.

### Problem

The hero currently communicates the architecture before fully locking in the
category and value.

### Recommendation

Keep the existing slogan, but add a sharper category subhead immediately around
it. The reader should see both the memorable phrase and the practical meaning.

Recommended hero copy directions:

- Clawperator makes Android apps programmable - Playwright for mobile apps.
- Turn Android apps into programmable interfaces for agents.
- A deterministic execution layer that turns Android apps into machine-readable interfaces.

Suggested structure:

1. problem framing
2. product name
3. memorable slogan
4. blunt category line
5. short trust-building explanation

### Candidate hero lines

Preferred hero stack:

- Your agent thinks. Clawperator acts.
- Clawperator makes Android apps programmable - Playwright for mobile apps.
- Clawperator is a deterministic execution layer that lets agents operate real
  Android apps and get structured results back.

Guidance:

- Use the Playwright analogy high on the page.
- Pair it directly with the native category claim so the analogy accelerates
  comprehension instead of replacing product identity.
- Keep the "brain/hand" explanation, but demote it below the category claim.

### Supporting body points to preserve

- dedicated Android burner phone or emulator
- agent is the brain, Clawperator is the hand
- reliable structured results

But that body should be tightened so it reads as proof, not explanation-heavy
intro copy.

Specific tightening guidance:

- reduce references to "build your own private workflows on top of" in the hero
- keep the hero focused on execution contract and trust
- move workflow expansion language into later sections such as examples or
  skills

## 2. "What" / value articulation section

This section should make the core thesis impossible to miss:

- most services only expose their real functionality through mobile apps
- Clawperator gives agents a reliable way to use those apps on behalf of users

Recommended emphasis:

- mobile apps are often the real API surface
- Clawperator is the execution layer between an agent and those apps

Strong lines worth incorporating:

- Mobile apps become programmable.
- Most services only expose their real functionality through mobile apps.
- Clawperator turns those apps into programmable interfaces.
- This is the API layer for the mobile internet.

The last line is powerful, but should be used carefully because it is bold. It
works best in a lower section or a pull-quote style area, not necessarily as
the main hero claim.

Recommended insert:

- Mobile apps become programmable.

Supporting paragraph:

- Most services still expose their real functionality through mobile apps, not
  public APIs. Clawperator turns those apps into programmable interfaces an
  agent can observe, operate, and reason over.

## 3. Determinism / trust section

This is one of the most important credibility sections and should be upgraded.

The page should say, in plain language:

- Each command does one thing.
- Each command returns one result.
- Clawperator never hides retries.
- Errors are explicit and machine-readable.

This is the page's strongest technical proof that the system is not "AI slop
automation."

Recommended framing:

- Built for reasoning loops, not brittle macro playback.
- Deterministic primitives your agent can actually trust.

Potential supporting line:

- Action -> execution -> structured result.

That sequence is memorable and succinct.

This deserves to become an explicit micro-block, not just a supporting phrase.

Recommended block:

- Built for agent loops
- action
- ->
- execution
- ->
- structured result

Supporting sentence:

- That strict contract is what makes Clawperator reliable inside reasoning
  loops.

This is stronger than a standard feature grid because it compresses the system
into one memorable mental model.

Recommended subsection heading:

- Not just Android automation

Recommended body:

- Each command does one thing, returns one result, and never hides retries.
  Deterministic primitives are what make Android apps usable inside agent
  loops.

## 4. Real-world examples section

This section should be rewritten. The current section is underselling the
product and likely repeating points already made elsewhere.

The new examples should be concrete, personal, and obviously valuable. They
should also highlight cases where mobile apps matter because there is no clean
public API.

Recommended section title:

- What you can do with Clawperator

Recommended example set:

- Monitor and filter every notification from a school app so you only get the
  updates that actually matter.
- Receive periodic screenshots from Life360 showing your child is on the way
  home, then stop automatically once they arrive.
- Watch the temperature in a home automation app and turn the heat on when it
  drops below your threshold.
- Pull balances, statuses, or alerts from apps that have no useful public API.
- Build private automations around the exact Android apps your household
  already uses.

Recommended intro line:

- Clawperator is most useful where the real interface only exists in a mobile
  app.

Copy note:

These examples are stronger because they are specific, emotionally legible, and
clearly tied to private real-world workflows.

## 5. Skills section

This section needs materially more weight.

The page should explicitly tell the reader:

- install includes open source skills
- you can run those immediately
- you can create your own private skills
- private skills are personalized to your apps, accounts, and workflows

That last point matters. It turns skills from a generic plugin concept into a
personal automation asset.

Recommended messages:

- Install Clawperator and you also get an open source skills library.
- Skills package common mobile workflows into reusable building blocks.
- Use included skills as-is, adapt them to your own setup, or create private
  skills for personal apps, accounts, and workflows.

Useful framing:

- Open source skills get you started.
- Private skills make Clawperator yours.

This section should make the ecosystem legible without promising a giant public
marketplace that does not yet exist.

Recommended two-column story:

- Included with install
- Yours to customize

Column guidance:

- Included with install: open source skill library, discoverable workflows,
  runnable directly or through the Node API
- Yours to customize: private skills, personal workflows, local sensitive logic,
  public and private skills mixed in one runtime

This framing is stronger than a purely technical explanation because it
connects skills to immediate utility and long-term ownership.

## 6. "How it works" section

Keep this section visually simple and architecture-driven.

The copy should reinforce:

- agent decides
- Clawperator executes
- Android app returns state
- results come back in structured form

The key improvement is to connect the architecture to the product payoff:

- this separation keeps intelligence in the agent and execution in the runtime

That is not just architecture. It is a trust and maintainability story.

Recommended sentence to include once, clearly:

- Clawperator is a deterministic execution layer for Android-based agent
  workflows.

Use this once as the clean architectural definition. Do not over-repeat the
phrase.

## 7. Install / getting started section

The install section is already useful. The main copy opportunity is to connect
setup to the dedicated-device thesis more clearly.

Recommended points:

- cheap burner phone preferred for reliability
- emulator supported for local setup and testing
- dedicated device preserves app state, logins, notifications, and long-lived
  workflows

This helps the burner-phone model read as a feature, not a workaround.

## Recommended narrative arc

The page should follow this sequence:

1. Mobile apps hold the real functionality
2. Clawperator makes those apps programmable
3. It does this with deterministic, structured execution primitives
4. Your agent stays the brain, Clawperator stays the hand
5. Here are concrete real-world things you can actually do
6. Open source skills get you started, private skills make it personal
7. Installation is straightforward on a burner device or emulator

That order moves from category -> trust -> use cases -> expansion -> action.

## Phrases worth using

These are especially strong and aligned with the product:

- Clawperator makes Android apps programmable.
- Playwright for mobile apps.
- A deterministic execution layer for Android agents.
- Turn Android apps into machine-readable interfaces.
- Built for agent loops.
- Structured actions in. Structured results out.
- Each command does one thing and returns one result.
- No hidden retries.
- Mobile apps are often the real API surface.
- Open source skills included.
- Create private skills for your own workflows.

## Phrases to avoid or de-emphasize

- generic "automation" language without the deterministic qualifier
- vague "do anything with AI" phrasing
- consumer-marketing hype that dilutes the technical credibility
- wording that implies Clawperator does planning or autonomous reasoning
- claims that sound like brittle screen-scraping magic

The site should stay precise and disciplined. That is part of its appeal.

## Suggested rewrite targets by section

### Hero

Needs:

- clearer category line
- preferred line: "Clawperator makes Android apps programmable - Playwright for mobile apps."
- stronger immediate payoff
- less explanatory weight in the paragraph block
- Playwright language used prominently, not buried as a lower-page aside

### Real-world examples

Needs:

- replacement, not light editing
- title changed to "What you can do with Clawperator"
- more concrete, human-value examples
- stronger proof of "mobile apps as programmable interfaces"

### Skills

Needs:

- open source skills called out explicitly
- private personalized skills called out explicitly
- clearer ecosystem/platform implication without overselling
- clearer product story built around included value plus customization

### Why / feature blocks

Needs:

- harder emphasis on deterministic execution contract
- one action -> one result -> no hidden retries
- machine-readable outcomes and errors
- explicit "not just UI automation" framing
- explicit "action -> execution -> structured result" micro-block

## Suggested final tone

The right tone is:

- technical
- blunt
- legible
- confident
- specific

Not flashy. Not abstract. Not startup-generic.

The page should feel like it was written by someone who understands execution
contracts, failure modes, and why reliability matters to agents.

## Success criteria

This task is successful if a technical reader can skim the page and quickly
repeat back something close to:

- Clawperator is Playwright for mobile apps.
- It makes Android apps programmable for agents.
- It is deterministic enough to use inside real reasoning loops.
- It ships with open source skills and lets me build private skills for my own
  workflows.
- I can see immediate real-world uses for this.

## Next implementation pass

When translating this plan into actual page edits, prioritize:

1. hero headline and subhead refinement
2. replacement of the examples section
3. expansion of the skills section
4. tightening of deterministic-runtime copy across the feature blocks
5. consistency of category language across the whole page
