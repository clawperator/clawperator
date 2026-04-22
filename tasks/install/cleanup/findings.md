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

## The Upgrade Skill - `clawperator-upgrade`

### Current behavior

`apps/node/bundled-skills/clawperator-upgrade/SKILL.md` defines one primary
upgrade action:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

The skill explicitly prohibits substituting:
- `npm install -g clawperator@latest`
- `clawperator bundled-skills update`
- `clawperator skills update`

The rationale was sound when written: none of those commands individually covered
the full install surface (CLI + APK + skills + host artifacts), so using any one
of them alone would produce an incomplete upgrade.

### Why `install.sh` is the wrong primary path for upgrades

The user's question identifies a real problem: on a machine that already has
Clawperator, re-running `install.sh` is a poor upgrade path even today, and
becomes worse after the cleanup.

**Problems with `curl ... | bash` as an upgrade path:**

1. **Security surface.** Fetching a shell script over the network and executing
   it immediately is the right pattern for first install (the machine has
   nothing yet). For upgrade on an already-trusted machine with an already-
   installed CLI, it introduces unnecessary remote-execution trust on every
   upgrade run.

2. **Bootstrap steps are wasted work.** On an upgrade, Java, Node, adb, git,
   and curl are already installed. Those checks are no-ops, but they still
   run - and on some machines they trigger slow package-manager operations even
   when nothing needs updating.

3. **Opaque result.** `install.sh` emits human-readable output but has no
   structured result contract. The upgrade skill treats it as a black box and
   can only verify the outcome by running `clawperator doctor` afterward. If a
   specific step fails mid-install the skill cannot identify which one.

4. **After the cleanup, `install.sh` itself delegates to CLI commands.** If
   the end state is a thin bootstrap stub that calls `clawperator doctor --fix`,
   `clawperator host materialize-artifacts`, etc., then running `install.sh`
   for upgrade is just a slow, network-dependent wrapper around commands the
   skill could call directly.

### What the upgrade path should be after the cleanup

Once the cleanup phases ship, a targeted upgrade sequence via CLI commands
covers everything install.sh currently handles post-bootstrap:

```bash
npm install -g clawperator@latest       # update CLI package
clawperator doctor --fix                # update APK, fix device permissions
clawperator bundled-skills update       # update bundled skills
clawperator skills install              # refresh runtime skills registry
clawperator host materialize-artifacts  # regenerate host artifacts (AGENTS.md, MCP snippet, etc.)
clawperator doctor --json               # verify
```

Each step has a structured JSON result. The skill can check each one
individually rather than treating the whole sequence as a black box.

The existing prohibition on `npm install -g clawperator@latest` as "the
primary path" was correct when that alone was insufficient. After the cleanup,
the prohibition should be replaced with guidance to run the full CLI upgrade
sequence above. The spirit - do not use a single partial command - is preserved;
only the implementation changes.

### When `install.sh` is still appropriate for upgrade

One scenario justifies falling back to `install.sh` during an upgrade: when the
host environment itself is broken - Java or Node missing or incompatible, adb
not on PATH, corrupted npm global install. In that case, the CLI commands cannot
run and the shell bootstrapper is the only recovery path.

**Recommended upgrade decision tree:**

1. Check whether the CLI is reachable: `clawperator --version`
2. If reachable, run the targeted CLI upgrade sequence above.
3. If not reachable (CLI missing, corrupt, or wrong runtime), fall back to
   `curl -fsSL https://clawperator.com/install.sh | bash` as a full
   environment repair, with an explicit note that this is a recovery path, not
   the normal upgrade path.

### Changes needed in the skill

**`SKILL.md`** - update in the same PR as Phase 1 or Phase 2 of the cleanup
(whichever introduces the first CLI command the skill should use):

- Replace "run `curl -fsSL https://clawperator.com/install.sh | bash`" as the
  primary action with the CLI upgrade sequence.
- Replace the prohibition on individual commands with the complete list of
  commands in order.
- Add the CLI-reachability check as the branch point for CLI upgrade vs
  install.sh recovery.
- Update the "What This Skill Does Not Own" list to include
  `clawperator doctor --fix` and `clawperator host materialize-artifacts` as
  things that are components of the upgrade sequence, not standalone replacements
  for it.

**`agents/openai.yaml` `default_prompt`** - update the prohibition clause to
match the new SKILL.md workflow. The current prompt says "Do not replace the
installer with `npm install -g clawperator@latest` ..."; that clause should
instead describe the full CLI upgrade sequence.

### Sequencing with the install.sh cleanup

The upgrade skill should not be updated before the CLI commands it needs exist.
Appropriate timing:

- After Phase 1 ships (`clawperator host materialize-artifacts`): update the
  artifact-writing step in the skill.
- After Phase 2 ships (expanded `clawperator doctor --fix`): update the
  remediation step.
- After Phase 3 ships (`clawperator operator download`): APK step is now
  subsumed by `doctor --fix`; no direct skill change needed.
- After all phases ship: replace the full `install.sh` primary path with the
  CLI upgrade sequence and move `install.sh` to the recovery-only path.

Do not update the skill to reference CLI commands that do not yet exist.

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
