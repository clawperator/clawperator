# install.sh Cleanup and CLI Migration Work Breakdown

Parent plan: `tasks/install/cleanup/plan.md`

## Executive Summary

4 PRs, 6 phases. **PR-1** contains Phase 1, Phase 2, and Phase 2.5 for the new
host setup CLI surface, installer delegation, and the final naming refactor.
**PR-2** contains Phase 3 for operator APK download and checksum migration.
**PR-3** contains Phase 4 for doctor-driven remediation and multi-device policy
migration. **PR-4** contains Phase 5 for final installer thinning, docs,
validation realignment, and `clawperator-upgrade` follow-through.

This task is currently in progress. No phase should begin out of order because
later phases depend on earlier CLI surfaces being real and merged.

## Status

| Item | Value |
| --- | --- |
| State | in progress |
| Total PRs | 4 |
| Total phases | 6 |
| Completed | 1, 2, 2.5, 3 |
| Remaining | 4, 5 |
| Current / Next | Phase 4 |
| Blockers | none |

## Hard Rules

- Do not start PR-2 until PR-1 is merged.
- Do not start PR-3 until PR-2 is merged.
- Do not start PR-4 until PR-3 is merged.
- Treat `tasks/install/cleanup/plan.md` as the authoritative task contract. If
  implementation contradicts it, append a dated `## Execution Notes` section to
  the plan before the phase commit.
- Keep `install.sh` as the public bootstrap entrypoint. Do not replace it in
  this task.
- Do not move bootstrap prerequisite logic out of shell:
  - OS validation
  - Java provisioning
  - Node provisioning
  - adb, git, curl checks
  - initial `npm install -g clawperator@latest`
- A phase that moves behavior out of `install.sh` must add the replacement test
  coverage in the same phase and commit. Do not defer tests.
- Use the new CLI surface as the source of truth once it exists. Do not keep a
  second shell policy engine in place after migration.
- Do not edit generated docs directly. Use
  `.agents/skills/docs-author/SKILL.md` for the docs phase and validate with
  `./scripts/docs_build.sh`.
- Do not update `apps/node/bundled-skills/clawperator-upgrade` to reference
  CLI commands that do not yet exist.
- One commit per logical step. Do not batch artifact migration, APK download
  migration, remediation-policy migration, and upgrade-skill changes into one
  commit.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/install/cleanup/plan.md` | Stable contract, sequencing, naming decisions, and scope boundaries |
| `sites/landing/public/install.sh` | Current installer behavior and the shell logic being thinned |
| `validation/install/README.md` | Install validation maintenance rule and existing harness ownership |
| `apps/node/src/cli/registry.ts` | Existing CLI command structure and help-surface conventions |
| `apps/node/src/cli/commands/doctor.ts` | Current `doctor` command surface and `--fix` behavior |
| `apps/node/src/domain/doctor/DoctorService.ts` | `finalize()` lines 166-226: current autofix mechanism that runs `kind: "shell"` fix steps |
| `apps/node/src/domain/doctor/checks/readinessChecks.ts` | APK presence and handshake check fix steps - what is `kind: "shell"` today vs `kind: "manual"` |
| `apps/node/src/domain/version/compatibility.ts` | `getOperatorPackageApkPath()` - canonical APK path that Phase 3 download command must write to |
| `apps/node/src/cli/commands/operatorSetup.ts` | Existing operator setup contract |
| `apps/node/src/domain/device/setupOperator.ts` | Existing operator install-grant-verify domain flow |
| `apps/node/src/cli/commands/bundledSkills.ts` | Existing pattern for install-oriented CLI subcommands returning structured results |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Current installed-home registry fallback relevant to shell RC cleanup |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Current upgrade workflow that will change in Phase 5 |
| `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` | Prompt metadata that must stay aligned with the skill text |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for authored public docs in Phase 5 |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Create CLI-owned host setup surface, remove shell heredoc writers, and finalize the public naming | 1, 2, 2.5 | thinking, default, default | none |
| PR-2 | Move operator APK metadata, download, and checksum verification into the CLI | 3 | default | PR-1 merged |
| PR-3 | Move doctor-driven remediation and multi-device install policy into the CLI | 4 | thinking | PR-2 merged |
| PR-4 | Final installer thinning, docs, validation cleanup, and upgrade-skill follow-through | 5 | default | PR-3 merged |

Important: Phase 1, Phase 2, and Phase 2.5 are one PR unit. Another agent may
implement them as separate commits, but they should merge together as `PR-1`.

## Phase 1: Host Artifact CLI Surface

### Agent Tier

thinking

### Goal

Create a CLI-owned host setup surface that can materialize the durable
install outputs currently written by large embedded Node snippets in
`install.sh`.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- new or existing `apps/node/src/cli/commands/` file for host setup work
- any justified helper under `apps/node/src/domain/`
- `apps/node/src/test/` coverage for the new command surface

### Steps

1. Add a new CLI surface for host setup work. Phase 1 may land with a temporary
   name if needed, but the final public name after Phase 2.5 must be
   `clawperator host setup`.
2. Move the artifact generation logic for all of the following into TypeScript:
   - install state
   - MCP config snippet
   - local `~/.clawperator/AGENTS.md`
   - shared-agent bridge update
3. Keep the output structured. The new CLI surface must support JSON output and
   report which artifacts were written, updated, skipped, or failed.
4. Preserve the current artifact semantics unless the plan already calls for
   changing them. Do not redesign content and file shapes in this phase.
5. Add tests in the same phase. Required cases:
   - artifact command writes install-state JSON with the expected required and
     nullable fields
   - artifact command writes MCP snippet content with the expected top-level
     sections
   - artifact command writes local `AGENTS.md` content using installed runtime
     skill information when available
   - shared-agent bridge remains bounded and idempotent
   - JSON output from the command reports artifact outcomes deterministically
6. Stop after the CLI surface and tests are real. Do not modify `install.sh` in
   this phase beyond any minimal plumbing required for testability.

### Acceptance Criteria

- a CLI-owned host setup surface exists and can write all four artifact
  types
- artifact-writing logic no longer requires embedded Node heredocs for the new
  code path
- tests prove content shape and idempotent update behavior

Human review checklist:

- the new CLI surface owns real logic rather than shelling back out to
  `install.sh`
- JSON result shape is stable and usable by later installer integration
- no unrelated installer behavior changed yet

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add host artifact materialization command
```

