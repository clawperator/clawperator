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
- Phase 5 exercised the anchor scenario through the discovery front door in a
  local shell agent context on the required Samsung physical device.
- The discovery-only anchor run stopped at the correct boundary and chose
  `recommended_next_step = "escalate_to_human"` because Netflix opened on a
  multi-profile chooser and no authorized target profile was provided for the
  later state-changing `My List` mutation.
- Phase 1 still kept the anchor scenario as the motivating zero-results route
  while the eval proving surface used the Pack A Settings/About-device
  benchmark.

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

- Phase 1 only defined the eval red baseline and did not yet ship the new
  discovery skill.
- Phase 2 defines the durable discovery artifact contract and includes an
  explicit Netflix / House of Cards example artifact in
  `.agents/skills/skill-author-by-agent-discovery/SKILL.md`.
- The first official Phase 5 AOSP green-proof rerun did produce a discovery
  artifact in transcript form before it stalled later in scaffold editing:
  - `recommended_next_step = "proceed_to_recording"`
  - `skill_classification = "shared-general"`
  - `handoff_target = "skill-author-by-recording"`
  - the artifact was singular and explicit, and it routed into recording
    instead of inventing a direct wrapper or reusing an unrelated Settings
    skill
- The clean official Samsung green-proof rerun also produced the same singular
  route before proving:
  - `recommended_next_step = "proceed_to_recording"`
  - `skill_classification = "shared-general"`
  - `handoff_target = "skill-author-by-recording"`
- The anchor-scenario discovery-only run produced one explicit Netflix routing
  artifact with:
  - `recommended_next_step = "escalate_to_human"`
  - `handoff_target = "human"`
  - `handoff_reasoning` grounded in the unapproved profile-selection boundary
    at the Netflix chooser

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
- `npm --prefix apps/node run build`
- `uv run --project evals --extra dev pytest evals/harness/test_run_eval.py -q`
- `node apps/node/dist/cli/index.js authoring-skills install --format json`
- `node apps/node/dist/cli/index.js authoring-skills list --format json`
- `rg -n "skill-author-by-agent-discovery|skill-author-by-recording|authoring-skills|AGENTS.md" ~/.clawperator/AGENTS.md ~/.agents/AGENTS.md`
- `uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device emulator-5554 --label pack-a-aosp`
- `node apps/node/dist/cli/index.js skills validate com.android.settings.read-android-version-aosp-replay --json`
- `node apps/node/dist/cli/index.js skills run com.android.settings.read-android-version-aosp-replay --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js skills new com.android.settings.read-android-version-samsung-replay --json`
- `node apps/node/dist/cli/index.js skills validate com.android.settings.read-android-version-samsung-replay --json`
- `node apps/node/dist/cli/index.js skills run com.android.settings.read-android-version-samsung-replay --device <samsung_device_serial> --operator-package com.clawperator.operator.dev --json`
- `adb -s <samsung_device_serial> shell dumpsys power`
- `adb -s <samsung_device_serial> shell dumpsys window policy`
- `adb -s <samsung_device_serial> shell cmd lock_settings get-disabled`
- `adb -s <samsung_device_serial> shell wm dismiss-keyguard`
- `adb -s <samsung_device_serial> shell input keyevent 82`
- `node apps/node/dist/cli/index.js press home --device <samsung_device_serial> --operator-package com.clawperator.operator.dev --json`
- `python` one-off registry cleanup to remove temporary AOSP / Samsung replay skills from `~/.clawperator/skills/skills/skills-registry.json`
- `adb -s <samsung_device_serial> shell dumpsys window policy | rg -n "showing=|secure=|mInputRestricted="`
- `uv run --project evals --extra dev pytest evals/harness/test_replay.py -q`
- `uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device <samsung_device_serial> --label pack-a-samsung-clean-rerun`
- `codex exec --dangerously-bypass-approvals-and-sandbox --json -m gpt-5.4 -C <repo_root> "Use the local skill at .agents/skills/skill-author-by-agent-discovery/SKILL.md for this run. User goal: Make a Clawperator skill that opens Netflix, searches for House of Cards, and adds it to My List. Work in a local shell agent context only. Use the branch-local Clawperator CLI command: node apps/node/dist/cli/index.js. Use the Samsung device <samsung_device_serial> and operator package com.clawperator.operator.dev. Follow the skill literally: check installed runtime skills first, keep discovery bounded, use only Clawperator commands for live device interaction, produce exactly one fenced JSON discovery artifact with every required top-level key, choose exactly one recommended_next_step, and stop at the discovery boundary. Do not author a runtime skill, do not start recording, and do not mutate account state." > /tmp/agent-assisted-skill-drafting-anchor-discovery.jsonl`
- `uv run --project evals --extra dev python evals/run_eval.py android-version --agent codex --model gpt-5.4 --mode full-repo --runtime local-dev --skill-prompt prompt-skill.md --device <aosp_emulator_serial> --label pack-a-aosp-clean-rerun`

