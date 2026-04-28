# Personalized Skills Findings

## Audit Commands

- `openclaw skills list --eligible --json`: passed. OpenClaw listed personal AgentSkills with `"source": "agents-skills-personal"`, so `~/.agents/skills/` is the target home for PR-1 wrappers.
- `rg -n "personalized|personalised|preference|user preferences|local labels|device graph|account state|personal assumptions|local skill" docs .agents/skills tasks apps sites evals`: passed. Relevant current-repo signals are in `docs/skills/authoring.md`, bundled authoring skills, eval harness validation, and this task pack.
- `rg -n "personalized|personalised|preference|user preferences|local labels|device graph|account state|personal assumptions|local skill" ../clawperator-skills`: passed. Sibling repo has no broad personalized policy page; relevant local-skill signals are mostly runtime helper wording and existing app-specific skills.
- Inspected sibling runtime skill sources for SolaX, GloBird, Netflix, and AirTouch under `../clawperator-skills/skills/`.
- Inspected existing OpenClaw workspace home skills under `~/.openclaw/workspace/skills/` for stale or current personal-wrapper practice.

## Current Repo Evidence

| Path | Signal | Implication |
| --- | --- | --- |
| `docs/skills/authoring.md` | Recording-derived authoring already says personalized local skills are valid when a flow depends on one user's setup, labels, account state, or device graph. | Durable guidance should move the full policy into `docs/skills/personalized.md` and leave authoring with a short pointer. |
| `docs/skills/overview.md` | Runtime skills are registry-driven and not discovered by folder scanning alone; authoring skills are separate from runtime skills. | Personal AgentSkills wrappers must be described as a host-agent layer that calls runtime skills, not as runtime registry entries. |
| `docs/skills/runtime.md` | Skill run JSON has a two-level trust order: branch on top-level wrapper status first, then inspect nested `skillResult.status` and read the answer from `skillResult.result`. | Personalized wrappers must not claim success from nested child status alone when the wrapper is failed or indeterminate. |
| `apps/node/src/contracts/skills.ts` | Runtime skill entries define registry fields, optional `agent`, and optional `contract`; no user memory or personal preference store exists in this contract. | Docs must not imply Clawperator has a built-in encrypted preference or memory feature for personal values. |
| `apps/node/src/domain/skills/runSkill.ts` | `runSkill()` enforces timeout, parses terminal SkillResult frames, injects trusted source metadata, and returns failed or indeterminate wrapper states for runtime failures or verification misses. | Wrapper guidance should preserve runtime failures and partial results instead of smoothing them into success. |
| `apps/node/src/domain/skills/validateSkill.ts` | Runtime validation checks registry parity, required files, frontmatter type, and artifact payloads under dry-run, but does not validate personal AgentSkills in `~/.agents/skills/`. | Personal wrapper tests must be separate executable scripts beside each personal skill. |
| `apps/node/bundled-skills/clawperator-skill-author-by-agent-discovery/SKILL.md` | Discovery artifacts classify recording handoffs as `shared-general` or `personalized-local`. | The public page should define how agents decide between local and shared skill outcomes. |
| `evals/harness/runner.py` | Eval validation enforces `skill_classification` values of `shared-general` or `personalized-local` for recording handoffs. | Personalized-skill policy is already a contract term in evaluation, not just prose. |

## Sibling Or Downstream Repo Evidence

