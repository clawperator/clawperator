# install.sh Cleanup - Findings and Recommendations

## Problem statement

`sites/landing/public/install.sh` is ~2300 lines of bash. The user asked:
could portions of the install process move to the CLI itself, reducing the
shell script and preferring Python/Node over bash?

## What the script actually does

The script has two distinct concerns that have grown together:

### 1. Bootstrap (irreducible shell work, ~150 lines)

These steps require a working shell before the CLI exists. They cannot move to
the CLI because the CLI has not been installed yet.

- OS validation
- Java 17/21 check and installation (Homebrew, apt, pacman)
- Node.js >= 24 check and installation (via nvm)
- adb check and installation
- git check and installation
- curl availability check
- `npm install -g clawperator@latest`

These must stay in shell (or in a separate bootstrapper in a language that is
already universally available, like Python 3 - more on that below).

### 2. Post-install orchestration (~2150 lines)

These steps run only after the CLI is installed. They are where the bloat lives.
Almost all of this is duplicating work the CLI is better positioned to do.

The current structure:
- Calls `clawperator doctor --format json`, then re-parses the JSON output using
  inline `node -e` heredocs to decide what to do next.
- Calls `clawperator operator setup ...` to install the APK on each device.
- Calls `clawperator skills install` and `clawperator bundled-skills install`.
- Writes `~/.clawperator/AGENTS.md` using ~180 lines of inline Node.js.
- Writes `~/.clawperator/mcp-config-snippet.json` using ~100 lines of inline
  Node.js.
- Writes `~/.clawperator/install-state.json` using ~50 lines of inline Node.js.
- Updates `~/.agents/AGENTS.md` using ~70 lines of inline Node.js.
- Updates `~/.zshrc` / `~/.bashrc` / `~/.bash_profile` to export
  `CLAWPERATOR_SKILLS_REGISTRY`.
- Runs a final `clawperator doctor` pass and formats a multi-device summary.

The key observation: the script uses inline `node -e` and bash heredoc Node.js
programs to parse JSON that came from the CLI. The CLI already has that data
natively. The shell is acting as a fragile middleware layer that does not belong
there.

## What could move to the CLI

### High value - these are the biggest wins

**1. `clawperator setup finalize` (new command)**

Consolidate the four artifact-writing steps into one CLI command:

- Write `~/.clawperator/AGENTS.md` (currently ~180 lines of bash + inline Node)
- Write `~/.clawperator/mcp-config-snippet.json` (currently ~100 lines)
- Write `~/.clawperator/install-state.json` (currently ~50 lines)
- Update `~/.agents/AGENTS.md` shared bridge (currently ~70 lines)

The CLI already has the data these need: skills registry path, installed APK
version, `adb` binary location, bundled-skills install dirs. Calling `setup
finalize` post-install would replace ~400 lines of the script with one call.

The command should accept `--output json` so automation can verify it succeeded.

**2. Expand `clawperator doctor --fix` to cover multi-device APK remediation**

The current `--fix` flag on `doctor` exists but the script re-implements a
parallel multi-device scanning loop (~350 lines) that:
- Calls `doctor_device_json` per device
- Parses each result with inline Node to classify the device
- Decides which devices need APK install
- Calls `clawperator operator setup` on each target device

All of this should be `clawperator doctor --fix`. The CLI can express per-device
status in structured JSON, and the shell does not need to re-parse it.

With an expanded `--fix`, the entire `run_doctor_and_fix` function (~150 lines),
`collect_multi_device_apk_setup_targets` (~40 lines), and the
`doctor_check_status` / `doctor_report_ok` / `doctor_report_all_checks_pass` /
`doctor_check_code` helpers (~60 lines of inline Node) collapse to:

```bash
clawperator doctor --fix --operator-package "$DEFAULT_OPERATOR_PACKAGE" || exit 1
```

**3. `clawperator setup configure-shell` (new command)**

Move the shell RC update logic (currently ~40 lines iterating over `.zshrc`,
`.bashrc`, `.bash_profile`) into the CLI. The CLI can handle idempotent
`CLAWPERATOR_SKILLS_REGISTRY` export injection more robustly than the bash
grep/mktemp/mv pattern.

