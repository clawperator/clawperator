An agent was given this prompt:

```

I'm building Clawperator, a deterministic device automation tool for Android. It's the "hand" for an LLM "brain" - agents call its CLI to interact with devices. Think: take UI snapshots, tap elements, type text, open apps, press keys, take screenshots, read element text, wait for elements to appear.

The project is pre-alpha with zero external users. I want to redesign the CLI command surface now, before writing canonical documentation, so that agents encountering the tool for the first time succeed on their natural first attempt.

This blog post captures the problem well:

> Agent UX matters at least as much as Human UX
> One of the interesting themes I heard at the AI Engineering Conference in NYC a couple weeks ago was that although many people are building tools for AIs, they are finding it very hard to get the AIs to use those tools.
> It's tricky to get AI to use a tool it's not trained on. They have certain ways of thinking and working, and they tend to reach for familiar tools (e.g. grep instead of a fancier search). I've talked with many people who wanted to build a tool for their agents to use, and they'd work with the frontier models to design the perfect agent-friendly interface — one the models swore up and down would get them to use it.
> And then haha, no, the agents don't use it. You prompt and prompt, they ignore and ignore. So what do you do? How do you get them to use your tools?
> My Beads issue tracker for agents has been an interesting case study here. It's only maybe 2 months old and it already has 250+ forks and 5000+ stars. It's a successful project. But I've never looked at the code. It's fully vibe-coded by agents. Despite that, Beads managed to capture lightning in a bottle — it's a tool that AIs use, and not only that, they like it. Agents use Beads eagerly and enthusiastically with very little prompting. They make smart decisions, such as filing Beads when they are low on context, instead of doing the work directly. Things you would normally have to prompt them to do, they just do!
> I'm no magician. I've built plenty of tools that the AIs refused to use; I'll talk about one of them below. And I've built plenty of prompts that the AIs choose to ignore or overlook. It's not like capturing lightning in a bottle is super reproducible at this point. But I can share some of the things I did with Beads that I think helped.
> First, I asked Claude to help me design a new lightweight issue tracker backed by git, with a few other constraints, and then Claude came up with about half of the rest of the design: the SQLite database caching layer, the discovered_by graph link that the models feel is very important for gathering context on issues, the hash IDs, deletion tombstoning, etc.
> During the Beads design phase, I mostly argued with Claude, telling it I didn't like certain choices it was making from a Human UX perspective. Eventually we negotiated our way to something we both liked, something that had good agent UX and also good human UX.
> For the agent side, once we had the initial structure in place (the issue tracker itself), the primary UX issue became tooling ergonomics. My agents were trying to use Beads, but they kept giving it the wrong arguments. For example, they'd use — body instead of — description when filing an issue, which would fail. Why? Because they were trained on GH Issues, and GHI's CLI tool uses — body for filing issues. Reaching for the familiar again!
> So in that particular case, told it to add — body as an alias for — description, which it did, and that bit of Agent UX friction went away forever. I've done this many, many times in Beads. As the agent works, I watch how it's using the tool, and whenever it encounters an error, I ask it, how did you want it to work there? How can we change it to make the behavior be more easily guessable?
> Over the past few months we've made dozens of tweaks, adding flags and commands, and the agents now rarely have trouble using Beads fluently.

**The attached files describe the current API.** The key files are:

- `docs/node-api-for-agents.md` - Full API contract and CLI reference
- `docs/architecture.md` - System design
- `docs/first-time-setup.md` - Device setup flow

**Your task:**

Act as an agent who will be using this tool heavily. You've never seen it before. Based on the attached documentation:

1. **First impressions:** What would you naturally try to do, and what commands would you reach for? Where does the current API match your instincts and where does it fight you?

2. **Propose the ideal command surface.** If you were designing this CLI from scratch for agent consumption, what would every command look like? Show the full command list with flags. Be specific and concrete - show exact command signatures, not abstract principles.

3. **Flag and argument ergonomics.** For each command, what flags feel natural vs. what the current API requires? Where would you expect positional arguments? Where do flag names feel wrong or unfamiliar?

4. **Help text and error messages.** What would ideal `--help` output look like for the top-level command and for 2-3 individual commands? What should error messages say when you get a command or flag wrong?

5. **The "5 minute test."** If you were dropped into a terminal with this tool installed and told "open the Settings app and tap Wi-Fi," what exact commands would you type, in order, before reading any documentation? Then show what you'd type after reading the help text.

Don't hold back. The current API is being redesigned. I want your unfiltered opinion on what the ideal shape is, not diplomatic suggestions for incremental improvement.

```

