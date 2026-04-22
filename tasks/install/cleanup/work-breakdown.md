# install.sh Cleanup and CLI Migration Work Breakdown

Parent plan: `tasks/install/cleanup/plan.md`

## Executive Summary

4 PRs, 5 phases. **PR-1** contains Phase 1 and Phase 2 for the new
host-artifact CLI surface plus installer delegation. **PR-2** contains Phase 3
for operator APK download and checksum migration. **PR-3** contains Phase 4
for doctor-driven remediation and multi-device policy migration. **PR-4**
contains Phase 5 for final installer thinning, docs, validation realignment,
and `clawperator-upgrade` follow-through.

This task is currently in planning. No phase should begin out of order because
later phases depend on earlier CLI surfaces being real and merged.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 4 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do not start PR-2 until PR-1 is merged.
- Do not start PR-3 until PR-2 is merged.
- Do not start PR-4 until PR-3 is merged.
- Treat `tasks/install/cleanup/findings.md` as authoritative input. Do not
  rewrite existing sections. If implementation contradicts it, append a dated
  `## Execution Notes` section before the phase commit.
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
| `tasks/install/cleanup/plan.md` | Stable contract, sequencing, and scope boundaries |
| `tasks/install/cleanup/findings.md` | Authoritative migration rationale and end-state decisions |
| `sites/landing/public/install.sh` | Current installer behavior and the shell logic being thinned |
| `validation/install/README.md` | Install validation maintenance rule and existing harness ownership |
| `apps/node/src/cli/registry.ts` | Existing CLI command structure and help-surface conventions |
| `apps/node/src/cli/commands/doctor.ts` | Current `doctor` command surface and `--fix` behavior |
| `apps/node/src/domain/doctor/DoctorService.ts` | Current doctor policy and autofix machinery |
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
| PR-1 | Create CLI-owned host artifact materialization and remove shell heredoc writers | 1, 2 | thinking, default | none |
| PR-2 | Move operator APK metadata, download, and checksum verification into the CLI | 3 | default | PR-1 merged |
| PR-3 | Move doctor-driven remediation and multi-device install policy into the CLI | 4 | thinking | PR-2 merged |
| PR-4 | Final installer thinning, docs, validation cleanup, and upgrade-skill follow-through | 5 | default | PR-3 merged |

## Phase 1: Host Artifact CLI Surface

### Agent Tier

thinking

### Goal

Create a CLI-owned host-artifact surface that can materialize the durable
install outputs currently written by large embedded Node snippets in
`install.sh`.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- new or existing `apps/node/src/cli/commands/` file for host-artifact work
- any justified helper under `apps/node/src/domain/`
- `apps/node/src/test/` coverage for the new command surface

### Steps

1. Add a new CLI surface for host-artifact materialization. A grouped command
   such as `clawperator host materialize-artifacts` is the preferred shape
   unless the existing CLI structure proves another naming is cleaner.
2. Move the artifact generation logic for all of the following into TypeScript:
   - install state
   - MCP config snippet
   - local `~/.clawperator/AGENTS.md`
   - shared-agent bridge update
3. Keep the output structured. The new CLI surface must support JSON output and
   report which artifacts were written, updated, skipped, or failed.
4. Preserve the current artifact semantics unless the findings already call for
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

- a CLI-owned host-artifact surface exists and can write all four artifact
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
   the CLI host-artifact surface added in Phase 1.
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

## Phase 3: Operator APK Download and Verification

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
   - metadata fetch
   - metadata parse
   - APK download
   - checksum acquisition
   - checksum verification
2. Return a structured result with at minimum:
   - local APK path
   - operator version
   - checksum or verification status
   - any package-flavor or operator-package compatibility data needed by the
     installer
3. Replace the shell-side metadata parsing and checksum flow in `install.sh`
   with the CLI surface from step 1.
4. Add tests in the same phase. Required cases:
   - valid metadata with inline checksum
   - valid metadata with external checksum file
   - missing required metadata fields
   - malformed metadata
   - checksum mismatch
   - installer path delegates to the CLI rather than parsing JSON in shell
5. Keep manual recovery text truthful if the new CLI surface fails. Do not
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

### Files or Surfaces To Change

- `apps/node/src/cli/commands/doctor.ts` or a new install-oriented command
- `apps/node/src/domain/doctor/DoctorService.ts`
- any justified helper under `apps/node/src/domain/doctor/` or
  `apps/node/src/domain/device/`
- `sites/landing/public/install.sh`
- `apps/node/src/test/` coverage
- `validation/install/test_main.sh`
- `validation/install/test_multidevice.sh`
- `validation/install/test_install.sh`

### Steps

1. Expand `doctor --fix` or add a new install-oriented CLI surface that owns:
   - single-device remediation decisions
   - multi-device target collection
   - APK setup targeting
   - permission re-grant recovery
   - structured per-device and overall install summary output
2. Treat the new CLI result as authoritative. Do not re-derive policy from raw
   `doctor --json` output in shell once this phase lands.
3. Remove shell-side policy helpers from `install.sh` that exist only to
   interpret doctor JSON and multi-device readiness.
4. Add tests in the same phase. Required cases:
   - no connected device
   - single device needing APK remediation
   - multiple devices with mixed ready, warn, stale, and shell-unavailable
     states
   - permission re-grant recovery when handshake fails after setup
   - stable structured summary output from the CLI-owned remediation surface
5. Keep the installer summary truthful by rendering the CLI result, not by
   rebuilding the state machine in shell.
6. Replace shell-harness assumptions in `validation/install/` as the behavior
   moves. Do not leave tests asserting removed shell internals.

### Acceptance Criteria

- the CLI owns remediation policy and multi-device install logic
- `install.sh` no longer parses internal doctor check ids to make product
  decisions
- replacement tests prove the migrated behavior in the same phase

Human review checklist:

- one policy engine exists after this phase, not two
- multi-device behavior is still explicit and reviewable
- summary output is derived from CLI results rather than shell re-interpretation

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commit

```text
feat(node): move installer remediation into the CLI
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
   Preferred outcome: remove default RC mutation entirely. If a hard repo
   constraint forces retention, make it explicit opt-in only and document the
   rule clearly.
2. Update the installer summary and install docs so they describe the new
   ownership split truthfully:
   - shell bootstrap first
   - CLI-owned post-bootstrap install behavior
   - durable artifacts and remediation surfaces
3. Use `.agents/skills/docs-author/SKILL.md` for authored docs updates.
4. Update `clawperator-upgrade/SKILL.md` so the normal upgrade path is:
   1. check CLI reachability
   2. if reachable, run the CLI-first upgrade sequence
   3. if not reachable, fall back to `curl -fsSL https://clawperator.com/install.sh | bash`
5. Update `clawperator-upgrade/agents/openai.yaml` in the same phase so its
   prompt metadata matches the new `SKILL.md` workflow.
6. Update validation docs and harness ownership text so they describe the new
   split between shell bootstrap coverage and CLI coverage.
7. Add or update tests in the same phase. Required cases:
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