## Phase 2: Replace Shell Artifact Writers

### Agent Tier

default

### Goal

Switch `install.sh` to call the new CLI artifact surface and remove the
embedded shell-side artifact writers.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`
- `validation/install/test_install.sh`
- `validation/install/test_agent_skills.sh`
- any other affected install harness under `validation/install/`

### Steps

1. Replace the shell-side artifact writing path in `install.sh` with a call to
   the CLI host surface added in Phase 1.
2. Remove the embedded Node heredocs and shell helper code for:
   - `write_install_state`
   - `write_mcp_config_snippet`
   - `write_agent_guide`
   - `write_shared_agent_bridge`
3. Keep the installer’s user-facing summary truthful. If artifact generation
   can now fail partially, surface the real CLI result rather than re-inventing
   summary logic in shell.
4. Replace validation coverage in the same phase. Required cases:
   - install harness proves the CLI artifact command is invoked through the
     installer path
   - artifact outputs still exist after install
   - rerun behavior remains idempotent
   - no shell-side artifact logic is still being tested as live behavior
5. Keep the install harness as the authoritative proof for `install.sh`.
   `bash -n` alone is not enough.

### Acceptance Criteria

- `install.sh` no longer owns embedded Node artifact writers
- the installer still produces the expected durable artifacts through the CLI
  path
- `validation/install/` coverage is updated in the same phase

Human review checklist:

- shell thinning is real, not a wrapper around duplicated logic
- install harnesses prove the new delegated path end to end
- no artifact behavior regressed on rerun

### Validation

```bash
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commit

```text
refactor(install): delegate host artifacts to the CLI
```

## Phase 2.5: Rename Host Surface To `host setup`

### Agent Tier

default

### Goal

