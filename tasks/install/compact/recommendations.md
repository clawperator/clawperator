# install.sh Compacting - Central Recommendations

## Goal

Make `sites/landing/public/install.sh` and the shell-heavy install validation
harness as small, linear, and easy to maintain as possible by moving the
remaining post-bootstrap install behavior into the Node CLI.

This is the canonical recommendations document for the next task pack.

---

## What the First Wave Already Achieved

The initial installer-cleanup work that landed on `main` successfully moved the
largest ownership domains into the CLI:

- `clawperator host setup` now owns durable host artifact generation
  (install-state.json, mcp-config-snippet.json, AGENTS.md, shared agent bridge)
- `clawperator operator download` now owns APK metadata fetch, SHA-256
  verification, and canonical placement
- `clawperator operator remediate` now owns multi-device remediation policy,
  per-device doctor runs, APK download, operator install, and doctor-fix
- `clawperator-upgrade` now uses a CLI-first upgrade path, with `install.sh`
  as recovery only

That ownership migration was genuine. The current issue is not that the CLI
migration failed. It is that `install.sh` is still a significant shell-side
middleware layer after the migration.

---

## Current State

After the initial phases landed, the residual shell surface is still large:

- `sites/landing/public/install.sh`: 1431 lines
- `validation/install/test_agent_skills.sh`: 1054 lines
- `validation/install/test_main.sh`: 942 lines
- `validation/install/test_multidevice.sh`: 301 lines

The remaining bulk is no longer dominated by artifact writers or doctor policy.
It is now concentrated in shell-side JSON parsing, state threading, orchestration
glue, and installer summary formatting - none of which belongs in bash.

---

## Key Findings

### 1. Five inline `node -e` JSON parsers still live in `install.sh`

The installer spawns Node a second time after each CLI call to decode its JSON
output back into shell variables:

| Parser | Extracts |
|---|---|
| `parse_skills_registry_path` (lines 471-487) | `registryPath` string |
| `parse_bundled_skills_install_result` (lines 489-511) | `installedDir`, `agentDiscoveryDirs[].{label,dir}` |
| `parse_host_setup_result` (lines 624-665) | `ok`, `summary.*`, per-artifact `status/path/message` |
| `parse_operator_download_result` (lines 667-699) | `localPath`, `operatorVersion`, `sha256`, `operatorPackage`, error fields |
| `parse_operator_remediate_result` (lines 701-748) | `ok`, `summary.*`, per-device `deviceId/adbState/status/message` |

These parsers exist because values extracted from one CLI call must be threaded
forward as flags or env vars into a subsequent CLI call. That data threading is
the root cause, not the parsers themselves. The three active data threads are:

- `operator remediate` output (`LAST_DEVICE_SERIAL`) forwarded to
  `host setup --last-device-serial`
- `skills install` output (`SKILLS_REGISTRY_PATH`) forwarded as
  `CLAWPERATOR_SKILLS_REGISTRY=` to `host setup`
- formerly: `operator download` output (`OPERATOR_VERSION`) forwarded to
  `host setup --apk-version` (this path is now dead; see finding 4)

If a higher-level CLI surface owned the sequencing, it would thread state
internally and the parsers would have no purpose.

### 2. `setup_host_artifacts_via_cli` is still a ~165-line orchestration layer

`setup_host_artifacts_via_cli` (lines 796-961):

- builds args for `clawperator host setup` from state variables collected
  throughout the install run
- injects `CLAWPERATOR_SKILLS_REGISTRY=` env based on extracted registry path
- calls `host setup --output json`
- parses with `parse_host_setup_result`
- iterates four artifacts by hardcoded name (`installState`,
  `mcpConfigSnippet`, `agentGuide`, `sharedAgentBridge`)
- validates all four are present by name
- implements the "shared bridge failure is non-fatal" policy in bash
  (the `ONLY_SHARED_BRIDGE_FAILURE` branch at lines 942-949)

