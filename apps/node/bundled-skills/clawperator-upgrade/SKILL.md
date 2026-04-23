---
name: clawperator-upgrade
description: Clawperator first-party bundled skill. Whole-product upgrade route for Clawperator. Checks CLI reachability, uses the CLI-first upgrade sequence when possible, and falls back to install.sh only for recovery when the CLI is not reachable.
---

# Clawperator Upgrade

Use this skill only when the current machine already has Clawperator and the
user or calling workflow has explicitly chosen a whole-product upgrade.

This is a thin packaged host-agent skill. It should route through the canonical
CLI surfaces that Clawperator already ships. It must not re-implement install
logic inside the skill body.

## What This Skill Owns

- check `clawperator --version` before mutating the host
- run the CLI-first upgrade sequence when the CLI is reachable:
  - `npm install -g clawperator@latest`
  - `clawperator operator remediate`
  - `clawperator bundled-skills update`
  - `clawperator skills install`
  - `clawperator host setup`
  - `clawperator doctor --json`
- use `curl -fsSL https://clawperator.com/install.sh | bash` only as recovery
  when `clawperator --version` is not reachable
- verify the resulting install with `clawperator doctor --json`
- report whether the host is ready, or which existing repair route is still
  blocking readiness
- keep upgrade guidance aligned with the installed first-party host-agent docs
- require explicit upgrade intent before any host mutation begins

## What This Skill Does Not Own

- do not make `install.sh` the primary path
- do not skip the `clawperator --version` reachability check
- do not invent a second upgrade-health checker beyond `clawperator doctor --json`
- do not add or imply a top-level `clawperator upgrade` command
- do not restate all setup or repair docs from memory
- do not turn passive diagnosis into an implicit upgrade
- do not keep using `install.sh` after the CLI-first path is reachable

## Workflow

### 1. Confirm explicit upgrade intent first

Only continue when the user or calling workflow has already chosen upgrade as
the next step.

Valid triggers:

- the user explicitly asked to upgrade, update, refresh, or reinstall
  Clawperator
- the calling workflow explicitly selected `clawperator-upgrade`
  as an opt-in route

Stop and do not run any host mutations yet when:

- you are still diagnosing a problem
- you are only checking readiness or inventory
- you merely suspect the install might be stale

If explicit upgrade intent is missing, stop and say that upgrade is an opt-in
host mutation.

### 2. Check CLI reachability first

Run:

```bash
clawperator --version
```

If this succeeds, use the CLI-first upgrade sequence in step 3.

If this fails, run the recovery installer:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

After recovery, re-run `clawperator --version`. If the CLI is still not
reachable, stop and report the recovery failure.

### 3. Run the CLI-first upgrade sequence

When `clawperator --version` succeeds, run these commands in order:

```bash
npm install -g clawperator@latest
clawperator operator remediate
clawperator bundled-skills update
clawperator skills install
clawperator host setup
clawperator doctor --json
```

Rules:

- use `clawperator operator remediate` as the device policy front door
- do not re-implement multi-device policy inside the skill
- use the structured CLI results rather than guessing about state
- let `clawperator host setup` write the durable host artifacts
- keep `clawperator doctor --json` as the readiness check after the sequence

### 4. Decide between ready and blocked

Use this decision table:

| Doctor result | Outcome |
| --- | --- |
| exit code `0` and `criticalOk: true` for every connected device | Report that Clawperator is ready and name the next truthful front door for the user’s task. |
| non-zero exit code or `criticalOk: false` | Summarize the failing checks and point to the existing repair route already named by doctor or the setup docs. |

Rules:

- do not invent a custom remediation tree inside this skill
- do not claim success when doctor still reports blocking issues
- do not claim success until every connected device has been checked with doctor
  and every connected device reports `criticalOk: true`
- if doctor indicates setup is incomplete, keep the next step grounded in the
  real failing surface
- if recovery was needed, report the recovery outcome before the doctor result
- do not ask the user whether to proceed with the doctor-reported repair path
  or the next command; pick the explicit next action from doctor or the setup
  docs and state it directly

### 5. Name the next truthful action

After a successful upgrade:

- if the host is unfamiliar, suggest `clawperator-agent-orientation`
- if the goal is runtime-skill discovery, suggest
  `clawperator skills for-app <package_id> --json` or
  `clawperator skills search --keyword <text> --json`
- if the user explicitly needs repair after doctor failure, point at the
  existing setup or repair guidance instead of widening scope

After a blocked upgrade:

- do not ask a follow-up question
- surface the first concrete doctor fix or nextActions item
- if doctor provides multiple fix steps, keep the response to the first
  actionable repair step and the canonical docs URL

### 6. End with a short status summary

Finish with:

- the CLI reachability result in one sentence
- the upgrade result in one sentence
- one explicit next command or one canonical doc URL

Examples:

- "Clawperator was reachable, the CLI-first upgrade sequence completed, and `clawperator doctor --json` reports `criticalOk: true`. Your next step is `clawperator-agent-orientation`."
- "Clawperator was not reachable, so I used `install.sh` as recovery only. The CLI is still not ready, so follow the recovery guidance or finish setup at `https://docs.clawperator.com/setup/`."
- "Upgrade intent is not explicit yet, so I stopped before running any host mutations."

## Output Style

Be concise. Treat `clawperator --version` as the reachability gate, the
CLI-first sequence as the normal path, and `install.sh` as recovery only. End
with one explicit next step. Name the upgrade-intent gate explicitly when you
decline to run the installer. Never ask the user to choose the next repair step
after doctor has already named it.
