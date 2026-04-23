# Install Compaction and Final Shell Collapse Work Breakdown

Parent plan: `tasks/install/compact/plan.md`

## Executive Summary

2 PRs, 4 phases. **PR-1** contains Phase 1 and Phase 2: remove dead
operator-download shell residue, move the remaining shared-bridge warning
semantics fully into Node, and add the CLI-owned post-bootstrap
`clawperator install` surface. **PR-2** contains Phase 3 and Phase 4: rewrite
`install.sh` to delegate to that new CLI surface, delete the remaining shell
parsers and shell state machine, shrink shell validation to bootstrap and
delegation proof, then update docs and `clawperator-upgrade`.

PR-1 is complete on the current branch. PR-2 remains next, and no phase should
begin out of order because the shell collapse in PR-2 depends on the CLI
surface introduced in PR-1.

## Status

| Item | Value |
| --- | --- |
| State | PR-1 complete, PR-2 pending |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | PR-1 / Phases 1-2 |
| Remaining | PR-2 / Phases 3-4 |
| Current / Next | Phase 3 |
| Blockers | none |

## Current Status

PR-1 is complete on the current branch.

- Phase 1 completed with:
  - removal of the dead operator-download shell path and matching shell-only test coverage
  - Node-owned host setup warning output for the shared-agent-bridge non-fatal case
- Phase 2 completed with:
  - a real top-level `clawperator install` command in `registry.ts`
  - Node-owned post-bootstrap sequencing for operator remediation, runtime skills, bundled skills, and host setup
  - focused Node coverage for success, warning, failure, and help-path behavior
- PR-1 follow-up fix completed after review:
  - `clawperator install` now rejects `--device`
  - host setup no longer suppresses normal CLI version recording when invoked from `clawperator install`

PR-1 branch commits:

- `04005da` `refactor(install): remove dead operator download shell path`
- `0ed75cb` `fix(node): own shared bridge warning semantics in host setup output`
- `714e48a` `feat(node): add post-bootstrap install command`
- `f4097e3` `fix(node): tighten install command contract`

## Hard Rules

- Treat `tasks/install/compact/recommendations.md` as the authoritative input.
  If implementation contradicts it materially, append a dated
  `## Execution Notes` section to that file before the phase commit.
- Keep bootstrap prerequisite logic in shell. Do not move OS, Java, Node, adb,
  git, curl, or npm-global-install ownership into Node in this task.
- Repurpose the existing top-level `install` tombstone in `registry.ts` into
  the real post-bootstrap install command. Do not add a second parallel public
  installer namespace.
- Do not leave post-bootstrap `node -e` JSON parsers in `install.sh` at the end
  of this task.
- Do not leave parser-helper unit tests in `validation/install/test*` once the
  parser they cover is removed.
- A phase that introduces or changes CLI behavior must add Node tests in the
  same phase and commit. Do not defer behavior proof to a later cleanup phase.
- When `install.sh` behavior changes, update the matching shell validation in
  the same phase and commit. Do not leave stale shell harnesses asserting
  removed glue behavior.
- Use `.agents/skills/docs-author/SKILL.md` for the docs phase. Do not
  hand-wave public docs updates.