It's response is as follows:


1. First impressions

What I would naturally try first

Without docs, I would assume a Playwright-ish / adb-lite surface:

clawperator devices
clawperator snapshot
clawperator screenshot
clawperator open com.android.settings
clawperator tap --text "Wi-Fi"
clawperator click --text "Wi-Fi"
clawperator type --text "hello"
clawperator press back
clawperator scroll down
clawperator wait --text "Wi-Fi"
clawperator doctor

Where the current API matches instinct

The core model is right:
	•	one execution in, one result out
	•	explicit snapshots
	•	deterministic actions
	•	device targeting
	•	no hidden retries

That is the correct agent mental model. The docs are clear that Clawperator is the hand, not the brain, and that the Node CLI is the agent-facing layer.  ￼  ￼

Where it fights instinct

This is the big problem: the CLI surface does not match the nouns and verbs the docs themselves teach.

The docs teach:
	•	open app
	•	snapshot UI
	•	click
	•	read text
	•	type text
	•	press key
	•	scroll
	•	wait for navigation

But the CLI exposes these through mixed wrappers:
	•	observe snapshot
	•	action open-app
	•	action type
	•	action read
	•	action wait
	•	execute --execution ...
	•	provision emulator and also emulator provision

That is too many layers for first-contact usage. The CLI table already shows the fragmentation.  ￼

Specific friction points

A. Verb nesting is unnatural
I would never guess:

clawperator action open-app --app com.android.settings

I would guess:

clawperator open app com.android.settings
clawperator open com.android.settings
clawperator app open com.android.settings

B. observe is the wrong top-level noun
Agents think in snapshot and screenshot, not “observe”.
observe snapshot is semantically okay, but mechanically worse than:

clawperator snapshot
clawperator ui snapshot
clawperator screenshot

C. action type is actively bad
type is a shell word and a generic English verb. It also collides conceptually with action “type”. The docs admit the payload action is enter_text while the CLI command is action type. That mismatch is avoidable friction.  ￼

D. CLI names do not align with payload names
Examples:
	•	CLI: action type
	•	payload: enter_text
	•	CLI: action wait
	•	payload: wait_for_node
	•	CLI: observe snapshot
	•	payload: snapshot_ui
	•	CLI: action read
	•	payload: read_text

That means the agent must learn two taxonomies.

E. Too many JSON-only choke points
A lot of common first actions should be guessable from flags:

clawperator click --text "Wi-Fi"
clawperator click --id com.android.settings:id/title
clawperator click --desc "Search settings"

Instead the current surface strongly pushes --selector <json>. That is precise, but bad first-contact ergonomics. JSON selector should be the escape hatch, not the main path.

F. receiver-package is a leak
This is implementation detail. Necessary, yes. First-class, no. It should still exist, but agents should not be forced to care about it in common flows. The docs surface it globally and often.  ￼

G. Duplicate surface area
emulator provision and provision emulator both exist. That helps guessing, but it also signals surface indecision. Pick one canonical spelling and add aliases aggressively under the hood.  ￼

⸻

2. Ideal command surface

My blunt recommendation:

Design rule

Split the CLI into only five top-level mental buckets:
	•	device
	•	app
	•	ui
	•	exec
	•	skill

And make the most common verbs available as flat aliases too.

⸻

Canonical command list

clawperator device ...

clawperator device list
clawperator device doctor [--device <id>] [--json]
clawperator device version [--device <id>] [--check-compat] [--json]
clawperator device setup --apk <path> [--device <id>] [--package <pkg>] [--json]
clawperator device permissions [--device <id>] [--package <pkg>] [--json]
clawperator device logs [--device <id>] [--follow] [--level <debug|info|warn|error>]

