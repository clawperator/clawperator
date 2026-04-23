# Installer Compaction Findings

*Based on direct inspection of the current `main` branch code.*

---

## What has already been moved into the CLI

The first-wave work successfully migrated four substantial ownership domains into Node:

- **Host artifact generation** - `clawperator host setup` writes `install-state.json`,
  `mcp-config-snippet.json`, `AGENTS.md`, and the shared agent bridge.
- **Operator APK download** - `clawperator operator download` handles metadata fetch,
  SHA-256 verification, temp-file-with-rename, and placement at the canonical path.
- **Device remediation policy** - `clawperator operator remediate` runs doctor per device,
  decides which need setup, downloads the APK when needed, installs, runs doctor-fix,
  and emits a structured per-device result. Multi-device logic, APK download caching, and
  grant recovery are all owned by the CLI.
- **Skills and bundled-skills install** - `clawperator skills install` and
  `clawperator bundled-skills install` handle syncing, copying, and returning agent
  discovery dirs.

The ownership migration is genuine. These are not thin delegations - the actual policy and
file I/O live in typed Node code.

---

## What still remains in shell

### 1. Five inline `node -e` JSON parsers

These are the most prominent residual middleware in `install.sh`:

| Parser | Lines | Extracts |
|---|---|---|
| `parse_skills_registry_path` | 471-487 | `registryPath` string |
| `parse_bundled_skills_install_result` | 489-511 | `installedDir`, `agentDiscoveryDirs[].{label,dir}` |
| `parse_host_setup_result` | 624-665 | `ok`, `summary.*`, per-artifact `status/path/message` |
| `parse_operator_download_result` | 667-699 | `localPath`, `operatorVersion`, `sha256`, `operatorPackage`, `code`, `message` |
| `parse_operator_remediate_result` | 701-748 | `ok`, `summary.*`, per-device `deviceId/adbState/status/message` |

Each parser translates a CLI JSON response into shell-consumable `KEY=VALUE` lines. They
exist because bash can't parse JSON natively, and the shell then acts on the extracted
values to drive the next CLI call or the final summary output.

### 2. `setup_host_artifacts_via_cli` - the most complex remaining function (~165 lines)

`setup_host_artifacts_via_cli` (lines 796-961):

- Builds args for `host setup` from state variables collected earlier in the install
  (`$RESOLVED_CLI_VERSION`, `$OPERATOR_VERSION`, `$LAST_DEVICE_SERIAL`,
  `$SKILLS_REGISTRY_PATH`).
- Passes `CLAWPERATOR_SKILLS_REGISTRY=` env var to `host setup` based on the registry
  path extracted from the `skills install` output.
- Calls `host setup --output json`.
- Parses with `parse_host_setup_result`, then iterates four artifacts by hardcoded name
  (`installState`, `mcpConfigSnippet`, `agentGuide`, `sharedAgentBridge`).
- Validates all four are present.
- Implements the "shared bridge failure is non-fatal" policy: if only `sharedAgentBridge`
  failed and `HOST_FAILED_COUNT = 1`, the function returns 0 rather than propagating the
  CLI's exit code (lines 942-949).

The hardcoded artifact names in bash are a maintenance liability. The non-fatal shared
bridge policy is owned by the shell here, even though `hostSetup.ts` already has
`isNonFatalHostArtifactFailure()`.

### 3. `run_operator_remediation_via_cli` (~120 lines, 1128-1244)

This function captures per-device remediation state into parallel shell arrays
(`OPERATOR_REMEDIATE_DEVICE_IDS[]`, `STATES[]`, `STATUSES[]`, `MESSAGES[]`) and nine
scalar summary counters. The shell arrays are the most "database-like" use of shell
variables in the entire script. The extracted `LAST_DEVICE_SERIAL` is later forwarded
to `host setup --last-device-serial`.

### 4. `download_operator_apk_via_cli` is dead code in `main()`

