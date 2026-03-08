# Agent Bootstrap Session Notes

**Date:** 2026-03-08
**Agent:** Claude Sonnet 4.6 (claude-sonnet-4-6)
**Host:** macOS Darwin 24.6.0 (Mac mini)
**Device:** Samsung Android (serial <device_serial>), single device connected via USB

---

## Objective

Follow public Clawperator installation instructions from scratch (as a remote agent would), reach a working state, and document every friction point for doc improvement.

---

## What Was Attempted

Starting from zero Clawperator install, following only what a remote agent could find at `https://clawperator.com` and `https://docs.clawperator.com`:

1. Run `curl -fsSL https://clawperator.com/install.sh | bash`
2. Verify CLI installation
3. Run `clawperator doctor`
4. Resolve failures
5. Install skills
6. Run the `com.android.settings.capture-overview` skill

**Outcome: Success.** All six steps completed. The skill produced a full Android Settings UI snapshot.

---

## Step-by-Step Findings

### Step 1: Installer (`curl -fsSL https://clawperator.com/install.sh | bash`)

**What worked:**
- Node.js 22 detected automatically
- `adb` detected at `/opt/homebrew/share/android-commandlinetools/platform-tools/adb`
- `git` and `curl` detected
- CLI installed to `/opt/homebrew/bin/clawperator` (v0.1.4)
- APK (0.1.4) downloaded, checksum verified, installed on device (`Performing Streamed Install / Success`)

**Issues encountered:**

1. **/dev/tty errors during piped execution:**
   Two non-fatal errors appeared:
   ```
   bash: line 462: /dev/tty: Device not configured
   bash: line 463: /dev/tty: Device not configured
   ```
   These are caused by the install script attempting interactive `/dev/tty` reads while being run via `| bash` (which closes stdin). The errors were non-fatal and installation completed, but they may alarm agents. The installer should guard these reads with a TTY check (`[ -t 0 ]`) or skip them silently in non-interactive mode.

2. **Skills setup failed silently with misleading message:**
   The installer said:
   ```
   ⚠️ Skills setup skipped: unable to update the skills repository without interactive GitHub credentials.
   ```
   The real failure was `git pull` failing because `~/.clawperator/skills` was a local git repo with no upstream tracking branch configured. The error message blamed GitHub credentials, which is incorrect and misleading. An agent following this would not know whether the skills repo requires authentication (it does not - it is public, accessible via SSH).

   Resolution required manually:
   - Adding `git@github.com:clawpilled/clawperator-skills.git` as origin
   - Running `git fetch origin && git reset --hard origin/main`

3. **Skills directory left in broken state:**
   After the installer completes, `~/.clawperator/skills/skills-registry.json` exists but contains `{"version": "1.0", "skills": []}` - an empty registry. No error is surfaced during the install. A subsequent `clawperator skills list` returns a `REGISTRY_READ_FAILED` error from a completely wrong path (see Step 4 below) rather than "skills not installed."

### Step 2: CLI Verification

**Issue - `clawperator version` is not a valid command:**
The docs (e.g. `docs/node-api-for-agents.md`) refer to `clawperator version` as a CLI command. The actual CLI responds:
```json
{"code":"USAGE","message":"Unknown command: version. Use --help."}
```
The correct invocation is `clawperator --version`. The docs need to reflect this.

**Installed version:** 0.1.4 (CLI). APK 0.1.4 (dev variant: `com.clawperator.operator.dev`).

### Step 3: `clawperator doctor`

First run result:
```
✅ Node version v22.22.0 is compatible.
✅ adb is installed.
✅ adb server is healthy.
✅ Device <device_serial> is connected and reachable.
✅ Device shell is available.
✅ Operator APK (com.clawperator.operator.dev) is installed.
✅ Developer options are enabled.
✅ USB debugging is enabled.
❌ Handshake timed out.
   Detail: No [Clawperator-Result] envelope received. Is the Accessibility Service running?
```

The Accessibility Service was not enabled. Doctor exit code was non-zero (correct behavior).

### Step 4: Enabling the Accessibility Service

**Critical gap: No agent-safe path to enable the Accessibility Service.**

The public troubleshooting docs point to:
```
./scripts/clawperator_grant_android_permissions.sh
```
This script is in the source repository - not available to a remote agent that only ran the installer. There is no `clawperator` CLI command to enable the accessibility service.

**Resolution used (manual adb):**
First, discovered the service class name via:
```bash
adb -s <device_serial> shell pm dump com.clawperator.operator.dev | grep AccessibilityService
# Output: com.clawperator.operator.dev/clawperator.operator.accessibilityservice.OperatorAccessibilityService
```

Then enabled it:
```bash
adb -s <device_serial> shell settings put secure enabled_accessibility_services \
  "com.clawperator.operator.dev/clawperator.operator.accessibilityservice.OperatorAccessibilityService"
adb -s <device_serial> shell settings put secure accessibility_enabled 1
```

After a 3-second settle, `clawperator doctor` passed:
```
✅ Handshake successful.
✅ Verified state reached.
```

**This is a major gap for the agent bootstrap path.** See "Key Issues for Documentation" below.

### Step 5: Skills Installation

**Issue 1 - Wrong registry path from CLI:**
After the failed installer skills step, running `clawperator skills list` failed with:
```json
{"code":"REGISTRY_READ_FAILED","message":"ENOENT: ... '<worktree_path>/skills/skills-registry.json'"}
```
The CLI derived the registry path relative to the current working directory rather than using `~/.clawperator/skills`. The path it tried was inside the development repo worktree - clearly wrong for a user running the global CLI.

**Issue 2 - `CLAWPERATOR_SKILLS_REGISTRY` env var required but not mentioned post-install:**
The fix was setting:
```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```
The installer completion message does not instruct the agent to set this. The docs mention it but only as an aside in the API reference.

