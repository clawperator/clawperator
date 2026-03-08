# Clawperator Remote Bootstrap Readiness Report

Date: 2026-03-09
Host: Mac mini running OpenClaw
Device: one USB-connected Android device detected (`<device_id>`)
Bootstrap source used: [OpenClaw Remote Bootstrap Guide](https://docs.clawperator.com/ai-agents/openclaw-remote-bootstrap/)

## Scope

I treated this as a black-box first-run agent bootstrap. I did not use repo-local setup docs or internal planning material. I started from a fresh user state by:

- moving existing `~/.clawperator` aside to `~/.clawperator.prebootstrap-20260309-064854`
- uninstalling the pre-existing global `clawperator` npm package

## Outcome

Bootstrap did not complete successfully from public materials alone.

What succeeded:

- public docs page was reachable
- public install script was reachable
- CLI installed successfully
- device was reachable over `adb`
- release APK installed manually from the installer cache
- `clawperator version --check-compat --receiver-package com.clawperator.operator` reported compatible versions
- Android accessibility service was enabled and visible in `dumpsys accessibility`

What failed:

- skills bootstrap failed because the published skills repo URL was not anonymously cloneable
- installer APK checksum validation failed because the published checksum did not match the downloaded APK
- `doctor` and `observe snapshot` could not complete a handshake against the installed release APK
- `skills sync` and therefore end-to-end skill execution could not be completed

## Exact Command Log

### Public install

Command:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

Installer result:

```text
✅ Clawperator CLI installed.
⚠️  Skills setup skipped: unable to clone the skills repository anonymously.
❌ APK checksum mismatch.
Expected: be7dfb7b7d7c3a1647a858e837b0e979f24d9a6e9e69d402274eb96bfec78b07
Actual:   23041771a12c3ac774f70d3afed59f6403fc1b3e18a3679691e2dab4c529cb6e
```

### Manual recovery attempts

Because the cached download was a valid APK file and the public recovery section explicitly says:

```text
Or install the APK manually:
adb install -r <path-to-operator.apk>
The APK is cached at ~/.clawperator/downloads/operator.apk after first install.
```

I tried:

```bash
adb install -r ~/.clawperator/downloads/operator.apk
clawperator grant-device-permissions --receiver-package com.clawperator.operator
clawperator version --check-compat --receiver-package com.clawperator.operator
clawperator doctor --receiver-package com.clawperator.operator --output pretty
```

Results:

- `adb install -r` succeeded
- permission grant succeeded for `com.clawperator.operator`
- version compatibility check succeeded
- doctor still failed with handshake timeout

Doctor failure:

```text
[FAIL] Handshake timed out.
No [Clawperator-Result] envelope received. Is the Accessibility Service running?
```

I verified the service was in fact enabled:

```bash
adb shell settings get secure enabled_accessibility_services
adb shell dumpsys accessibility
```

Both showed `com.clawperator.operator/clawperator.operator.accessibilityservice.OperatorAccessibilityService` enabled and bound.

### Smoke test commands

Version:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

Result:

```json
{"cliVersion":"0.2.0","apkVersion":"0.2.0","apkVersionCode":200900,"receiverPackage":"com.clawperator.operator","compatible":true}
```

Snapshot:

```bash
clawperator observe snapshot --receiver-package com.clawperator.operator --timeout-ms 5000 --output pretty
```

Observed behavior:

- command did not return within 12 seconds
- no stdout
- no stderr
- `--timeout-ms 5000` did not cause a visible CLI timeout exit

Skills sync:

```bash
clawperator skills sync --ref main
```

Result:

```json
{"code":"SKILLS_SYNC_FAILED","message":"Skills sync failed: Command failed: git clone https://github.com/clawpilled/clawperator-skills.git <local_user_home>/.clawperator/skills\nCloning into '<local_user_home>/.clawperator/skills'...\nfatal: could not read Username for 'https://github.com': Device not configured\n"}
```

Skills list after explicitly setting the documented env var:

```bash
CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json" clawperator skills list
```

Result:

```json
{"code":"REGISTRY_READ_FAILED","message":"ENOENT: no such file or directory, open '<local_user_home>/skills/skills-registry.json'"}
```

This error is misleading. It does not report the env var path I set. It reports an internal fallback path instead.

## Frictions Encountered

### 1. Public skills bootstrap path appears non-public

The bootstrap doc says:

```text
attempts to clone the skills repo to ~/.clawperator/skills/
```

The actual repo URL in the CLI and installer is:

```text
https://github.com/clawpilled/clawperator-skills.git
```

Anonymous clone failed with:

```text
fatal: could not read Username for 'https://github.com'
```

That makes the public bootstrap guide incomplete as written, because Phase 1 explicitly requires skills setup and Phase 2 explicitly requires `clawperator skills sync`.

### 2. Published APK artifact and published checksum were out of sync

The installer downloaded a valid APK, but its SHA-256 did not match the published `.sha256` file. This is a release-blocking bootstrap failure because the install script refuses to continue, and the public doc only says to re-run the installer.

### 3. Default receiver package did not match the installed package

Immediately after manual install, `clawperator doctor --output pretty` warned:

```text
[WARN] Wrong Operator variant installed.
  Expected com.clawperator.operator.dev but found com.clawperator.operator.
```

For a public bootstrap path, the first-run docs never explain why a freshly installed release APK would require `--receiver-package com.clawperator.operator` to get sensible results.

### 4. Subcommand help is too shallow

`clawperator --help` is useful, but `clawperator skills install --help`, `clawperator skills sync --help`, `clawperator doctor --help`, and `clawperator version --help` all printed the same top-level command list instead of subcommand-specific guidance. For a remote agent, that removes the main built-in fallback when docs and reality diverge.

### 5. Snapshot execution hung without visible timeout feedback

`clawperator observe snapshot --timeout-ms 5000` did not emit a timeout error within the requested timeout window. It simply hung until I killed it externally. That makes troubleshooting much harder than the doc implies.

### 6. `skills list` fallback error hid the real configured path

The doc says:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

After setting that exact path, `skills list` still surfaced a different fallback path in its failure message:

```text
ENOENT: no such file or directory, open '<local_user_home>/skills/skills-registry.json'
```

That would send a first-time user debugging the wrong location.

## Assumptions I Had To Make

- I assumed "start completely fresh" meant I should move aside existing `~/.clawperator` state and uninstall the globally installed npm package before beginning.
- I assumed the public release APK was still worth manually testing after checksum failure because:
  - the file was a valid APK archive
  - the bootstrap guide explicitly recommends manual `adb install -r` from the cached file as a recovery path
- I assumed the correct receiver package for public bootstrap should be `com.clawperator.operator` once the CLI itself reported the installed package was the release variant.
- I assumed the skills repo was intended to be public because the guide positions remote bootstrap as a public flow and the installer attempts anonymous HTTPS clone.

## Failures And How I Recovered

### Failure: installer could not clone skills repo

Cause:

- published skills repo URL was not anonymously cloneable

Recovery:

- none available from public materials
- I verified the failure through both the installer and `clawperator skills sync --ref main`

### Failure: installer aborted on APK checksum mismatch

Cause:

- published APK file and published checksum file were inconsistent

Recovery:

- manually installed the cached APK with `adb install -r ~/.clawperator/downloads/operator.apk`
- this allowed version compatibility checks to proceed, but did not resolve handshake failure

### Failure: `doctor` reported wrong variant installed

Cause:

- CLI default receiver package appeared to target `com.clawperator.operator.dev`, while the installed APK was `com.clawperator.operator`

Recovery:

- retried commands with `--receiver-package com.clawperator.operator`
- version compatibility check passed after that

### Failure: handshake timed out despite enabled accessibility service

Cause:

- unknown from public materials
- accessibility service was enabled and bound, broadcast dispatch was visible in logcat, but no `[Clawperator-Result]` envelope was returned

Recovery:

- none found from public materials
- I verified Android-side accessibility state to rule out the specific failure mode suggested by `doctor`

## What Worked Well

- The bootstrap page has a sensible linear structure: install, set registry, grant permissions, verify, run a skill.
- The public install script clearly reports prerequisite checks and surfaces the exact checksum mismatch.
- `clawperator version --check-compat` produced clean, actionable output once the correct receiver package was supplied.
- `doctor --output pretty` is generally readable and grouped well.
- The recovery section in the doc is the right idea. It just needs to match the real failure modes more closely.

## Recommendations

### 1. Make the skills bootstrap path genuinely public or clearly mark it as unavailable

Belongs in:

- install script (`install.sh`)
- docs site (`docs.clawperator.com`)
- CLI built-in help / doctor output

Why:

- this is a hard blocker for remote bootstrap

Concrete change:

- if the skills registry is meant to be public, publish an anonymously downloadable source of truth
- if it is not public yet, say so explicitly and do not present public bootstrap as complete

### 2. Align default receiver package with the artifact the installer actually installs

Belongs in:

- install script
- CLI built-in help / doctor output
- docs site

Why:

- a first-run user should not see "wrong variant installed" immediately after following the install flow

Concrete change:

- either install the package the CLI expects by default, or have the installer print the exact `--receiver-package` value required for subsequent commands

### 3. Improve handshake diagnostics and make timeout flags trustworthy

Belongs in:

- CLI built-in help or doctor output
- a new in-CLI guidance mechanism such as `clawperator bootstrap`

Why:

- I could prove the accessibility service was bound, yet the CLI only repeated the same generic accessibility advice

Concrete change:

- when broadcast dispatch succeeds but no envelope returns, print that distinction explicitly
- include the receiver package, device id, and whether logcat saw the broadcast dispatch
- ensure `--timeout-ms` causes a visible timeout exit within the requested bound

### 4. Fix subcommand help so it is actually subcommand help

Belongs in:

- CLI built-in help

Why:

- remote bootstrap depends on CLI help when docs drift

Concrete change:

- `clawperator skills sync --help` should describe `--ref`, expected clone location, and required env vars instead of repeating the top-level command list

### 5. Stop masking the configured registry path on failure

Belongs in:

- CLI built-in help / error output

Why:

- current error output sent me to the wrong filesystem path

Concrete change:

- if `CLAWPERATOR_SKILLS_REGISTRY` is set, surface that exact path in the error before attempting any fallback

## Top 3 Proposed Text Changes

I did not open a draft PR because the bootstrap blockers are release-surface issues and I did not want to guess at repo-owner intent. Below is the exact text I would propose.

### Proposal 1: docs site change for the bootstrap page

Target:

- `docs.clawperator.com` bootstrap guide

Add immediately after Step 2:

```md
### Skills registry availability check

Before relying on `skills install` or `skills sync`, verify that the public skills source is reachable from a fresh machine:

```bash
git ls-remote https://github.com/clawpilled/clawperator-skills.git
```

Expected result:

- the command prints refs without prompting for credentials

If this command prompts for credentials or fails with `could not read Username`, the public skills bootstrap path is not currently available. Treat that as a release issue, not a local machine issue.
```

### Proposal 2: installer output change

Target:

- `install.sh`

Replace the current post-install next-step messaging with:

```text
Installed Operator APK package: com.clawperator.operator

Use this package for first-run verification:
  clawperator grant-device-permissions --receiver-package com.clawperator.operator
  clawperator doctor --receiver-package com.clawperator.operator --output pretty
  clawperator version --check-compat --receiver-package com.clawperator.operator
```

And if skills clone fails, print:

```text
⚠️  Skills setup could not complete because the published skills source is not anonymously reachable:
    https://github.com/clawpilled/clawperator-skills.git

Public bootstrap cannot complete until that source is reachable without credentials or an alternate public registry download is provided.
```

### Proposal 3: doctor / snapshot timeout messaging

Target:

- CLI built-in diagnostics

Replace the current handshake failure wording with:

```text
[FAIL] Command broadcast was sent, but no [Clawperator-Result] envelope was observed within 5000ms.
  Device: <device_id>
  Receiver package: com.clawperator.operator
  Broadcast dispatch: sent
  Accessibility service state: enabled

Next checks:
  - Re-run with --verbose to print correlated Android log lines
  - Confirm the installed APK package matches --receiver-package
  - If this persists on a fresh public install, treat it as a runtime handshake bug
```

## Bottom Line

The current public remote bootstrap flow is not yet reliable enough for a fresh agent on a clean machine. The biggest blockers are not agent judgment issues. They are release-surface issues:

- non-public or inaccessible skills source
- mismatched APK checksum publication
- release/dev receiver package confusion
- handshake diagnostics that do not distinguish "accessibility not enabled" from "broadcast sent but runtime did not answer"
