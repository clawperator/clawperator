# API Refactor Plan: Critical Review

Reviewer: independent agent, 2026-03-23.
Reviewed against: actual source code in `apps/node/src/cli/` and `apps/node/src/contracts/`, not just documentation.

---

## 1. Plan vs Reality

### What the plan gets right

The plan accurately identifies the core problems: `action`/`observe` nesting, JSON-only selectors, verbose flag names. The command inventory in the plan's Phase 1 table (line 167-177) matches the actual dispatch in `apps/node/src/cli/index.ts` lines 634-688 (action) and 602-621 (observe). The plan correctly identifies that `inspect ui` exists as an alias of `observe snapshot` (index.ts:622-632).

### What the plan mischaracterizes or misses

**1. No CLI framework.** The plan does not acknowledge that the CLI uses hand-rolled argument parsing, not Yargs/Commander/etc. This is the single most important implementation detail. `getGlobalOpts()` (index.ts:335-380) manually iterates argv. `getOpt()` (index.ts:382-385) does simple `rest.indexOf(flag)`. There is no built-in support for:

- Positional arguments (adding `clawperator open com.android.settings` means the implementing agent must write positional-arg extraction from scratch)
- Flag aliases (adding `--device` as an alias for `--device-id` means modifying `getGlobalOpts` to check both strings)
- Subcommand deprecation / "did you mean?" (the `default:` case at index.ts:887 just says `Unknown command: ${cmd}. Use --help.`)
- Per-command help generation (help is a hardcoded `HELP_TOPICS` record at index.ts:121)

The plan says Phase 0 should build "flag alias infrastructure" and "did you mean?" errors. This is correct, but the plan underestimates the effort because it doesn't say "we have no CLI framework - everything is manual." An implementing agent that doesn't read the dispatch code will assume there's a framework providing alias support.

**2. The `--output json` vs `--json` flag is trickier than it looks.** The plan says `--json` replaces `--output json`. But currently `--output` is parsed in `getGlobalOpts` (index.ts:356-357) and produces a `format` field that flows through every command handler as `OutputOptions["format"]`. The `--json` flag only exists as a special case in the `doctor` command (index.ts:858). Implementing `--json` as a global boolean flag requires either:

- Adding another branch in `getGlobalOpts` that sets `output = "json"` when `--json` is seen, OR
- Keeping `--output` parsing and treating `--json` as syntactic sugar

The plan doesn't call out this implementation detail. It should.

**3. `action type` already has `--submit` and `--clear`.** The plan lists these in Phase 2 as "Additional type ergonomics" (plan line 326-330). They already exist: `index.ts:667-668` parses both `--submit` and `--clear`, and `action.ts:151-153` passes them through. `buildTypeTextExecution` in `domain/actions/typeText.ts` already accepts them. This is not new work - it just needs to be preserved during the command promotion.

**4. NodeMatcher field names don't match the plan's flag names.** This is the most subtle gap. The plan says `--text` should produce `{"text":"Login"}` (Phase 2 testing, plan line 341). But `NodeMatcher` (contracts/selectors.ts:4-11) uses `textEquals`, not `text`:

```typescript
interface NodeMatcher {
  resourceId?: string;
  role?: string;
  textEquals?: string;
  textContains?: string;
  contentDescEquals?: string;
  contentDescContains?: string;
}
```

So `--text "Login"` must map to `{ textEquals: "Login" }`, `--desc "Submit"` must map to `{ contentDescEquals: "Submit" }`, and `--id "foo"` must map to `{ resourceId: "foo" }`. The plan's Phase 2 testing section (lines 341-349) says things like `--text "Login" produces {"text":"Login"} matcher` which is wrong - it should produce `{"textEquals":"Login"}`. This is not a showstopper but an implementing agent that takes the test specs literally will write incorrect tests.

**5. `action open-uri` exists separately from `action open-app`.** The plan's unified `open` command (plan lines 77-83) needs to merge two existing handlers: `cmdActionOpenApp` (action.ts:20-49) which calls `buildOpenAppExecution()`, and `cmdActionOpenUri` (action.ts:187-216) which calls `buildOpenUriExecution()`. These produce different execution action types (`open_app` vs `open_uri`). The URL/URI/package detection logic in the unified `open` must route to the correct builder. The plan mentions this but doesn't highlight that these are different execution action types requiring different builders.

