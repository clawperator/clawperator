# install.sh Cleanup - Master Findings

Synthesizes `findings-claude.md` and `findings-codex.md`. References
`validation/install/` coverage where it affects migration decisions.

---

## Diagnosis

`sites/landing/public/install.sh` is 2306 lines. The test harnesses under
`validation/install/` are another 3171 lines. That is a large maintenance
surface for a bootstrapper.

The size is not the root problem. The root problem is that the script mixes
four distinct responsibilities:

1. **Host prerequisite provisioning** - OS detection, Java/Node/adb/git/curl
   install (appropriate for shell; CLI does not exist yet)
2. **Clawperator product logic** - APK download, checksum, multi-device
   remediation policy (should live in the CLI)
3. **JSON parsing via embedded Node snippets** - re-parsing output from CLI
   commands the script itself just called (should not exist at all; the CLI
   already has this data)
4. **Host artifact generation** - writing AGENTS.md, mcp-config-snippet.json,
   install-state.json, and shared agent bridge via large inline Node programs
   (should be CLI commands)

The result is a second product-logic layer outside the CLI that encodes
internal doctor check IDs, device states, and file formats - all of which the
CLI already owns.

---

## What Must Stay In Shell

These steps are bootstrapping. The CLI does not exist yet when they run.
They cannot move.

- OS validation (`install.sh:81-95`)
- Java detection and installation - Homebrew, apt, pacman (`install.sh:134-271`)
- Node.js detection and installation via nvm (`install.sh:273-331`)
- adb, git, curl checks and installation (`install.sh:333-417`)
- `npm install -g clawperator@latest` (`install.sh:418-449`)

The irreducible bootstrap is roughly 150-200 lines of shell. Everything else
is either already delegated well or should be moved.

---

## What Is Already Delegated Well

Some flows are already in the right layer:

- `clawperator skills install` - runtime skills install, shell only parses
  `registryPath` from JSON result (`install.sh:512-557`,
  `apps/node/src/cli/commands/skills.ts`)
- `clawperator bundled-skills install` - shell only parses `installedDir` and
  `agentDiscoveryDirs` (`install.sh:568-620`,
  `apps/node/src/cli/commands/bundledSkills.ts:37-55`)
- `clawperator operator setup` - install, grant, verify flow is already a
  stable CLI command (`apps/node/src/cli/commands/operatorSetup.ts`,
  `apps/node/src/domain/device/setupOperator.ts`)
- `clawperator doctor` - canonical readiness check with structured JSON output

---

## What Should Move To The CLI

### 1. Host artifact generation (highest leverage)

The four artifact writers are Node application code embedded in bash heredocs.
They are harder to test, harder to type-check, and harder to share with the
rest of the codebase.

| Function | Lines | Output |
|----------|-------|--------|
| `write_install_state` | ~50 | `~/.clawperator/install-state.json` |
| `write_mcp_config_snippet` | ~100 | `~/.clawperator/mcp-config-snippet.json` |
| `write_agent_guide` | ~180 | `~/.clawperator/AGENTS.md` |
| `write_shared_agent_bridge` | ~70 | `~/.agents/AGENTS.md` (marker-block update) |

**Total: ~400 lines removed from install.sh.**

These belong in a single CLI command, something like
`clawperator host materialize-artifacts` or as subcommands under a `host`
group. The command should accept `--output json` and report which artifacts
were written or skipped.

The `write_agent_guide` function reads the installed skills registry (a
Clawperator-owned concept) to produce its output. Moving it into the CLI
gives it native access to that data without the current
`node - "$RUNTIME_SKILLS_REGISTRY_PATH"` heredoc indirection.

### 2. Doctor-driven APK remediation (second highest leverage)

The installer hand-codes its own device remediation policy by calling
`clawperator doctor --format json` and then re-parsing specific check IDs in
shell:

- `readiness.apk.presence`
- `readiness.version.compatibility`
- `device.discovery`
- `DEVICE_SHELL_UNAVAILABLE` error code

Relevant sections: `install.sh:1664-1727`, `1729-1769`, `1878-1942`,
`2100-2153`, `2195-2235`.

**Total: ~350 lines of shell + inline Node parsing helpers.**

`DoctorService` already has an autofix concept (`autoFix` execution,
`check.fix.steps` in `apps/node/src/domain/doctor/DoctorService.ts:194-211`)
that install.sh bypasses entirely. The right fix is to expand
`clawperator doctor --fix` to handle multi-device APK remediation and
permission re-grant recovery, then let the installer call that command
instead.

The installer should consume a single structured result - host status, per-device
summary, list of devices needing further action - rather than re-implementing
policy state machines in shell.

### 3. APK download and checksum verification

This logic is product behavior, not shell bootstrap:

- metadata fetch and JSON parse (`install.sh:1371-1419`)
- APK download (`install.sh:1421-1448`)
- SHA256 verification (`install.sh:1450-1475`)

**Total: ~105 lines removed.**

The embedded `node` call to parse metadata JSON is a clear sign the shell is
fighting the problem. This belongs as a CLI subcommand, likely
`clawperator operator download` or `clawperator operator fetch-apk`.

Suggested result contract: local path, operator version, sha256, package
flavor. That would reduce the installer to:

