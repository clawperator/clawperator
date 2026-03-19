# Skills Runtime Environment Configuration

## Problem

`clawperator skills run` cannot currently be pointed at a local CLI build or a
non-default operator package without workarounds. This blocks developers who
use the dev APK (`com.clawperator.operator.dev`) from running skills in their
normal workflow, and means any newly authored skill that does not know to use
the `CLAW_BIN` pattern from `common.js` will silently fail or time out on a
dev setup.

There are two separate but related gaps:

**Gap 1 - CLI binary override.** The skills repo `common.js` already supports
a `CLAW_BIN` env var, but it is undocumented in this repo, not a first-class
contract, and new skill scripts may not know to use `common.js`. The main CLI
also does not set or validate this variable before spawning the skill script.

**Gap 2 - Receiver package passthrough.** `clawperator skills run` accepts
`--device-id` and pushes it into the skill script's positional args. It accepts
no `--receiver-package` flag at all. Skill scripts either hardcode the release
package or read an unstandardized `RECEIVER_PKG` env var. There is no official
way to override the operator package for a skills run session.

---

## Solution

Standardize two env vars as official Clawperator configuration:

| Env var | Maps to | Default |
|---|---|---|
| `CLAWPERATOR_BIN` | Path to CLI binary used by skill scripts | auto-resolved: sibling build if present, else global `clawperator` |
| `CLAWPERATOR_RECEIVER_PACKAGE` | Operator package passed as `--receiver-package` on every CLI call within a skill | `com.clawperator.operator` |

These are injected into the skill script's child process environment by the
Node runner, so any script that reads them - whether via `common.js` or
directly - gets the correct values without the caller needing to thread them
through positional args.

---

## Implementation surface

### This repo (`clawperator`)

**`apps/node/src/cli/index.ts` - `skills run` dispatch**

- Accept `--receiver-package` as an option on `skills run` (currently absent).
- Before spawning the skill, resolve `CLAWPERATOR_BIN` (from the flag, the env
  var, sibling build autodiscovery, or global fallback - in that order) and
  `CLAWPERATOR_RECEIVER_PACKAGE` (from the flag or the env var), then inject
  both into the child's env explicitly.
- Update the USAGE string for `skills run` to document both flags.

**`apps/node/src/domain/skills/runSkill.ts`**

- Add an optional `env` parameter to `runSkill()` (passed as `env:` on the
  `spawn` call, merged with `process.env` so the child inherits the rest of
  the shell environment).
- The caller (`cmdSkillsRun` in `skills.ts`) resolves the two env vars and
  passes them in.
- Keep `runSkill.ts` itself free of CLI-flag logic - env resolution belongs in
  the CLI layer.

**`apps/node/src/domain/skills/skillsConfig.ts`**

- Export the two env var names as named constants:
  `CLAWPERATOR_BIN_ENV_VAR = "CLAWPERATOR_BIN"` and
  `CLAWPERATOR_RECEIVER_PACKAGE_ENV_VAR = "CLAWPERATOR_RECEIVER_PACKAGE"`.
- Export a `resolveSkillBin()` helper that implements the resolution order:
  explicit override > sibling build at known path > global `clawperator`.
  This mirrors what `common.js` does but gives the Node runner a typed,
  testable version.

**`apps/node/src/test/unit/skills.test.ts`**

Add test cases for:
- `CLAWPERATOR_BIN` set in env - verify the resolved bin is the override value
- `CLAWPERATOR_RECEIVER_PACKAGE` set in env - verify it appears in child env
- Neither set - verify defaults apply (global binary, release package)
- Both set via flag and env var - verify flag takes precedence

**`apps/node/src/cli/commands/skills.ts`**

- `cmdSkillsRun` receives `receiverPackage: string | undefined` from the CLI
  layer and merges it with the env var resolution before passing to `runSkill`.

### Sibling repo (`clawperator-skills`)

**`skills/utils/common.js`**

- Add `CLAWPERATOR_BIN` as the new canonical env var in `resolveClawBin()`,
  checked before `CLAW_BIN`. Keep `CLAW_BIN` as a deprecated alias with a
  stderr warning so existing setups do not break.
- Add `CLAWPERATOR_RECEIVER_PACKAGE` support in `runClawperator()`: when
  `receiverPkg` is not passed explicitly by the caller, fall back to
  `process.env.CLAWPERATOR_RECEIVER_PACKAGE`, then to the existing hardcoded
  default.
- This makes every skill that already uses `common.js` automatically respect
  the two new env vars without per-script changes.

**Individual skill scripts**

- Audit for scripts that read `RECEIVER_PKG` (non-standard) or hardcode
  `com.clawperator.operator` and update them to use the `common.js` pattern
  or read `CLAWPERATOR_RECEIVER_PACKAGE` directly.
- New skill scripts scaffolded via `skills new` should use `common.js` by
  default. Update the scaffold template if one exists.

---

## Naming rationale

`CLAWPERATOR_BIN` rather than `CLAW_BIN` or `CLAWPERATOR_NODE_BIN`:
- Matches the `CLAWPERATOR_` prefix used by other env vars in this repo
  (`CLAWPERATOR_RUN_INTEGRATION`, `CLAWPERATOR_RECEIVER_PACKAGE`).
- `NODE_BIN` is unnecessary qualification - there is one Clawperator binary.
- Short enough to type and set in a shell profile or `.env` file.

`CLAWPERATOR_RECEIVER_PACKAGE` rather than `CLAWPERATOR_OPERATOR_PACKAGE` or
`CLAWPERATOR_OPERATOR_PACKAGE_NAME`:
- Mirrors the existing `--receiver-package` CLI flag exactly.
- Drops `_NAME` suffix - the value is the package identifier, not a display
  name; the suffix adds no information.
- Anyone who knows `--receiver-package` immediately knows this env var.

---

## Sequencing note

This work is scoped as a standalone PR immediately after the Record PoC
(Phase 3) closes. Phase 3 validation uses the release APK and global CLI
and does not depend on this feature. The immediate motivation is developer
ergonomics for skills authoring with a dev APK setup, but the fix benefits
any skills developer regardless of the recording feature.

Changes to the skills repo must be made in lockstep with this repo and
committed as a coordinated pair. Bump the skills repo version and run the
skills smoke checks before merging either side.

---

## Documentation

- `docs/node-api-for-agents.md`: document `CLAWPERATOR_BIN` and
  `CLAWPERATOR_RECEIVER_PACKAGE` as supported env vars for `skills run` in a
  new "Environment configuration" subsection under the skills commands.
- `docs/troubleshooting.md`: update the existing "Skill returns
  RESULT_ENVELOPE_TIMEOUT" entry to reference `CLAWPERATOR_BIN` and
  `CLAWPERATOR_RECEIVER_PACKAGE` instead of the old `CLAW_BIN` workaround.
- `../clawperator-skills/docs/` or `README`: document the two env vars in
  the skills authoring guide so new skill authors know the pattern.

---

## Exit criteria

- `clawperator skills run <skill_id> --receiver-package com.clawperator.operator.dev` works without timeouts on a dev APK setup.
- `CLAWPERATOR_BIN=/path/to/local/build clawperator skills run <skill_id>` uses the specified binary.
- `CLAWPERATOR_RECEIVER_PACKAGE=com.clawperator.operator.dev clawperator skills run <skill_id>` passes the package through without a flag.
- Unit tests cover resolution order for both env vars.
- `CLAW_BIN` still works (with a deprecation warning) so existing setups do not break.
- Both repos updated and skills smoke checks pass.