### Medium value

**4. `clawperator operator download` (new command)**

The APK download and SHA256 verification logic (~80 lines: `download_operator_apk`,
`verify_operator_apk`, `parse_operator_metadata`) could be a CLI command. The
metadata fetch, JSON parse, download, and checksum verification is straightforward
Node.js. It would also give users a standalone way to refresh the cached APK
outside of a full install run.

### Lower value / keep in shell

**5. Post-install device status summary**

The multi-device summary at the end of `main()` (~80 lines of per-device status
reporting) could move to the CLI as a `doctor --summary` or be an artifact of
`doctor --fix` output. Worth doing eventually but not the highest ROI.

**6. APK install prompt / non-interactive detection**

This is short and genuinely needs to interact with the terminal in a way that is
awkward from a CLI.

## What cannot move to the CLI

The bootstrap phase (OS, Java, Node, adb, git, curl, npm install) **must** stay
outside the CLI. The CLI does not exist yet when these run.

This is the irreducible ~150-line shell core. It cannot be eliminated.

## On replacing bash with Python/Node

The user noted that Python/Node is preferable to .sh scripts. The option surface:

**Option A - Keep bash for bootstrap, Python/Node for everything else**

Write a `setup.js` or `setup.py` that is invoked by a minimal bootstrap stub.
The bootstrap stub (~50 lines) installs Node, then hands off to `setup.js` which
does everything else with real language tooling. This is a clean split.

The downside: `curl ... | bash` is the canonical install pattern. Adding a
`curl ... | bash` that downloads and runs a Node or Python script is one more
layer. The bootstrap stub is still bash.

**Option B - Keep the shell script but hollow it out**

Move all the complex logic into CLI commands (as described above) and let the
shell script become a thin ~200-line orchestrator that calls them. The embedded
Node.js inline programs disappear. The bash that remains is simple linear
sequencing with no complex logic.

This is lower risk and incrementally deliverable.

**Recommendation: Option B first, Option A later if desired.**

Option B can be done in phases:
1. Add `clawperator setup finalize` and call it from install.sh - removes ~400 lines immediately.
2. Expand `doctor --fix` to cover multi-device APK remediation - removes ~350 lines.
3. Add `clawperator setup configure-shell` - removes ~40 lines.
4. Optionally add `clawperator operator download` - removes ~80 lines.

After these four phases, install.sh would shrink from ~2300 lines to roughly
200-250 lines of bootstrap + thin orchestration, with no inline Node.js programs.
A Python rewrite of that 200-line stub would then be straightforward.

## Impact on the upgrade skill

`clawperator-upgrade` (bundled skill) re-runs `install.sh`. If install.sh shrinks
to a bootstrap + CLI delegation pattern, the upgrade skill becomes simpler and
more reliable - it can call targeted CLI commands instead of re-running the full
shell gauntlet.

## Prioritized action list

| Priority | Action | Est. lines removed |
|----------|--------|--------------------|
| 1 | Add `clawperator setup finalize` command | ~400 |
| 2 | Expand `clawperator doctor --fix` for multi-device | ~350 |
| 3 | Add `clawperator setup configure-shell` | ~40 |
| 4 | Add `clawperator operator download` | ~80 |
| 5 | Rewrite remaining bootstrap stub in Python (optional) | 0 lines removed, different language |

Total potential reduction: ~2300 lines to ~250 lines of shell (bootstrap stub
only), with all logic living in the CLI where it belongs.

## Files involved

- `sites/landing/public/install.sh` - the script under evaluation
- `apps/node/src/cli/commands/doctor.ts` - add `--fix` multi-device expansion here
- `apps/node/src/cli/commands/operatorSetup.ts` - `operator download` could be a subcommand here
- `apps/node/src/cli/registry.ts` - register new commands
- New files: `apps/node/src/cli/commands/setupFinalize.ts`, `apps/node/src/cli/commands/setupConfigureShell.ts`
- `validation/install/` - new test coverage for any new CLI commands must be added here
