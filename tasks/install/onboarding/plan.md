# Install Onboarding Agent Discovery Cleanup

## Executive Summary

Tighten the post-install path so an OpenClaw-style host agent can actually
discover and use the runtime skills that Clawperator already installs. This is
a small cross-surface task pack: 2 PRs, 4 phases. PR-1 ships Node-side runtime
discovery ergonomics. PR-2 ships install/on-disk host-agent guidance and bridge
artifacts. The deferred preflight metadata idea from `findings.md` F6 is
explicitly out of scope for this pack.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships, a host agent that runs `curl -fsSL https://clawperator.com/install.sh | bash`
can discover installed runtime skills without shell-session luck, identify the
Google Home HVAC skills using user-language terms, and find durable on-disk
guidance about how to call Clawperator from an OpenClaw-style environment.

## Why Now

`tasks/install/onboarding/findings.md` shows the capability gap is not runtime
execution. The Google Home HVAC skills already exist. The failure is the
handoff after install: registry resolution, search quality, app-oriented
discovery, and host-agent-facing artifacts. These are all part of the same
onboarding problem and should land as one small multi-phase project.

## In Scope

- Make runtime-skill registry resolution work after install without requiring a
  shell rc reload
- Add an app-oriented runtime-skill discovery surface
- Improve `skills search` so user-language queries can find the Google Home HVAC
  skills and do not confidently mis-rank irrelevant skills for short queries
- Render installed runtime skills into `~/.clawperator/AGENTS.md`
- Add durable install artifacts for host-agent use
- Add a bounded host-agent bridge at the `AGENTS.md` / `TOOLS.md` layer
- Materialize an MCP config snippet under `~/.clawperator/`
- Update authored docs that describe these host-facing behaviors

## Out of Scope

- New `SkillEntry` preflight or `requires` metadata
- Harness-enforced precondition failures
- Changes to orchestrated-skill runtime semantics beyond describing existing
  host requirements
- Treating Clawperator runtime skills as native prompt-skills in shared agent
  skill directories
- Any Android runtime behavior change

## Existing Artifact Scope

- `tasks/install/onboarding/findings.md`: preserved as the research source of
  truth for this task pack; do not rewrite it as part of implementation
- `sites/landing/public/install.sh`: in scope for additive onboarding and
  artifact-generation changes; existing install steps stay intact
- `~/.clawperator/AGENTS.md` template in `install.sh`: in scope to expand with
  runtime-skill guidance
- Shared agent discovery surfaces: in scope for bounded, idempotent append-only
  bridge guidance, not ownership takeover

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/adapters/skills-repo/` | Registry fallback behavior | PR-1 / Phase 1 |
| `apps/node/src/domain/skills/` | Search behavior, `for-app` discovery, possible contract support for `keywords` | PR-1 / Phases 1-2 |
| `apps/node/src/cli/` | `skills for-app <pkg>` command surface and help text | PR-1 / Phase 2 |
| `apps/node/src/test/unit/` | Unit tests for fallback, search, and app-oriented discovery | PR-1 / Phases 1-2 |
| `sites/landing/public/install.sh` | Runtime-skill AGENTS content, install-state artifact, MCP snippet, bounded shared-agent bridge | PR-2 / Phases 3-4 |
| `docs/` | Public docs for install/onboarding and runtime-skill discovery behavior | PR-2 / Phase 4 |
| `docs/internal/` | No new internal docs required in this pack | n/a |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Runtime-skills registry path resolution | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Runtime skills config constants | `apps/node/src/domain/skills/skillsConfig.ts` |
| Skills search behavior | `apps/node/src/domain/skills/searchSkills.ts` |
| Skills registry contract | `apps/node/src/contracts/skills.ts` |
| Skills CLI registration | `apps/node/src/cli/registry.ts` |
| Skills CLI command implementation | `apps/node/src/cli/commands/skills.ts` |
| Existing unit-test patterns | `apps/node/src/test/unit/skills.test.ts` |
| install.sh structure and final summary | `sites/landing/public/install.sh` |
| MCP public behavior | `docs/api/mcp.md`, `apps/node/src/cli/registry.ts` |
| Docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Build validation | `./scripts/docs_build.sh` |
| Research source | `tasks/install/onboarding/findings.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- This pack excludes F6-style skill preflight metadata work. Do not add new
  `requires`, `preflight`, or orchestrated-harness precondition logic here.
- The preferred bridge order is:
  1. `~/.clawperator/AGENTS.md`
  2. bounded append to `~/.agents/AGENTS.md` (append only; do not create the
     file if it does not already exist - Clawperator does not own this path)
  3. optional `~/.clawperator/TOOLS.md`
  4. MCP config snippet
  5. no shared-agent bridge skill in this pack
- App-oriented discovery should ship as `clawperator skills for-app <pkg>` in
  the `skills` namespace. Implement it as a thin wrapper over the existing
  `searchSkills({ app })` path - do not introduce a new domain module for this.
  `skills search --app <pkg>` already filters correctly today; `for-app` is a
  discoverability alias, not new capability. Do not move this into `doctor`.
- Search improvement should be implemented through explicit metadata and ranking
  rules, not vague semantic heuristics. Adding `keywords?: string[]` to
  `SkillEntry` is a registry-contract change and therefore a cross-repo change:
  the Clawperator Node contract, the `clawperator-skills` registry JSON schema,
  and the seeded Google Home HVAC entries must land in lockstep (see Hard Rules
  in the work breakdown).
- MCP config snippet must include at minimum: Claude Desktop, Codex, and a
  generic stdio MCP consumer entry. Do not attempt automatic registration.

