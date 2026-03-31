# Env Var Reference Work Breakdown

Parent plan: `tasks/docs/envvars/plan.md`

## Executive Summary

1 PR, 1 phase. Read source first, write docs from what you see, verify build.

| Sub-phase | Purpose | Agent tier |
| --- | --- | --- |
| 1a | Source research: verify each var's resolution order in code | fast |
| 1b | Write `docs/configuration.md` + cross-reference + nav entry | default |
| 1c | Regenerate `.build/`, run `./scripts/docs_build.sh`, verify | fast |

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total sub-phases | 3 (1a-1c) |
| Completed | none |
| Remaining | 1a, 1b, 1c |
| Current / Next | 1a |
| Blockers | `tasks/docs/gaps/` PR must be merged first |

## Hard Rules

1. Read the source files listed in the plan before writing a single line of docs.
2. Every resolution order statement must be traceable to a source file line.
   Record the file and approximate line in `findings.md`.
3. Do not document `CLAWPERATOR_CMD` - it is an eval harness internal, not a
   public env var.
4. Do not copy from `CLAUDE.md`. CLAUDE.md is internal repo instructions, not
   a public contract. If it disagrees with the source, the source is correct.
5. Use the `docs-author` skill at `.agents/skills/docs-author/` for authoring
   and style guidance.
6. Never edit `sites/docs/.build/` directly.
7. Run `./scripts/docs_build.sh` only after all authored content is complete.
8. No em dashes. Use regular dashes.
9. Do not shorten "Clawperator" to "Claw".
10. One commit per sub-phase.
11. Update this file's Status section after each sub-phase.

## Required Reading

Read these IN THIS ORDER before writing anything.

| Order | File | Why |
| --- | --- | --- |
| 1 | `tasks/docs/envvars/plan.md` | Scope, env vars, source of truth |
| 2 | `apps/node/src/cli/selectorFlags.ts` | Flag and env var resolution for device and operator package |
| 3 | `apps/node/src/contracts/selectors.ts` | Selector types and defaults |
| 4 | `apps/node/src/contracts/errors.ts` | Error codes for invalid/missing values |
| 5 | `apps/node/src/cli/registry.ts` | All CLI commands and global flags |
| 6 | `docs/setup.md` | Existing `--device` and `--operator-package` coverage to match style and avoid duplication |
| 7 | `sites/docs/mkdocs.yml` | Current nav structure to find correct placement |

## PR / Phase Plan

| PR | Purpose | Included sub-phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Env var reference page | 1a, 1b, 1c | fast/default/fast | All acceptance criteria in plan.md pass; docs build succeeds |

---

## Sub-phase 1a: Source Research

### Agent Tier

fast

### Goal

Determine the real resolution order for each env var by reading source.
Record findings before writing any docs.

### Files To Read

- `apps/node/src/cli/selectorFlags.ts`
- `apps/node/src/contracts/selectors.ts`
- `apps/node/src/contracts/errors.ts`
- Any other files that reference `CLAWPERATOR_BIN`, `CLAWPERATOR_OPERATOR_PACKAGE`,
  or `ANDROID_SERIAL` (search the `apps/node/src/` tree)

### Steps

1. Search for `CLAWPERATOR_BIN` in `apps/node/src/`:
   ```bash
   grep -rn "CLAWPERATOR_BIN" apps/node/src/
   ```
   Record: does it exist as a real env var read? What is the fallback?

2. Search for `CLAWPERATOR_OPERATOR_PACKAGE`:
   ```bash
   grep -rn "CLAWPERATOR_OPERATOR_PACKAGE\|operator.*package\|operatorPackage" apps/node/src/
   ```
   Record: resolution order (flag > env var > auto-detect > default).

3. Search for `ANDROID_SERIAL`:
   ```bash
   grep -rn "ANDROID_SERIAL" apps/node/src/
   ```
   Record: is it read by the CLI? What is the fallback?

4. For each var, note:
   - The exact source file and line where it is read
   - The fallback chain (flag > env var > default)
   - The default value when nothing is set
   - The error code emitted when the value is invalid or the resolved target
     is not available

5. Create `tasks/docs/envvars/findings.md` with:
   ```
   ## ANDROID_SERIAL
   Source: <file:line>
   Resolution: <actual order found in code>
   Default: <value>
   Error when wrong: <error code(s)>

   ## CLAWPERATOR_BIN
   Source: <file:line or "not found in Node CLI source">
   Resolution: <actual order found>
   Default: <value>
   Error when wrong: <error code(s)>
   Notes: <any discrepancy with plan.md assumptions>

   ## CLAWPERATOR_OPERATOR_PACKAGE
   Source: <file:line>
   Resolution: <actual order found>
   Default: <value>
   Error when wrong: <error code(s)>
   ```