`download_operator_apk_via_cli` (lines 963-1057) and its parser
`parse_operator_download_result` (lines 667-699) exist in `install.sh` and are tested
in `test_agent_skills.sh` scenarios 15-15f, but there is no code path from `main()` to
this function. The `operator remediate` CLI command handles APK download internally.
`download_operator_apk_via_cli` has no callers in the install flow.

This accounts for roughly 200 lines of `install.sh` and about 100 lines of
`test_agent_skills.sh` (scenarios 15c-15f plus the parser/via-cli case runner at lines
117-190) that are dead with respect to the actual install execution path.

### 5. `main()` final summary block (~105 lines, 1327-1431)

The completion output is a multi-level conditional tree that interprets
`OPERATOR_REMEDIATE_TOTAL_DEVICES`, `OPERATOR_REMEDIATE_FAILED_COUNT`,
`OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT`, etc. to decide which messages to show.
This is pure orchestration/presentation logic. It represents several multi-device,
single-device, and failure-mode summary paths, all expressed in bash.

### 6. `setup_skills_via_cli` and `setup_bundled_skills_via_cli`

`setup_skills_via_cli` (lines 514-540) extracts `SKILLS_REGISTRY_PATH` from the
`skills install` JSON so that it can be forwarded to `host setup`. In practice, for a
default installation, this path is always `~/.clawperator/skills/skills/skills-registry.json`.

`setup_bundled_skills_via_cli` (lines 542-598) extracts `BUNDLED_SKILLS_INSTALL_DIR`,
`BUNDLED_SKILLS_CLAUDE_DIR`, etc. from `bundled-skills install` JSON. These values are
used only for printing (lines 584-588) - they are not passed to any subsequent CLI call.
If the CLI printed its own success summary, the shell would not need to extract them.

---

## What should move next

### Highest priority: remove the dead `download_operator_apk_via_cli` path

The function has no callers in `main()`. Removing it plus its parser plus the dead test
scenarios removes about 300 lines of code with zero behavior change. This is the safest
possible compaction step and it should be done first.

Scope: delete `download_operator_apk_via_cli` and `parse_operator_download_result` from
`install.sh`; delete test scenarios 15-15f (and the `run_operator_download_via_cli_case`
and `run_operator_download_parser_case` helpers) from `test_agent_skills.sh`.

### Move the "shared bridge failure is non-fatal" policy into `hostSetup.ts`

The current design has a mismatch: `hostSetup.ts` has `isNonFatalHostArtifactFailure()`
which identifies the category, but the policy decision (ok=true, exit 0) lives in the
shell at lines 942-949. The CLI should return `ok = true` when a shared bridge failure is
the only failure, so the shell can simply check the exit code. The "warning; continuing"
message should come from the CLI's human output, not from a bash branch.

Once this moves, the shell's artifact-counting and `ONLY_SHARED_BRIDGE_FAILURE` logic
collapses. `setup_host_artifacts_via_cli` becomes closer to: call CLI, check exit code,
print output.

### Add a `clawperator install` command for post-bootstrap orchestration

The root cause of most remaining shell complexity is shell-to-CLI data threading:
values extracted from one CLI call get forwarded as flags to the next. The three key
data threads are:

1. `operator remediate` output (`LAST_DEVICE_SERIAL`) - forwarded to `host setup --last-device-serial`
2. `skills install` output (`SKILLS_REGISTRY_PATH`) - forwarded as `CLAWPERATOR_SKILLS_REGISTRY=` to `host setup`
3. `operator download` output (`OPERATOR_VERSION`) - forwarded to `host setup --apk-version` (dead, but the pattern illustrates the coupling)

A single `clawperator install` (or `clawperator host install`) command would:

- Accept `--operator-package` for non-release APKs
- Internally orchestrate: operator remediate, skills install, bundled-skills install, host setup
- Thread state between these steps internally (no shell extraction needed)
- Return a structured result with per-step outcomes
- Own the multi-device vs single-device messaging decision
- Handle the shared bridge non-fatal policy

With this command, the post-bootstrap section of `main()` would reduce to:
```bash
install_cli || exit 1
clawperator install --operator-package "$DEFAULT_OPERATOR_PACKAGE"
```

