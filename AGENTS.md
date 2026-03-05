# Repository Guidelines

## Mission
Clawperator is a deterministic actuator tool for device automation, primarily targeting Android. It acts as the "hand" for an LLM "brain," allowing it to automate device control and perform actions on behalf of a user using a dedicated **"burner" device**.

This setup ensures that any cheap or old Android device can be used as a reliable actuator, regardless of the user's primary phone choice (e.g., iOS).

Core intent:
- provide a stable Node-based interface for LLM agents
- execute validated UI actions reliably on a device target (Android)
- remain a simple and predictable execution substrate for user-on-behalf tasks

Clawperator is not an autonomous planner. Agent reasoning stays outside this runtime.

## Operating Model: Brain and Hand
Clawperator is the "hand" for an LLM "brain":
1.  **The Brain (Agent):** Interacts with the **Clawperator Node API** to reason about state and decide what to do next.
2.  **The Hand (Clawperator):** Translates Node API commands into precise device actions (currently Android) and returns structured sensory data (UI snapshots and terminal results).

Design consequence:
- prioritize deterministic command execution and diagnostics over hidden heuristics
- avoid embedding app-specific strategy in core runtime paths

## Runtime Contracts
- The **Clawperator Node API/CLI** is the canonical interface for all agent-driven interactions.
- Canonical terminal envelope is required: `[Clawperator-Result]`.
- Node API should remain strict and contract-driven.
- Per-command correlation IDs (`commandId`, `taskId`) must remain stable end-to-end.
- Keep receiver package and action identifiers consistent with current defaults:
  - `com.clawperator.operator` (Release)
  - `com.clawperator.operator.dev` (Local/Debug)
- **Clawperator is an actuator:** It does not own strategy, planning, or autonomous reasoning. These live in the Agent.

## Key Docs
- `docs/node-api-for-agents.md` - API contract, CLI reference, error codes
- `docs/first-time-setup.md` - Device setup and APK installation
- `docs/architecture.md` - System design
- `docs/troubleshooting.md` - Common issues
- `docs/design/` - Internal design documents

## Skills
- Skills are maintained in a dedicated repository: [github.com/clawpilled/clawperator-skills](https://github.com/clawpilled/clawperator-skills).
- Typical local layout is sibling repos:
  - `../clawperator` (this repo)
  - `../clawperator-skills` (skills repo)
- Repo-specific Codex skills live in `.agents/skills/` in this repository.
- Current project-local skill:
  - `.agents/skills/clawperator-generate-docs/` - regenerates `sites/docs/docs/` from `docs/`, `apps/node`, and `../clawperator-skills/docs` using `sites/docs/source-map.yaml`
- Clawperator runtime and Node API execute plans/actions; skill logic, recipes, and app-specific wrappers live in `../clawperator-skills`.
- Keep the distinction clear:
  - `../clawperator-skills` contains runtime/user-facing skills consumed by Clawperator
  - `.agents/skills/` contains repository-local Codex workflows for maintaining this repo
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

## Documentation Style
- **No em dashes:** Never use em dashes (`-`). Use a regular dash or hyphen (`-`) instead for clarity and consistency.
- Use clean, monospace-friendly formatting for all markdown files.
