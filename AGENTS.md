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
- Treat optional API strings carefully:
  - use explicit `undefined` checks when `""` and omitted mean different things
  - do not use truthy/falsy checks like `value || fallback` on contract fields such as file paths
  - reject blank strings at validation boundaries when they are not valid values
- If Node performs a pre-flight or fallback outside the Android runtime, only normalize the result to success when that pre-flight or fallback actually succeeded.
- CLI parsing changes must preserve both the structured JSON contract and the exit-code contract. Test valid, invalid, and missing-value cases for any new flag.

## Key Docs
- `docs/node-api-for-agents.md` - API contract, CLI reference, error codes
- `docs/first-time-setup.md` - Device setup and APK installation
- `docs/architecture.md` - System design
- `docs/troubleshooting.md` - Common issues
- `docs/design/` - Internal design documents

## Public Sites
- Clawperator has two public website surfaces with different build systems and purposes:
  - `sites/landing/` - Next.js static landing site for `https://clawperator.com`
  - `sites/docs/` - MkDocs documentation site for `https://docs.clawperator.com`
- Do not confuse the landing site with the docs site when making website changes:
  - marketing homepage, install entrypoints, and root-level files for `clawperator.com` belong in `sites/landing/`
  - technical docs content for `docs.clawperator.com` belongs in `docs/`, `apps/node/src/`, `../clawperator-skills/docs/`, and is published through `sites/docs/`
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
- Repo-specific Codex skills live in `.agents/skills/` in this repository.
- Current project-local skill:
  - `.agents/skills/docs-generate/` - regenerates `sites/docs/docs/` from `docs/`, `apps/node`, and `../clawperator-skills/docs` using `sites/docs/source-map.yaml`
- Clawperator runtime and Node API execute plans/actions; skill logic, recipes, and app-specific wrappers live in `../clawperator-skills`.
- Keep the distinction clear:
  - `../clawperator-skills` contains runtime/user-facing skills consumed by Clawperator
  - `.agents/skills/` contains repository-local Codex workflows for maintaining this repo
- When changing contracts that affect skills (action shapes, envelope fields, CLI behavior), bump skill version, update both repos in lockstep and re-run skills smoke checks.
- When validating a skill, do not stop at process exit code. Verify the skill's documented inputs, emitted output markers, screenshot/text artifacts, and runtime behavior against the current Clawperator validator and runtime contract.

## Documentation Discipline

`sites/docs/docs/` is generated output produced by the `docs-generate` skill. Never edit it directly - changes will be overwritten on the next run.

If your diff touches `sites/docs/docs/` before you have updated a canonical
source file in `docs/`, `apps/node/src/`, or `../clawperator-skills/docs/`,
stop and fix the source first. Generated docs are an output artifact, not an
authored surface.

`sites/docs/site/` is deployable MkDocs build output. Do not hand-edit it either, except as a temporary local build artifact. Source-controlled docs-site root files live in `sites/docs/static/` and are copied into `sites/docs/site/` by `./scripts/docs_build.sh`.

Items under `tasks/` should be treated as temporary working notes, not durable documentation. It is fine during iterative development to capture in-progress findings, plans, or draft documentation in `tasks/`, but before opening a PR we typically delete that task entry. By that point, any durable knowledge must have been migrated into its proper long-term home in `docs/`, `apps/node/src/`, or `../clawperator-skills/docs/` as appropriate.

**Exception — multi-phase project files:** When a task file covers a sequenced series of PRs (e.g. PR-1 through PR-7), do not delete completed task entries between phases. Keep them in place, marked `[DONE]`, until the final PR in the project ships. An agent working on a later phase benefits from reading the full history: dependency rationale, implementation choices made in earlier phases, and acceptance criteria that later tasks reference. Delete the whole file only when all phases are complete.

Do not rely on `tasks/` as the final home for agent-facing behavior notes, API caveats, validation expectations, or operational guidance. If an agent would need the information after the task folder is deleted, it belongs in the real docs.