The five JSON parsers, the parallel device arrays, the `setup_host_artifacts_via_cli`
orchestrator, and the `main()` summary tree would all disappear from shell.

### Rationalize `bundled-skills install` output extraction

The extracted agent discovery dirs are only used for printing, not for forwarding to
another CLI call. If `bundled-skills install --output pretty` printed its own summary,
the shell would not need to extract and reformat them. Either:

- Add `--output pretty` formatting to `bundled-skills install` that includes the
  installed dirs, OR
- Have the shell only check exit code and print a brief "installed at default location"
  message rather than extracting and re-printing the paths.

This eliminates `parse_bundled_skills_install_result` and simplifies
`setup_bundled_skills_via_cli` from ~57 lines to ~10.

---

## What should stay in shell

These are genuinely irreducible bootstrap concerns:

- `validate_os` - OS detection before Node exists
- `check_java` and helpers (~170 lines) - Java detection and multi-platform provisioning
  (Homebrew/apt/pacman) must exist before any Node runtime
- `check_node` / `load_nvm` / `install_or_upgrade_node_with_nvm` (~57 lines) - must
  precede the npm install step
- `check_adb`, `check_git`, `check_curl` (~80 lines combined) - OS-level tool management
- `install_cli` - `npm install -g clawperator@latest` plus binary path resolution; the
  binary resolution logic (lines 449-462) is necessary because the freshly installed
  binary may not yet be on PATH
- Error trapping, temp file cleanup, `on_error`
- The final "run `source ~/.zshrc`" shell RC hint - only shell knows which shell is active

The irreducible bootstrap core of `install.sh` is approximately lines 1-468 as currently
structured (~450-500 lines). The current 1431-line script could realistically reach that
target if all post-bootstrap orchestration moves to the CLI.

---

## Mismatches with the desired thin-bootstrapper end state

**1. Dead code is being maintained.**
`download_operator_apk_via_cli` has no callers. Its test coverage in
`test_agent_skills.sh` gives false confidence that a code path exists that doesn't.

**2. Non-fatal shared bridge policy splits across two layers.**
`hostSetup.ts` identifies what is non-fatal via `isNonFatalHostArtifactFailure()`, but
the shell is the one that decides to continue. This split will be a persistent maintenance
hazard as the artifact set changes.

**3. Shell validation tests parser behavior, not install behavior.**
`test_agent_skills.sh` scenarios 1-2 (bundled-skills parser), 2b (host setup parser), and
15-15f (operator download parser) are unit tests of shell-side JSON-parsing code, not of
install flow outcomes. This is coverage of the translation layer, not coverage of the
product. If the translation layer moves to Node, these tests have no equivalent value.
Node already owns unit tests for the CLI output shapes.

**4. `test_multidevice.sh` tests parser unit behavior too.**
Scenarios 1 and 5 (parser output, missing-id) test `parse_operator_remediate_result`
directly. Once the remediation summary moves to a `clawperator install` command, these
tests become Node-test coverage instead.

**5. `test_main.sh` mock complexity reflects old multi-step install architecture.**
The mock clawperator in `test_main.sh` dispatches on at least 6 command surfaces and
maintains state-file-tracked call counts (doctor call count logic at lines 182-394) to
simulate a multi-doctor-invocation flow. Most of this complexity exists because the old
architecture ran doctor multiple times as part of a shell-owned remediation loop. With a
`clawperator install` command, the mock would dispatch on one or two surfaces, and the
complex scenario-by-call-count logic would move to Node tests.

**6. `CLAWPERATOR_SKILLS_REGISTRY` threading is unnecessary for the default case.**
The shell extracts the registry path from `skills install` output and re-injects it as an
env var for `host setup`. For the default installation, the extracted path is always
`~/.clawperator/skills/skills/skills-registry.json`. This round-trip serves only
non-default registry configurations. If `host setup` could discover the registry path
directly (defaulting to the canonical path), the shell would not need to thread it.