- By the end of Phase 3, `install.sh` must delegate post-bootstrap work through
  `clawperator install` and should land at or below 700 lines. If that target
  cannot be met, stop and append an Execution Note before commit.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/install/compact/plan.md` | Stable contract, shell-budget target, and scope boundaries |
| `tasks/install/compact/recommendations.md` | Canonical findings and concrete recommendations this pack implements |
| `sites/landing/public/install.sh` | Current installer behavior and the shell residue being collapsed |
| `validation/install/README.md` | Current shell validation ownership and suite entrypoint |
| `validation/install/test_main.sh` | Current shell-heavy orchestration proof that should shrink materially |
| `validation/install/test_agent_skills.sh` | Current parser- and glue-heavy shell coverage, including dead operator-download tests |
| `validation/install/test_multidevice.sh` | Current parser-heavy remediation shell coverage |
| `apps/node/src/cli/registry.ts` | Existing CLI structure and the current `install` tombstone to repurpose |
| `apps/node/src/cli/registry.ts` help blocks near `clawperator-upgrade` | Existing top-level and bundled-skills help text that will become stale if the upgrade route changes |
| `apps/node/src/domain/host/hostSetup.ts` | Current non-fatal shared-agent-bridge semantics already owned in Node |
| `apps/node/src/cli/commands/operatorRemediate.ts` | Current CLI-owned remediation flow that the new install command will orchestrate |
| `apps/node/src/cli/commands/skills.ts` | Current skills-install contract and output shape |
| `apps/node/src/cli/commands/bundledSkills.ts` | Current bundled-skills contract and output shape |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Current upgrade workflow that will change after the new install surface is real |
| `docs/host-agents.md` and `docs/skills/authoring.md` | Existing authored docs that already describe the whole-product upgrade route |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for authored docs updates in Phase 4 |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Remove dead shell residue and add the CLI-owned post-bootstrap install surface | 1, 2 | default, thinking | none |
| PR-2 | Collapse the shell wrapper and align docs, validation guidance, and upgrade flow | 3, 4 | thinking, default | PR-1 merged |

Important: Phase 1 and Phase 2 are one PR unit. Phase 3 and Phase 4 are one PR
unit. Another agent may implement them as separate commits, but they should
merge together as their PR pairings above.

## Phase 1: Delete Dead Shell Residue and Trust Node Host Semantics

### Agent Tier

default

### Goal

Remove dead operator-download shell code and shrink the host-setup shell wrapper
so it trusts the Node-owned non-fatal shared-agent-bridge semantics instead of
re-detecting them in bash.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`
- `validation/install/test_agent_skills.sh`
- `apps/node/src/domain/host/hostSetup.ts`
- any adjacent Node test covering host setup or installer-facing host output

### Steps

1. Verify the dead shell path has no callers from `main()`:
   - `download_operator_apk_via_cli`
   - `parse_operator_download_result`
2. Delete that dead shell code from `install.sh`.
3. Delete the matching dead shell test helpers and scenarios from
   `test_agent_skills.sh`.
4. Move the shared-agent-bridge warning semantics fully into Node-owned host
   setup output so the shell no longer needs `ONLY_SHARED_BRIDGE_FAILURE`,
   `HOST_FAILED_COUNT`, or related shell-only policy branches.
5. Update or add Node tests proving:
   - `host setup` still exits successfully when only `sharedAgentBridge` fails
   - the CLI output distinguishes that warning case truthfully without needing
     shell re-detection
6. Keep shell edits tight in this phase. Do not start the higher-level
   `clawperator install` command yet.

### Acceptance Criteria

- `download_operator_apk_via_cli` and `parse_operator_download_result` are gone
  from `install.sh`
- dead operator-download parser or helper cases are gone from
  `validation/install/test_agent_skills.sh`
- shell no longer implements its own shared-agent-bridge non-fatal policy
- Node tests prove the warning case through CLI behavior rather than shell
  re-detection

Human review checklist:

- the phase removed dead code rather than just orphaning it further
- host-setup warning semantics are now owned in one place, not split across
  Node and shell
- shell validation shrank along with shell ownership

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commits

```text
refactor(install): remove dead operator download shell path
```

```text
fix(node): own shared bridge warning semantics in host setup output
```

## Phase 2: Add `clawperator install`

### Agent Tier

thinking

### Goal

Add a real top-level `clawperator install` command that owns post-bootstrap
sequencing, internal state threading, partial-failure semantics, and
installer-facing result output.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- new or existing `apps/node/src/cli/commands/` file for `install`
- any justified helper under `apps/node/src/domain/`
- `apps/node/src/test/`

