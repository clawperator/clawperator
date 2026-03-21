# PRD-3.5: Skills Compatibility Audit and Release

Workstream: WS-3.5 (maintenance/migration — between PRD-3 and PRD-4)
Priority: 3.5 (blocking — must land before PRD-4)
Proposed PR: PR-3.5 (in `clawperator-skills`; version bump and tag in this repo)

---

## Problem Statement

PRD-3 shipped a `skills run` gate that validates skill artifacts against the action schema
before touching a device. The gate is live in `main`. No audit of the existing
`clawperator-skills` registry has been completed. Any agent running an artifact-backed
skill today may hit `SKILL_VALIDATION_FAILED` on a skill that was valid before the gate
existed — with no warning that the gate was the cause.

This PRD closes the gap: audit every skill, fix every failure, and cut a versioned release
so the `install.sh` entry point and the skills registry are in a known-good state together.

---

## Inventory

**Artifact-backed skills (must pass `--dry-run` before this PRD ships):**

| Skill ID | Artifact file |
|---|---|
| `com.globird.energy.get-usage` | `artifacts/usage.recipe.json` |
| `com.google.android.apps.chromecast.app.get-aircon-status` | `artifacts/ac-status.recipe.json` |
| `com.solaxcloud.starter.get-battery` | `artifacts/battery.recipe.json` |
| `com.theswitchbot.switchbot.get-bedroom-temperature` | `artifacts/bedroom-temperature.recipe.json` |

Known failure: `com.globird.energy.get-usage` — `format: "ascii"` on a `snapshot_ui`
action. This was the GloBird incident that motivated PRD-2 and PRD-3. Fix is to remove
the `format` parameter from the action.

**Script-only skills (no action needed — dry-run skips these automatically):**

- `com.android.settings.capture-overview`
- `com.android.vending.install-app`
- `com.android.vending.search-app`
- `com.coles.search-products`
- `com.google.android.apps.chromecast.app.set-aircon`
- `com.life360.android.safetymapd.get-location`
- `com.woolworths.search-products`

Dry-run will report `dryRun.payloadValidation: "skipped"` for each of these. That is
correct and expected — no changes required.

---

## Proposed Change

### 0. Confirm the release baseline

Before auditing or versioning anything, make sure the branch-local Node app is healthy:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

This is the release floor. If either command fails, stop and fix the branch before
cutting a skills release.

### 1. Run the full dry-run audit

Using the PRD-3 CLI (now in `main`), run against every skill in the installed registry:

```bash
clawperator skills validate --all --dry-run --output json
```

Capture the output in the PR summary or release notes. For every skill:
- `ok: true` with no `dryRun` field → artifact-backed, passes. No action.
- `ok: true` with `dryRun.payloadValidation: "skipped"` → script-only. No action.
- `ok: false` → failure. Document: skill id, artifact filename, `details.actionId`,
  `details.actionType`, `details.invalidKeys`, `details.hint`.

### 2. Fix every failure in `clawperator-skills`

Work in `~/src/clawperator-skills`. For each failing skill:

- Open the artifact JSON file at `skills/<skill-id>/artifacts/<artifact>.json`.
- Remove or replace the invalid parameter(s) identified in `details.invalidKeys`.
- Re-run `clawperator skills validate <skill-id> --dry-run` to confirm it passes.
- Do not guess at fixes — use the `details.hint` field when present; it names the
  exact change required.

Known fix for GloBird:
- File: `skills/com.globird.energy.get-usage/artifacts/usage.recipe.json`
- Action: find the `snapshot_ui` action; remove the `format: "ascii"` key from `params`.
- Confirm: `clawperator skills validate com.globird.energy.get-usage --dry-run` → `ok: true`.

After fixing all failures, run the full audit again and confirm every skill is either
passing or skipped before proceeding.

### 3. Bump the Node CLI version

In this repo (`~/src/clawperator`), bump `apps/node/package.json` version.

**Recommended bump: `0.3.3` → `0.4.0`**

