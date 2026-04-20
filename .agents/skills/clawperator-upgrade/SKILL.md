---
name: clawperator-upgrade
description: Whole-product upgrade route for Clawperator. Re-runs the canonical installer, verifies readiness with doctor, and reports the next blocking repair step when setup is still incomplete.
---

# Clawperator Upgrade

Use this skill only when the current machine already has Clawperator and the
user or calling workflow has explicitly chosen a whole-product upgrade.

This is a thin packaged host-agent skill. It should route through the canonical
installer and readiness checks that Clawperator already ships. It must not
re-implement install logic inside the skill body.

## What This Skill Owns

- run the canonical whole-product installer:
  `curl -fsSL https://clawperator.com/install.sh | bash`
- verify the resulting install with `clawperator doctor --json`
- report whether the host is ready, or which existing repair route is still
  blocking readiness
- keep upgrade guidance aligned with the installed first-party host-agent docs
- require explicit upgrade intent before any host mutation begins

## What This Skill Does Not Own

- do not replace `https://clawperator.com/install.sh` with a bespoke upgrade flow
- do not make `npm install -g clawperator@latest` the primary path
- do not make `clawperator agent-skills update` or `clawperator skills update`
  the primary path
- do not add or imply a top-level `clawperator upgrade` command
- do not invent a second upgrade-health checker beyond `clawperator doctor --json`
- do not restate all setup or repair docs from memory
- do not turn passive diagnosis into an implicit upgrade

## Workflow

### 1. Confirm explicit upgrade intent first

Only continue when the user or calling workflow has already chosen upgrade as
the next step.

Valid triggers:

- the user explicitly asked to upgrade, update, refresh, or reinstall
  Clawperator
- the calling workflow explicitly selected `clawperator-upgrade`
  as an opt-in route

Stop and do not run the installer yet when:

- you are still diagnosing a problem
- you are only checking readiness or inventory
- you merely suspect the install might be stale

If explicit upgrade intent is missing, stop and say that upgrade is an opt-in
host mutation.

### 2. Run the canonical installer first

Run:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

Treat this as the primary action for whole-product upgrade because it owns the
CLI install, packaged agent-skills, runtime-skills bootstrap guidance, and the
Operator APK setup path.

Do not replace this first step with direct npm self-upgrade commands.

### 3. Verify readiness with doctor

After the installer finishes, run:

```bash
clawperator doctor --json
```

Prefer the structured JSON result. Continue from the doctor output instead of
guessing whether the upgrade "probably worked."

### 4. Decide between ready and blocked

Use this decision table:

| Doctor result | Outcome |
| --- | --- |
| exit code `0` and `criticalOk: true` | Report that Clawperator is ready and name the next truthful front door for the user’s task. |
| doctor returns a blocking failure | Summarize the failing checks and point to the existing repair route already named by doctor or the setup docs. |

Rules:

- do not invent a custom remediation tree inside this skill
- do not claim success when doctor still reports blocking issues
- if doctor indicates setup is incomplete, keep the next step grounded in the
  real failing surface

### 4. Name the next truthful action

After a successful upgrade:

- if the host is unfamiliar, suggest `clawperator-agent-orientation`
- if the goal is runtime-skill discovery, suggest
  `clawperator skills for-app <package_id> --json` or
  `clawperator skills search --keyword <text> --json`
- if the user explicitly needs repair after doctor failure, point at the
  existing setup or repair guidance instead of widening scope

### 5. End with a short status summary

Finish with:

- the installer result in one sentence
- the doctor readiness result in one sentence
- one explicit next command or one canonical doc URL

Examples:

- "Upgrade was explicitly requested, the canonical installer completed, and `clawperator doctor --json` reports `criticalOk: true`. Your next step is `clawperator-agent-orientation`."
- "The installer completed, but doctor still reports blocking setup failures. Follow the doctor-reported repair path or finish setup at `https://docs.clawperator.com/setup/`."
- "Upgrade intent is not explicit yet, so I stopped before running `install.sh`."

## Output Style

Be concise. Treat `install.sh` as the upgrade authority, `doctor --json` as the
readiness authority, and end with one explicit next step. Name the
upgrade-intent gate explicitly when you decline to run the installer.
