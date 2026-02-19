# Repository Guidelines

## Mission
Clawperator is an Android operator runtime for LLM-driven device control.

Current product target:
- Dumb single-activity Android shell app
- Controlled externally by OpenClaw-driven commands
- Local operator execution and observability on device

Out of scope for this migration:
- Firebase/FCM remote control path
- User/account management
- Broad launcher UI/pixel rendering surfaces
- `/apps/node` implementation

## Source of Truth
- Migration plan: `docs/migrate-to-clawperator.md`
- Pivot context: `docs/migrate-to-agent-controlled.md`
- Operator recipes/guides: `docs/operator-llm-playbook.md`, `ui-trees/`

## Required Iteration Loop
Every migration slice must do all steps before commit:
1. Make focused changes.
2. Compile: `./gradlew :app:assembleDebug`
3. Run unit tests: `./gradlew testDebug` (or equivalent module task after moves)
4. Install on device: `./gradlew :app:installDebug`
5. Launch smoke: `adb shell am start -n <applicationId>/<mainActivity>`
6. Run slice-specific operator smoke checks.
7. Commit and continue.

If compile, unit tests, install, or smoke fails, fix or explicitly document baseline/inherited failure before moving on.

## Build & Test Commands
- `./gradlew :app:assembleDebug`
- `./gradlew testDebug`
- `./gradlew :app:installDebug`
- `./scripts/grant_operator_permissions.sh --package <pkg>`
- `./scripts/operator_event_log_ui.sh`

## Coding & Commit Conventions
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Keep commits small and migration-slice scoped.
- Prefer deleting full unused modules/dependency edges instead of leaving dead code.
- Run formatting/quality checks for touched code when needed:
  - `./scripts/apply_coding_standards.sh -f`

## Migration-Specific Constraints
- Remove Firebase/FCM early (first pruning slice).
- Final package/application identifier target: `com.clawperator.operator`.
- Defer Android-only flattening decision; do not force it now.
- Preserve operator control path while pruning legacy systems.
