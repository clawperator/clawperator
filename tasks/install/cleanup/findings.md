# install.sh Cleanup - Master Findings

References `validation/install/` coverage where it affects migration
decisions. All technical claims below are verified against code.

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
group. The command must accept `--output json` and report per-artifact status
(written/skipped/failed).

The command needs the following inputs at runtime, all of which the CLI can
resolve natively without shell glue:
- resolved skills registry path (same logic as `loadRegistry`)
- bundled-skills install directory (from `bundled-skills install` result)
- operator package name (from `--operator-package` or env)
- CLI binary path (for MCP snippet `command` field)
- `adb` binary path (for MCP snippet `env.ADB_PATH`)

The command must be idempotent (always overwrite) so it is safe to re-run
during upgrades.

The `write_agent_guide` function reads the installed skills registry to
produce its output. Moving it into the CLI gives it native access to that
data without the current `node - "$RUNTIME_SKILLS_REGISTRY_PATH"` heredoc.

### 2. APK download and checksum verification

This logic is product behavior, not shell bootstrap:

- metadata fetch and JSON parse (`install.sh:1371-1419`)
- APK download (`install.sh:1421-1448`)
- SHA256 verification (`install.sh:1450-1475`)

**Total: ~105 lines removed.**

The embedded `node` call to parse metadata JSON is a clear sign the shell is
fighting the problem. This belongs as a CLI subcommand under the `operator`
family, likely `clawperator operator download`.

The APK is downloaded to `~/.clawperator/downloads/operator.apk` (release) or
`~/.clawperator/downloads/operator-debug.apk` (dev). This path is already
canonical: `getOperatorPackageApkPath()` in
`apps/node/src/domain/version/compatibility.ts:46` returns exactly this path,
and the existing `readiness.apk.presence` fix step hardcodes it. The new
download command must write to the same path.

Suggested result contract: `{ localPath, operatorVersion, sha256, operatorPackage }`.

This unlocks reuse outside the first-install path (manual APK refresh, upgrade
flows) and is a prerequisite for Phase 3 working correctly.

### 3. Doctor-driven APK remediation

The installer hand-codes its own device remediation policy by calling
`clawperator doctor --json` and then re-parsing specific check IDs in shell:

- `readiness.apk.presence` (`apps/node/src/domain/doctor/checks/readinessChecks.ts:33`)
- `readiness.version.compatibility` (`readinessChecks.ts:157`)
- `device.discovery` (`apps/node/src/domain/doctor/checks/deviceChecks.ts:13`)
- `DEVICE_SHELL_UNAVAILABLE` error code (`apps/node/src/contracts/errors.ts:43`)

Relevant sections: `install.sh:1664-1727`, `1729-1769`, `1878-1942`,
`2100-2153`, `2195-2235`.

**Total: ~350 lines of shell + inline Node parsing helpers.**

**Current state of `doctor --fix`:** The flag exists
(`apps/node/src/cli/registry.ts:2544`). `DoctorService.finalize()` runs
`kind: "shell"` fix steps when `autoFix` is true
(`apps/node/src/domain/doctor/DoctorService.ts:194-209`). For the
`readiness.apk.presence` fail case, there is already one `kind: "shell"` step:
`clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device <id>`.
However, the preceding download step is `kind: "manual"` and is NOT executed by
`--fix`. This means `--fix` will attempt `operator setup` but will fail if the
APK has not been downloaded first.

**What "expand `doctor --fix`" means concretely:**

1. Change the `readiness.apk.presence` download fix step from `kind: "manual"` to
   `kind: "shell"` using `clawperator operator download` (Phase 2 command).
   This makes `--fix` fully automated for single-device APK install.
2. Add `kind: "shell"` fix steps to `readiness.handshake` fail case using
   `clawperator grant-device-permissions --device <id>` for permission recovery.
   (This command already exists.)

**Open design question - multi-device:** `doctor` takes a single `--device`.
The multi-device install loop (~200 lines of the shell logic) has no natural
home in `doctor --fix` as currently designed. Options:

- Option A: Keep the per-device loop in install.sh but replace inline Node
  parsing with `clawperator doctor --json --device <id>` calls in a thin shell
  loop. Less CLI migration, but shell stays non-trivial.
- Option B: Add a new `clawperator install remediate` command that accepts no
  `--device` and loops over all connected devices internally, running
  `operator download` + `doctor --fix --device <id>` for each. Shell becomes a
  single call.
- Option C: Add `--each-device` to doctor. More complex, but reusable outside
  install.

**This design choice must be made before implementation.** Option B is the
cleanest boundary. It separates the "loop over devices" orchestration from
the per-device fix logic, and it gives the upgrade skill a single command to
call instead of a loop.