Emulator under device

clawperator device emulator list [--json]
clawperator device emulator inspect <name> [--json]
clawperator device emulator create [<name>] [--json]
clawperator device emulator start <name> [--json]
clawperator device emulator stop <name> [--json]
clawperator device emulator delete <name> [--json]
clawperator device emulator status [--json]
clawperator device emulator provision [--json]

Flat aliases

clawperator devices
clawperator doctor
clawperator version
clawperator provision emulator

Keep these for compatibility, but the help text should prefer device ....

⸻

clawperator app ...

clawperator app open <application-id> [--device <id>] [--json]
clawperator app close <application-id> [--device <id>] [--json]
clawperator app open-uri <uri> [--device <id>] [--json]
clawperator app open-url <url> [--device <id>] [--json]

Flat aliases

clawperator open <application-id> [--device <id>] [--json]
clawperator close <application-id> [--device <id>] [--json]
clawperator open-uri <uri> [--device <id>] [--json]
clawperator open-url <url> [--device <id>] [--json]

This is what I would actually type first.

⸻

clawperator ui ...

clawperator ui snapshot [--device <id>] [--json] [--timeout <ms>]
clawperator ui screenshot [--device <id>] [--json] [--path <file>] [--timeout <ms>]

clawperator ui click [selector flags...] [--device <id>] [--json]
clawperator ui tap [selector flags...] [--device <id>] [--json]
clawperator ui long-press [selector flags...] [--device <id>] [--json]
clawperator ui focus [selector flags...] [--device <id>] [--json]

clawperator ui type <text> [selector flags...] [--submit] [--clear] [--device <id>] [--json]
clawperator ui enter-text <text> [selector flags...] [--submit] [--clear] [--device <id>] [--json]

clawperator ui read [selector flags...] [--validator <temperature|version|regex>] [--pattern <regex>] [--device <id>] [--json]
clawperator ui wait [selector flags...] [--timeout <ms>] [--device <id>] [--json]
clawperator ui wait-nav [--package <pkg> | selector flags...] [--timeout <ms>] [--device <id>] [--json]

clawperator ui scroll [down|up|left|right] [--container ...] [--distance <0..1>] [--settle <ms>] [--device <id>] [--json]
clawperator ui scroll-until [selector flags...] [--direction <down|up|left|right>] [--max-scrolls <n>] [--max-duration <ms>] [--click] [--device <id>] [--json]

clawperator ui key <back|home|recents> [--device <id>] [--json]
clawperator ui read-pair [selector flags...] [--device <id>] [--json]

Flat aliases I would absolutely add

clawperator snapshot
clawperator screenshot
clawperator click ...
clawperator tap ...
clawperator type ...
clawperator read ...
clawperator wait ...
clawperator scroll down
clawperator press back

These should all work.
They can internally dispatch to ui ....

⸻

Selector flags for all UI commands

Every UI targeting command should accept both simple flags and raw JSON.

Selector flags

--id <resource-id>
--text <exact>
--text-contains <substring>
--desc <exact-content-desc>
--desc-contains <substring>
--role <button|textfield|text|switch|checkbox|image|listitem|toolbar|tab>
--selector <json>

Container flags

--container-id <resource-id>
--container-text <exact>
--container-text-contains <substring>
--container-desc <exact>
--container-desc-contains <substring>
--container-role <role>
--container-selector <json>

Canonical priority

If multiple simple selector flags are supplied, combine with AND semantics, exactly as the underlying matcher already does. That matches the current matcher model.  ￼

This one change would massively improve first-attempt success.

⸻

clawperator exec ...

clawperator exec run --file <payload.json> [--device <id>] [--json] [--timeout <ms>]
clawperator exec run --stdin [--device <id>] [--json] [--timeout <ms>]
clawperator exec run --json '<payload>' [--device <id>] [--timeout <ms>]

clawperator exec validate --file <payload.json> [--json]
clawperator exec validate --stdin [--json]
clawperator exec validate --json '<payload>' [--json]

