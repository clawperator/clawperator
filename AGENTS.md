# Repository Guidelines

## Mission
Clawperator is a deterministic Android operator runtime for LLM agents.

Core intent:
- execute validated UI actions reliably on Android
- expose strong observability for agents (`snapshot_ui`, structured terminal results)
- remain simple and predictable as an execution substrate

Clawperator is not an autonomous planner. Agent reasoning stays outside this runtime.

## Operating Model (Two-Handed)
Use Clawperator as one half of a system:
1. Clawperator executes Android actions and emits structured outcomes.
2. The agent interprets outcomes and decides what to do next.

Design consequence:
- prioritize deterministic command execution and diagnostics over hidden heuristics
- avoid embedding app-specific strategy in core runtime paths

## Runtime Contracts
- Canonical terminal envelope is required: `[Clawperator-Result]`.
- Node API should remain strict and contract-driven.
- Per-command correlation IDs (`commandId`, `taskId`) must remain stable end-to-end.
- Keep receiver package and action identifiers consistent with current defaults (`com.clawperator.operator*` / `app.clawperator.operator*`).

## Source of Truth Docs
- `docs/project-overview.md`
- `docs/operator-llm-playbook.md`
- `docs/node-api-design.md`
- `docs/node-api-for-agents.md`
- `docs/node-api-alpha-release-checklist.md`

## Skills
- Skills are maintained in a dedicated repository: [github.com/clawpilled/clawperator-skills](https://github.com/clawpilled/clawperator-skills).
- Typical local layout is sibling repos:
  - `../clawperator` (this repo)
  - `../clawperator-skills` (skills repo)
- Clawperator runtime and Node API execute plans/actions; skill logic, recipes, and app-specific wrappers live in `../clawperator-skills`.
- When changing contracts that affect skills (action shapes, envelope fields, CLI behavior), bump skill version, update both repos in lockstep and re-run skills smoke checks.

## Required Iteration Loop
For non-trivial changes, do all steps before commit:
1. Make focused changes.
2. Compile Android: `./gradlew :app:assembleDebug`
3. Run Android unit tests: `./gradlew testDebugUnitTest` (or `./gradlew unitTest`)
4. Build/test Node API: `npm --prefix apps/node run build && npm --prefix apps/node run test`
5. Install and launch on device:
   - `./gradlew :app:installDebug`
   - `adb shell am start -n <applicationId>/<mainActivity>`
6. Run smoke/verification scripts relevant to your change.
7. Commit only after failures are resolved.

## Validation Commands
- Permissions/bootstrap: `./scripts/clawperator_grant_android_permissions.sh`
- Receiver ingress check: `./scripts/clawperator_validate_receiver.sh`
- Core smoke: `./scripts/clawperator_smoke_core.sh`
- Skills smoke: `./scripts/clawperator_smoke_skills.sh`
- Canonical integration check (opt-in): `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_integration_canonical.sh`
- Formatting/quality: `./scripts/apply_coding_standards.sh -f`

## Security and Privacy Guardrails
- Do not hardcode personal names, device identifiers, or local machine paths.
- Use placeholders in examples:
  - `<device_id>`, `<device_serial>`, `<person_name>`, `<local_user>`
- If local blocked-terms policy is enabled, keep it in sibling config dir:
  - `../.clawcave/blocked-terms.txt`
- Before release or force-push events, run a blocked-term scan and verify clean history.

## Coding and Commit Conventions
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Keep commits narrow and reviewable.
- Prefer explicit contracts and deterministic behavior over convenience shortcuts.
- When making breaking contract changes, include migration notes in commit message and docs.

## Near-Term Engineering Priorities
- Keep Android and Node contracts aligned and minimal.
- Continue strengthening real-device smoke coverage and deterministic diagnostics.
- Improve docs and onboarding so first-time agents can run end-to-end quickly.