### Steps

1. Replace the current `COMMANDS["install"]` tombstone in `registry.ts` with
   the real post-bootstrap install command.
2. Update only the nearby CLI help and guidance text in `registry.ts` that
   becomes stale because `clawperator install` replaces the old tombstone or
   old canonical post-bootstrap or upgrade route. Do not broaden this into an
   unrelated CLI-help cleanup pass.
3. Implement a CLI-owned flow that internally sequences:
   - `operator remediate`
   - `skills install`
   - `bundled-skills install`
   - `host setup`
4. Thread installer state internally in Node rather than exposing data-threading
   seams to the shell. At minimum, absorb:
   - `LAST_DEVICE_SERIAL` forwarding into host setup
   - default skills-registry discovery for host setup
   - final installer-ready summary state
5. Keep underlying commands (`operator remediate`, `skills install`,
   `bundled-skills install`, `host setup`) as real reusable surfaces. The new
   command is an orchestrator, not a replacement for their direct use.
6. Define one installer-facing result contract that supports:
   - stable JSON output for automation and tests
   - pretty output for installer pass-through
   - partial-failure semantics such as non-fatal shared bridge warnings and
     best-effort skills or bundled-skills handling
7. Add focused Node tests proving required cases:
   - single-device success path
   - multi-device warn path
   - no-device or remediation-failure path
   - shared-agent-bridge warning remains non-fatal
   - skills or bundled-skills partial-failure semantics match the intended
     installer behavior
   - CLI help text and `clawperator install --help` stay truthful after the
     tombstone replacement
8. Stop after the command and tests are real. Do not rewrite `install.sh` in
   this phase beyond any minimal plumbing required for testability.

### Acceptance Criteria

- top-level `clawperator install` exists and replaces the old tombstone
- `registry.ts` no longer contains stale upgrade or help guidance that assumes
  the old multi-command post-bootstrap route is canonical
- post-bootstrap sequencing is owned in Node rather than shell
- the command returns a stable installer-facing JSON result and truthful pretty
  output
- Node tests prove the required success, warning, and failure cases

Human review checklist:

- the new command closes the real shell data-threading seams instead of simply
  wrapping existing shell logic
- underlying direct commands remain reusable and truthful
- the result contract is strong enough that shell can become a thin pass-through

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add post-bootstrap install command
```

## Phase 3: Collapse `install.sh` to Bootstrap and Delegate

### Agent Tier

thinking

### Goal

Rewrite `install.sh` so that after `install_cli` it delegates to
`clawperator install`, then remove the remaining post-bootstrap JSON parsers,
shell state model, and shell-owned summary tree. Shrink shell validation to
bootstrap and delegation proof only.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`
- `validation/install/test_main.sh`
- `validation/install/test_agent_skills.sh`
- `validation/install/test_multidevice.sh`
- `validation/install/test_install.sh`
- `validation/install/README.md`
- any adjacent Node tests required to absorb behavior removed from shell

### Steps

1. Replace the current post-bootstrap shell sequence after `install_cli` with a
   call to `clawperator install --operator-package "$DEFAULT_OPERATOR_PACKAGE"`
   or the resolved equivalent from the new command contract.
2. Delete the remaining post-bootstrap parser helpers from `install.sh`,
   including:
   - `parse_skills_registry_path`
   - `parse_bundled_skills_install_result`
   - `parse_host_setup_result`
   - `parse_operator_remediate_result`
3. Delete remaining post-bootstrap shell orchestration helpers and state arrays
   that no longer serve a bootstrap-only wrapper.
4. Delete the branch-heavy final summary tree in `main()` and replace it with
   minimal pass-through of the CLI-owned install output plus the shell-specific
   source hint or bootstrap guidance that still belongs in shell.
5. Rewrite shell validation so it proves:
   - bootstrap checks still gate correctly
   - the shell delegates to `clawperator install`
   - exit codes and top-level messaging propagate correctly