| Repo | Path | Signal | Implication |
| --- | --- | --- | --- |
| `../clawperator-skills` | `README.md`, `AGENTS.md` | Runtime skills are reusable packages with `SKILL.md`, scripts, validation, and live-device proof expectations; privacy rules prohibit personal names, device serials, and user-specific local identifiers. | Personal wrappers should keep user-specific defaults outside the public runtime skills repo. |
| `../clawperator-skills` | `skills/com.solaxcloud.starter.get-battery/` | Runtime skill reads SolaX battery through Clawperator and emits a parsed battery level in `skillResult.result`. | `home-battery-get-level` can be a no-argument personal wrapper around `com.solaxcloud.starter.get-battery`. |
| `../clawperator-skills` | `skills/com.globird.energy.get-yesterday-usage-cost-replay/` | Runtime skill targets GloBird yesterday usage cost directly and has no contract inputs. | `home-energy-get-yesterday-usage-cost` should prefer `com.globird.energy.get-yesterday-usage-cost-replay` unless live validation proves it unreliable. |
| `../clawperator-skills` | `skills/com.globird.energy.get-usage/` | Broader GloBird usage skill returns cost and yesterday data when present. | It is the documented fallback if the direct yesterday-cost replay path is not reliable. |
| `../clawperator-skills` | `skills/com.netflix.mediaclient.set-my-list-state-replay/` | Runtime skill requires `--action`, `--title`, and `--profile`; adding or removing changes account state but is reversible. | Personal wrapper should expose title only, derive action from request wording, and keep profile local-only. |
| `../clawperator-skills` | `skills/au.com.polyaire.airtouch5.set-power-state/`, `set-zone-state/`, `set-fan-level/`, `set-mode/` | AirTouch runtime skills expose separate generic controls with named arguments such as `--state`, `--zone-name`, `--fan-level`, and `--mode`. | `home-hvac-control` should be one user-facing personal wrapper that sequences these runtime skills and holds local aliases. |
| OpenClaw workspace | `~/.openclaw/workspace/skills/home-get-solax-battery/`, `home-get-globird-usage/`, `home-set-aircon/`, `home-get-aircon-status/` | Existing workspace skills still reference an older ActionTask path and local script commands. | These are handoff candidates for later personal-surface cleanup; PR-1 must create the new required wrappers first in `~/.agents/skills/`. |

## Recommended Policy

- Personalized local skills are valid when they are truthful, clearly user-scoped, and useful for repeatable local work.
- Agents should name the personal assumptions a wrapper uses, such as local labels, account state, device graph, preferred mode, profile default, or workspace convention.
- Shared skills require personal assumptions to become explicit inputs, configuration, discovery, generalized selectors, or documented setup requirements.
- Public artifacts must sanitize private values. Use placeholders such as `<device_serial>`, `<profile_name>`, `<room_label>`, `<account_label>`, and `<local_preference>`.
- User preferences are useful context, but this repo has no current contract for arbitrary sensitive memory or encrypted preference persistence. Do not invent that capability in docs or wrappers.
- Runtime failures must be surfaced truthfully. Check the top-level wrapper status first, then nested `skillResult.status`; do not report success from nested status alone when the wrapper is `indeterminate` or `failed`.
- Personal AgentSkills wrappers should call `clawperator skills run ... --output json` and preserve enough runtime output for diagnosis.
- Keep Clawperator runtime skills generic and parameterized. Keep personal defaults and aliases in personal skill homes or local config.

## Privacy And Safety Boundaries

- Do not commit real names, device serials, account identifiers, credentials, tokens, profile names, room labels, device labels, exact routines, or local filesystem paths that reveal private setup.
- Do not paste live OpenClaw JSON into committed findings if it contains private values. Summarize sanitized status, command, top-level result, and blocker.
- Do not store private values in this repository. Store local-only defaults in the owning personal skill surface or user-local config.
- Use placeholders consistently: `<device_serial>`, `<operator_package>`, `<profile_name>`, `<room_label>`, `<local_alias>`, `<account_label>`, and `<safe_test_title>`.
- For mutating skills, prefer reversible safe tests. If no safe mutation target exists, record a truthful blocker instead of fabricating success.

## Cross-Repo Work Items

| ID | Repo | Path or surface | Required action | Status |
| --- | --- | --- | --- | --- |
| XREPO-1 | OpenClaw personal workspace | `~/.openclaw/workspace/skills/home-get-solax-battery/` | Replace or retire the older ActionTask-oriented battery skill after the new `home-battery-get-level` personal wrapper is proven. | handoff-ready |
| XREPO-2 | OpenClaw personal workspace | `~/.openclaw/workspace/skills/home-get-globird-usage/` | Replace or retire the older ActionTask-oriented GloBird skill after the new energy wrapper is proven. | handoff-ready |
| XREPO-3 | OpenClaw personal workspace | `~/.openclaw/workspace/skills/home-set-aircon/` and `home-get-aircon-status/` | Replace older ActionTask-oriented HVAC guidance with the unified `home-hvac-control` policy if the Phase 4 wrapper proves discoverable and safe enough. | handoff-ready |
| XREPO-4 | `../clawperator-skills` | Runtime skill docs for SolaX, GloBird, Netflix, and AirTouch | Consider adding a short cross-reference to `docs/skills/personalized.md` after it exists, especially where runtime skills are commonly wrapped by personal AgentSkills. | handoff-ready |
| XREPO-5 | Clawperator runtime registry | Bundled-skill install and runtime registry behavior | No registry redesign is part of PR-1. Keep runtime registry mechanics unchanged. | out-of-scope |