The last point requires precision: `hostSetup.ts` already returns `ok: true`
and exits 0 when `sharedAgentBridge` is the only failing artifact (line 780,
using `isNonFatalHostArtifactFailure()`). The shell's `ONLY_SHARED_BRIDGE_FAILURE`
branch at lines 942-949 does not override the CLI's exit code - both branches
return 0. Its only effect is to print "⚠️  Host setup completed with a shared-agent
bridge warning; continuing." instead of "✅ Host setup complete." The shell
maintains 25 lines of redundant policy logic purely for a message distinction
that could instead be emitted directly by the CLI's pretty output. The artifact
hardcoding in bash is a separate maintenance liability: if an artifact is added
or renamed in the CLI, the bash name list breaks silently.

### 3. `run_operator_remediation_via_cli` builds a shell-side state model (~120 lines)

`run_operator_remediation_via_cli` (lines 1128-1244) parses CLI JSON into
parallel shell arrays: `OPERATOR_REMEDIATE_DEVICE_IDS[]`, `STATES[]`,
`STATUSES[]`, `MESSAGES[]`, plus nine scalar counters. This is the most
database-like use of shell variables in the entire script. The extracted
`LAST_DEVICE_SERIAL` (when exactly one connected device is found) gets forwarded
to `host setup --last-device-serial`. The counters drive the final summary
decision tree in `main()` (lines 1327-1431, ~105 lines of bash conditional
logic producing the completion message).

### 4. `download_operator_apk_via_cli` is dead code in `main()`

`download_operator_apk_via_cli` (lines 963-1057) and `parse_operator_download_result`
(lines 667-699) exist in `install.sh` and are tested by `test_agent_skills.sh`
scenarios 15-15f, but there is no code path from `main()` to this function.
`operator remediate` handles APK download internally. The function has no
callers in the install flow.

This accounts for approximately 200 lines of `install.sh` and about 100 lines
of `test_agent_skills.sh` (the `run_operator_download_via_cli_case` and
`run_operator_download_parser_case` helpers plus scenarios 15c-15f) that are
dead with respect to the actual install execution. This is pure cleanup with no
behavior change.

A consequence: `OPERATOR_VERSION` is only ever set inside `download_operator_apk_via_cli`,
so the `--apk-version` flag is never forwarded to `host setup` in the live
install flow. The `apkVersion` field in `install-state.json` is always `null`
after a standard install. If tracking the downloaded APK version in install-state
is a requirement, the fix belongs in `operator remediate`'s result contract
(expose the downloaded version) and `host setup` consumption - not in the dead
download function.

### 5. The final installer summary is a ~105-line bash decision tree

`main()` lines 1327-1431 interpret `OPERATOR_REMEDIATE_TOTAL_DEVICES`,
`OPERATOR_REMEDIATE_FAILED_COUNT`, `OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT`,
`OPERATOR_REMEDIATE_ADB_UNREADY_COUNT`, and `OPERATOR_REMEDIATE_WARN_COUNT` to
produce multi-device, single-device, failure, and warning completion messages.
This is pure product presentation logic that belongs in the CLI, not in bash
conditionals.

### 6. Some shell output extraction is only used for printing

`setup_bundled_skills_via_cli` extracts `BUNDLED_SKILLS_INSTALL_DIR`,
`BUNDLED_SKILLS_CLAUDE_DIR`, `BUNDLED_SKILLS_CODEX_DIR`, and
`BUNDLED_SKILLS_AGENTS_DIR` from the `bundled-skills install` JSON. These values
are used only at lines 584-588 to echo them to stdout. They are never forwarded
to another CLI call. If the CLI printed its own success summary for bundled-skills,
the shell would not need to extract or reformat them.

Similarly, `CLAWPERATOR_SKILLS_REGISTRY` threading is unnecessary for the default
install path. The extracted registry path is always
`~/.clawperator/skills/skills/skills-registry.json` for a default installation.
`host setup` already reads `CLAWPERATOR_SKILLS_REGISTRY` from the calling
environment. The shell-side extraction and re-injection serves only non-default
registry configurations.

### 7. The shell validation harness still proves parser and glue behavior