Refactor the Phase 1 and Phase 2 implementation so the public CLI surface and
supporting host-domain code use the final `clawperator host setup` naming
instead of `materialize-artifacts` / `materializeArtifacts`.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/commands/` host command implementation
- `apps/node/src/domain/host/`
- `apps/node/src/test/`
- `sites/landing/public/install.sh`
- any validation fixture or harness that still calls the old command name

### Steps

1. Rename the public CLI subcommand from `clawperator host materialize-artifacts`
   to `clawperator host setup`.
2. Rename supporting implementation identifiers so the steady-state code no
   longer centers `materializeArtifacts` naming when `host setup` is the public
   contract. This includes the host-domain file and exported function names
   unless a specific compatibility reason requires an internal exception.
3. Update installer usage, help text, examples, validation fixtures, and tests
   to reference `clawperator host setup`.
4. Preserve behavior and output shape. This phase is a naming and API-shape
   refactor, not a semantics change.
5. If parser compatibility for the old subcommand is temporarily retained, do
   not document it as the primary path. The task-pack target state is that
   `host setup` is the canonical surfaced command.

### Acceptance Criteria

- `clawperator host setup` is the canonical CLI surface
- task-facing code and tests no longer treat `materialize-artifacts` as the
  primary command name
- supporting host-domain identifiers reflect the new naming
- installer and validation references use `clawperator host setup`

Human review checklist:

- the new name reads like a user-facing setup command rather than internal
  implementation machinery
- behavior did not change while the naming refactor landed
- any temporary aliasing is clearly secondary and non-canonical

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commit

```text
refactor(node): rename host artifact command to host setup
```

## Phase 3 [DONE]: Operator APK Download and Verification

### Agent Tier

default

### Goal

Move operator APK metadata parsing, download, and checksum verification into a
CLI-owned operator surface so `install.sh` no longer owns that product logic.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/commands/operatorSetup.ts` or a new operator-related
  command file if cleaner
- any justified helper under `apps/node/src/domain/`
- `sites/landing/public/install.sh`
- `apps/node/src/test/` coverage for the new command
- `validation/install/` coverage for the delegated installer path

### Steps

1. Add a CLI-owned operator artifact surface such as
   `clawperator operator download` or equivalent. It must cover:
   - metadata fetch from `APK_METADATA_URL`
     (default: `https://downloads.clawperator.com/operator/latest.json`)
   - metadata parse
   - APK download
   - checksum acquisition (inline from metadata, or separate file)
   - checksum verification
2. The command must write the APK to `getOperatorPackageApkPath(operatorPackage)`
   from `apps/node/src/domain/version/compatibility.ts`. This path is already
   canonical: the `readiness.apk.presence` fix step hardcodes it. Do not invent
   a new download path.
3. Return a structured result with at minimum:
   - `localPath` - absolute path of the written APK
   - `operatorVersion` - version string from metadata
   - `sha256` - verified checksum
   - `operatorPackage` - the resolved package name
4. Support `--operator-package <pkg>` and `--output <json|pretty>`.
   Exit non-zero if download or verification fails.
5. Replace the shell-side metadata parsing and checksum flow in `install.sh`
   with a call to the new CLI surface. The installer reads `localPath` from the
   JSON result and passes it to `clawperator operator setup`.
6. Add tests in the same phase. Required cases:
   - valid metadata with inline checksum → writes APK to canonical path, exits 0
   - valid metadata with external checksum file → same
   - missing required metadata field (`version`, `apk_url`, `sha256_url`) →
     non-zero exit, structured error
   - malformed metadata JSON → non-zero exit
   - checksum mismatch → non-zero exit with clear error
   - `--output json` emits `localPath`, `operatorVersion`, `sha256`,
     `operatorPackage` fields on success
   - installer path in shell invokes the CLI rather than parsing JSON itself
7. Keep manual recovery text truthful if the new CLI surface fails. Do not
   leave stale shell-generated instructions behind.

### Acceptance Criteria

- `install.sh` no longer parses operator metadata or verifies checksums itself
- the CLI owns operator artifact acquisition and verification
- tests cover both CLI behavior and delegated installer behavior

Human review checklist:

- operator artifact logic is reusable outside first install
- failure cases remain structured and truthful
- no shell metadata parser remains as live product behavior

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commit

```text
feat(node): add operator download and verification command
```

## Phase 4: Doctor-Driven Remediation and Multi-Device Policy

### Agent Tier

thinking

### Goal

Move doctor-driven remediation and multi-device install policy into the CLI so
`install.sh` stops parsing internal doctor check ids and maintaining its own
policy engine.

### Background: current `doctor --fix` state

Before writing any code, read `apps/node/src/domain/doctor/DoctorService.ts`
lines 166-226 and `apps/node/src/domain/doctor/checks/readinessChecks.ts`
lines 30-118.