After fixing the skills directory (fetching from the public repo via SSH) and setting the env var, `clawperator skills list` returned 10 skills.

**Issue 3 - `skills install` and `skills update` commands not present:**
The public docs reference `clawperator skills install` and `clawperator skills update`. Neither command exists in the installed CLI (v0.1.4). Only `skills sync --ref <git-ref>` is available. Even this could not be used because the skills repo had no upstream remote configured.

### Step 6: Running the Skill

**Issue - `clawperator skills run` not available:**
The docs and landing page imply `clawperator skills run <skill_id>` works. In v0.1.4, this command does not exist. The CLI returned:
```json
{"code":"USAGE","message":"skills list|get|compile-artifact|sync ..."}
```

**Resolution:** Read `SKILL.md` to find the shell script invocation. The skill is a Node script wrapped in a bash launcher:
```bash
~/.clawperator/skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh <device_id> [receiver_package]
```

**Issue - Arg order not obvious from SKILL.md:**
The SKILL.md shows:
```bash
./skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh
./skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh <receiver_package>
```
This implies the first (optional) arg is `receiver_package`. The actual script (`capture_settings_overview.js`) reads `argv[2]` as `device_id` and `argv[3]` as `receiver_package`. An initial invocation passing only `com.clawperator.operator.dev` (assuming it was the receiver) caused the device serial to be used as the device ID - which failed.

**Successful invocation:**
```bash
ADB_SERIAL=<device_serial> \
  bash ~/.clawperator/skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh \
  <device_serial> com.clawperator.operator.dev
```

Output: Full Android Settings UI XML snapshot (29.5KB), prefixed with `✅ Settings Overview captured`.

---

## Key Issues for Documentation

### CRITICAL: Accessibility Service has no agent-safe enablement path

The single biggest blocker in a remote bootstrap is the accessibility service. An agent that only ran the installer has no documented way to enable it without either:
- Physical access to the device screen (tap through Settings > Accessibility)
- The source repo (for the grant permissions script)

**Recommendation:** Add a `clawperator doctor --fix` flow (the CLI shows this command exists but it was not tested) or add an explicit `clawperator setup-device` command that runs the adb-based accessibility grant. Document the manual adb commands as a fallback in `openclaw-remote-bootstrap.md`. The exact commands needed are:
```bash
# Discover the service class name
adb shell pm dump <package> | grep AccessibilityService

# Enable it
adb shell settings put secure enabled_accessibility_services \
  "<package>/<service_class>"
adb shell settings put secure accessibility_enabled 1
```

### HIGH: Skills setup left in broken state by installer

The installer leaves `~/.clawperator/skills/` as a local git repo with no remote and an empty registry. The failure message blames "GitHub credentials" but the real issue is a missing upstream tracking branch. An agent that reads this message may unnecessarily attempt to authenticate.

**Recommendation:** Improve the installer to either:
- Always clone fresh (not rely on an existing dir), or
- Detect no-remote state and add the public remote automatically
- Correct the error message to say "git remote not configured" rather than "GitHub credentials"

### HIGH: `CLAWPERATOR_SKILLS_REGISTRY` must be set but is not in the installer completion output

After install, the env var must be exported for `clawperator skills list` to work. This is not mentioned in the installer completion summary or in any prominent early-setup doc.

**Recommendation:** Add to the installer's "Next steps" output:
```
Add to your shell profile:
  export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

### MEDIUM: CLI/docs mismatch on several commands

Commands documented but not present in v0.1.4:
- `clawperator version` (use `clawperator --version`)
- `clawperator skills install` (use manual git clone + env var)
- `clawperator skills update` (use `clawperator skills sync --ref main`)
- `clawperator skills run` (invoke skill script directly)

### MEDIUM: SKILL.md arg order is misleading

`com.android.settings.capture-overview/SKILL.md` shows the first arg as `<receiver_package>`. The script treats the first arg as `<device_id>`. They should match.

### LOW: `/dev/tty` errors in piped install

Non-fatal but should be suppressed or guarded in non-interactive mode to avoid alarming agents.

---

## Successful Path (Summary for `openclaw-remote-bootstrap.md`)

A working end-to-end path from scratch, documented for reproducibility:

```bash
# 1. Install
curl -fsSL https://clawperator.com/install.sh | bash

# 2. Add to shell profile (or export for session)
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"

# 3. Fix skills repo (if installer skipped it)
cd ~/.clawperator/skills
git remote add origin git@github.com:clawpilled/clawperator-skills.git
git fetch origin
git reset --hard origin/main
cd -

# 4. Enable accessibility service via adb
DEVICE_ID=<device_serial>
PACKAGE=com.clawperator.operator.dev  # or com.clawperator.operator for release APK
SERVICE_CLASS="clawperator.operator.accessibilityservice.OperatorAccessibilityService"
adb -s $DEVICE_ID shell settings put secure enabled_accessibility_services "${PACKAGE}/${SERVICE_CLASS}"
adb -s $DEVICE_ID shell settings put secure accessibility_enabled 1
sleep 3

# 5. Verify
clawperator doctor --output pretty

# 6. Run the settings skill
bash ~/.clawperator/skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.sh \
  $DEVICE_ID $PACKAGE
```

---

## Trust Boundary Observation

The accessibility service enablement step (Step 4) is fully automatable via adb. There is no step that strictly requires on-device user interaction, provided:
- The device already has USB debugging authorized for this host (the RSA key was accepted on a prior connection)
- The device is unlocked

If this is a fresh device that has never been connected to this host, the USB debugging authorization prompt on the device still requires a human tap. This is an OS-level security gate and cannot be bypassed via adb.