Large sections of `validation/install/test*` test shell-owned translation code
rather than install outcomes:

- `test_agent_skills.sh` scenarios 1-2 and 2b test `parse_bundled_skills_install_result`
  and `parse_host_setup_result` as unit tests
- `test_agent_skills.sh` scenarios 15-15f test `parse_operator_download_result`
  and `download_operator_apk_via_cli` (dead code)
- `test_multidevice.sh` scenarios 1 and 5 test `parse_operator_remediate_result`
  directly
- `test_main.sh` contains a mock clawperator binary dispatching on at least six
  command surfaces with state-file-tracked call counts (lines 182-394) that
  simulate a multi-doctor-invocation flow - this complexity reflects the old
  multi-step shell-driven architecture and would simplify substantially if a
  `clawperator install` command replaced the multi-step sequence

That validation surface pays maintenance cost for shell behavior the architecture
no longer wants to keep.

---

## Recommendations

### 1. Delete dead installer code first

Remove from `install.sh`:
- `download_operator_apk_via_cli` (lines 963-1057)
- `parse_operator_download_result` (lines 667-699)

Remove from `test_agent_skills.sh`:
- `run_operator_download_parser_case` helper (lines 117-138)
- `run_operator_download_via_cli_case` helper (lines 140-190)
- scenarios 15-15f (approximately lines 922-1038)

This is the safest compaction step: pure removal of dead code and dead test
coverage with no behavior change to the real install flow. Do this before any
deeper refactor to reduce the surface under consideration.

### 2. Simplify the shell's shared-bridge handling to trust the CLI

`hostSetup.ts` already returns `ok: true` and exits 0 when `sharedAgentBridge`
is the only failing artifact. The shell does not need to re-detect this case.
The `ONLY_SHARED_BRIDGE_FAILURE` branch at lines 942-949 exists only to emit a
warning-flavored message instead of a success message.

The fix is to let the CLI's pretty output carry that warning text, then collapse
`setup_host_artifacts_via_cli` to: call CLI, check exit code, print output.
The `ONLY_SHARED_BRIDGE_FAILURE` branch, the `HOST_FAILED_COUNT` counter, the
`CORE_FAILURE` counter, and the per-artifact status variables all disappear from
shell once the shell trusts the exit code the CLI already sets correctly.

### 3. Add a higher-level post-bootstrap installer CLI surface

This is the most important recommendation.

The remaining shell complexity is mostly caused by shell-to-CLI data threading:
the shell extracts state from one CLI call and forwards it to the next. The
cleanest fix is to add a CLI-owned post-bootstrap install surface - provisionally
named `clawperator install`.

Implementation note: `COMMANDS["install"]` in `registry.ts` is already a
tombstone that rejects the command with "clawperator install is not a valid
command. Use: clawperator operator setup --apk <path>." Adding the real
post-bootstrap install surface requires deliberately repurposing this tombstone,
not just adding a new command entry.

The surface should:

- accept `--operator-package` (for non-release APKs)
- internally sequence: operator remediate, skills install, bundled-skills
  install, host setup
- thread state between those steps internally in Node (no shell extraction
  needed)
- own partial-failure semantics (shared bridge non-fatal, skills best-effort)
- own final installer summary semantics (single-device, multi-device, failure,
  warning paths)
- return one stable installer-facing result contract

With this command, the post-bootstrap section of `main()` reduces to:

```bash
install_cli || exit 1
clawperator install --operator-package "$DEFAULT_OPERATOR_PACKAGE"
```

The five JSON parsers, the parallel device arrays, `setup_host_artifacts_via_cli`,
`run_operator_remediation_via_cli`, the bundled-skills extraction loop, the
registry path threading, and the ~105-line final summary tree in `main()` all
disappear from shell. The test mock in `test_main.sh` simplifies from a
multi-surface dispatcher with call-count state to a single-command mock.

### 4. Remove shell-side JSON parsing entirely

