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
- Phase 2 defines the durable discovery artifact contract and includes an
  explicit Netflix / House of Cards example artifact in
  `.agents/skills/skill-author-by-agent-discovery/SKILL.md`.

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
- `test -f .agents/skills/skill-author-by-agent-discovery/SKILL.md`
- `test -f .agents/skills/skill-author-by-agent-discovery/agents/openai.yaml`
- `rg -n "recommended_next_step|existing_skill_verdict|target_app_package|route_confidence|mutation_risk|evidence_collected|discovery_budget_used|skill_classification|handoff_target|handoff_reasoning" .agents/skills/skill-author-by-agent-discovery/SKILL.md`
- `rg -n "discovery|proving|skill-author-by-agent-discovery" .agents/skills/skill-author-by-recording/SKILL.md`
- `npm --prefix apps/node run build`
- `npm --prefix apps/node run test`
- `node apps/node/dist/cli/index.js --help`
- `node apps/node/dist/cli/index.js skills --help`
- `node apps/node/dist/cli/index.js authoring-skills --help`
- `node apps/node/dist/cli/index.js skills new --help`
- `node apps/node/dist/cli/index.js authoring-skills install --format json`
- `node apps/node/dist/cli/index.js authoring-skills list --format json`
- `bash -lc 'source sites/landing/public/install.sh; AUTHORING_SKILLS_INSTALL_DIR="$HOME/.clawperator/authoring-skills"; write_agent_guide; write_shared_agent_bridge'`
- `rg -n "skill-author-by-agent-discovery|skill-author-by-recording|authoring-skills|AGENTS.md" ~/.clawperator/AGENTS.md ~/.agents/AGENTS.md`
- `./scripts/docs_build.sh`
- `grep -ri "receiver" docs/api/ docs/skills/ docs/troubleshooting/ docs/index.md docs/setup.md`
- `grep -r "observe snapshot\|action click\|action press" docs/`

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
- Phase 3 install check with the branch-local CLI now reports both packaged
  first-party authoring skills:
  - `skill-author-by-agent-discovery`
  - `skill-author-by-recording`
- `authoring-skills list --format json` now returns both installed skill
  entries with absolute `SKILL.md` paths under
  `~/.clawperator/authoring-skills/`.
- The packaged discovery skill is now wired through all shared agent discovery
  directories created by the CLI install:
  - `~/.claude/skills/`
  - `~/.codex/skills/`
  - `~/.agents/skills/`

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
- Phase 2 additionally updated and checked:
  - `.agents/skills/skill-author-by-agent-discovery/SKILL.md`
  - `.agents/skills/skill-author-by-agent-discovery/agents/openai.yaml`
  - `.agents/skills/skill-author-by-recording/SKILL.md`
  - `tasks/skills/agent-assisted-skill-drafting/plan.md`
  - `tasks/skills/agent-assisted-skill-drafting/work-breakdown.md`
- Phase 3 additionally updated and checked:
  - `apps/node/authoring-skills/skill-author-by-agent-discovery`
  - `apps/node/src/cli/registry.ts`
  - `apps/node/src/cli/commands/authoringSkills.ts`
  - `apps/node/src/test/unit/cliHelp.test.ts`
  - `apps/node/src/test/unit/authoringSkills.test.ts`
  - `apps/node/src/test/unit/authoringSkillsPack.test.ts`
  - `sites/landing/public/install.sh`
  - `~/.clawperator/AGENTS.md`
  - `~/.agents/AGENTS.md`
- Phase 4 additionally updated and checked:
  - `docs/host-agents.md`
  - `docs/skills/authoring.md`
  - `docs/internal/design/agent-host-integration.md`
  - `sites/docs/static/llms-full.txt`
  - `sites/landing/public/llms-full.txt`

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
- Phase 2 keeps the default discovery budget from the plan with no deviation:
  - max 5 snapshots
  - max 3 screenshots
  - max 90 seconds wall time
- Phase 2 will require the new discovery skill to emit the exact Pack A
  top-level artifact keys from the plan and to treat `skill_classification` as
  conditional only when `recommended_next_step = proceed_to_recording`.
- Phase 2 also makes the boundary explicit:
  - `skill-author-by-agent-discovery` is the zero-results router
  - `skill-author-by-recording` is the proving workflow after
    `proceed_to_recording`
