# Agent-Assisted Skill Drafting Findings

## Goal

Start `tasks/skills/agent-assisted-skill-drafting/` by making the existing
`android-version` eval the explicit Pack A red baseline for discovery-authored
Settings/About-device skills, then record the canary result before any new
discovery front door is implemented.

## Dependency state

- Verified `clawperator` already contains prerequisite commit
  `da1dd70cab04252bebd142faaf47c77ce9ccabf3` via
  `git merge-base --is-ancestor da1dd70cab04252bebd142faaf47c77ce9ccabf3 HEAD`.
- Verified `../clawperator-skills` already contains prerequisite commit
  `7c6d593e4f162f676c71460877c4e2b884fc5fee` via
  `git -C ../clawperator-skills merge-base --is-ancestor 7c6d593e4f162f676c71460877c4e2b884fc5fee HEAD`.
- Current pack execution is intentionally scoped to Pack A only. Pack B was not
  re-reviewed during this run.

## Anchor scenario

- Shared anchor scenario from `tasks/skills/authorship/findings-compiled.md`:
  "Make a Clawperator skill that opens Netflix, searches for House of Cards,
  and adds it to My List."
- Current execution run has not exercised the anchor scenario yet.
- Phase 1 keeps the anchor scenario as the motivating zero-results route while
  the eval proving surface uses the Pack A Settings/About-device benchmark.

## Eval design decision

- Keep the existing `android-version` eval id and extend it instead of creating
  a sibling benchmark in Phase 1.
- Use `evals/specs/android-version/prompt-skill.md` as the Pack A red/green
  route surface.
- The updated skill prompt now requires discovery through
  `skill-author-by-agent-discovery` before any skill can be emitted and forbids
  a direct minimal wrapper fallback.
- The benchmark still scores Android version as the required pass/fail field.
  Security patch level and Google Play system update version remain out of
  scope for scoring in this phase.
- Phase 1 does not widen `/evals` into a new `skill_score` contract. Later
  SkillResult proof can still use the authored-skill self-test evidence and the
  run transcript until a dedicated harness field is justified.

## Device matrix

- Required matrix:
  - AOSP emulator: `emulator-5554`
  - Samsung physical device: `<samsung_device_serial>`
- Verified both devices were connected at Phase 1 start via `adb devices`.
- Phase 1 canary uses the AOSP emulator only.
- Later phases must keep explicit `--device` selection and must not substitute
  another OEM if the Samsung device becomes unavailable.

## Discovery artifact produced

- None yet.
- Phase 1 only defines the eval red baseline and does not ship the new
  discovery skill.

## Commands run

- `git branch --show-current`
- `git status --short`
- `git merge-base --is-ancestor da1dd70cab04252bebd142faaf47c77ce9ccabf3 HEAD`
- `git -C ../clawperator-skills merge-base --is-ancestor 7c6d593e4f162f676c71460877c4e2b884fc5fee HEAD`
- `adb devices`
- `git checkout -b skills/agent-assisted-skill-drafting`
- `uv run --project evals --extra dev pytest evals/harness -q`
- `uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device emulator-5554 --label pack-a-red-baseline`
- `./gradlew :app:assembleDebug`
- `node apps/node/dist/cli/index.js operator setup --apk apps/android/app/build/outputs/apk/debug/app-debug.apk --device emulator-5554 --operator-package com.clawperator.operator.dev --output json`
- `uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device emulator-5554 --label pack-a-red-baseline`

## Eval run ids

- Preflight blocker run:
  - `android-version-20260419-163614-317-d8e252-codex-gpt-5-4-pack-a-red-baseline`
- Accepted Phase 1 red-baseline canary:
  - `android-version-20260419-163739-522-0da380-codex-gpt-5-4-pack-a-red-baseline`

## Installed authoring-skill checks

- Direct install and reinstall checks remain owned by Phase 3 and Phase 5.
- The accepted emulator canary transcript did perform a host-visible discovery
  check:
  - `authoring-skills list --json` returned only
    `skill-author-by-recording`
  - `skill-author-by-agent-discovery` was not installed yet