**6. `scroll` as a CLI command does not exist today.** The plan correctly states this (plan line 189: "If no CLI command currently wraps the scroll action, one must be added"). But this is more work than promoted commands. Promoting `observe snapshot` to `snapshot` is a dispatch change. Adding `scroll` requires: a new builder function (like `buildScrollExecution`), new CLI parsing for direction and container flags, new help text, and new tests. This is the only genuinely new command in the refactor and it should be flagged as higher-effort.

**7. `back` convenience command.** The plan proposes `back` as `press --key back` (plan line 181). But `press --key back` is the current syntax pattern. After promotion, it's `press back` (positional). So `back` would be a synonym for `press back`, which requires the dispatch to handle `back` as a top-level command. This is trivial but the plan doesn't address the dispatch wiring.

**8. `packages list` and `grant-device-permissions` are not mentioned.** The plan doesn't discuss what happens to these commands. They're already flat (`packages list` is namespaced, `grant-device-permissions` is flat). Neither needs promotion, but the plan should explicitly say they're unchanged to avoid an implementing agent wondering whether to touch them.

**9. Exit code contract.** The current exit-code logic (index.ts:903-908) parses the JSON result to determine the exit code. The plan's new error messages for "did you mean?" and missing selectors need to produce exit code 1. Currently, USAGE errors from the switch cases exit with code 0 (most cases just `JSON.stringify` a code:USAGE object). The plan should specify the exit-code contract for new error types, especially since CLAUDE.md requires testing exit codes for CLI option work.

---

## 2. Phase Boundaries

### Phase 0 + Phase 1: Collapse them

The plan already says this is acceptable (plan line 146-147: "If the implementing agent finds Phase 0 and Phase 1 naturally collapse into one PR, that is acceptable"). I'd go further: they *should* collapse. Phase 0 alone is not a useful state. The "did you mean?" infrastructure only matters once old commands are removed. Flag aliases only matter once new flag names exist. Building Phase 0 as a standalone PR means shipping unused infrastructure and testing it in isolation when the real test is "does the old command produce a redirect?". One PR is better.

### Phase 1: This is the largest phase and it's too big for comfort

Phase 1 includes:
- Promoting 7+ commands from `action`/`observe` to top-level (dispatch changes)
- Removing `action` and `observe` parent commands
- Adding unified `open` with smart detection
- Adding `scroll` (new command, new builder)
- Adding `back` (new convenience command)
- Adding positional arguments to `open`, `press`, `type`, `scroll`
- Normalizing 4 global flags
- Rewriting the `HELP` string and all `HELP_TOPICS` entries
- Updating all tests that reference old command forms
- Updating smoke scripts

This is a single PR that touches index.ts (915 lines, the entire dispatch), action.ts (all handlers), help text, tests, and smoke scripts. It's reviewable but it's pushing the boundary.

**Recommendation:** Phase 1 could split into:
- **PR-1a:** Promote commands + remove `action`/`observe` + "did you mean?" redirects. This is the structural change. No positional args, no flag aliases, no new commands yet.
- **PR-1b:** Flag normalization, positional args, unified `open`, `scroll` command, `back` command. This is the ergonomic layer.

But the plan correctly notes the layers are mentally separable (plan line 156-158). As long as the implementing agent doesn't try to do everything in one pass, one PR is workable.

### Phase 2: Correctly scoped

Phase 2 (selector flags) is genuinely independent. It adds `--text`, `--id`, `--desc`, `--role` to commands that currently only take `--selector`. The command dispatch doesn't change. The only risk is that Phase 2 depends on Phase 1's command names existing (you add `--text` to `click`, not to `action click`). The plan correctly notes this dependency (plan line 473-474).

### Phase 3: Mostly fine, but smoke scripts should move earlier

The plan puts smoke script updates in Phase 3 (plan line 418-421). But if Phase 1 removes `action`/`observe`, the smoke script `clawperator_smoke_core.sh` will break immediately. The smoke script currently uses `action open-app`, `observe snapshot`, etc. (confirmed by reading the script). Smoke script updates must happen in Phase 1, not Phase 3. The plan contradicts itself here: line 289 says "clawperator_smoke_core.sh passes (update script if it uses old command forms)" under Phase 1 testing, but line 418-421 puts the actual update work in Phase 3.