## Required Personalized Skill Status

| Order | Skill | Target home | Status | Local test result | OpenClaw discovery result | OpenClaw live-call result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `home-battery-get-level` | `~/.agents/skills/` | implemented in personal home | passed: `~/.agents/skills/home-battery-get-level/scripts/test_command_shape.sh` | passed: `openclaw skills list --eligible --json` shows the skill; `openclaw skills info home-battery-get-level --json` reports `source: agents-skills-personal`, `eligible: true` | blocked after exact required call: `openclaw agent --message "What is the home battery level? Use the personal skill if one applies." --json` failed before skill selection because OpenClaw required `--to`, `--session-id`, or `--agent` |
| 2 | `home-energy-get-yesterday-usage-cost` | `~/.agents/skills/` | implemented in personal home | passed: `~/.agents/skills/home-energy-get-yesterday-usage-cost/scripts/test_command_shape.sh` | passed: `openclaw skills list --eligible --json` shows the skill; `openclaw skills info home-energy-get-yesterday-usage-cost --json` reports `source: agents-skills-personal`, `eligible: true` | blocked after exact required call: `openclaw agent --message "What was yesterday's home energy usage cost? Use the personal skill if one applies." --json` failed before skill selection because OpenClaw required `--to`, `--session-id`, or `--agent` |
| 3 | `media-netflix-set-my-list-state` | `~/.agents/skills/` | not started | not run | not run | not run |
| 4 | `home-hvac-control` | `~/.agents/skills/` | not started | not run | not run | not run |

## Test Script Convention

Phase 2 created a static content validator convention for instruction-only
personal AgentSkills wrappers. Each wrapper has an executable script under
`scripts/` that reads the neighboring `SKILL.md`, asserts the documented
runtime skill id, `clawperator skills run` command shape, `--output json`,
argument rules, and success-reporting rule, then exits nonzero on failure.

Current scripts:

- `~/.agents/skills/home-battery-get-level/scripts/test_command_shape.sh`
  asserts `com.solaxcloud.starter.get-battery`, `--output json`, no required
  user content arguments, and top-level wrapper status before
  `skillResult.status`.
- `~/.agents/skills/home-energy-get-yesterday-usage-cost/scripts/test_command_shape.sh`
  asserts `com.globird.energy.get-yesterday-usage-cost-replay`,
  `--output json`, no required user content arguments, and top-level wrapper
  status before `skillResult.status`.

If a later wrapper introduces executable normalization code, its local test
must stub command execution and assert the generated argv or ordered command
sequence without touching the live device.

## Docs Draft Notes

- Define personalized skills as user-scoped agent-facing wrappers whose behavior depends on local labels, device graph, account state, profile defaults, or local workflow choices.
- Explain that personal wrappers are often the truthful first result, but shared skills need personal assumptions converted into inputs, configuration, discovery, or broader selectors.
- Include the two-level runtime trust order from `docs/skills/runtime.md`: top-level wrapper status first, then nested `skillResult.status`, answer in `skillResult.result`.
- Keep runtime skills, bundled authoring skills, OpenClaw workspace skills, and personal AgentSkills distinct.
- Use only sanitized examples and placeholders.
- Provide a verification checklist covering local tests, `openclaw skills list --eligible --json`, `openclaw skills info ... --json`, and safe OpenClaw forward tests or blockers.

## Open Questions

- None blocking Phase 2. OpenClaw discovery confirms `~/.agents/skills/` is visible through `agents-skills-personal`.