Once the higher-level install surface exists and the shared-bridge policy is
fixed, all five `node -e` parsers in `install.sh` should be deletable. This is
a consequence, not a separate effort. Do not attempt to remove them piecemeal
before the upstream data-threading seams are closed.

### 5. Move installer summary formatting into the CLI

The CLI should own:

- ready vs warn vs failure semantics
- device remediation summaries
- host-artifact outcome summaries
- follow-up commands and recovery guidance

The shell should not need to decide which message to print based on multiple
arrays and counters. It should mostly pass through CLI output and propagate exit
status. This is a consequence of recommendation 3 if the higher-level install
surface owns its own pretty output.

### 6. Reduce shell validation by moving behavioral proof into Node tests

Explicitly shrink `validation/install/test*` as shell code is removed. Move
proof of these behaviors into Node tests:

- parser behavior (move as parsers are deleted)
- host-artifact non-fatal policy (move when recommendation 2 lands)
- remediation summary assembly (move when recommendation 3 lands)
- post-bootstrap sequencing logic (move when recommendation 3 lands)

Keep shell tests focused on the irreducible shell responsibilities:

- bootstrap checks (Java, Node, adb, git, curl) and their failure paths
- CLI delegation (the shell calls the right CLI surface with the right args)
- top-level exit-code propagation

The shell harness should prove "the bootstrap wrapper invokes the CLI-owned
install flow and propagates its result sanely," not re-prove Node-owned business
logic. The test mock complexity in `test_main.sh` (multi-surface dispatch, call
counts for doctor invocations) is a direct symptom of shell owning too much; it
should shrink as shell responsibility shrinks.

### 7. Preserve the irreducible shell core; cut everything else aggressively

The shell should continue to own:

- OS validation (`validate_os`)
- Java detection and multi-platform provisioning (`check_java` and helpers,
  ~170 lines; this must precede any Node runtime)
- Node.js detection and nvm provisioning (`check_node`, `load_nvm`,
  `install_or_upgrade_node_with_nvm`, ~57 lines; must precede npm)
- adb, git, curl check and install (~80 lines combined)
- `npm install -g clawperator@latest` plus binary path resolution
  (`install_cli`, ~37 lines; the fresh-binary discovery at lines 449-462 is
  necessary because the new binary may not yet be on PATH)
- error trapping, temp file cleanup, `on_error`
- the final `source ~/.zshrc` hint (only shell knows the active shell)

This irreducible bootstrap core is approximately lines 1-468 of the current
`install.sh` - roughly 450-500 lines. The current 1431-line script should
realistically reach that target once all post-bootstrap orchestration moves to
the CLI.

Almost everything after `install_cli || exit 1` should be treated as suspect
unless there is a strong reason it cannot move into Node.

---

## Recommended End State

1. Shell performs prerequisite checks and installs the CLI (~450-500 lines)
2. Shell invokes one primary CLI-owned post-bootstrap install flow
3. Shell relays the resulting success, warning, or failure output
4. Shell exits

In that state `install.sh` becomes shorter, easier to reason about, and easier
to maintain. `validation/install/test*` becomes much smaller. Future install
behavior changes happen in typed Node code with unit test coverage, not in bash
conditionals.

---

## Bottom Line

The next refinement round should not be framed as "move a few more helpers." It
should be framed as **removing the shell's remaining role as an orchestrator and
JSON interpreter**.

The most valuable concrete moves, in priority order:

1. Delete the dead operator-download shell path and its test coverage (~300 lines,
   zero behavior change)
2. Simplify the shell's shared-bridge handling to trust the CLI exit code
   (`hostSetup.ts` already returns the correct `ok` value; the shell just needs
   to stop re-detecting it and emit the warning from CLI pretty output instead)
3. Add a `clawperator install` post-bootstrap surface (closes the data-threading
   root cause; everything else follows from this)
4. Delete the remaining shell JSON parsers (consequence of 3)
5. Shrink shell validation to bootstrap-only concerns (consequence of 3 and 4)

If that work is done well, `install.sh` will stop behaving like a second
application and become the small bootstrap entrypoint it was always supposed
to be.
