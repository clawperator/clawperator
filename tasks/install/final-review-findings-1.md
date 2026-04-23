# Install Compaction Final Review Findings 1

Review date: 2026-04-24

Reviewed range: `0c3ce93b9cac5d48635677f77f50b431d4231eca^..HEAD`, so the
`0c3ce93` commit itself is included.

Current branch reviewed: `install/compact-phases-3-and-4`

## Scope Reviewed

This review focused on whether the install compaction work actually moved
post-bootstrap install ownership out of
`sites/landing/public/install.sh` and into the Node CLI, while keeping
installer reliability and validation coverage intact.

Surfaces inspected:

- `sites/landing/public/install.sh`
- `validation/install/`
- `apps/node/src/cli/commands/install.ts`
- `apps/node/src/cli/commands/operatorRemediate.ts`
- `apps/node/src/domain/host/hostSetup.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/*install*`
- `apps/node/bundled-skills/clawperator-upgrade/`
- authored docs changed under `docs/`
- task pack files under `tasks/install/compact/`

Validation run during review:

```bash
./validation/install/test_install.sh
```

Result: passed. This included the Node build, full Node test suite, and the
reduced install shell harnesses.

## Work Done Well

The main ownership migration succeeded. `install.sh` no longer parses
post-bootstrap JSON, tracks parallel device arrays, or owns the final install
summary tree. Its post-bootstrap role is now a narrow delegation to:

```bash
clawperator install --output pretty --operator-package "$DEFAULT_OPERATOR_PACKAGE"
```

The installer is materially slimmer. The current shell script is 526 lines,
which is below the task pack target of 700 lines and far below the previous
shell middleware shape. The remaining shell is mostly bootstrap work that the
task explicitly kept in scope for the wrapper: OS detection, Java, Node, curl,
adb, git, npm global CLI install, and shell activation hints.

The Node CLI now has a real top-level `clawperator install` command. It owns the
post-bootstrap sequence across operator remediation, runtime skills install,
bundled-skills install, and host setup. It also owns installer-facing status,
summary, warning, and follow-up messaging. That is the right boundary for this
project: shell bootstraps the CLI, then the CLI owns Clawperator behavior.

The old dead shell path for direct operator APK download was removed from the
installer flow and from shell validation. Detailed behavior now has Node-owned
tests in `operatorDownload.test.ts`, `operatorRemediate.test.ts`,
`hostSetup.test.ts`, and `installCommand.test.ts`.

The shared-agent-bridge warning policy is now Node-owned. `hostSetup.ts`
classifies shared bridge write failures as a warning when all core host
artifacts succeed, and `cmdInstall` preserves that as a non-fatal install
warning. This removes a duplicated bash policy branch and keeps the CLI as the
source of truth.

The reduced shell validation is pointed at the right shell-owned behavior:
fresh npm binary resolution, wrapper delegation to `clawperator install`,
operator package env normalization, bootstrap gate behavior, delegated failure
propagation, and stdin entrypoint safety. The validation shrink was not just
line deletion.

Docs and host-agent guidance are broadly aligned with the new route. `docs/setup.md`,
`docs/host-agents.md`, `docs/skills/authoring.md`, CLI help text, generated
LLM surfaces, and `clawperator-upgrade` now consistently describe
`clawperator install` as the canonical post-bootstrap path and keep
`install.sh` as bootstrap or recovery.

## Gaps And Residual Risks

No blocking defect was found in the final review, and the install validation
suite passed. The remaining gaps are mostly proof, polish, and follow-through.

### 1. Live install proof is still the biggest missing confidence signal

The validation suite is strong for contracts and wrapper behavior, but it is
still mostly unit and mocked integration coverage. The changed behavior affects
real install reliability, adb device enumeration, APK remediation, permission
grant, host artifact writing, runtime skills, and bundled-skill discovery.

Before treating this as release-ready, run one real install or upgrade smoke on
a physical device or emulator using the branch-local Node build path. The smoke
should verify:

- `install.sh` delegates to the freshly installed CLI binary, not a stale PATH
  entry
