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
- When testing or developing Node API/CLI changes in this repo, use the branch-local
  build from `apps/node/` and its generated artifacts, not the globally installed
  `clawperator` binary. The global install may lag behind the checked-out branch and
  silently hide new or renamed commands.
- Keep operator package and action identifiers consistent with current defaults:
  - `com.clawperator.operator` (Release)
  - `com.clawperator.operator.dev` (Local/Debug)
- For local development, prefer the `.dev` Operator APK and pass
 `--operator-package com.clawperator.operator.dev` unless you are explicitly
  validating the release variant. This keeps local CLI changes aligned with the
  debug app that is usually installed on a developer device.
- **Clawperator is an actuator:** It does not own strategy, planning, or autonomous reasoning. These live in the Agent.
- Treat optional API strings carefully:
  - use explicit `undefined` checks when `""` and omitted mean different things
  - do not use truthy/falsy checks like `value || fallback` on contract fields such as file paths
  - reject blank strings at validation boundaries when they are not valid values
- If Node performs a pre-flight or fallback outside the Android runtime, only normalize the result to success when that pre-flight or fallback actually succeeded.
- CLI parsing changes must preserve both the structured JSON contract and the exit-code contract. Test valid, invalid, and missing-value cases for any new flag.

## Key Docs
- `docs/setup.md` - Device setup and APK installation
- `docs/api/overview.md` - API contract and execution model
- `docs/api/actions.md` - Action types and parameter semantics
- `docs/api/errors.md` - Error codes and recovery patterns
- `docs/internal/design/` - Internal design documents

## How to Verify Against Code
For every claim in the documentation, there must be a code path that confirms it.
- CLI command names and flags: read `apps/node/src/cli/registry.ts`
- Selector flags and behavior: read `apps/node/src/cli/selectorFlags.ts` and `apps/node/src/contracts/selectors.ts`
- Action types and parameters: read `apps/node/src/contracts/execution.ts`
- Error codes and meanings: read `apps/node/src/contracts/errors.ts`
- Result envelope shape: read `apps/node/src/contracts/result.ts`
- Doctor checks: read `apps/node/src/domain/doctor/checks/`
- Serve command: read `apps/node/src/cli/commands/serve.ts`

Do not write documentation from memory or from existing docs alone. Open the
code file and write the docs from what you see. If the code contradicts
existing docs, the code is correct.

## Public Sites
- Clawperator has two public website surfaces with different build systems and purposes:
  - `sites/landing/` - Next.js static landing site for `https://clawperator.com`
  - `sites/docs/` - MkDocs documentation site for `https://docs.clawperator.com`
- Do not confuse the landing site with the docs site when making website changes:
  - marketing homepage, install entrypoints, and root-level files for `clawperator.com` belong in `sites/landing/`
  - technical docs content for `docs.clawperator.com` belongs in `docs/` and `apps/node/src/`, and is published through `sites/docs/`
- Root-level machine-facing files must be updated on the correct surface:
  - `clawperator.com/robots.txt`, `llms.txt`, `sitemap.xml`, `install.sh` come from `sites/landing/public/`
  - `docs.clawperator.com/robots.txt` and `llms.txt` come from `sites/docs/static/`
- Deployment behavior:
  - both public website surfaces deploy automatically to Cloudflare after changes are merged to `main`
  - for website-only changes, source/build validation in this repo is usually sufficient before PR
  - no manual website deployment step is expected unless the automation is broken
- Build commands:
  - landing site: `./scripts/site_build.sh`
  - docs site: `./scripts/docs_build.sh`

## Skills
- Skills are distributed from the public GitHub repository at `https://github.com/clawperator/clawperator-skills`. The canonical source is in the sibling repo `../clawperator-skills`.
- Typical local layout is sibling repos:
  - `../clawperator` (this repo)
  - `../clawperator-skills` (skills repo)
- Canonical skills documentation is authored in this repo at `docs/skills/`; the skills repo provides runtime/user-facing skill packages.
- Repo-specific Codex skills live in `.agents/skills/` in this repository.
- Current project-local skill:
  - `.agents/skills/docs-generate/` - assembles `sites/docs/.build/` from `docs/`, `apps/node/src/`, and `sites/docs/source-map.yaml`
- Clawperator runtime and Node API execute plans/actions; skill logic, recipes, and app-specific wrappers live in `../clawperator-skills`.
- Keep the distinction clear:
  - `../clawperator-skills` contains runtime/user-facing skills consumed by Clawperator
  - `.agents/skills/` contains repository-local Codex workflows for maintaining this repo
- When changing contracts that affect skills (action shapes, envelope fields, CLI behavior), bump skill version, update both repos in lockstep and re-run skills smoke checks.
- When validating a skill, do not stop at process exit code. Verify the skill's documented inputs, emitted output markers, screenshot/text artifacts, and runtime behavior against the current Clawperator validator and runtime contract.

## Documentation Discipline