```bash
clawperator operator download
clawperator operator setup --apk "$APK_LOCAL_PATH" ...
```

This also unlocks reuse outside the first-install path (manual APK refresh,
upgrade flows).

### 4. Shell RC mutation - likely deletable, not just moveable

After `clawperator skills install`, the script rewrites `~/.zshrc`,
`~/.bashrc`, and `~/.bash_profile` to export `CLAWPERATOR_SKILLS_REGISTRY`
(`install.sh:530-556`).

**This is probably unnecessary.** The CLI already falls back to the installed-home
registry at `~/.clawperator/skills/skills/skills-registry.json` when no env
var is set (`apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:79-186`).

Recommendation: **remove the RC mutation** rather than move it. Print the
export command as optional advice for users who need a non-default registry
path, but stop modifying shell profiles by default. This removes a surprising
host side-effect and simplifies the installer.

---

## Recommended Phasing

### Phase 1 - Add host artifact CLI command

Add `clawperator host materialize-artifacts` (or equivalent) covering
`write_install_state`, `write_mcp_config_snippet`, `write_agent_guide`, and
`write_shared_agent_bridge`. Replace the four shell functions with one CLI call.

**Impact:** ~400 lines removed from install.sh; embedded Node heredocs gone.
Validation coverage shifts from `test_agent_skills.sh` shell assertions to
Node unit tests against the new CLI command.

### Phase 2 - Expand `doctor --fix` for multi-device remediation

Move per-device APK presence checking, remediation policy, and permission
re-grant recovery into `clawperator doctor --fix`. Collapse the
`run_doctor_and_fix` / `collect_multi_device_apk_setup_targets` /
`doctor_each_connected_device` / `doctor_check_*` shell logic.

**Impact:** ~350 lines removed; inline Node JSON-parsing helpers gone.
Validation coverage shifts from `test_main.sh` + `test_multidevice.sh`
shell assertions to CLI integration tests.

### Phase 3 - Add `clawperator operator download`

Move APK metadata fetch, download, and checksum verification into a CLI
subcommand under the `operator` family.

**Impact:** ~105 lines removed; no more embedded Node metadata parser.
Enables standalone APK refresh outside the full install flow.

### Phase 4 - Delete shell RC mutation

Remove or opt-in-gate the `CLAWPERATOR_SKILLS_REGISTRY` shell profile edits.
Confirm the CLI home-directory fallback is the documented default path.

**Impact:** ~40 lines removed; fewer surprising host side-effects.

---

## End State

After all four phases, `install.sh` becomes a ~200-line bootstrap stub:

1. OS validation
2. Java install
3. Node.js install (nvm)
4. adb / git / curl checks
5. `npm install -g clawperator@latest`
6. `clawperator doctor --fix` (handles APK download, install, permission grant, multi-device)
7. `clawperator skills install`
8. `clawperator bundled-skills install`
9. `clawperator host materialize-artifacts`
10. `clawperator doctor --output pretty` (final status print)

No inline Node programs. No embedded product logic. All Clawperator-specific
behavior lives in the CLI where it can be tested with TypeScript unit tests.

A Python rewrite of that 200-line bootstrap stub would be a natural follow-on
once the shell script is reduced to pure prerequisite provisioning.

---

## Impact On The Validation Suite

The current `validation/install/` harnesses test shell behavior directly and
will need to migrate as logic moves into the CLI.

| Harness | Coverage | Migration path |
|---------|----------|----------------|
| `test_agent_skills.sh` (~600 lines) | artifact writers, skills glue, install-state, MCP config, shared bridge | Node unit tests for Phase 1 CLI command |
| `test_main.sh` (~1167 lines) | main() smoke, APK remediation, multi-device flows, doctor integration | CLI integration tests for Phase 2; thin shell smoke stays |
| `test_multidevice.sh` (~600 lines) | multi-device APK install, device states, setup prompts | CLI integration tests for Phase 2 |
| `test_java.sh` (~800 lines) | Java check and provisioning | stays as-is (bootstrap logic remains in shell) |
| `lib/json_assert.sh` | shared helpers | may be reused or replaced by CLI contract tests |

**Key constraint from CLAUDE.md:** any change to `install.sh` requires
updating or adding coverage under `validation/install/` in the same change.
Each phase must maintain parity - when a function moves to the CLI, its shell
test coverage must be replaced with CLI coverage before the shell test is removed.

---

## Risks And Tradeoffs

**Benefits**
- Product logic moves into TypeScript where it can be unit tested cleanly
- Inline Node programs in bash disappear
- Doctor check IDs are referenced in one place, not two
- Upgrade skill (`clawperator-upgrade`) simplifies - it can call targeted CLI
  commands rather than re-running the full shell gauntlet
- APK download becomes reusable outside the install flow

**Costs**
- Any new CLI install command becomes part of the product contract; must be
  maintained and versioned
- Multi-device remediation logic must be deliberately simplified while moving,
  not ported verbatim - the current shell state machine has implicit state that
  is fragile even in bash
- Each phase requires migrating test coverage before removing the shell
  equivalent; this is not optional per project guidelines

**Lowest risk entry point:** Phase 1 (host artifact generation) has the
cleanest boundary, touches no device behavior, and removes the most embedded
Node code per line of effort.