Rationale: PRDs 1-3 together represent behavioral contract changes that affect both skill
authors and agent integrators:
- `RECEIVER_NOT_INSTALLED` is now a hard failure (was advisory)
- `skills run` gates by default (new enforcement, `--skip-validate` required to bypass)
- Error envelopes have new fields agents can depend on

These are not purely additive. A minor version bump signals to skill authors that they
need to validate their artifacts against the new gate. A patch bump would understate the
change.

If the project convention is to stay on patch bumps pre-1.0, `0.3.4` is acceptable —
but document the reason in the release notes so authors know to re-audit.

Also update the version comment in `sites/landing/public/install.sh` (line 1:
`# install.sh (v0.3.2)`) to match the new version. If `docs/first-time-setup.md`
shows a literal version in an example, update that example too; if it uses a placeholder,
leave it alone.

### 4. Tag the release

```bash
git tag v0.4.0
git push origin v0.4.0
```

The tag marks the first release that includes the readiness gate (PRD-1), enriched errors
(PRD-2), and the skills pre-run validation gate (PRD-3). This gives skill authors and
agent integrators a stable reference point.

### 5. Update `install.sh` version metadata

`sites/landing/public/install.sh` fetches the CLI version from package metadata at install
time. Confirm the version bump in `package.json` flows through to the install script
correctly by running `./scripts/site_build.sh` and verifying the install path references
the new version.

If `install.sh` hardcodes a version string anywhere (beyond the comment on line 1),
update it to match.

---

## Documentation updates in PR-3.5

No new doc pages needed. One update:

- `docs/first-time-setup.md`: confirm the version shown in any "verify your install"
  examples matches the new release. If the doc shows `clawperator --version` output,
  update the expected value. If it uses a placeholder, leave it.

---

## Scope Boundaries

In scope:
- Audit of all 4 artifact-backed skills in `clawperator-skills`
- Fixes to any failing skills in `clawperator-skills`
- Version bump in `apps/node/package.json`
- Git tag for the release
- `install.sh` version comment update

Out of scope:
- Changes to skill logic or script behavior (this is schema compliance only)
- Adding new skills
- Changing the `--dry-run` or gate behavior (that is PRD-3, already shipped)
- Updating skill documentation beyond the workflow doc already updated in PRD-3

---

## Dependencies

- PRD-3 merged (✓ — `63b8a4a`)
- No other PRDs required; this is a maintenance step between PRD-3 and PRD-4

---

## Testing Plan

No new unit tests needed — the test infrastructure is PRD-3's. This PRD's verification
is operational.

### Verification steps

**V0 — Release baseline passes**
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```
Expected: both commands succeed before the audit begins.

**V1 — Full dry-run audit passes**
```bash
clawperator skills validate --all --dry-run --output json
```
Expected: every skill is either `ok: true` (with or without `dryRun.payloadValidation`)
or `ok: true` with `payloadValidation: "skipped"`. Zero `ok: false` results.

**V2 — Known failure fixed**
```bash
clawperator skills validate com.globird.energy.get-usage --dry-run --output json
```
Expected: `{ "ok": true }` with no `dryRun` field (it is artifact-backed and should pass
payload validation, not skip it).

**V3 — Version bump is consistent**
```bash
node -e "const p = require('./apps/node/package.json'); console.log(p.version)"
```
Expected: `0.4.0` (or whatever version was chosen).

**V4 — Tag exists**
```bash
git tag | grep v0.4.0
```
Expected: tag present.

**V5 — Landing site install metadata is consistent**
```bash
./scripts/site_build.sh
```
Expected: the build succeeds and the generated landing-site install artifact reflects
the bumped version.

---

## Acceptance Criteria

- `clawperator skills validate --all --dry-run` returns `ok: true` for every skill in the
  installed registry. Zero failures.
- `com.globird.energy.get-usage` specifically passes — it is the known failure case.
- `apps/node/package.json` version bumped to `0.4.0` (or documented alternative).
- Git tag `v0.4.0` created and pushed.
- The `clawperator-skills` fixes are in a merged PR before this repo's version tag is cut.
  Do not tag without the skills fixes landing first.