clawperator exec plan --file <payload.json> [--json]
clawperator exec plan --stdin [--json]
clawperator exec plan --json '<payload>' [--json]

Flat aliases

clawperator execute ...

But exec run, exec validate, exec plan is cleaner than overloading execute --validate-only and execute --dry-run.

⸻

clawperator skill ...

clawperator skill list [--json]
clawperator skill get <skill-id> [--json]
clawperator skill search [--app <pkg>] [--intent <intent>] [--keyword <text>] [--json]

clawperator skill run <skill-id> [--device <id>] [--timeout <ms>] [--expect <text>] [--json]
clawperator skill compile <skill-id> --artifact <name> [--vars <json>] [--json]

clawperator skill new <skill-id> [--json]
clawperator skill validate <skill-id> [--json]
clawperator skill validate --all [--json]

clawperator skill install [--json]
clawperator skill update [--ref <git-ref>] [--json]

Flat aliases

clawperator skills ...

Singular is cleaner; plural alias preserved.

⸻

clawperator record ...

clawperator record start [--session <id>] [--device <id>] [--json]
clawperator record stop [--session <id>] [--device <id>] [--json]
clawperator record pull [--session <id>] [--out <dir>] [--device <id>] [--json]
clawperator record parse <input-file> [--out <file>] [--json]

Drop recording from the primary surface. Keep it as alias.

⸻

3. Flag and argument ergonomics

Global ergonomics changes

Rename these globally

Current	Better
--device-id	--device
--receiver-package	--package
--output json	--json
--timeout-ms	--timeout
--expect-contains	--expect
--execution	--file or --json or --stdin

Keep old flags as aliases. Do not break them.

Why

Agents guess short, generic flags:
	•	--device, not --device-id
	•	--json, not --output json
	•	--timeout, not --timeout-ms
	•	--package, not --receiver-package

⸻

Command-by-command ergonomics

Snapshot

Current

clawperator observe snapshot --device-id <id> --output json

Natural

clawperator snapshot --device <id> --json

Verdict

Current command is usable but one layer too deep.

⸻

Screenshot

Current

clawperator observe screenshot --path <file>

Natural

clawperator screenshot --path <file>

Verdict

Same issue.

⸻

Open app

Current

clawperator action open-app --app <id>

Natural

clawperator open com.android.settings
clawperator app open com.android.settings

Verdict

Current command is much worse than expected.

⸻

Click

Current

clawperator action click --selector '{"textEquals":"Wi-Fi"}'

Natural

clawperator click --text "Wi-Fi"
clawperator tap --text "Wi-Fi"
clawperator ui click --text "Wi-Fi"

Verdict

The JSON selector should remain, but only as advanced mode.

⸻

Type text

Current

clawperator action type --selector '<json>' --text 'hello'

Natural

clawperator type "hello" --role textfield
clawperator ui type "hello" --id com.example:id/search

Verdict

Put the text as a positional arg. It is the payload. The selector is the modifier.

⸻

Read text

Current

clawperator action read --selector '<json>'

Natural

clawperator read --text "Android version"
clawperator read --id com.android.settings:id/summary

Verdict

Again: raw JSON as fallback only.

⸻

Wait

Current

clawperator action wait --selector '<json>'

Natural

clawperator wait --text "Wi-Fi" --timeout 5000

Verdict

Current is too hidden and too generic.

⸻

Press key

Current

clawperator action press-key --key back

Natural

clawperator press back
clawperator key back
clawperator ui key back

Verdict

The command should accept the key positionally.

⸻

Scroll

Current payload action exists, but there is no obvious first-class CLI command in the CLI summary for it. That is a miss. The docs clearly describe scroll and scroll_until as core primitives.  ￼

Natural

clawperator scroll down
clawperator scroll down --container-id com.android.settings:id/recycler_view
clawperator scroll-until --text "About phone" --click


⸻

4. Help text and error messages

Ideal top-level help

Clawperator
Deterministic Android automation for agents.

Usage:
  clawperator <command> [options]