- That transcript evidence is sufficient for the Phase 1 red baseline because
  the prompt now requires the missing discovery front door before skill
  emission is allowed.

## Discoverability surfaces checked

- Read and updated Phase 1 eval-facing surfaces only:
  - `evals/specs/android-version/spec.json`
  - `evals/specs/android-version/prompt-skill.md`
  - `evals/README.md`
  - `docs/internal/design/evals.md`
  - `.agents/skills/evals-run/SKILL.md`
  - `.agents/skills/evals-run/references/evals-run.md`
  - `.agents/skills/evals-live-run/SKILL.md`
  - `.agents/skills/evals-live-run/references/evals-live-run.md`
- CLI help, installer-owned `AGENTS.md` surfaces, and public authoring docs are
  deferred to later phases exactly as the pack requires.

## Authored skills and `SkillResult` validity

- No authored skill was emitted in the accepted Phase 1 canary.
- `skill_score` for the accepted canary:
  - `skill_emitted = false`
  - `replay_attempted = false`
  - `replay_status = "skipped"`
- No `SkillResult` validity claim is made yet because the required discovery
  front door is still absent and the prompt correctly omitted the skill block.

## Observations

- The pre-Phase-1 `prompt-skill.md` allowed a direct minimal wrapper skill,
  which was too weak for Pack A because it bypassed the discovery-first route.
- The repo-local eval helper skills described the generic `android-version`
  benchmark and the Solax live eval, but neither one previously named the Pack
  A AOSP-emulator-plus-Samsung proving path.
- The prerequisite pack state is already present locally, so no blocker remains
  on the dependency side for Phase 1.
- On the accepted emulator canary:
  - the main task still passed with `CLAWPERATOR_EVAL_ANSWER: 15`
  - `skills for-app com.android.settings` found only the existing
    `com.android.settings.capture-overview` runtime skill, which is not the
    Pack A authored-skill route
  - `authoring-skills list --json` exposed only
    `skill-author-by-recording`
  - the transcript explicitly stated that the required
    `skill-author-by-agent-discovery` front door was missing and omitted the
    skill block accordingly

## Problems encountered

- The repo started on `main` instead of the requested task branch.
- The first canary run failed preflight with `VERSION_INCOMPATIBLE` because the
  branch-local CLI was `0.6.5` but the emulator still had
  `com.clawperator.operator.dev` at `0.5.5-d`.

## Fixes attempted

- Created and switched to the requested local branch:
  `skills/agent-assisted-skill-drafting`.
- Rebuilt the debug APK with `./gradlew :app:assembleDebug`.
- Reinstalled the matching debug operator to the emulator with the branch-local
  CLI via `operator setup`.
- Reran the exact Pack A canary command after the local-dev runtime was aligned.

## Final route result

- Phase 1 red baseline is now recorded truthfully.
- Accepted canary result:
  - run id:
    `android-version-20260419-163739-522-0da380-codex-gpt-5-4-pack-a-red-baseline`
  - main eval outcome: `pass`
  - normalized Android version answer: `15`
  - Pack A skill path outcome: red
  - red reason: the required discovery front door
    `skill-author-by-agent-discovery` is not installed yet, so the transcript
    omitted the skill block and `skill_score` stayed skipped
- Phase 1 acceptance now matches the pack intent:
  - the benchmark lives in `/evals`
  - the prompt names `skill-author-by-agent-discovery` as the required front door
  - the canary demonstrates the current missing-front-door red state instead of
    a hand-authored fallback skill

## Deferred follow-up

- Phase 2: create `skill-author-by-agent-discovery` and lock the discovery
  artifact contract.
- Phase 3: wire packaged install, CLI help, and installer-generated host-agent
  discoverability surfaces.
- Phase 4: update public host-agent and authoring docs with the zero-results
  route.
- Phase 5: run the anchor scenario plus the AOSP emulator and Samsung physical
  eval matrix and record authored-skill proof.