**Verdict:** Move smoke script updates to Phase 1. Phase 3 should only contain help text polish and error message improvements.

---

## 3. Design Decisions

### Flat commands canonical: Correct

The `action`/`observe` nesting adds one token of indirection for zero benefit. Agents trained on `adb`, Playwright, or any modern CLI will try flat verbs first. The codebase confirms that `action` and `observe` are just dispatch routers with no shared state (index.ts:634, 602) - they're pure taxonomy, not subsystem namespaces.

### No `ui`/`app`/`device` namespaces: Correct

The first review agent proposed these namespaces. The plan correctly rejects them (plan line 45-47). With only ~10 device interaction verbs, namespaces double the discovery cost. The existing `skills`, `emulator`, and `recording` namespaces are justified because they have 5+ subcommands with shared state. `ui` would just be a renamed `action`.

### `press` over `press-key`: Correct

`press back` is what an agent will type. `press-key back` is not. The first review correctly identified this.

### Unified `open`: Correct but needs edge case spec

The URL/URI/package detection (plan lines 78-80) is clean for the common cases. But the plan doesn't specify: what about a package name that contains a period and could be confused with a domain? Example: `com.google.android.youtube` vs `youtube.com`. The answer is that package names don't start with URL schemes, so the check is unambiguous - but the plan should state this explicitly to prevent an implementing agent from over-engineering the detection.

### Primary names vs synonyms: Correct

One documented name, synonyms accepted silently. This prevents decision paralysis in help text while remaining forgiving.

### `--selector` JSON as escape hatch: Correct

This is the highest-value change. The NodeMatcher has six fields. Making them individual flags covers 95%+ of real usage. The only case where `--selector` JSON is needed is when an agent wants to specify a combination that can't be expressed with AND (which is currently none, since AND is the only combinator).

### Decisions that should be locked but aren't

**1. `--long` and `--focus` click types.** The first review agent proposed `--long` and `--focus` flags for click. The codebase supports `clickType: "default" | "long_click" | "focus"` in ActionParams (contracts/execution.ts). The plan doesn't address these. They should either be included in Phase 2 (add `--long` and `--focus` flags to `click`) or explicitly deferred.

**2. `scroll-until` and `scroll-and-click` as CLI commands.** The plan adds `scroll` as a CLI command but says nothing about `scroll_until` and `scroll_and_click`, which are separate canonical action types (contracts/aliases.ts:33-34). These are powerful actions that currently require `execute --execution <json>`. Should they get CLI wrappers? The first review agent proposed `scroll-until --text "About phone" --click`. This is a real gap - the plan should explicitly defer or include them.

**3. `wait` timeout behavior.** The plan doesn't specify whether `--timeout` on `wait` overrides the execution-level timeout or is a wait-specific timeout. Currently, `buildWaitExecution` uses a fixed 30s execution timeout. An agent using `wait --text "Loading" --timeout 5000` probably means "wait up to 5 seconds for this element" not "set the execution timeout to 5 seconds." The plan should clarify.

**4. Output format for non-JSON mode.** The plan specifies `--json` as canonical but says nothing about what pretty mode looks like after the refactor. Currently, pretty mode still outputs JSON for most commands (action.ts handlers always return `formatSuccess`/`formatError` which produces JSON regardless of format). This is fine to leave unchanged but should be acknowledged.

---

## 4. Gaps and Risks

### The HTTP API (`serve`) is not addressed

The `serve` command (serve.ts) exposes routes at `/observe/snapshot`, `/observe/screenshot`, and accepts `receiverPackage` in request bodies. When the CLI renames commands, the HTTP API routes become inconsistent. The plan says nothing about whether to update HTTP routes.

**My recommendation:** Don't change HTTP routes in this refactor. The HTTP API is alpha/unstable (per docs/architecture.md:474). But the plan should explicitly state "HTTP API routes are unchanged in this refactor" to prevent scope creep.

### Test infrastructure is adequate but brittle

The existing test pattern (cliHelp.test.ts) spawns a subprocess against `dist/cli/index.js`. This means:

1. Tests require a build step first (`npm run build`)
2. Tests match on string output (`assert.match(stdout, /clawperator observe snapshot/)`)
3. Every command rename will break these string matches

There are ~30 test files, many of which will need updates. The plan mentions "regression test harness" (plan line 133-136) but doesn't call out that the existing tests are the harness - they just need to be updated, not rebuilt.

