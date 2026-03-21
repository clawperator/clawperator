# EM Sign-off: Agent Usability Plan

Reviewer: Claude (EM-level review, second pass)
Date: 2026-03-21
Branch: claude/intelligent-chatterjee
Commits reviewed: 8bb7b8f through 094965a (12 commits since initial EM review)

---

## Verdict: Approved

The plan is ready for implementation. All must-fix and should-fix items from the
first review have been addressed. The one rejected item (PRD-4 log path conditional)
was correctly rejected with sound reasoning. Interim working artifacts have been
cleaned up per CLAUDE.md documentation discipline.

---

## What Changed Since First Review

### Cleanup

- `em-review.md`, `findings-analysis.md`, `issues.md`, `reconciliation.md` deleted.
  Correct call - these were interim analysis artifacts that would confuse implementing
  agents if left in place. Evidence citations in PRDs updated to reference primary
  sources (OpenClaw session logs, verified source files) instead of deleted intermediates.
- `plan.md` no longer references deleted files.

### PRD-1: Gate Condition Fix (35ade12)

Changed `if (apkCheck.status !== "pass")` to `if (apkCheck.status === "fail")` with
a clear comment explaining why "warn" passes through. Added T9 for transient adb
failure during pre-flight. Added `docs/node-api-for-agents.md` to doc update list
(now five source docs). Added `observe` commands as documented out-of-scope limitation.
Added manual installer verification to acceptance criteria.

All first-review must-fix and should-fix items for PRD-1: resolved.

### PRD-2: Envelope Shape Fix (8a8b669)

Timeout enrichment fields moved under `details: { ... }` to match existing
`ValidationFailure.details` pattern. `buildTimeoutError` helper extraction mandated.
T5/T6 test expectations updated to reference `result.details.*`. `enter_text clear: true`
changed from "add a note" to "verify existing note is sufficient."

All first-review items for PRD-2: resolved.

### PRD-3: Pre-run Gate Promotion (ca3527c, 8db74c9)

Most significant change. `--dry-run` promoted from opt-in to default for `skills run`,
with `--skip-validate` escape hatch. Rationale is sound: all skills require a device,
check is milliseconds, failure mode is visible.

Pre-ship skills audit added as a blocking dependency with a concrete five-step procedure.
This was the missing piece - without it, the gate would immediately break any skill with
a stale artifact.

New tests T7/T8/T9 cover gate enforcement, happy path, and escape hatch. Documentation
source path fixed to `../clawperator-skills/docs/skill-development-workflow.md` with
CLAUDE.md warning about generated files. PRD-2 dependency clarified as quality-only.
T6 fallback for no bundled artifact skills added.

All first-review items for PRD-3: resolved.

### PRD-5: Logger Independence (4e79aa7)

Clarified that `onOutput` (PRD-4) and structured lifecycle events (PRD-5) are
independent mechanisms. Neither depends on the other. Prevents incorrect wiring
by a future implementing agent.

### PRD-6: llms.txt and Ownership Fixes (8e6674f, 27597e9)

llms.txt acceptance criterion expanded to cover PRs 1-5. `operator_event.sh` removed
from PR-1 scope, stays in PR-6. AGENTS.md version source specified as
`clawperator --version`. `docsUrl` breakage after PRD-7 noted with update requirement
for PRD-7 agent.

### PRD-7: Scope and Redirect Fixes (094965a)

Audit restricted to `mkdocs.yml` nav tree pass only. Redirect plugin availability
check with fallback added.

### Cross-cutting: Doc Update Requirements (094965a)

Every PRD now has an explicit "Documentation updates in PR-N" section listing specific
source files and specific content changes. This was a gap - code changes were well-specified
but doc updates were vague. Now concrete.

### Testing Strategy

Build-before-test bolded in merge gate with explanation. This was the most important
testing fix - an agent running `npm run test` without `npm run build` first gets stale
results and wastes time.

---

## Remaining Concerns (None Blocking)

1. **Double `---` separator in plan.md (line 187-189).** Cosmetic. Not worth a commit.

2. **plan.md risk section slightly stale.** Line 174 still says "Keep `--dry-run` as
   explicit opt-in" but PRD-3 now makes it the default for `skills run`. Low impact -
   implementing agents will read the PRD, not the risk summary.

3. **Cross-repo coordination ownership unspecified.** PRD-3's skills audit and PRD-6's
   sibling repo doc update both require coordinated `clawperator-skills` PRs. The plan
   identifies the coordination but does not assign ownership. Recommendation: PRD-3
   implementing agent owns the skills audit and fix PR. PRD-6 agent owns the doc update.

---

## Testing Assessment

Well-calibrated for the project stage:
- Every PRD has a numbered TDD sequence with pass/fail expectations at each step
- 12 regression anchors explicitly named with failure modes
- "What Not to Test" section prevents over-testing
- Cross-PRD dependency tests specified for four pairs
- `buildTimeoutError` extraction mandated for PRD-2 (unit-test the pure function, defer timeout to integration)
- PRD-3 gate tests (T7-T9) cover reject, pass, and bypass states
- Build-before-test is now bolded in the merge gate

No testing gaps remain.

---

## Implementation Alignment

All PRD code references verified against the actual codebase in the first review. The
changes since then are additive (new tests, new sections, scope clarifications) and do
not introduce new code claims that need verification. The existing verification table
from the first review still holds.

---

## Sign-off

**Approved for implementation.** The seven PRDs are complete enough for less capable
agents to execute in isolation. The sequencing is correct. The testing is well-calibrated.
Known risks are documented with mitigations. All first-review corrections have been
applied.

Proceed with PR-1.