Key facts:
- `--fix` already exists. `DoctorService.finalize()` runs `kind: "shell"` fix
  steps when `autoFix` is true; it skips `kind: "manual"` steps.
- `readiness.apk.presence` fail currently has one `kind: "shell"` step
  (`operator setup`) but the preceding APK download step is `kind: "manual"`.
  `--fix` runs the setup step but cannot download the APK without the Phase 3
  command existing first.
- `readiness.handshake` fail already has a `kind: "shell"` fix step for
  `clawperator grant-device-permissions`.
- `doctor` takes a single `--device`. Multi-device looping is not inside doctor
  today and must not be added to `doctor --fix`.

Do not re-derive this state from the code at execution time. Use it as the
established starting point.

### Multi-Device Surface Decision

**Use the settled plan decision:** Add a new `clawperator operator remediate`
command that:

1. enumerates all connected ADB devices
2. for each device needing APK setup: runs `operator download` (if needed) then
   `doctor --fix --device <id>`
3. emits a structured per-device result and overall summary

Do not extend `doctor --fix` for multi-device. `doctor` is single-device by
contract. Do not use top-level `install` for this command: `clawperator
install` is already reserved in `registry.ts` as invalid-command guidance that
points users to `operator setup`. Do not leave this choice to the implementer.

### Files or Surfaces To Change

- new file `apps/node/src/cli/commands/operatorRemediate.ts`
- `apps/node/src/cli/registry.ts` - register the new command
- `apps/node/src/domain/doctor/checks/readinessChecks.ts` - change APK
  download fix step kind
- `apps/node/src/domain/doctor/DoctorService.ts` - if any autofix plumbing
  changes are needed
- `sites/landing/public/install.sh`
- `apps/node/src/test/` coverage
- `validation/install/test_main.sh`
- `validation/install/test_multidevice.sh`
- `validation/install/test_install.sh`

### Steps

1. In `apps/node/src/domain/doctor/checks/readinessChecks.ts`, change the APK
   download fix step for `readiness.apk.presence` fail from `kind: "manual"` to
   `kind: "shell"` with value `clawperator operator download [--operator-package
   <pkg>]`. The subsequent `operator setup` step is already `kind: "shell"` and
   is correct. Do not change it.
2. Preserve the existing `readiness.handshake` shell fix step for
   `clawperator grant-device-permissions`. Do not regress or duplicate it while
   editing adjacent readiness logic.
3. Add a new `clawperator operator remediate` command:
   - enumerate connected ADB devices
   - for each device where `doctor --json --device <id>` shows APK setup or
     version compatibility fail: run `operator download` (skip if APK already
     current) then `doctor --fix --device <id>`
   - emit structured output: per-device status map and overall `ok` boolean
   - support `--operator-package <pkg>` and `--output <json|pretty>`
4. Replace the shell-side policy helpers in `install.sh` that parse doctor
   JSON and multi-device readiness with a call to `clawperator operator
   remediate`. The installer reads the structured result and renders a summary.
5. Add tests in the same phase. Required cases:

   For `readinessChecks.ts` fix step changes:
   - `readiness.apk.presence` fail fix steps now include a `kind: "shell"` download
     step before the setup step
   - `readiness.handshake` fail continues to include exactly one `kind: "shell"`
     grant step
   - `doctor --fix --device <id>` with APK absent and Phase 3 download command
     available: verifies download step runs before setup step in autofix path

   For `clawperator operator remediate`:
   - no connected device → exits 0, reports no devices
   - single device needing APK remediation → remediates, structured result
   - multiple devices with mixed ready, warn, stale, and
     `DEVICE_SHELL_UNAVAILABLE` states → correct per-device status, overall `ok`
     reflects whether any device needed and failed setup
   - permission re-grant recovery when handshake fails after setup
   - `--output json` emits stable per-device result shape

6. Keep the installer summary truthful by rendering the CLI result. Do not
   rebuild the state machine in shell.
7. Replace shell-harness assumptions in `validation/install/` as the behavior
   moves. Do not leave tests asserting removed shell internals.

### Acceptance Criteria

- `readiness.apk.presence` fail has a `kind: "shell"` download step
- `readiness.handshake` fail still has exactly one `kind: "shell"` grant step
- a new CLI-owned multi-device install remediation surface exists
- `install.sh` no longer parses internal doctor check ids to make product
  decisions
