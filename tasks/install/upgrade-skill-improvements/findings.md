# Upgrade Skill Improvement Findings

Review date: 2026-04-25

Reviewed surfaces:

- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
- `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`
- prior Codex session `019dc1ea-eaee-7e11-9db9-3e3d255cbcdf`
- commit `223911092ae7c29af6d6acc8b409db18f4579da0`

## Context

The reviewed Codex session attempted to run the `clawperator-upgrade` bundled
skill from a non-interactive host-agent shell. The session incorrectly treated
`brew`, `npm`, `adb`, and `clawperator` as unavailable even though the user
confirmed those tools were installed and reachable from their interactive
shell.

That confusion points to a skill-spec gap. The upgrade skill correctly defines
the high-level route: prefer the CLI-first upgrade path when the current host is
already viable, and use `install.sh` only as bootstrap or recovery. However, it
does not currently tell agents how to distinguish a missing tool from a
non-interactive `PATH` mismatch before they classify the host as needing
recovery.

## Findings

### 1. Add a PATH discovery gate before treating host tools as absent

Current issue:

- the skill tells agents to run bare commands such as `clawperator --version`,
  `node -v`, and `java -version`
- if `clawperator --version` fails, the skill immediately routes to
  `install.sh`
- in a host-agent shell, a bare command can fail because the non-interactive
  shell did not inherit the user's interactive `PATH`
- this can make an installed tool look absent and can cause the agent to run
  the wrong recovery path

Suggested tightening:

- before declaring a tool absent, capture the shell resolution context:

```bash
printf 'PATH=%s\n' "$PATH"
command -v clawperator || true
command -v node || true
command -v npm || true
command -v java || true
command -v adb || true
command -v brew || true
```

- on macOS, probe common Homebrew locations before concluding that Homebrew is
  missing:

```bash
/opt/homebrew/bin/brew --version
/usr/local/bin/brew --version
```

- when a Homebrew binary is found outside `PATH`, activate its shell
  environment for the current command sequence before continuing:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

  or the matching `/usr/local/bin/brew shellenv`.

- classify exit code `127` as "command not found in this shell" rather than
  proof that the tool is not installed on the machine
- once a reliable absolute path or repaired `PATH` is found, continue with that
  resolved environment instead of repeatedly retrying the same bare commands

Why it matters:

- the installer and host-agent design already recognize that shell rc
  propagation is not a reliable host-agent mechanism
- adding this gate keeps the skill from mistaking a Codex or GUI-agent shell
  mismatch for a missing Clawperator install
- this preserves the intended install architecture because the skill still does
  not re-implement installer logic; it only verifies command reachability more
  carefully before choosing a route

### 2. Require npm reachability before the CLI-first upgrade path

Current issue:

- the skill's CLI-first viability gate checks Node and Java, but the CLI-first
  sequence depends on `npm install -g clawperator@latest`
- if `npm` is not reachable in the agent shell, the upgrade will fail after the
  skill has already chosen the CLI-first path
- this happened in the reviewed session: `npm` appeared unavailable through the
  Codex command runner even though the user's host had working tooling

Suggested tightening:

- include `npm` in the pre-mutation viability checks:

```bash
node -v
npm -v
java -version
```

- if `npm` fails, classify it through the same PATH-discovery gate before
  deciding whether to:
  - continue with a repaired environment
  - use `install.sh` as bootstrap or recovery
  - stop with a concrete PATH repair note

Why it matters:

- `npm` is a hard dependency of the documented CLI-first sequence
- checking it up front gives the agent a deterministic route instead of a
  partial upgrade attempt followed by ambiguous failure handling

## Intentionally Excluded Finding

Do not add a finding that requires `--output json` on the upgrade skill's
`clawperator install` or `clawperator doctor` examples.

Commit `223911092ae7c29af6d6acc8b409db18f4579da0` formalized JSON as the
default CLI output contract. It preserved explicit selectors such as `--json`,
`--output json`, and `--format json`, but intentionally updated main-repo
examples and bundled skill guidance so default examples do not need optional
JSON flags.

The upgrade skill can still say "use the structured CLI results" because bare
CLI commands already produce JSON by default. Adding `--output json` back to
the examples would work, but it would contradict the cleanup direction from
that commit and make the guidance noisier without changing the contract.

## Follow-up Scope

Expected implementation scope:

- update `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
- mirror the condensed guidance in
  `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`
- consider whether permanent host-agent docs should mention this PATH
  classification rule if it proves broadly useful outside the upgrade skill

Validation expectations:

- no Android runtime validation should be needed for wording-only skill changes
- run the Node build and bundled-skill tests if the packaged skill contents or
  tests are touched
- if generated docs include the bundled skill text, regenerate docs through the
  docs-build workflow rather than editing generated output by hand