Most-used commands:
  snapshot                    Capture UI hierarchy XML
  screenshot                  Capture PNG screenshot
  open <app-id>               Open an Android app
  click                       Click a UI element
  tap                         Alias for click
  type <text>                 Enter text into a UI element
  read                        Read text from a UI element
  wait                        Wait for a UI element to appear
  scroll <direction>          Scroll the current view
  press <key>                 Press a global Android key: back, home, recents
  doctor                      Check device and operator readiness
  devices                     List connected devices
  skill run <skill-id>        Run a skill

Command groups:
  device                      Devices, setup, doctor, emulator, logs
  app                         Open/close apps and URIs
  ui                          Snapshot, screenshot, click, type, read, wait, scroll
  exec                        Run or validate raw execution payloads
  skill                       Skills discovery and execution
  record                      Start/stop/pull/parse Android recordings

Global options:
  --device <id>               Target device serial
  --package <pkg>             Operator package (default: com.clawperator.operator)
  --json                      Output machine-readable JSON
  --timeout <ms>              Override command timeout
  --log-level <level>         debug | info | warn | error
  -h, --help                  Show help

Examples:
  clawperator snapshot --json
  clawperator open com.android.settings
  clawperator click --text "Wi-Fi"
  clawperator type "hello" --role textfield
  clawperator scroll down
  clawperator exec run --file payload.json --json

Tip:
  You can target elements with simple selector flags:
    --id, --text, --text-contains, --desc, --desc-contains, --role
  Or pass a raw matcher with:
    --selector '{"textEquals":"Wi-Fi"}'


⸻

Ideal click --help

Usage:
  clawperator click [selector options] [options]
  clawperator tap [selector options] [options]

Click a UI element.

Selector options:
  --id <resource-id>          Exact Android resource-id
  --text <text>               Exact visible text
  --text-contains <text>      Visible text contains substring
  --desc <text>               Exact content description
  --desc-contains <text>      Content description contains substring
  --role <role>               button | textfield | text | switch | checkbox | image | listitem | toolbar | tab
  --selector <json>           Raw NodeMatcher JSON

Click behavior:
  --long                      Long-click instead of default click
  --focus                     Focus without activating

Other options:
  --device <id>               Target device
  --json                      Output JSON
  --timeout <ms>              Command timeout

Examples:
  clawperator click --text "Wi-Fi"
  clawperator tap --id com.android.settings:id/title
  clawperator click --desc "Search settings"
  clawperator click --selector '{"textEquals":"Wi-Fi","role":"button"}'


⸻

Ideal type --help

Usage:
  clawperator type <text> [selector options] [options]
  clawperator ui type <text> [selector options] [options]

Enter text into a matched field.

Selector options:
  --id <resource-id>
  --text <text>
  --text-contains <text>
  --desc <text>
  --desc-contains <text>
  --role <role>
  --selector <json>

Options:
  --submit                    Press enter/submit after typing
  --clear                     Clear existing text first, if supported
  --device <id>
  --json
  --timeout <ms>

Examples:
  clawperator type "hello" --role textfield
  clawperator type "wifi" --id com.android.settings:id/search_src_text --submit
  clawperator type "test@example.com" --selector '{"role":"textfield"}'

Important: if --clear is still ignored by runtime, help should say so directly. The current docs already admit this behavior.  ￼

⸻

Ideal exec run --help

Usage:
  clawperator exec run (--file <path> | --json <payload> | --stdin) [options]

Run a raw execution payload.

Input:
  --file <path>               Read payload from file
  --json <payload>            Read payload from inline JSON
  --stdin                     Read payload from stdin

Options:
  --device <id>               Target device
  --package <pkg>             Operator package
  --json                      Output JSON
  --timeout <ms>              Override execution timeout

Related:
  clawperator exec validate ...
  clawperator exec plan ...

Examples:
  clawperator exec run --file payload.json --device emulator-5554 --json
  cat payload.json | clawperator exec run --stdin --json


⸻

Error messages

Wrong subcommand

Bad

Unknown command: observe

Better

Unknown command: observe

Did you mean one of these?
  clawperator snapshot
  clawperator screenshot
  clawperator ui snapshot
  clawperator ui screenshot

Run `clawperator --help` for the full command list.