## Eval run ids

- Preflight blocker run:
  - `android-version-20260419-163614-317-d8e252-codex-gpt-5-4-pack-a-red-baseline`
- Accepted Phase 1 red-baseline canary:
  - `android-version-20260419-163739-522-0da380-codex-gpt-5-4-pack-a-red-baseline`
- Official Phase 5 AOSP green-proof rerun that reached discovery, recording,
  export, and scaffold creation before stalling:
  - `android-version-20260419-181353-562-fef9f9-codex-gpt-5-4-pack-a-aosp`
- Invalid resumed Samsung rerun that was discarded because a previously
  installed local replay skill polluted the required no-match route:
  - `android-version-20260419-192050-156-ede0f8-codex-gpt-5-4-pack-a-samsung-rerun`
- Accepted official Samsung green-proof rerun:
  - `android-version-20260419-192344-413-59102e-codex-gpt-5-4-pack-a-samsung-clean-rerun`
- Accepted official AOSP green-proof rerun:
  - `android-version-20260419-193626-487-20bb58-codex-gpt-5-4-pack-a-aosp-clean-rerun`

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
- Phase 5 reran the branch-local install and list checks before the live-device
  proof and before the anchor-scenario discovery pass. Both packaged skills
  still resolved correctly from the installed local authoring-skills registry.

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
- Phase 5 benchmark-hardening proof did produce one local sandbox replay skill
  on the AOSP emulator after the official rerun exposed scaffold-authoring
  drift:
  - skill id: `com.android.settings.read-android-version-aosp-replay`
  - `skills validate` passed
  - `skills run` emitted `CLAWPERATOR_EVAL_ANSWER: 15`
  - `skills run` emitted one terminal `[Clawperator-Skill-Result]` frame that
    parsed successfully
- The temporary AOSP sandbox skill and the matching temporary Samsung scaffold
  were removed from the local runtime registry before stopping, so a later
  official rerun will still hit the truthful no-match discovery route first.
- The accepted official Samsung green-proof rerun emitted a target-specific
  replay skill for the Samsung route:
  - skill id: `com.android.settings.read-android-version-samsung-replay`
  - eval outcome: `pass`
  - normalized answer: `16`
  - `skill_score.skill_emitted = true`
  - `skill_score.skill_valid = true`
  - `skill_score.replay_status = "pass"`
  - `skill_score.replay_answer_correct = true`
- The accepted official AOSP green-proof rerun emitted a target-specific replay
  skill for the AOSP route:
  - skill id: `com.android.settings.read-android-version-aosp-replay`
  - eval outcome: `pass`
  - normalized answer: `15`
  - `skill_score.skill_emitted = true`
  - `skill_score.skill_valid = true`
  - `skill_score.replay_status = "pass"`
  - `skill_score.replay_answer_correct = true`
- The clean official AOSP rerun also produced a valid script-sourced
  `SkillResult` during its required self-test with terminal verification
  `verified` and observed answer `15`.

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
- After the Samsung device was unlocked again, `dumpsys window policy`
  confirmed the blocker was cleared:
  - `showing=false`
  - `mInputRestricted=false`
- The resumed Samsung and AOSP green-proof runs exposed two truthful
  benchmark-path defects rather than product-surface regressions:
  - `prompt-skill.md` embedded `${routeNote}`-style strings that Python
    `Template.substitute` interpreted as missing placeholders
  - replay scoring passed a multi-part `CLAWPERATOR_BIN` string to nested
    `skills run`, which failed with `spawnSync ... ENOENT`
- The AOSP proving route also confirmed a real UI variant worth preserving:
  after reopen, the emulator could resume directly into the active Settings
  search surface, so treating the `click --text "Search settings"` step as
  allowable failure remained the truthful replay shape.
