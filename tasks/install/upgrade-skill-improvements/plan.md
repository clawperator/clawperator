# Upgrade Skill PATH Handling Improvements

## Executive Summary

Tighten the `clawperator-upgrade` bundled skill so host agents do not mistake a
non-interactive shell `PATH` mismatch for missing host tooling. This is a
single-PR, two-phase task. Phase 1 updates the packaged skill instructions and
OpenAI agent metadata. Phase 2 validates packaging, checks whether generated
docs or help surfaces need regeneration, and commits the final wording.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships, `clawperator-upgrade` should tell agents to classify
command-not-found failures carefully before choosing recovery. Agents should
probe the current `PATH`, common macOS Homebrew locations, and `npm`
reachability before they decide the host needs `install.sh` recovery.

## Why Now

A reviewed Codex session attempted to use `clawperator-upgrade` and incorrectly
treated `brew`, `npm`, `adb`, and `clawperator` as unavailable even though the
user confirmed those tools were present in their interactive shell. The
existing skill is correct about the high-level install architecture, but it is
too terse about non-interactive shell discovery. That leaves room for agents to
diagnose PATH mismatch as missing host state.

## In Scope

- Update `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`
- Update `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`
- Add an explicit PATH-discovery gate before declaring tools absent
- Add `npm` reachability to the CLI-first viability gate
- Preserve the existing CLI-first versus `install.sh` recovery architecture
- Preserve the JSON-default CLI output guidance from commit
  `223911092ae7c29af6d6acc8b409db18f4579da0`
- Run focused Node validation for bundled-skill packaging and any affected docs
  or generated outputs

## Out of Scope

- Do not add a top-level `clawperator upgrade` command
- Do not change `install.sh` unless implementation discovers a direct
  contradiction that blocks the skill wording
- Do not change Node CLI behavior, doctor behavior, installer behavior, Android
  runtime behavior, or device selection behavior
- Do not add `--output json` to upgrade examples solely for agent parsing
- Do not edit `sites/docs/.build/` or `sites/docs/site/` by hand
- Do not make Homebrew mandatory on non-macOS hosts

## Existing Artifact Scope

- `tasks/install/upgrade-skill-improvements/findings.md`: preserve as the
  review source of truth. Do not rewrite its findings except for small
  correction notes discovered during implementation.
- `apps/node/bundled-skills/clawperator-upgrade/SKILL.md`: in scope for
  workflow wording, command snippets, decision rules, examples, and output style
  guidance.
- `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml`: in scope
  only to keep the UI metadata and default prompt aligned with `SKILL.md`.
- Public docs and generated docs: only in scope if the skill text is surfaced
  or copied into docs generation outputs that must stay synchronized.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` | Main workflow and decision-rule tightening | Phase 1 |
| `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` | Condensed prompt alignment | Phase 1 |
| `apps/node/src/test/unit/bundledSkillsPack.test.ts` | Existing packaging guard to run, not necessarily edit | Phase 2 |
| `docs/` | Only if authored public guidance must mirror the changed skill | Phase 2 |
| `sites/docs/.build/`, `sites/docs/site/` | Generated only through docs-build if docs regeneration is required | Phase 2 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Accepted findings | `tasks/install/upgrade-skill-improvements/findings.md` |
| Upgrade skill behavior | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` |
| OpenAI skill metadata | `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` |
| JSON-default CLI contract | commit `223911092ae7c29af6d6acc8b409db18f4579da0` |
| Host-agent PATH caveat | `docs/internal/design/agent-host-integration.md` |
| Installer architecture boundary | `docs/internal/design/installer-architecture.md` |
| Current install shell behavior | `sites/landing/public/install.sh` |
| Bundled skill packaging tests | `apps/node/src/test/unit/bundledSkillsPack.test.ts`, `apps/node/src/test/unit/bundledSkills.test.ts` |

## Deterministic Versus Judgment

Deterministic - do not re-derive:

- Exit code `127` from a bare command means "command not found in this shell"
  for routing purposes, not proof the tool is absent from the machine.
- The skill must probe `PATH` and common macOS Homebrew paths before reporting
  `brew`, `npm`, `adb`, or `clawperator` as unavailable.
- After this task, the CLI-first viability gate must include `node`, `npm`, and `java`. Currently only `node` and `java` are listed in the skill; `npm` must be added.
- `install.sh` remains recovery only when the CLI is unreachable after PATH
  classification or when bootstrap prerequisites genuinely need repair.
- Do not add `--output json` to examples as a required parsing mechanism. JSON
  is already the CLI default.

Judgment required:

- Exact wording that is concise enough for a bundled skill but explicit enough
  that agents will not skip the PATH classification step.
- How much of the macOS Homebrew probe belongs in `agents/openai.yaml`, which
  should remain a compact prompt rather than a full workflow copy.
- Whether public docs need a small note or whether the skill wording alone is
  sufficient.

## Decision Rules

| Question | Rule |
| --- | --- |
| `clawperator --version` fails with command not found | Run the PATH discovery gate before using `install.sh`. |
| `node`, `npm`, `java`, `adb`, or `brew` is missing from `command -v` | Probe known host locations where applicable, then classify as PATH mismatch or genuinely unavailable. |
| macOS Homebrew exists at `/opt/homebrew/bin/brew` or `/usr/local/bin/brew` | Use that `brew shellenv` for the current command sequence before retrying bare commands. |
| `npm` is not reachable after PATH repair attempts | Do not choose the CLI-first path. Route to recovery or stop with the concrete blocker from the skill. |
| CLI-first path succeeds | Continue with `clawperator install` and `clawperator doctor` using the existing multi-device decision rules. |
| Agent wants to add `--output json` to command examples | Do not add it unless another code-owned contract proves JSON is no longer the default. |

## Failure Modes To Prevent

- Agent reports Homebrew, adb, npm, or Clawperator missing when the issue is
  only a non-interactive `PATH`.
- Agent runs `install.sh` immediately after `clawperator --version` fails
  without checking command discovery first.
- Agent chooses CLI-first upgrade even though `npm` is unavailable.
- Agent expands the skill into a second installer or custom remediation tree.
- Agent reverses the JSON-default cleanup by requiring redundant JSON flags.
- Agent updates `SKILL.md` but leaves `agents/openai.yaml` stale.
- Agent edits generated docs directly.

## Output Contract

After the task:

- `SKILL.md` contains a clear PATH-discovery step before recovery routing.
- `SKILL.md` treats `npm` as part of CLI-first viability.
- `SKILL.md` preserves the existing multi-device doctor verification rules.
- `SKILL.md` explicitly avoids treating `--output json` as required.
- `agents/openai.yaml` summarizes the new PATH and `npm` gates consistently
  with `SKILL.md`.
- Tests and validation listed in the work breakdown pass, or any skipped
  validation has a concrete reason recorded in the final response.

## Idempotency

Re-running this task should produce stable wording and no duplicate sections.
The bundled skill files are authored source files, not generated outputs.
Generated docs, if touched, must be regenerated from source and should be
committed with the source change that required them.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Upgrade skill PATH classification behavior | `apps/node/bundled-skills/clawperator-upgrade/SKILL.md` |
| Condensed agent-facing prompt | `apps/node/bundled-skills/clawperator-upgrade/agents/openai.yaml` |
| General host-agent PATH caveat if it proves broader than upgrade | `docs/internal/design/agent-host-integration.md` or `docs/host-agents.md` |

Delete this task pack after the implementation PR lands and any durable
guidance has been migrated to the authored skill or docs surfaces.
