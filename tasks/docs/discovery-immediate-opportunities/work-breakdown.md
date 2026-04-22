# Discovery Immediate Opportunities Work Breakdown

Parent plan: `tasks/docs/discovery-immediate-opportunities/plan.md`

## Executive Summary

1 PR, 4 phases. Phases 1-3 are authored-doc updates, each mapped to one page
and one commit. Phase 4 is the paired Node CLI help-text update plus tests.
This pack is intentionally narrow: ship only the four verified
immediate-opportunity items from `tasks/discovery/findings.md`, then stop.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Implement only the four `Immediate Opportunities` from
  `tasks/discovery/findings.md`. Do not pull anything from
  `Follow-Up Enhancements` into this pack.
- One phase, one commit. Do not batch multiple phases into one commit.
- Use `.agents/skills/docs-author/SKILL.md` for Phases 1-3. Follow its code
  verification rules and authored-doc workflow.
- Do not edit `sites/docs/.build/` or `sites/docs/site/` directly.
- Treat `tasks/discovery/findings.md` as authoritative scope input. If you find
  a material contradiction, append a dated `## Execution Notes` section there
  before committing the affected phase.
- Phase 4 must include its `cliHelp.test.ts` coverage in the same commit as the
  help-text change. Do not defer tests.
- Run `./scripts/docs_build.sh` after every docs phase and again after the help
  text phase because `registry.ts` is a docs-relevant source file.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/docs/discovery-immediate-opportunities/plan.md` | Stable contract, scope boundaries, and phase decisions |
| `tasks/discovery/findings.md` | Verified discovery input and the exact immediate-opportunity scope |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for the authored public-doc phases |
| `docs/internal/documentation-drafting-north-star.md` | Governing doc quality bar required by the docs-author skill |
| `docs/quickstart.md` | Phase 1 target page |
| `docs/api/navigation.md` | Phase 2 target page |
| `docs/api/selectors.md` | Phase 3 target page |
| `apps/node/src/contracts/selectors.ts` | Selector contract that Phase 3 must not contradict |
| `apps/node/src/cli/selectorFlags.ts` | Current selector flag behavior that Phase 3 should reflect accurately |
| `apps/node/src/cli/registry.ts` | Phase 4 help-text source of truth |
| `apps/node/src/test/unit/cliHelp.test.ts` | Existing regression patterns for help output |

## PR / Phase Plan

| PR | Purpose | Included phases | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Ship the four verified discovery immediate opportunities | 1, 2, 3, 4 | none |

## Phase 1: Quickstart Selector Callout

### Agent Tier

thinking

### Goal

Add an explicit, prominent quickstart rule that raw-route users should not
guess selectors and should derive them from the current snapshot.

### Files or Surfaces To Change

- `docs/quickstart.md`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for this phase.
2. Verify the current quickstart wording against the actual file and against
   `tasks/discovery/findings.md`.
3. Add a visible callout near the automation-loop or observation guidance that
   says, in substance:
   - snapshot before any action that needs a target
   - derive selectors from the current snapshot
   - guessed labels failing is not a Clawperator bug
4. Keep the change narrow. Do not broaden this phase into navigation or
   selector-priority guidance; those belong to later phases.
5. Run the Phase 1 validation commands.

### Acceptance Criteria

- `docs/quickstart.md` contains an explicit rule against guessing selectors.
- The new text points users back to snapshot-derived targeting, not to a new
  workflow or new command surface.
- The page still matches current code and existing docs structure.

Human review checklist:

- output accuracy: the new callout does not claim behavior the runtime does not provide
- scope completeness: this phase changed only `docs/quickstart.md`
- evidence grounding: the wording matches the verified findings and current docs
- format compliance: the page remains a normal authored doc, not a task-note dump

### Validation

```bash
./scripts/docs_build.sh
rg -n "guess|snapshot|selector" docs/quickstart.md
```

### Expected Commit

```text
docs: strengthen quickstart selector guidance
```

## Phase 2: Navigation Launcher Guidance

### Agent Tier

thinking

### Goal

Add targeted launcher and home-screen guidance to `docs/api/navigation.md`
without changing runtime claims.

### Files or Surfaces To Change

- `docs/api/navigation.md`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for this phase.
2. Verify the current page already says `open_app` is not proof of readiness,
   and preserve that accurate statement.
3. Add a short section that covers:
   - paged launchers may not expose a generic scrollable container
   - launcher paging visible in snapshot XML does not guarantee `scroll` will
     work on that surface
   - direct `open_app` is the preferred path for installed apps
   - chooser, overlay, and transient windows can complicate
     `wait_for_navigation` even when the app ultimately reaches the foreground
4. Keep this phase docs-only. Do not propose runtime fixes or change any action
   contract wording here.
5. Run the Phase 2 validation commands.

### Acceptance Criteria

- `docs/api/navigation.md` contains launcher and home-screen guidance.
- The new section explains launcher paging and overlay behavior without
  overstating certainty or inventing new runtime detection.
- The page still points to `snapshot_ui` as confirmation of current screen
  state.

Human review checklist:

- output accuracy: launcher guidance matches the verified findings and current docs
- scope completeness: this phase changed only `docs/api/navigation.md`
- evidence grounding: the new wording does not contradict `open_app` and `wait_for_navigation` docs
- format compliance: the page remains reference-style and easy to scan

### Validation

```bash
./scripts/docs_build.sh
rg -n "launcher|home-screen|overlay|scroll" docs/api/navigation.md
```

### Expected Commit

```text
docs: add launcher guidance to navigation patterns
```

## Phase 3: Selector Stability Guidance

### Agent Tier

default

### Goal

Add practical selector stability guidance to `docs/api/selectors.md` so agents
do not have to infer field priority by trial and error.

### Files or Surfaces To Change

- `docs/api/selectors.md`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for this phase.
2. Verify the selector contract in:
   - `docs/api/selectors.md`
   - `apps/node/src/contracts/selectors.ts`
   - `apps/node/src/cli/selectorFlags.ts`
3. Add a short section that gives a practical preference order for stable
   selectors:
   - Android framework `resourceId`
   - `contentDescEquals`
   - `textEquals` or `textContains`
   - app-specific opaque numeric resource IDs as a last resort
4. Frame the section as practical guidance, not an absolute guarantee. The
   contract itself remains unchanged.
5. Note that some Compose-heavy trees expose fewer stable IDs and may rely more
   on content descriptions or visible text.
6. Run the Phase 3 validation commands.

### Acceptance Criteria

- `docs/api/selectors.md` contains a selector stability or selector choice
  section.
- The section complements the `NodeMatcher` contract instead of redefining it.
- The new wording presents a practical preference order without claiming it is
  universally guaranteed.

Human review checklist:

- output accuracy: the priority order is presented as guidance, not a hard contract
- scope completeness: this phase changed only `docs/api/selectors.md`
- evidence grounding: the text matches the actual selector fields supported in code
- format compliance: the added guidance fits the existing reference page

### Validation

```bash
./scripts/docs_build.sh
rg -n "stable|resourceId|contentDescEquals|textEquals|Compose" docs/api/selectors.md
```

### Expected Commit

```text
docs: add selector stability guidance
```

## Phase 4: Raw-Route Help Reminders

### Agent Tier

default

### Goal

Add short orientation reminders to `exec` and `snapshot` help and prove them
with help-output regression tests.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/cliHelp.test.ts`

### Steps

1. Update the `exec` and `snapshot` help text only. Keep the new note short and
   point unfamiliar hosts to:
   - `clawperator bundled-skills list`
   - `clawperator-agent-orientation`
2. Do not touch top-level help or unrelated flat-command help in this phase.
3. Add focused tests to `apps/node/src/test/unit/cliHelp.test.ts` that prove:
   - `clawperator exec --help` contains the new orientation reminder
   - `clawperator snapshot --help` contains the new orientation reminder
4. Run the Phase 4 validation commands.

### Acceptance Criteria

- `clawperator exec --help` includes the new raw-route orientation reminder.
- `clawperator snapshot --help` includes the new raw-route orientation reminder.
- The tests fail without the change and pass with it.
- No unrelated command help text changes in this phase.

Human review checklist:

- output accuracy: the new note points to real installed surfaces that already exist
- scope completeness: only `exec` and `snapshot` help were changed
- evidence grounding: tests assert the actual intended text, not a vague substring
- format compliance: the change fits existing help style and test conventions

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(node): add raw-route orientation help cues
```