- replacement tests prove the migrated behavior in the same phase

Human review checklist:

- one policy engine exists after this phase, not two
- multi-device behavior is explicit and reviewable through the new command
- summary output is derived from CLI results rather than shell re-interpretation
- `readinessChecks.ts` fix step kinds are correct - no step was accidentally
  changed from shell to manual or vice versa

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commits

```text
fix(node): wire operator download into doctor autofix
```

```text
feat(node): add operator remediate command for multi-device setup policy
```

```text
refactor(install): delegate remediation and multi-device policy to CLI
```

## Phase 5: Final Installer Thinning, Docs, and Upgrade Skill

### Agent Tier

default

### Goal

Finish the migration by cleaning up shell RC mutation, updating authored docs,
realigning install validation, and switching `clawperator-upgrade` to a
CLI-first upgrade path with `install.sh` retained as recovery-only fallback.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`
- `validation/install/README.md`
- affected install harnesses under `validation/install/`
- authored docs in `docs/`
- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
- `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`

### Steps

1. Revisit shell RC mutation for `CLAWPERATOR_SKILLS_REGISTRY`.
   Before removing, read `docs/setup.md` and any related authored install docs.
   If they still say to set `CLAWPERATOR_SKILLS_REGISTRY`, update the docs first
   to document the installed-home fallback path
   (`~/.clawperator/skills/skills/skills-registry.json`) as the supported
   default before removing the mutation. Do not remove the RC mutation while the
   docs still tell users to set the env var.
   Preferred outcome after docs are correct: remove default RC mutation entirely.
   If a hard repo constraint forces retention, make it explicit opt-in only and
   document the rule clearly.
2. Update the installer summary and install docs so they describe the new
   ownership split truthfully:
   - shell bootstrap first
   - CLI-owned post-bootstrap install behavior
   - durable artifacts and remediation surfaces
3. Use `.agents/skills/docs-author/SKILL.md` for authored docs updates.
4. Update `clawperator-upgrade/SKILL.md` so the normal upgrade path is:
   1. check CLI reachability (`clawperator --version`)
   2. if reachable, run the full CLI upgrade sequence:
      ```
      npm install -g clawperator@latest
      clawperator operator remediate
      clawperator bundled-skills update
      clawperator skills install
      clawperator host setup
      clawperator doctor --json
      ```
   3. if not reachable (CLI missing or broken), fall back to
      `curl -fsSL https://clawperator.com/install.sh | bash` as recovery only
   Do this as one coordinated update in this phase. Do not make partial updates
   to the skill across earlier phases; partial updates risk agents mixing old
   and new guidance.
5. Remove the prohibitions in `SKILL.md` against `npm install -g clawperator@latest`,
   `clawperator bundled-skills update`, and `clawperator skills update` as
   standalone upgrades. Replace with a single prohibition: do not use any one
   command as a substitute for the full upgrade sequence above.
6. Update `clawperator-upgrade/agents/openai.yaml` `default_prompt` in the same
   commit so it matches the new `SKILL.md` workflow and references the
   CLI-reachability gate.
7. Update validation docs and harness ownership text so they describe the new
   split between shell bootstrap coverage and CLI coverage.
8. Add or update tests in the same phase. Required cases:
   - shell RC mutation no longer happens by default, or only happens when the
     explicit opt-in path is enabled
   - installer docs and validation readme no longer describe removed shell
     responsibilities as current behavior
   - bundled-skill upgrade guidance references the CLI-first path and the
     recovery-only fallback

### Acceptance Criteria

- shell RC mutation is removed or clearly opt-in only
- authored docs describe the migrated installer truthfully
- `clawperator-upgrade` is aligned with the new CLI-first upgrade path
- `agents/openai.yaml` stays aligned with the skill text in the same phase

Human review checklist:

- upgrade guidance no longer treats `install.sh` as the normal upgrade path
- docs and prompts do not reference CLI surfaces that still do not exist
- validation documentation matches the shipped ownership model

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
./scripts/docs_build.sh
```

### Expected Commits

```text
refactor(install): stop mutating shell rc for skills registry
```

```text
docs: align install and upgrade guidance with CLI-first flow
```

```text
docs(skills): update clawperator-upgrade for CLI-first upgrades
```