- The task-pack status blocks in `plan.md` and `work-breakdown.md` now track
  live progress instead of leaving the pack at its pre-execution blocked state.
- Phase 3 code inspection result:
  - `apps/node/src/domain/skills/copyAuthoringSkills.ts` already discovers
    packaged authoring skills generically by scanning subdirectories for
    `SKILL.md`
  - no hard-coded single-skill assumption needed to be repaired there
  - install wiring work stayed additive: packaged symlink entry, help text,
    tests, and installer-authored guidance
- The branch-local CLI help surfaces now route no-match users to the discovery
  front door instead of stopping at a generic `authoring-skills list` hint:
  - `clawperator --help`
  - `clawperator skills --help`
  - `clawperator authoring-skills --help`
  - `clawperator skills new --help`
- The installer-written local guide at `~/.clawperator/AGENTS.md` now names
  both packaged front doors, treats discovery as the zero-results first step,
  and keeps recording as the proving step after `proceed_to_recording`.
- The installer-owned bridge block in `~/.agents/AGENTS.md` now points agents
  back to the local guide plus runtime-skill discovery commands without
  claiming the shared skill dirs contain runtime skills.
- Phase 4 public docs now mirror the shipped route:
  - `docs/host-agents.md` names the zero-results route and its verification
    commands
  - `docs/skills/authoring.md` treats discovery as the zero-results front door
    and recording as the proving workflow
  - `docs/internal/design/agent-host-integration.md` records the durable
    install / bridge assumption so future host-agent work does not regress it
- `./scripts/docs_build.sh` passed after the Phase 4 doc updates.
- Auxiliary docs-author greps found existing unrelated hits outside the Phase 4
  scope:
  - `docs/api/environment.md` still mentions the legacy `--receiver-package`
    alias while documenting env precedence
  - `docs/internal/documentation-drafting-north-star.md` intentionally contains
    deprecated-command examples as anti-pattern text
  - these did not block the pack because the phase validation requirement is
    `./scripts/docs_build.sh`

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
- Phase 2 is now complete locally.
- Phase 2 acceptance result:
  - `.agents/skills/skill-author-by-agent-discovery/` now exists with both
    `SKILL.md` and `agents/openai.yaml`
  - the new skill names every required discovery artifact field from the plan
  - the new skill enforces the default Pack A budget:
    5 snapshots, 3 screenshots, 90 seconds wall time
  - the Netflix / House of Cards anchor scenario is explicit in the new skill
    prompt
  - `skill-author-by-recording` now describes itself as the proving workflow
    after discovery instead of the zero-results router
  - `plan.md` and `work-breakdown.md` now reflect live pack status:
    completed phases `1, 2`, current / next `Phase 3`
- Phase 3 is now complete locally.
- Phase 3 acceptance result:
  - `apps/node/authoring-skills/skill-author-by-agent-discovery` now packages
    the discovery front door alongside the recording front door
  - authoring-skills tests now cover both packaged skills and the pack script
    now proves multi-symlink materialize / restore behavior
  - the built CLI help now tells no-match users to start with
    `skill-author-by-agent-discovery` and keeps
    `skill-author-by-recording` as the proving handoff
  - `authoring-skills install --format json` installs both packaged skills and
    `authoring-skills list --format json` lists both installed skills
  - the refreshed installer-owned host guides at `~/.clawperator/AGENTS.md`
    and `~/.agents/AGENTS.md` now advertise the discovery-to-proving route
  - `plan.md` and `work-breakdown.md` now reflect live pack status:
    completed phases `1, 2, 3`, current / next `Phase 4`
- Phase 4 is now complete locally.
- Phase 4 acceptance result:
  - `docs/host-agents.md` now documents the zero-results authoring route from
    runtime discovery to discovery-first handoff
  - `docs/skills/authoring.md` now documents the installed front doors in the
    correct order: discovery first, recording second, scaffold only by explicit
    choice
  - `docs/internal/design/agent-host-integration.md` now records the durable
    guide / bridge expectation for the discovery-to-proving route
  - `./scripts/docs_build.sh` passed and regenerated the shipped
    `llms-full.txt` outputs
  - `plan.md` and `work-breakdown.md` now reflect live pack status:
    completed phases `1, 2, 3, 4`, current / next `Phase 5`

## Deferred follow-up

- Phase 5: run the anchor scenario plus the AOSP emulator and Samsung physical
  eval matrix and record authored-skill proof.