If you find an error in a generated page, check `sites/docs/source-map.yaml` to find the source file, fix it there, then re-run the skill to regenerate. Source locations:
- Content errors: `docs/` or `../clawperator-skills/docs/`
- CLI/API reference errors: `apps/node/src/`

Commit the source fix and the regenerated output together.

If a change affects a public API, CLI command, error code, execution contract, setup flow, or user-visible runtime behavior, update the relevant authored docs in the same change. This usually includes `docs/node-api-for-agents.md`, `docs/first-time-setup.md`, `docs/troubleshooting.md`, and any other affected source doc, then regenerate `sites/docs/docs/` so the public docs stay aligned with the shipped behavior.

When docs need regeneration, use the repo docs-generation workflow rather than hand-editing generated pages. The project-local skill is `.agents/skills/docs-generate/`, and the public docs site build can be validated with `./scripts/docs_build.sh`.

Before treating generated docs changes as valid, run the repo-local
`.agents/skills/docs-validate/` skill. It fails when `sites/docs/docs/`
changes without a corresponding canonical source change.

Documentation updates should be considered part of the feature or bug-fix work, not optional follow-up. At minimum, agents should update:
- `docs/node-api-for-agents.md` for API shape, contract, error code, result-envelope, or agent-behavior changes
- `docs/first-time-setup.md` for setup/install/device-prep changes
- `docs/troubleshooting.md` for new failure modes, recovery guidance, or recurring operator issues
- `docs/design/` when internal design guidance, engineering expectations, or skill-authoring guidance changed in a durable way
- `../clawperator-skills/docs/` and skill-local `SKILL.md` files when skill behavior, usage, or outputs changed

Docs must not over-promise behavior. When code, validators, scripts, and docs disagree, fix the implementation or narrow the docs so they accurately describe the current shipped behavior. Do not document aspirational or partially implemented behavior as if it already exists.

Delete stale documentation instead of preserving it as historical context unless it is still an active source of truth. Completed task files, superseded roadmaps, and obsolete release checklists should be removed once their remaining actionable content is migrated elsewhere.

Clawperator is still pre-alpha. Documentation should focus on accurately describing the current behavior and current state of the project, not maintaining development history, previous versions, superseded behavior, or change logs unless a document is explicitly meant for release/version management. Prefer deleting or rewriting stale material over documenting how the system used to work.

When removing a source doc, also remove its docs-site references and generated output:
- `sites/docs/source-map.yaml`
- `sites/docs/mkdocs.yml`
- `sites/docs/docs/` pages that would otherwise become dead links

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

3. **Always use `--device-id` when multiple devices are connected:**
   ```bash
   clawperator observe snapshot --device-id <device_serial>
   clawperator skills run <skill_id> --device-id <device_serial>
   ```

4. **Do not assume device availability:** The presence of `emulator-5554` does not mean a physical device is unavailable. Check `clawperator devices` output and explicitly select the appropriate device for the test scenario.

5. **Both device types are valid production targets:** Emulators with Google Play can be fully configured with user credentials and provide a complete automation environment. Physical devices offer OEM-specific behaviors and hardware sensors. Choose based on the testing scenario, not assumptions about capability.

### Accessibility Instrumentation Notes

- Do not assume adb-driven navigation or text entry reproduces the same accessibility events as real user input. For instrumentation work that depends on `TYPE_VIEW_TEXT_CHANGED`, `TYPE_VIEW_SCROLLED`, back-key delivery, or click timing, verify that the target app and input path actually emit those events before treating the scenario as valid.
- If the primary target app does not emit the required accessibility events under the available input method, use a substitute app or screen that exercises the same event category and document the substitution plus the reason. Valid measurements are better than forcing the nominal app path when the runtime does not expose the needed signals.
- For AccessibilityService measurement work, log both the per-event samples and the caveats discovered during collection. Missing event categories are a measurement result, not something to silently smooth over.
- From the repo root, the Android Gradle app module tasks are exposed as `app:*` tasks such as `./gradlew app:assembleDebug`, `./gradlew app:testDebugUnitTest`, and `./gradlew app:installDebug`. Prefer those working forms over guessing deeper module paths.

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