**Judgment required:**

- Exact output shape of `skills for-app`
- Exact wording of the new `AGENTS.md` sections
- Whether `TOOLS.md` is justified in PR-2 or whether `AGENTS.md` plus MCP
  snippet is sufficient
- The smallest ranking rule that fixes `"ac"` mis-ranking without broad search
  regressions

## Decision Rules

| Question | Rule |
| --- | --- |
| Should this pack address `findings.md` F6? | No. Record it in `finalization-items.md` only. |
| Should shared agent skill dirs receive runtime-skill copies or symlinks? | No. Runtime skills remain CLI-invoked assets. |
| Should `doctor` become the main app-capability discovery surface? | No. Ship `skills for-app` first; any doctor enhancement is secondary. |
| How should host guidance be written into shared agent surfaces? | Append-only, bounded, idempotent, and clearly marked as Clawperator-owned text. Do not create `~/.agents/AGENTS.md` if it does not exist. |
| How should `"ac"`-style short queries be handled? | Prefer exact-token or keyword matches ahead of substring summary matches; do not let substring matches dominate for short tokens. Returned order must be stable and covered by tests against the findings.md query table. |
| Where should `keywords` metadata be seeded? | In `../clawperator-skills` (the sibling skills repo). The Node contract change and the seeded entries ship as paired PRs; do not mock it by editing only a local test fixture. |
| What if `TOOLS.md` adds more complexity than value? | Skip it in PR-2 and keep the bridge in `AGENTS.md` plus MCP snippet. |

## Failure Modes To Prevent

- **Shell-rc dependency remains the only way skills resolve.** Phase 1 must
  make the installed home-directory registry discoverable by default.
- **Search looks "improved" but still mis-ranks short user terms.** Phase 2 must
  include explicit ranking tests using the real problem queries from
  `findings.md`.
- **Runtime skills are presented as if they were host-agent prompt-skills.** Do
  not install runtime-skill mirrors into shared agent skill dirs.
- **Shared agent discovery file is overwritten.** Any `~/.agents/AGENTS.md`
  change must be append-only and guard-comment delimited.
- **`doctor` becomes a second capability browser.** Keep app-capability
  discovery in `skills`, not in `doctor`.
- **F6 leaks into the pack.** If work starts touching skill preflight metadata,
  stop and split it into follow-up instead of expanding this pack.
- **Tests deferred to a later phase.** Phase 1 and Phase 2 each ship their own
  unit coverage.

## Output Contract

After PR-1:

- `clawperator skills list` succeeds after install in a fresh non-login shell
  when the installed runtime registry exists under `~/.clawperator/skills/...`
- `clawperator skills for-app com.google.android.apps.chromecast.app` returns
  the Google Home HVAC skills in one command
- `clawperator skills search` can find the Google Home HVAC skills using the
  target user-language queries from `findings.md`

After PR-2:

- `~/.clawperator/AGENTS.md` includes installed runtime-skill guidance
- a bounded Clawperator section can be added to `~/.agents/AGENTS.md`
- `~/.clawperator/install-state.json` exists after install
- `~/.clawperator/mcp-config-snippet.json` exists after install
- public docs reflect the new onboarding and discovery behavior

`install-state.json` field rules:

- `schemaVersion`, `installedAt`, and `cliVersion` are always required
- `registryPath` is required when runtime skills were installed successfully,
  otherwise `null`
- `apkVersion` should use the installer's known operator version when available,
  otherwise `null`
- `lastDeviceSerial` is nullable when no unambiguous device was selected during
  install

## Idempotency

- Re-running `install.sh` must be safe: generated host-agent artifacts are
  overwritten or updated in place without duplicate append blocks
- The `~/.agents/AGENTS.md` contribution must be idempotent and guard-comment
  delimited
- `install-state.json` and `mcp-config-snippet.json` are rewrite-safe
- Search and registry behavior must be stable across repeated CLI invocations

## Testing Strategy

- Treat testing as part of the pack contract, not phase-local cleanup. Every
  phase must prove the behavior it introduces before the next phase starts.
- Prefer the smallest realistic proof for each surface:
  - Node discovery behavior: unit tests in `apps/node/src/test/unit/skills.test.ts`
  - installer artifact and idempotency behavior: `validation/install/test_install.sh`
  - docs behavior: authored-doc updates plus `./scripts/docs_build.sh`
- Do not require live OpenClaw execution as a gate for this pack. The correct
  proxy is to prove the on-disk agent-facing artifacts, CLI discovery paths,
  and install rerun behavior that an OpenClaw-style host would consume.
- When behavior spans code plus seeded skills metadata, the test plan must
  cover both:
  - repo-local unit tests for the Node ranking and command behavior
  - paired `../clawperator-skills` change for the shipped registry/schema data
- PR-1 must leave behind deterministic regression coverage for the exact
  user-language queries in `findings.md`. PR-2 must leave behind deterministic
  installer-harness coverage for artifact creation, pointer text, and rerun
  idempotency.
- The install harness is the authoritative place to test `install.sh`. Do not
  rely only on ad hoc shell runs or `bash -n` for installer behavior changes.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Host-agent onboarding behavior | `docs/setup.md` and skills/onboarding docs updated in PR-2 |
| App-oriented discovery command | `docs/skills/overview.md` or adjacent public docs in PR-2 |
| Deferred skill preflight metadata work (F6) | `tasks/install/onboarding/finalization-items.md` |

Delete this task pack only after both PRs land and the F6 follow-up has been
captured elsewhere.