- `clawperator install` reaches a real device
- operator remediation installs or verifies the expected package
- `~/.clawperator/install-state.json`, `mcp-config-snippet.json`, and
  `AGENTS.md` are written
- runtime skills and bundled skills are discoverable after install
- `clawperator doctor --json` reports the expected readiness state

### 2. `apkVersion` remains unthreaded through the canonical install path

The compact task recommendations already called out that the old dead
`download_operator_apk_via_cli` path was the only place shell ever learned an
operator version. The current Node-owned `clawperator install` path still calls
`setupHost` without an `apkVersion`, so `install-state.json` keeps
`apkVersion: null` after normal install.

Docs accurately avoid over-promising this field, so this is not a correctness
blocker. It is still a useful follow-up because install-state diagnostics would
be stronger if `operator remediate` exposed the downloaded or verified operator
version and `cmdInstall` passed it into host setup.

### 3. `clawperator-upgrade` has a multi-device verification ambiguity

The updated bundled skill correctly routes through `npm install -g
clawperator@latest`, `clawperator install`, and `clawperator doctor --json`.
It also says not to claim success until every connected device has been checked
with doctor and reports `criticalOk: true`.

That creates a small ambiguity on multi-device hosts. A single
`clawperator doctor --json` without `--device` may not prove every connected
device in the way the skill text requires. Since `clawperator install` already
returns per-device remediation output and a `deviceSelectionRequired` signal,
the skill should eventually spell out the multi-device follow-up: when multiple
ready devices are present, run doctor per selected device or consume the
install result's device list before declaring the whole host ready.

### 4. Remaining shell validation names are slightly stale

`validation/install/test_agent_skills.sh` now primarily validates CLI bootstrap
binary resolution. That is good coverage, but the filename no longer describes
the test's main purpose. This is not harmful because `test_install.sh` remains
the single entrypoint, but renaming it later would make the reduced validation
surface easier for future agents to understand.

### 5. The install validation runner is broad and may become expensive

`validation/install/test_install.sh` builds `apps/node` and runs the full Node
test suite before the install shell harnesses. This is safe and currently
passes, but it is broader than install-specific validation. If the Node test
suite grows substantially, consider adding a stable install-focused npm test
slice while keeping full `npm --prefix apps/node run test` in CI or pre-release
validation.

## Recommendations

1. Keep the current ownership split. Do not move Java, Node, adb, git, curl, or
   npm bootstrap into the Node CLI unless the project later ships a
   self-contained launcher that can run before Node is installed.

2. Add a real-device or emulator smoke before merge or release. The important
   proof is not just that `clawperator install` returns a good JSON shape, but
   that the compact shell wrapper plus freshly installed CLI can complete a
   real post-bootstrap flow.

3. Add a follow-up task to thread operator version into install state. The
   likely shape is to extend `operator remediate` with the effective downloaded
   or verified APK version, then pass that through `cmdInstall` to `setupHost`.

4. Tighten `clawperator-upgrade` multi-device wording. It should explicitly
   handle `deviceSelectionRequired` or multiple connected devices before
   claiming every device was verified by doctor.

5. Rename or consolidate the reduced shell harnesses when convenient. Suggested
   names:
   - `test_cli_bootstrap.sh` for the current `test_agent_skills.sh`
   - `test_main_delegation.sh` for the current `test_main.sh`

6. Keep `validation/install/README.md` as the source of truth for what belongs
   in shell validation. The current README is directionally right: shell tests
   should prove bootstrap and delegation, while Node tests own post-bootstrap
   behavior.

## Bottom Line

The install compaction work achieved the intended architecture. The shell is
now a bootstrap wrapper, `clawperator install` is the canonical post-bootstrap
surface, and the detailed behavior moved to Node with meaningful tests.

The remaining work is not another large refactor. It is a short follow-up pass:
prove the flow on a real device or emulator, improve install-state version
metadata, tighten multi-device upgrade verification guidance, and polish the
names of the reduced shell harnesses.