`sites/docs/.build/` is generated staging output produced by the `docs-generate`
skill. Never edit it directly - changes will be overwritten on the next run.

If your diff touches `sites/docs/.build/` before you have updated a canonical
source file in `docs/` or `apps/node/src/`, stop and fix the source first.
Generated staging output is an artifact, not an authored surface.

`sites/docs/site/` is deployable MkDocs build output. Do not hand-edit it either, except as a temporary local build artifact. Source-controlled docs-site root files live in `sites/docs/static/` and are copied into `sites/docs/site/` by `./scripts/docs_build.sh`.

Items under `tasks/` should be treated as temporary working notes, not durable documentation. It is fine during iterative development to capture in-progress findings, plans, or draft documentation in `tasks/`, but before opening a PR we typically delete that task entry. By that point, any durable knowledge must have been migrated into its proper long-term home in `docs/` or `apps/node/src/` as appropriate.

**Exception — multi-phase project files:** When a task file covers a sequenced series of PRs (e.g. PR-1 through PR-7), do not delete completed task entries between phases. Keep them in place, marked `[DONE]`, until the final PR in the project ships. An agent working on a later phase benefits from reading the full history: dependency rationale, implementation choices made in earlier phases, and acceptance criteria that later tasks reference. Delete the whole file only when all phases are complete.

Do not rely on `tasks/` as the final home for agent-facing behavior notes, API caveats, validation expectations, or operational guidance. If an agent would need the information after the task folder is deleted, it belongs in the real docs.

If you find an error in a generated page, check `sites/docs/source-map.yaml` to find the generator or marker source, fix it there, then re-run the skill to regenerate. Source locations:
- Content errors: `docs/`
- CLI/API reference errors: `apps/node/src/`

Commit the source fix and the regenerated output together.

If a change affects a public API, CLI command, error code, execution contract,
setup flow, or user-visible runtime behavior, update the relevant authored docs
in the same change. Then regenerate `sites/docs/.build/` and run
`./scripts/docs_build.sh` so the public docs stay aligned with the shipped
behavior.

When docs need regeneration, use the repo docs-generation workflow rather than hand-editing generated pages. The project-local skill is `.agents/skills/docs-generate/`, and the public docs site build can be validated with `./scripts/docs_build.sh`.

Before treating docs changes as valid, run `./scripts/docs_build.sh` and
confirm it succeeds end to end.

Documentation updates should be considered part of the feature or bug-fix work, not optional follow-up. At minimum, agents should update:
- `docs/` for API shape, contract, error code, result-envelope, setup/install/device-prep, troubleshooting, or other authored public docs changes
- `docs/internal/design/` when internal design guidance, engineering expectations, or skill-authoring guidance changed in a durable way

Docs must not over-promise behavior. When code, validators, scripts, and docs disagree, fix the implementation or narrow the docs so they accurately describe the current shipped behavior. Do not document aspirational or partially implemented behavior as if it already exists.

Delete stale documentation instead of preserving it as historical context unless it is still an active source of truth. Completed task files, superseded roadmaps, and obsolete release checklists should be removed once their remaining actionable content is migrated elsewhere.

Clawperator is still pre-alpha. Documentation should focus on accurately describing the current behavior and current state of the project, not maintaining development history, previous versions, superseded behavior, or change logs unless a document is explicitly meant for release/version management. Prefer deleting or rewriting stale material over documenting how the system used to work.

When removing a source doc, also remove its docs-site references and assembled
output:
- `sites/docs/source-map.yaml`
- `sites/docs/mkdocs.yml`
- any `sites/docs/.build/` pages that would otherwise become dead links

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

Testing is part of the default definition of done. Agents should assume they are expected to run unit/integration validation for the areas they touched, and when the change affects real device behavior they should also verify on a physical device or emulator when appropriate. Do not rely solely on static inspection for changes involving gestures, accessibility, app navigation, screenshots, snapshots, skills, or device/runtime contracts if a runnable verification path exists.

Tests and smoke scripts should prove the intended behavior, not just exercise code paths. Be alert for false-confidence checks, especially around scrolling, container selection, snapshot extraction, screenshots, and skill wrappers that can succeed while validating the wrong thing.

When Node tests execute built `dist/` artifacts, run build before test and avoid parallel build/test runs that could leave tests exercising stale compiled output.

For CLI option work, add regression coverage for:
- valid values
- invalid values
- missing values
- global vs command-local placement when both forms exist
- exit code and structured JSON output

For runtime behavior changes, prefer reproducing a real user-visible scenario on a physical device or emulator before declaring the change safe. If live testing finds a bug, add a focused regression test for that exact failure mode.

### Device Selection

When multiple devices are connected (physical + emulator), be explicit about which device to target:

1. **Check connected devices first:**
   ```bash
   clawperator devices
   # or
   adb devices
   ```

