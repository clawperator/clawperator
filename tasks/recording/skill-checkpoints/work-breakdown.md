# Work Breakdown

## Execution Summary

- This is the reliability sibling to `tasks/recording/compare/`.
- Do this before treating Solax as the proving case for compare.
- Keep the work focused and cheap. Fix the integrity gaps first before
  inventing a generalized checkpoint framework.

## Hard Rules

- Do not return success if the underlying `clawperator exec` failed.
- Do not return success unless the Solax UI shows the requested persisted value.
- Do not broaden this task into compare or generic trace emission.
- Do not claim a generalized selector solution unless it is actually proven on
  the device.

## Required Reading

- `tasks/recording/demo/findings.md`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/SKILL.md`
- `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit/scripts/run.js`
- `docs/skills/authoring.md`

## Phase Plan

### P1. Tighten the Solax skill integrity

- Tier: `default`
- Requirements:
  - remove silent-success handling on failed exec
  - add a regression test or, if test coverage is not yet practical in the
    skills repo, a documented manual repro that proves a forced sub-exec failure
    reaches `runSkill` as `ok:false`
  - make the second `Save` click safer:
    - wait for first `Save` to disappear, or
    - otherwise prove the UI advanced before the second click
  - keep the implementation narrow and reviewable

### P2. Add terminal-state verification

- Tier: `default`
- Requirements:
  - verify `Discharge to <target>%` before returning success
  - use the cheapest reliable proof path
  - make failure legible to the caller if persistence did not occur

### P3. Document the durable guidance

- Tier: `default`
- Requirements:
  - update `docs/skills/authoring.md` with the generalized lesson:
    non-trivial skills need checkpoints and terminal-state verification
  - keep Solax-specific coordinate/input details in the skill docs

## Validation Expectations

- live device validation on the Samsung Galaxy target
- prove:
  - successful set to a new value
  - verified persisted row value
  - failure propagation remains truthful if exec fails and reaches the caller as
    failure

## Findings File

Create `tasks/recording/skill-checkpoints/findings.md` only if the work
uncovers new reliability-specific lessons that do not fit cleanly in the
existing demo findings file.