6. Move any detailed behavior proof removed from shell harnesses into Node tests
   in the same phase and commit.
7. Confirm the final shell budget. If `install.sh` remains above 700 lines,
   stop and append an Execution Note to `recommendations.md` describing the
   exact justified residue before commit.

### Acceptance Criteria

- after `install_cli`, `install.sh` delegates through `clawperator install`
- no post-bootstrap `node -e` parser helpers remain in `install.sh`
- no post-bootstrap shell arrays or shell-owned installer state machine remain
- `install.sh` is at or below 700 lines, or an Execution Note explains the
  exact justified residue
- shell validation harnesses no longer unit-test removed parser or glue logic

Human review checklist:

- the shell now reads like a bootstrap wrapper, not a second application
- validation shrank with shell ownership rather than simply being rewritten
  at the same size
- detailed behavior proof clearly moved into Node tests

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
bash -n sites/landing/public/install.sh
./validation/install/test_install.sh
```

### Expected Commit

```text
refactor(install): delegate post-bootstrap flow to clawperator install
```

## Phase 4: Docs and Upgrade Alignment

### Agent Tier

default

### Goal

Update authored docs, validation guidance, and `clawperator-upgrade` so they
describe the compact installer truthfully and use `clawperator install` as the
canonical post-bootstrap route.

### Files or Surfaces To Change

- `docs/setup.md`
- `docs/host-agents.md`
- `docs/skills/authoring.md`
- any additional authored page only if it still encodes the superseded
  post-bootstrap or upgrade route at execution time
- `validation/install/README.md`
- `apps/node/src/cli/registry.ts`
- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
- `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the authored docs changes.
2. Update public install and host-agent docs that still encode the old route to
   reflect the compact model:
   - shell bootstrap first
   - `clawperator install` owns post-bootstrap install behavior
   - direct lower-level commands remain available but are no longer the normal
     installer route
3. Update authored bundled-skill docs that name `clawperator-upgrade`
   explicitly, including `docs/skills/authoring.md`, so they match the new
   CLI-first upgrade route.
4. Update `validation/install/README.md` so it describes the reduced shell
   harness role accurately.
5. Update only the `apps/node/src/cli/registry.ts` help blocks that still name
   the superseded upgrade or post-bootstrap route, so `clawperator --help` and
   related install-oriented help stay truthful without broad CLI-help churn.
6. Update `clawperator-upgrade/SKILL.md` so the normal upgrade route uses:
   1. `clawperator --version` reachability check
   2. `npm install -g clawperator@latest`
   3. `clawperator install`
   4. `clawperator doctor --json`
   with `install.sh` retained as recovery-only fallback when the CLI is not
   reachable or bootstrap prerequisites are broken.
7. Update `agents/openai.yaml` in the same commit so the prompt metadata stays
   aligned with the skill text.
8. Keep the docs pass scoped. Do not broaden it into unrelated wording cleanup
   once the stale install or upgrade guidance is removed.

### Acceptance Criteria

- authored docs describe `clawperator install` as the canonical post-bootstrap
  route truthfully
- authored docs that previously encoded the old route no longer describe
  `clawperator-upgrade` as a raw `install.sh` rerun or spell out the superseded
  multi-command upgrade sequence
- only the CLI help surfaces in `registry.ts` that actually became stale are
  updated, and they align with the shipped `clawperator install` and upgrade
  route
- validation README matches the reduced shell-harness ownership model
- `clawperator-upgrade` and its `agents/openai.yaml` align on the new flow

Human review checklist:

- docs do not overstate shell responsibilities that no longer exist
- upgrade guidance no longer teaches the old multi-command post-bootstrap flow
- no public doc or skill text references a CLI surface that does not actually
  exist

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
docs(install): align compact installer guidance
```

```text
feat(skills): update clawperator-upgrade for clawperator install
```