**Risk:** The implementing agent might try to build a new test harness instead of updating the existing one. The plan should say: "Update existing tests in `apps/node/src/test/unit/` to use new command names. Do not build a separate regression harness."

### The `execute` command contract is unchanged but fragile

The plan says `execute` is unchanged (plan line 508-511: "The current `execute` command has a settled contract"). This is correct. But `execute --execution <json>` is how skills and advanced agents construct payloads. The `--execution` flag name is verbose but renaming it would break the skill scripts. Since skills migration happens after Phase 1, there's a window where skill scripts call `execute --execution` on a CLI that has renamed other flags. This is fine (the plan explicitly preserves old flag names as silent aliases), but the plan should note that `--execution` specifically is NOT renamed. It's not in the flag alias table (plan line 126-129), which is correct, but the absence should be deliberate and documented.

### The alias table in contracts/aliases.ts will confuse the implementing agent

`contracts/aliases.ts` defines action type aliases for the execution payload (e.g., `tap` -> `click`, `press` -> `click`). These are execution-level aliases, not CLI-level aliases. The plan creates CLI-level aliases (e.g., `tap` command -> `click` command). These are different layers. An implementing agent might conflate them. The plan should add a note: "CLI command synonyms (tap -> click) are dispatch-level routing in index.ts. Execution action type aliases (contracts/aliases.ts) are payload normalization and are not changed by this refactor."

### CI is not mentioned

The plan doesn't reference CI configuration. If there are GitHub Actions workflows that run tests or smoke scripts, they may need updates. This is a minor gap but worth noting.

### The HELP string is 100+ lines of hardcoded text

The main `HELP` constant (index.ts:9-119) is a giant template literal. The `HELP_TOPICS` record (index.ts:121+) is another ~200 lines of hardcoded strings. Phase 3 says "rewrite help text." This is not a trivial change - it's rewriting ~300 lines of static text. The plan provides the target structure (plan lines 362-405) which is helpful, but the implementing agent should know they'll be rewriting index.ts lines 9-330 essentially from scratch.

### The `resolveHelpTopic` function needs updating

`resolveHelpTopic` (index.ts:313-333) maps command paths to help topic keys. It currently handles paths like `["observe", "snapshot"]` and `["action", ...]`. This must be updated to handle new flat command names. The plan doesn't mention this function.

---

## 5. The Guiding Principles Doc

### Overall assessment: Good, useful, mostly accurate

`docs/design/node-api-design-guiding-principals.md` is well-written and provides clear, actionable guidance. The principles are concrete (not vague platitudes) and the examples show bad vs good patterns. An implementing agent reading this before starting work would make better decisions.

### Issues

**1. The filename has a typo.** `guiding-principals.md` should be `guiding-principles.md`. "Principals" means "people in charge." "Principles" means "fundamental rules." This is a real typo that should be fixed.

**2. Principle 3 references Playwright's `fill` but the plan uses `type` as canonical.** The principles doc says agents draw from Playwright vocabulary including `fill` (line 123). The plan makes `type` canonical and `fill` a synonym. This is the right call (agents will type `type` before `fill` because it's shorter and more generic), but the principles doc should note that Playwright convention was considered and deliberately not followed for this specific case.

**3. The checklist (lines 279-296) is good but redundant with the plan.** The "Checklist for New Commands and Flags" duplicates guidance that's already in the plan's acceptance criteria. This isn't harmful but it means there are two sources of truth. If the plan changes, the checklist needs updating too. Consider whether the checklist should reference the plan rather than duplicating it.

**4. No contradiction with the plan.** I checked every principle against the plan's design decisions. They're consistent. The principles doc is a correct distillation of the plan's reasoning.

### Overlap with docs/design/node-api-design.md

The existing `node-api-design.md` was updated to point to the new principles doc (lines 390-403). The cross-reference is clean. The existing doc covers runtime architecture (execution model, result transport, safety bounds); the new doc covers CLI surface design. They're complementary, not overlapping. This is fine.

---

## 6. Docs Refactor Plan

### Sequencing is correct

`API refactor complete -> PRD-1 -> PRD-2` is the right order. Writing docs against a moving API is waste (docs/refactor/plan.md line 5 says this explicitly). PRD-1 (entry points) before PRD-2 (structure) is also correct - you need to know where agents enter before restructuring what they find.