6. If `CLAWPERATOR_BIN` is NOT found in the Node CLI source: note this clearly.
   It may be a convention used by the eval harness and CLAUDE.md but not read
   by the Node CLI itself. If so, it should NOT be documented on the public
   docs page as a CLI env var. Adjust the plan accordingly.

### Acceptance Criteria

- `findings.md` exists and has entries for all three env vars.
- Each entry has a source file reference or an explicit "not found" note.
- Any discrepancy between plan.md assumptions and actual code is noted.

### Expected Commit

```
docs(envvars): record source research findings for env var resolution
```

---

## Sub-phase 1b: Write Documentation

### Agent Tier

default

### Goal

Write `docs/configuration.md` from findings. Add cross-reference in
`docs/setup.md`. Add nav entry in `sites/docs/mkdocs.yml`.

### Files To Change

- `docs/configuration.md` (new)
- `docs/setup.md` (one cross-reference link added)
- `sites/docs/mkdocs.yml` (one nav entry)

### Page Structure

`docs/configuration.md` must have these sections in order:

1. **Short intro** (2-3 sentences): Clawperator resolves configuration from
   CLI flags, environment variables, and defaults - in that order. This page
   documents the env vars and their resolution behavior.

2. **`ANDROID_SERIAL`** section:
   - What it controls
   - Full resolution order (flag > env var > auto-select > error)
   - Default when nothing is set
   - Error code when the resolved device is not connected
   - Example: `export ANDROID_SERIAL=<device_serial>`

3. **`CLAWPERATOR_OPERATOR_PACKAGE`** section:
   - What it controls (which Operator APK variant is targeted)
   - Full resolution order
   - Default value
   - When to set it explicitly (both release and debug variants installed)
   - Error code for `OPERATOR_NOT_INSTALLED` or `OPERATOR_VARIANT_MISMATCH`
   - Examples for release and debug variants

4. **`CLAWPERATOR_BIN`** section (only if confirmed in source by 1a):
   - What it controls
   - Full resolution order (env var > local sibling build > global binary)
   - When useful (local development, CI with non-standard install paths)
   - If NOT confirmed in source: omit this section entirely and note in
     findings.md that it is not a public CLI env var.

5. **Resolution precedence summary table** at the end:

   | Setting | Flag overrides | Env var | Default |
   | --- | --- | --- | --- |
   | Device | `--device` | `ANDROID_SERIAL` | auto-select (one device) |
   | Operator package | `--operator-package` | `CLAWPERATOR_OPERATOR_PACKAGE` | auto-detect or release |
   | Binary | (n/a) | `CLAWPERATOR_BIN` | local build then global |

   Omit rows for vars not confirmed in source.

### Style Requirements

- Second person ("you", "your device"), no "we" or marketing
- No em dashes
- Each section has at least one concrete shell example
- Error codes are quoted exactly as they appear in `errors.ts`
- Cross-reference `docs/setup.md` for `--device` and `--operator-package`
  flag usage (do not duplicate the flag reference content)

### Cross-Reference in `docs/setup.md`

Find the existing "When to pass `--device` and `--operator-package`" section.
Add one sentence after it: "You can also set these values as environment
variables. See [Configuration reference](configuration.md) for details."

### Nav Entry

In `sites/docs/mkdocs.yml`, find the nav entry for `setup.md`. Add
`configuration.md` immediately after it at the same indentation level.

### Acceptance Criteria

- `docs/configuration.md` covers all vars confirmed in 1a research.
- Every resolution order claim traces to a source file recorded in findings.md.
- `docs/setup.md` has a cross-reference link to `configuration.md`.
- `sites/docs/mkdocs.yml` has the nav entry.
- No section documents vars not confirmed in source.

### Expected Commit

```
docs: add configuration.md env var reference page
```

---

## Sub-phase 1c: Build Verification

### Agent Tier

fast

### Goal

Regenerate `sites/docs/.build/` and verify the docs build passes end-to-end.

### Steps

1. Run the docs-build skill or build script:
   ```bash
   ./scripts/docs_build.sh
   ```
2. Verify exit 0.
3. Check that `configuration.md` appears in the built output under
   `sites/docs/site/`.
4. Spot-check one internal link: verify the cross-reference from `setup.md`
   to `configuration.md` resolves correctly in the built output.

### Acceptance Criteria

- `./scripts/docs_build.sh` exits 0.
- `sites/docs/site/configuration/index.html` (or equivalent) exists.
- No broken-link warnings for `configuration.md` in build output.

### Validation

```bash
./scripts/docs_build.sh
ls sites/docs/site/ | grep -i config
```

### Expected Commit

```
docs: regenerate .build/ for configuration.md env var reference
```