### 4. Shell RC mutation - likely deletable, not just moveable

After `clawperator skills install`, the script rewrites `~/.zshrc`,
`~/.bashrc`, and `~/.bash_profile` to export `CLAWPERATOR_SKILLS_REGISTRY`
(`install.sh:530-556`).

**Fallback mechanics (verified):** When `CLAWPERATOR_SKILLS_REGISTRY` is not
set, `loadRegistry` (`localSkillsRegistry.ts:79`) first tries
`{process.cwd()}/skills/skills-registry.json` (cwd-relative default). If that
fails with ENOENT, it tries `~/.clawperator/skills/skills/skills-registry.json`
(installed-home) as a fallback. For an installed user whose cwd is not the
repo root, the cwd-relative attempt fails silently and the installed-home path
succeeds - no warning is emitted when the fallback succeeds.

**Consequence:** For users who run `clawperator` from an arbitrary working
directory (the common case for installed users), the RC mutation is
unnecessary. The installed-home fallback works.

**Recommendation:** Remove the RC mutation. Print the export command as
optional advice for users with non-standard registry paths. Confirm the
installed-home fallback is documented as the supported default path before
removing.

**Caveat:** Do not remove the RC mutation until the installed-home fallback
path is confirmed in `docs/setup.md` as the official default. If docs
currently say "set CLAWPERATOR_SKILLS_REGISTRY", fix the docs first.

---

## Recommended Phasing

Phase ordering is constrained by dependencies. Phase 2 (`operator download`)
must ship before Phase 3 (`doctor --fix` expansion) because `--fix` needs
`operator download` as the shell step for APK acquisition.

### Phase 1 - Add `clawperator host materialize-artifacts`

Add a new `host materialize-artifacts` command covering `write_install_state`,
`write_mcp_config_snippet`, `write_agent_guide`, and `write_shared_agent_bridge`.
Replace the four shell functions with one CLI call.

**New files:**
- `apps/node/src/cli/commands/hostMaterializeArtifacts.ts`
- Register under a `host` group in `apps/node/src/cli/registry.ts`

**Test requirements:**
- Unit tests for each artifact writer (install-state schema, MCP snippet
  structure, AGENTS.md content, shared bridge marker-block insert/update)
- CLI regression: `--output json` emits valid JSON with per-artifact status;
  `--output pretty` prints human-readable summary
- Idempotency test: running twice produces the same output files
- Edge case: `~/.agents/AGENTS.md` does not exist - must skip bridge without
  failing

**Validation suite migration:** `test_agent_skills.sh` assertions for artifact
writers move to Node unit tests. Shell harness must be updated in the same PR
(not deferred) per CLAUDE.md requirements.

**Docs update required:** `docs/setup.md` - document the new command as the
canonical way to regenerate host artifacts after a manual CLI upgrade.

**Impact:** ~400 lines removed from install.sh; embedded Node heredocs gone.

### Phase 2 - Add `clawperator operator download`

Move APK metadata fetch, download, and SHA256 verification into a new
`operator download` subcommand.

**New surface:** `clawperator operator download [--operator-package <pkg>] [--output <json|pretty>]`

**Behavior:**
- Fetch metadata from `APK_METADATA_URL` (default: `https://downloads.clawperator.com/operator/latest.json`)
- Download APK to `getOperatorPackageApkPath(operatorPackage)` (canonical path
  shared with `readiness.apk.presence` fix step)
- Verify SHA256 checksum
- Emit `{ localPath, operatorVersion, sha256, operatorPackage }` on `--output json`

**Test requirements:**
- Unit tests: metadata JSON parse (valid, malformed, missing fields), SHA256
  match and mismatch, download path selection by package variant
- CLI regression: `--output json` on success; `--output json` on checksum
  mismatch (non-zero exit, structured error); `--operator-package` with unknown
  value; network error behavior
- Exit-code contract: 0 on success, non-zero on download or verification failure

**Validation suite migration:** APK download/verify logic moves from
`test_main.sh` stubs to Node unit tests. Shell stubs for download in
`test_main.sh` must be replaced with stubs for `clawperator operator download`
in the same PR.

**Docs update required:** `docs/api/` - document `operator download` command,
flags, result contract, and error codes.

**Impact:** ~105 lines removed from install.sh.

### Phase 3 - Expand `doctor --fix` and resolve multi-device design

Requires Phase 2 to be complete.

**Single-device `--fix` expansion:**
1. In `apps/node/src/domain/doctor/checks/readinessChecks.ts`, change the
   APK download step for `readiness.apk.presence` fail from `kind: "manual"` to
   `kind: "shell"` with value `clawperator operator download [--operator-package <pkg>]`.
   The existing `kind: "shell"` operator setup step is already correct.