### PRD-1 references stale PR numbers

PRD-1 repeatedly references "PR-1" through "PR-5" (prd-1-entry-points.md lines 16, 66-72, 206-210, 245-248). These refer to the old `tasks/node/agent-usage/` PRD numbering, not the current API refactor phases. An implementing agent won't know what "PR-1" or "PR-3" means. The docs refactor plan.md (line 67-69) provides the translation: "Do not reference `action click`, `observe snapshot`, `--device-id`, or `--output json`." But PRD-1 still says things like "the APK absence behavior change that the docs must describe" (line 245) and "the error format that `node-api-for-agents.md` must document" (line 246) - these reference work that has already shipped. The PRD-1 dependencies section (lines 244-250) needs rewriting to reference the API refactor phases, not the old PRD numbers.

### PRD-1 `operator_event.sh` section is still relevant

The `scripts/operator_event.sh` stub (PRD-1 section 4, lines 124-141) is about a missing script that OpenClaw expects. This is unrelated to the API refactor and could proceed independently. The docs plan says it's blocked on API refactor completion, but it shouldn't be - it's a script stub, not a docs page.

### PRD-2 is coherent but vague

PRD-2 (prd-2-structure.md) proposes a four-section docs structure (Get Started / Use / Reference / Troubleshoot). This is reasonable but the "audit before designing" step (lines 60-68) means the actual implementation plan doesn't exist yet - it'll be determined during the audit. This is fine for a future task but means PRD-2 is more of a direction than a plan.

### PRD-1's AGENTS.md template uses old command forms

PRD-1 line 167 shows `clawperator operator setup --apk <path> --device-id <id>`. The docs refactor plan (line 72) says to use new commands: `--device` not `--device-id`. But PRD-1's template (lines 160-181) still uses `--device-id` and doesn't use any of the new flat commands. The implementation notes in docs/refactor/plan.md (lines 67-73) correctly call this out, but the template itself is stale. It should be updated or clearly marked as needing update.

---

## 7. Summary of Required Actions Before Implementation Begins

Ranked by impact:

1. **Acknowledge the hand-rolled parser.** Add a section to the plan stating that there is no CLI framework. All alias, positional arg, and "did you mean?" infrastructure must be built from scratch in index.ts. This is the biggest implementation risk.

2. **Fix NodeMatcher field name mismatch in Phase 2 test specs.** `--text` maps to `textEquals`, not `text`. `--desc` maps to `contentDescEquals`, not `contentDescription`. Update all Phase 2 test specifications.

3. **Move smoke script updates to Phase 1.** The smoke script will break the moment `action`/`observe` are removed. It can't wait for Phase 3.

4. **Add explicit note about HTTP API routes.** State that `/observe/snapshot`, `/observe/screenshot`, and `/execute` routes are unchanged in this refactor.

5. **Decide on `scroll-until` / `scroll-and-click` CLI wrappers.** Either include them in Phase 1/2 or explicitly defer with rationale.

6. **Decide on `--long` / `--focus` click type flags.** Either include in Phase 2 or explicitly defer.

7. **Clarify that `--submit` and `--clear` already exist.** Phase 2 should not treat them as new work.

8. **Fix the filename typo.** `guiding-principals.md` -> `guiding-principles.md`.

9. **Update PRD-1 to remove stale PR-1 through PR-5 references.** Replace with API refactor phase references or remove the dependencies section entirely.

10. **Add note distinguishing CLI command synonyms from execution action type aliases.** Prevent implementing agent from conflating `contracts/aliases.ts` with CLI dispatch routing.

---

## 8. What's Good

The plan is substantially correct. The core insight - that agents fail because the CLI surface reflects implementation taxonomy rather than user intent - is accurate and well-evidenced. The four-phase structure is logical. The design decisions are sound. The failure-mode acceptance criteria (plan lines 222-272) are specific and testable. The guiding principles doc is genuinely useful guidance that will improve the quality of the implementation.

The decision to hard-remove `action`/`observe` with "did you mean?" redirects (rather than keeping them as aliases) is the right call for a pre-alpha project with zero users. It forces the new surface to be the only surface, which means bugs in the new surface get found immediately.

The plan is ready for implementation after the fixes above. None of the issues are architectural - they're all specificity gaps that would cause an implementing agent to waste cycles or make incorrect assumptions.