- The anchor-scenario discovery-only run proved the discovery skill does not
  over-author or cross the mutation boundary when intent is underspecified.
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
- The first official Phase 5 AOSP green-proof rerun did not fail on the
  discovery route or on Settings navigation. It stalled after `skills new`
  while the eval agent inspected scaffold files instead of writing the replay
  implementation and self-test.
- The first resumed Samsung rerun after the device was unlocked failed before
  replay scoring because Python `Template.substitute` treated
  `${routeNote}`-style prompt text as an unresolved placeholder and raised
  `KeyError: 'routeNote'`.
- The next resumed Samsung run reached skill emission but replay scoring failed
  because nested replay execution treated the full string
  `node .../apps/node/dist/cli/index.js` as a single executable path and
  returned `spawnSync ... ENOENT`.
- The first resumed Samsung rerun after those code repairs was not accepted
  because a previously installed local Samsung replay skill polluted the
  benchmark's required no-match discovery route.
- The Samsung physical-device blocker from earlier in Phase 5 was real, but it
  was later cleared by unlocking the device outside the pack workflow.

## Fixes attempted

- Created and switched to the requested local branch:
  `skills/agent-assisted-skill-drafting`.
- Rebuilt the debug APK with `./gradlew :app:assembleDebug`.
- Reinstalled the matching debug operator to the emulator with the branch-local
  CLI via `operator setup`.
- Reran the exact Pack A canary command after the local-dev runtime was aligned.
- Repaired Phase 5 benchmark defects that the first official green-proof runs
  exposed:
  - `evals/run_eval.py` now honors the Pack A Android timeout and turn budget
    from `spec.json` when the CLI does not override them explicitly
  - `evals/harness/test_run_eval.py` now covers spec-default budget resolution
  - `evals/specs/android-version/prompt-skill.md` now includes the proven
    minimal replay overwrite shape, fixed AOSP / Samsung route constants, and
    stronger scaffold-repair guidance
- Validated the repaired replay pattern in a local AOSP sandbox skill run:
  - `skills validate` passed
  - `skills run` emitted the correct Android version answer `15`
  - `skills run` emitted a valid terminal `SkillResult`
- Repaired the resumed Samsung prompt-path defect by changing the replay-shape
  template in `prompt-skill.md` from `${routeNote}`-style strings to plain
  string concatenation.
- Repaired replay scoring for multi-part local CLI commands:
  - `evals/harness/replay.py` now writes an executable wrapper when
    `CLAWPERATOR_BIN` needs command plus arguments
  - `evals/harness/test_replay.py` now covers that wrapper path
- Cleaned temporary AOSP and Samsung replay skills out of the local runtime
  registry before the accepted official reruns so the benchmark would hit the
  truthful no-match route first.
- Reran the required physical-device proof after the Samsung device was
  unlocked and confirmed clean official Samsung replay pass.
- Ran the required anchor-scenario discovery-only check in a local shell agent
  context and captured the resulting JSON artifact under
  `/tmp/agent-assisted-skill-drafting-anchor-discovery.jsonl`.
- Reran the clean official AOSP proof after the replay-harness repair and
  confirmed emitted-skill, replay, and self-test success.

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
- Phase 5 is now complete.
- Phase 5 acceptance result:
  - the benchmark-hardening repairs are implemented locally and covered by
    focused replay-harness tests
  - the accepted official Samsung rerun passed on the required physical device:
    - run id:
      `android-version-20260419-192344-413-59102e-codex-gpt-5-4-pack-a-samsung-clean-rerun`
    - main eval outcome: `pass`
    - normalized Android version answer: `16`
    - emitted-skill replay outcome: `pass`
  - the accepted official AOSP rerun passed on the required emulator:
    - run id:
      `android-version-20260419-193626-487-20bb58-codex-gpt-5-4-pack-a-aosp-clean-rerun`
    - main eval outcome: `pass`
    - normalized Android version answer: `15`
    - emitted-skill replay outcome: `pass`
  - the anchor-scenario discovery-only run also passed its intended boundary
    check by choosing `escalate_to_human` instead of over-authoring or
    mutating account state
  - `plan.md` and `work-breakdown.md` now reflect live pack status:
    completed phases `1, 2, 3, 4, 5`, current / next `Done`

## Deferred follow-up