2. In the `readiness.handshake` fail case, add a `kind: "shell"` fix step:
   `clawperator grant-device-permissions --device <id> [--operator-package <pkg>]`.
   (The command already exists; it just isn't wired as a fix step.)

**Multi-device surface (must be decided before implementation):**
Choose one option from the design question in the "What Should Move" section.
The recommendation is Option B: add `clawperator install remediate` that loops
over connected devices and calls per-device `operator download` + `doctor --fix
--device <id>`. This collapses `run_doctor_and_fix`,
`collect_multi_device_apk_setup_targets`, and `doctor_each_connected_device`
into a single CLI call from the shell.

**Test requirements:**
- Unit tests for the new/changed fix steps in `readinessChecks.ts`
- CLI regression for `doctor --fix` with APK absent: verify it now runs
  download before setup
- CLI regression for `doctor --fix` with handshake fail: verify it runs
  grant-device-permissions
- Integration or emulator test for single-device `--fix` end-to-end (APK
  missing -> fix -> doctor passes)
- For Option B: unit tests for `install remediate` device enumeration and
  per-device result aggregation

**Validation suite migration:** `test_main.sh` and `test_multidevice.sh` stubs
for `run_doctor_and_fix` move to CLI integration tests. Shell stubs must be
updated in the same PR.

**Docs update required:** Update `docs/setup.md` to document `doctor --fix` as
an automated repair path and the new `--fix` behavior for APK presence and
handshake failures.

**Impact:** ~350 lines removed from install.sh.

### Phase 4 - Delete shell RC mutation

Remove the `CLAWPERATOR_SKILLS_REGISTRY` shell profile edits from install.sh.

**Before removing:**
1. Confirm `docs/setup.md` documents the installed-home fallback
   (`~/.clawperator/skills/skills/skills-registry.json`) as the supported
   default path, not the env var.
2. Confirm no existing test or smoke check asserts that the env var is set after
   install.

**Impact:** ~40 lines removed; fewer surprising host side-effects.

---

## End State

After all phases, `install.sh` becomes a ~200-line bootstrap stub:

1. OS validation
2. Java install
3. Node.js install (nvm)
4. adb / git / curl checks
5. `npm install -g clawperator@latest`
6. `clawperator operator download` (fetch latest release APK)
7. `clawperator install remediate` or `clawperator doctor --fix` (install APK per device, grant permissions)
8. `clawperator skills install`
9. `clawperator bundled-skills install`
10. `clawperator host materialize-artifacts`
11. `clawperator doctor --json` (final structured verification)

Step 6 uses `--json` for the final check so install.sh can test `criticalOk`
and exit non-zero on failure without parsing human-readable output.

No inline Node programs. No embedded product logic. No re-parsing of CLI JSON
output. All Clawperator-specific behavior lives in the CLI.

---

## Impact On The Validation Suite

The current `validation/install/` harnesses test shell behavior directly and
will need to migrate as logic moves into the CLI. Per CLAUDE.md, coverage must
be maintained in the same PR - removing a shell test without adding CLI test
coverage is not acceptable.

| Harness | Current coverage | Migration path |
|---------|-----------------|----------------|
| `test_agent_skills.sh` (~600 lines) | artifact writers, skills glue, install-state, MCP config, shared bridge | Node unit tests in Phase 1 same PR |
| `test_main.sh` (~1167 lines) | main() smoke, APK remediation, multi-device flows, doctor integration | Split: APK/doctor logic to CLI integration tests (Phase 2-3); thin shell smoke updated in same PR |
| `test_multidevice.sh` (~600 lines) | multi-device APK install, device states, setup prompts | CLI integration tests for Phase 3; shell harness updated in same PR |
| `test_java.sh` (~800 lines) | Java check and provisioning | Stays as-is; bootstrap logic remains in shell |
| `lib/json_assert.sh` | shared JSON assertion helpers | Stays as-is or replaced by CLI contract tests |

---

## The Upgrade Skill - `clawperator-upgrade`

### Current behavior

`apps/node/bundled-skills/clawperator-upgrade/SKILL.md` defines one primary
upgrade action: `curl -fsSL https://clawperator.com/install.sh | bash`.

The skill prohibits substituting: `npm install -g clawperator@latest`,
`clawperator bundled-skills update`, `clawperator skills update`.

That rationale was sound when written: none of those commands alone covered the
full install surface. After the cleanup, the combined CLI sequence does.

### Why `install.sh` is the wrong primary path for upgrades

On a machine that already has Clawperator, re-running `install.sh` is a poor
upgrade path:

1. **Security surface.** `curl ... | bash` is appropriate for first install on
   a machine with nothing. For upgrade, it introduces remote-execution trust on
   every run.
2. **Bootstrap steps are wasted work.** Java, Node, adb, git, curl are already
   installed. Some checks still invoke package managers even when nothing needs
   updating.
3. **Opaque result.** `install.sh` has no structured result contract. The skill
   can only verify by running `doctor` afterward; individual step failures are
   invisible.
4. **After cleanup, install.sh delegates to CLI commands anyway.** Running it
   for upgrade is a slow network-dependent wrapper around commands the skill
   could call directly.

### Correct upgrade path after cleanup

```bash
npm install -g clawperator@latest
clawperator install remediate          # or doctor --fix per device
clawperator bundled-skills update
clawperator skills install
clawperator host materialize-artifacts
clawperator doctor --json              # verify criticalOk: true per device
```

Each step has a structured JSON result. The prohibition on
`npm install -g clawperator@latest` as "the primary path" is replaced by
"do not use any single command as a substitute for the full upgrade sequence."

### When `install.sh` remains appropriate

Only when the host environment is broken: Java or Node missing or incompatible,
adb not on PATH, corrupted npm global install. In that case CLI commands cannot
run and `install.sh` is the only recovery path.

**Decision tree for the skill:**
1. Check: `clawperator --version` succeeds?
2. Yes: run the CLI upgrade sequence above.
3. No: fall back to `curl -fsSL https://clawperator.com/install.sh | bash` as
   environment repair, with explicit note this is a recovery path.

### Skill changes required (timed to phase completion)

Do not update the skill to reference commands that do not yet exist.

**After Phase 1 ships** (`host materialize-artifacts`):
- Add `clawperator host materialize-artifacts` to the upgrade sequence in SKILL.md
- Update SKILL.md "What This Skill Does Not Own" to note it is a required
  upgrade step, not a standalone substitute

**After Phase 2 ships** (`operator download`):
- Add `clawperator operator download` step (or note it is subsumed by
  `install remediate` / `doctor --fix`)

**After Phase 3 ships** (multi-device remediation command + `--fix` expansion):
- Replace `doctor --fix` step description with the resolved multi-device command

**After all phases ship** (final skill update):
- Replace `curl -fsSL ... | bash` as the primary action with the full CLI
  upgrade sequence
- Add the CLI-reachability check as the branch point
- Update `agents/openai.yaml` `default_prompt` to match
- Move `install.sh` to the recovery-only path in the skill

**A single coordinated skill update after all phases is preferable** to four
incremental partial updates, since the skill is consumed by agents in
production. Partial updates risk agents mixing new and old guidance.

---

## Open Design Questions

These must be resolved before implementation begins on their respective phases.

**Q1 (Phase 3): Multi-device surface**

Which option for replacing the multi-device install loop?

- Option A: Thin shell loop calling `clawperator doctor --json --device <id>`
  per device, keeping loop orchestration in install.sh
- Option B: New `clawperator install remediate` command that enumerates
  connected devices and runs per-device `operator download` + `doctor --fix`
  internally (recommended)
- Option C: `doctor --each-device` flag

Decision affects whether install.sh retains any device-probing logic and what
the upgrade skill calls.

**Q2 (Phase 1): Command group name**

`clawperator host materialize-artifacts` vs `clawperator setup materialize`
vs `clawperator artifacts write` vs another shape. Pick one before
implementation and add to registry.

**Q3 (Phase 4): RC mutation removal prerequisite**

Before deleting the RC mutation, confirm: does any existing user-facing
documentation or setup flow require `CLAWPERATOR_SKILLS_REGISTRY` to be set?
Check `docs/setup.md` and `docs/api/`. If yes, update docs to reference the
installed-home fallback first.

---

## Risks And Tradeoffs

**Benefits**
- Product logic moves into TypeScript where it can be unit tested cleanly
- Inline Node programs in bash disappear
- Doctor check IDs are referenced in one place, not two
- Upgrade skill simplifies - targeted CLI commands instead of install.sh
- APK download becomes reusable outside the install flow

**Costs**
- Each new CLI command is part of the product contract and must be maintained
- Multi-device remediation must be deliberately simplified while moving, not
  ported verbatim
- Each phase requires migrating test coverage in the same PR - this is
  non-negotiable per CLAUDE.md

**Lowest risk entry point:** Phase 1 (host artifact generation) has the
cleanest boundary, touches no device behavior, and removes the most embedded
Node code per line of effort. It is also independent of the open design
questions.