⸻

Wrong flag on click

User types:

clawperator click --body "Wi-Fi"

Better

Unknown option: --body

For `clawperator click`, element selectors are:
  --id
  --text
  --text-contains
  --desc
  --desc-contains
  --role
  --selector

Closest match: --text
Example:
  clawperator click --text "Wi-Fi"

This is exactly the Beads lesson. Add aliases where agents predict them.

⸻

Missing selector

User types:

clawperator click

Better

click requires a selector.

Use one of:
  --id <resource-id>
  --text <text>
  --text-contains <text>
  --desc <text>
  --desc-contains <text>
  --role <role>
  --selector <json>

Example:
  clawperator click --text "Wi-Fi"


⸻

Missing device in multi-device setup

Better

More than one device is connected. This command needs an explicit target.

Connected devices:
  emulator-5554
  R58W123ABC

Retry with:
  --device emulator-5554
or
  --device R58W123ABC

The current docs already make explicit targeting important. The error should operationalize that immediately.  ￼

⸻

Validation error

Better

Execution payload is invalid.

Code: EXECUTION_VALIDATION_FAILED
Path: actions[0].params.key
Reason: expected one of: back, home, recents
Hint: use `clawperator press back` for common key actions

Make the hint task-oriented, not schema-oriented.

⸻

5. The 5 minute test

Before reading docs

Prompt: “open the Settings app and tap Wi-Fi”

What I would type first, in order

clawperator devices
clawperator snapshot --json
clawperator open com.android.settings --json
clawperator snapshot --json
clawperator click --text "Wi-Fi" --json

If open failed, I would try:

clawperator app open com.android.settings --json

If click --text failed, I would try:

clawperator tap --text "Wi-Fi" --json
clawperator click --text-contains "Wi-Fi" --json
clawperator snapshot --json

What this exposes

Your current CLI likely fails me at step 2 or step 3 because:
	•	snapshot is actually observe snapshot
	•	open is actually action open-app --app
	•	click --text is actually action click --selector '{"textEquals":"Wi-Fi"}'

That is exactly the gap you want to close.

⸻

After reading help text

With the redesigned surface, I would type:

clawperator devices --json
clawperator open com.android.settings --json
clawperator snapshot --json
clawperator click --text "Wi-Fi" --json

If Wi-Fi is off-screen:

clawperator scroll-until --text "Wi-Fi" --click --json

With the current documented surface, after reading docs, I would type:

clawperator devices --output json
clawperator action open-app --app com.android.settings --output json
clawperator observe snapshot --output json
clawperator action click --selector '{"textEquals":"Wi-Fi"}' --output json

That works, but it is not the CLI an agent guesses on first contact.  ￼

⸻

Bottom line

What I would change aggressively
	1.	Promote flat first-contact verbs
	•	snapshot, screenshot, open, click, tap, type, read, wait, scroll, press
	2.	Keep grouped commands as canonical structure
	•	device, app, ui, exec, skill, record
	3.	Make simple selector flags first-class
	•	--text, --id, --desc, --role
	•	keep --selector <json> as advanced mode
	4.	Alias everything agents are likely to guess
	•	singular/plural
	•	hyphen / underscore
	•	open-url / open-uri
	•	tap / click
	•	press / key
	•	snapshot / ui snapshot
	5.	Collapse flag verbosity
	•	--device, --package, --json, --timeout
	6.	Unify CLI and payload naming where possible
	•	stop teaching two vocabularies unless necessary

My unfiltered verdict

The underlying runtime model is strong. The CLI surface is not.
Right now it feels like an implementation-shaped CLI, not an agent-shaped CLI.
You should optimize for guessability first, taxonomy second. The command someone tries blind in minute 1 should usually work. The docs already establish the right mental model; the CLI should stop contradicting it.

---

# Second Agent Review: Plan Validation

A second agent was given the API refactor plan (produced in response to the
review above) and asked to validate it before implementation. The plan at that
point had `press-key` as canonical with `press` as synonym, `scroll` marked as
"needs investigation", no failure-mode acceptance criteria, and no explicit
selector resolution rules.