2. **Default to physical device when both exist:** If both a physical device and emulator are connected, prefer the physical device for skill testing unless there's a specific reason to use the emulator. This avoids accidentally testing on the wrong target.

3. **Prefer the debug Operator APK for local CLI/API work:** When validating branch-local
   recording, docs, or command-surface changes, use the `.dev` variant and
   `--operator-package com.clawperator.operator.dev` unless the change is specifically
   about the release build. This reduces false negatives caused by a stale release APK
   or a mismatched global CLI install.

4. **Always use `--device` when multiple devices are connected** (accepted alias: `--device-id`):
   ```bash
   clawperator snapshot --device <device_serial>
   clawperator skills run <skill_id> --device <device_serial>
   ```

5. **Do not assume device availability:** The presence of `emulator-5554` does not mean a physical device is unavailable. Check `clawperator devices` output and explicitly select the appropriate device for the test scenario.

6. **Both device types are valid production targets:** Emulators with Google Play can be fully configured with user credentials and provide a complete automation environment. Physical devices offer OEM-specific behaviors and hardware sensors. Choose based on the testing scenario, not assumptions about capability.

### Accessibility Instrumentation Notes

- Do not assume adb-driven navigation or text entry reproduces the same accessibility events as real user input. For instrumentation work that depends on `TYPE_VIEW_TEXT_CHANGED`, `TYPE_VIEW_SCROLLED`, back-key delivery, or click timing, verify that the target app and input path actually emit those events before treating the scenario as valid.
- If the primary target app does not emit the required accessibility events under the available input method, use a substitute app or screen that exercises the same event category and document the substitution and the reason. Valid measurements are better than forcing the nominal app path when the runtime does not expose the needed signals.
- For AccessibilityService measurement work, log both the per-event samples and the caveats discovered during collection. Missing event categories are a measurement result, not something to silently smooth over.

## Validation Commands
- From the repo root, the Android Gradle app module tasks are typically invoked as `app:*` tasks such as `./gradlew app:assembleDebug`, `./gradlew app:testDebugUnitTest`, and `./gradlew app:installDebug`. Prefer the working task names already used in this file over guessing deeper module paths from the directory layout.
- Permissions/bootstrap: `./scripts/clawperator_grant_android_permissions.sh`
- Operator ingress check: `./scripts/clawperator_validate_operator_ingress.sh`
- Core smoke: `./scripts/clawperator_smoke_core.sh`
- Skills smoke: `./scripts/clawperator_smoke_skills.sh`
- Canonical integration check (opt-in): `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_integration_canonical.sh`
- Formatting/quality: `./scripts/apply_coding_standards.sh -f`

## Security and Privacy Guardrails
- Do not hardcode personal names, device identifiers, or local machine paths.
- Use placeholders in examples:
  - `<device_id>`, `<device_serial>`, `<person_name>`, `<local_user>`
- Never shorten `Clawperator` to `Claw` in code, docs, comments, or commit messages. `Claw` is reserved for OpenClaw or OpenClaw-like agents and is not an acceptable shorthand for this project.
- If local blocked-terms policy is enabled, keep it in the user-scoped config dir:
  - `~/.clawperator/blocked-terms.txt`
- Before release or force-push events, run a blocked-term scan and verify clean history.

## Coding and Commit Conventions
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Keep commits narrow and reviewable.
- Prefer adding new incremental commits when working in branches rather than amending previous commits. This is easier for users to track at a glance. PRs are ultimately squashed and merged, so incremental commit history is not a negative.
- Prefer explicit contracts and deterministic behavior over convenience shortcuts.
- When making breaking contract changes, include migration notes in commit message and docs.
- Agents should create commits proactively as work reaches a natural breakpoint, not only at the very end. A natural breakpoint usually means one coherent fix, one verified documentation pass, one validation repair, or one reviewable sub-task. Default to committing progress with a conventional commit message once that unit is working and validated.

When reviewing or extending an existing branch, verify branch claims against the actual code and runtime rather than assuming previous notes, task files, or commit messages are correct.

## Git and Push Discipline
- **Branch Pushing:** Agents may push to feature branches or any branch that has already been pushed to the remote, but only when the user or the active workflow explicitly calls for a push or remote sync. Do not treat branch pushes as the default. Follow the commit-before-review rule first.
- **Main Branch Protection:** NEVER push directly to the `main` branch without explicit user permission. Changes should typically be merged into `main` via pull requests using the `pr-autoloop` or `pr-squash-merge` skills.
- **Commit Before Review:** When an agent finishes a logical unit of work and is waiting for user review or the next instruction, it should create a local commit for that work. Keep those commits narrow, reviewable, and in conventional-commit format. By default, stop after committing and do not push unless the user asks or the active workflow explicitly calls for it.

## Documentation Style
- **No em dashes:** Never use em dashes (`-`). Use a regular dash or hyphen (`-`) instead for clarity and consistency.
- Use clean, monospace-friendly formatting for all markdown files.