- Post-acceptance review hardening completed locally on 2026-04-19:
  - the review note claiming Samsung proof was still missing was stale by this
    point because commit `1db2cb8` had already recorded the accepted Samsung
    and AOSP reruns
  - `evals/harness/runner.py` now enforces the Pack A route fields during
    skill scoring:
    - `required_authoring_front_door`
    - `required_proving_handoff`
    - transcript evidence for `clawperator authoring-skills list --json`
  - the saved `skill_score` now records:
    - `route_requirements_met`
    - `route_requirement_errors`
    - `skill_generation_passed`
    so a direct bypass of `skill-author-by-agent-discovery` no longer counts as
    a green Pack A skill-generation result
  - `sites/landing/public/install.sh` now advertises
    `skill-author-by-agent-discovery` only when it is actually installed on the
    host and falls back to repair guidance when the packaged front doors are
    incomplete
  - `validation/install/test_authoring_skills.sh`,
    `validation/install/test_main.sh`, and the aggregate
    `validation/install/test_install.sh` now cover:
    - both packaged authoring skills
    - the discovery-first no-match guidance
    - the partial-install fallback when the discovery front door is missing
  - validation run for this follow-up:
    - `uv run --project evals --extra dev pytest evals/harness/test_run_eval.py -q`
    - `uv run --project evals --extra dev pytest evals/harness/test_rescore.py -q`
    - `./validation/install/test_authoring_skills.sh`
    - `./validation/install/test_main.sh`
    - `./validation/install/test_install.sh`
    - `./gradlew app:assembleDebug app:testDebugUnitTest`
    - `git diff --check`
- Post-acceptance review hardening completed locally on 2026-04-20:
  - Pack A route checks now change the top-level eval result instead of staying
    advisory inside `skill_score`
  - `evals/harness/runner.py` no longer treats free-text narration or echoed
    docs as route proof:
    - `clawperator authoring-skills list --json` must be present as structured
      `command_execution` evidence
    - the discovery-front-door proof must come from the structured fenced JSON
      discovery artifact
    - the proving handoff must come from structured artifact fields such as
      `recommended_next_step = "proceed_to_recording"` and
      `handoff_target = "skill-author-by-recording"`
  - rescore and replay paths now reapply the same Pack A route contract so a
    green answer alone cannot silently restore a false-green eval outcome
  - validation run for this follow-up:
    - `uv run --project evals --extra dev pytest evals/harness/test_run_eval.py -q`
    - `uv run --project evals --extra dev pytest evals/harness/test_rescore.py -q`
    - `uv run --project evals --extra dev pytest evals/harness -q`
    - `npm --prefix apps/node run build`
    - `npm --prefix apps/node run test`
    - `./gradlew app:assembleDebug app:testDebugUnitTest`
    - `git diff --check`
- Post-acceptance route-contract hardening completed locally on 2026-04-20:
  - `evals/harness/runner.py` now treats copied or hand-authored discovery JSON
    as insufficient proof unless it matches the structured transcript evidence
  - the Pack A scorer now requires:
    - one structured runtime-skill discovery command in JSON mode before the
      authoring front door
    - one structured `authoring-skills list` command in JSON mode
    - exactly one structured discovery artifact after the authoring-skill
      listing
    - discovery-artifact registry provenance that cites the same runtime and
      authoring registry commands the transcript actually executed
    - route-specific artifact validation for:
      `target_app_package.package_id`, app label, sub-route observation,
      `skill_classification`, `route_confidence`, `mutation_risk`,
      `evidence_collected`, and `discovery_budget_used`
  - new regressions cover:
    - copied registry evidence
    - wrong target package metadata
    - missing `skill_classification`
    - runtime discovery after authoring instead of before
  - validation run for this follow-up:
    - `python -m py_compile evals/harness/runner.py evals/harness/test_run_eval.py evals/run_eval.py evals/harness/test_rescore.py`
    - `uv run --project evals --extra dev pytest evals/harness/test_run_eval.py -q`
    - `uv run --project evals --extra dev pytest evals/harness/test_rescore.py -q`
    - `uv run --project evals --extra dev pytest evals/harness -q`
- No blocker remains for this pack.
- Optional follow-up after review:
  - clean up this task pack with `tasks/skills/task-cleanup/` once the branch
    work is accepted and any durable follow-up has been migrated