The review below drove several material changes to the final plan.

---

## Verdict

The plan is structurally sound and ready for execution. Phase boundaries are
clear, priorities are correct, and the direction aligns with agent-first CLI
design. No architectural rewrites required.

---

## Required Changes (must fix before implementation)

### 1. Command Naming: `press-key` -> `press` (canonical)

**Problem:** Agents will not guess `press-key`. Current plan had `press-key` as
canonical and `press` as synonym.

**Change:**
- canonical: `press`
- synonym: `press-key`
- keep shortcut: `back`

Result: `clawperator press back`

### 2. Unify `open` command surface

**Problem:** Current plan exposes `open`, `open-uri`, and `open-url` as separate
commands. This creates unnecessary branching.

**Change:** Make `open` the canonical command:

```
clawperator open <target>
```

Interpretation:
- `http(s)://` -> URL
- `*://` -> URI
- otherwise -> package name

Optional: keep `open-uri` / `open-url` as internal aliases (not documented).

### 3. Define deterministic selector resolution rules

**Missing behavior:** Selector semantics were incomplete.

**Add to Phase 2:**
- multiple simple flags (`--text`, `--id`, etc.) combine with AND
- `--selector` is mutually exclusive with simple flags
- container flags scope element search
- if multiple matches -> select first in traversal order

Required for predictability and agent reasoning consistency.

### 4. Define `read` output contract

**Missing:** Ambiguity in return behavior.

**Add rule:**
- default: return first matching node text
- future: `--all` may return list

### 5. Lock `scroll` command spec in Phase 1

**Problem:** Currently "needs investigation."

**Required spec:**

```
clawperator scroll <down|up|left|right>
```

No deferral. This is a core primitive.

### 6. Add failure-mode behavior requirements

**Missing:** Only happy-path success was defined.

**Add acceptance criteria:**

**Case: missing selector**
```
clawperator click
```
Must: explain selector is required, list valid selector flags, show example.

**Case: missing argument**
```
clawperator open
```
Must: explain required argument, show package + URL examples.

**Case: incomplete press**
```
clawperator press
```
Must: list valid keys (back, home, recents).

### 7. Clarify namespace rule

**Problem:** "No namespaces" is too absolute and conflicts with existing
commands like `skills` and `emulator`.

**Replace with:** Flat commands are canonical for device interaction. Namespaces
are only allowed for subsystems with lifecycle/state (e.g. `skills`, `emulator`,
`recording`). Do not introduce `ui`, `app`, or `device` namespaces.

---

## Strong Recommendations (high value improvements)

### 8. Establish primary command names vs synonyms

**Problem:** Peer synonyms (`click` / `tap`) create doc ambiguity.

**Rule:**
- implementation: both work
- documentation/help: use one canonical form only

Example:
- document: `click`
- accept: `tap`

### 9. Split Phase 1 mentally into two layers

**Current risk:** Phase 1 bundles command promotion, positional args, flag
normalization, and removals.

**Suggested structure:**
- Phase 1A: promote flat commands, remove `action`/`observe`, implement "did you mean"
- Phase 1B: positional arguments, flag normalization

Can be one PR, but must be logically separable.

### 10. Decouple skills migration from CLI refactor

**Add constraint:** Skills migration is a validation step, not a blocking
dependency for CLI refactor. Avoids rollout coupling.

---

## Confirmed Correct Decisions (no changes needed)

**Hard removal of `action` / `observe`:**
- correct given zero users
- use hard error with "did you mean"
- do not support legacy aliases

**Flat command surface:**
- correct
- aligns with agent guessability
- avoids namespace pollution

**Selector flags approach:**
- correct
- matches agent expectations
- better than JSON input model

**Phase ordering:**
- Phase 1: command surface
- Phase 2: selectors
- Phase 3: ergonomics
- Phase 4: docs

Correct sequencing.

---

## Final Expected Outcome

After applying changes:
- CLI is fully guessable by agents
- no legacy surface area remains
- selector behavior is deterministic
- commands are minimal and unambiguous
- failure paths are recoverable via CLI feedback

This plan is ready for execution after incorporating the required changes above.