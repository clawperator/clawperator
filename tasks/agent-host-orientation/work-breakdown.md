# Agent Host Orientation and CLI Discoverability Work Breakdown

Parent plan: `tasks/agent-host-orientation/plan.md`

## Executive Summary

2 PRs, 4 phases. PR-1 settles the canonical public host-agent orientation flow
and updates the authored docs around it. PR-2 tightens CLI help plus
registry/discovery remediation so shell surfaces point at the same stable docs.
This work begins only after PR #196 is merged; until then the pack stays in
planning so it does not reopen onboarding scope.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | PR #196 merge gate |

## Hard Rules

- Do not reopen or expand PR #196. This pack starts after that PR merges.
- Use `.agents/skills/docs-author/SKILL.md` for authored docs changes. Do not
  hand-edit generated docs outputs.
- Do not hand-edit `sites/docs/.build/`, `sites/docs/site/`, or generated
  `api/cli.md` content. Regenerate them from source.
- Do not add new commands or change runtime behavior in this pack. Only
  orientation, help, and remediation guidance are in scope.
- Keep `skills for-app` as the primary app-oriented discovery surface.
- If a new public page is needed, create exactly one. Do not create a mini-docs
  cluster for the same concept.
- Any CLI docs link must point at the chosen public docs route, not at a task
  file, GitHub source file, or local install artifact.
- If the plan and current code disagree, trust the code and update the task plan
  decision rather than implementing the stale assumption.
- One commit per logical step. Do not batch docs IA, help text, and error-text
  work into one catch-all commit.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/agent-host-orientation/plan.md` | Stable contract and scope boundaries |
| `docs/setup.md` | Current public install and artifact guidance |
| `docs/skills/overview.md` | Current runtime-skills discovery flow |
| `docs/api/mcp.md` | Current MCP front-door guidance |
| `docs/index.md` | Current docs home entry point |
| `docs/quickstart.md` | Current fast-start public page |
| `docs/internal/design/agent-host-integration.md` | Durable design rules for host-agent orientation |
| `sites/docs/mkdocs.yml` | Public nav and published route ownership |
| `sites/docs/source-map.yaml` | Generated-page ownership, especially `api/cli.md` |
| `apps/node/src/cli/registry.ts` | Top-level CLI help and `skills` help surface |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Registry-read and discovery remediation text |
| `.agents/skills/docs-author/SKILL.md` | Required authoring workflow for PR-1 docs work |

## PR / Phase Plan

| PR | Branch | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `docs/agent-host-orientation-p1` | Canonical docs flow | 1, 2 | thinking, default | PR #196 merged |
| PR-2 | `node/agent-host-orientation-p2` | CLI help and remediation alignment | 3, 4 | default, default | PR-1 merged |

## Phase 1: Canonical Public Orientation Path

### Agent Tier

thinking

### Goal

Choose and implement one canonical public docs route that answers "how should a
host agent use Clawperator after install?" without requiring subsystem
archaeology.

### Files or Surfaces To Change

- `docs/index.md`
- `docs/quickstart.md`
- `docs/setup.md`
- `docs/skills/overview.md`
- `docs/api/mcp.md`
- one new authored docs page under `docs/` only if reuse is not enough
- `sites/docs/mkdocs.yml`
- `docs/internal/design/agent-host-integration.md` if the durable preferred
  orientation flow changes materially

### Steps

1. Audit the current public entry points (`index.md`, `quickstart.md`,
   `setup.md`, `skills/overview.md`, `api/mcp.md`) and identify where a cold
   reader currently has to hop across pages to understand the post-install flow.
2. Decide whether an existing page can become the canonical host-agent front
   door with targeted edits. If yes, reuse it. If not, create exactly one new
   authored page under `docs/`.
3. Update `sites/docs/mkdocs.yml` so the chosen route is visible in the public
   nav instead of being an orphaned page.
4. If the durable preferred flow changes meaningfully, update
   `docs/internal/design/agent-host-integration.md` so future agents do not
   rediscover the decision.
5. Leave the detailed flow edits for Phase 2. Phase 1 is about locking the
   canonical route and nav ownership, not polishing every page at once.

### Acceptance Criteria

- One canonical public docs route is chosen and implemented in source.
- `sites/docs/mkdocs.yml` clearly exposes that route.
- No second competing "start here for agents" page is introduced.
- Any internal design note update reflects the same preferred flow.

### Validation

```bash
./scripts/docs_build.sh
rg -n "agent host|host agent|skills for-app|mcp" docs sites/docs/mkdocs.yml
```

### Expected Commit

```text
docs(agent-host): add canonical host orientation path
```

## Phase 2: Public Docs Cross-Links and First-Success Flow

### Agent Tier

default

### Goal

Make the authored public docs consistently explain the same post-install order:
what to read first, when to use `clawperator skills`, when to use MCP, and what
artifacts from install matter later.

### Files or Surfaces To Change

- Canonical public orientation page from Phase 1
- `docs/setup.md`
- `docs/skills/overview.md`
- `docs/api/mcp.md`
- `docs/index.md` and `docs/quickstart.md` if they still need pointer updates

### Steps

1. Tighten `docs/setup.md` so the post-install handoff is explicit and points at
   the canonical orientation route rather than forcing the user to infer the
   next surface.
2. Tighten `docs/skills/overview.md` so runtime-skills discovery starts with the
   shortest successful commands and clearly says when `skills for-app` is the
   fastest path.
3. Tighten `docs/api/mcp.md` so it explains when MCP is the right front door
   versus `clawperator skills` or direct CLI commands.
4. Make `docs/index.md` and `docs/quickstart.md` either point cleanly at the
   canonical route or intentionally remain standalone. Do not leave ambiguous
   overlap.
5. Regenerate the docs site and fix any broken links or nav mismatches before
   moving to PR review.

### Acceptance Criteria

- A cold reader can identify one first page, one first discovery command family,
  and one criterion for when MCP is the better front door.
- The public pages no longer contradict one another about the first successful
  post-install path.
- Docs build succeeds with the updated nav and links.

### Validation

```bash
./scripts/docs_build.sh
rg -n "skills for-app|mcp serve|install-state.json|mcp-config-snippet.json" docs
```

### Expected Commit

```text
docs(agent-host): tighten public discovery guidance
```

## Phase 3: Top-Level CLI and Skills Help Orientation

### Agent Tier

default

### Goal

Make the CLI help answer the same orientation questions as the public docs:
where to start, which discovery commands to use first, and when MCP is the
alternative front door.

### Files or Surfaces To Change

- `apps/node/src/cli/registry.ts`
- generated CLI reference output through the normal docs build workflow

### Steps

1. Read the current top-level help and `skills` help in `registry.ts` before
   editing. Keep command inventory intact; this phase changes wording and
   emphasis, not subcommand shape.
2. Tighten the top-level `clawperator` help so it points at the canonical docs
   route and the right first command families instead of assuming prior context.
3. Tighten `clawperator skills` help so the fastest discovery commands are easy
   to spot, especially `skills for-app`, `skills search`, and `skills get`.
4. Only mention MCP at the help level where it helps a host choose between
   fronts. Do not turn top-level help into protocol documentation.
5. Regenerate docs so `api/cli.md` stays in sync with the edited help blocks.

### Acceptance Criteria

- Top-level help points at the canonical public orientation route.
- `skills` help highlights the first successful discovery flow rather than only
  listing subcommands mechanically.
- `api/cli.md` is regenerated from source and matches the new help text.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Expected Commit

```text
feat(node): improve agent-host CLI orientation
```

## Phase 4: Registry and Discovery Remediation Guidance

### Agent Tier

default

### Goal

Make registry-read and related discovery failures point at the durable installed
path and the correct next step instead of only env-var remediation.

### Files or Surfaces To Change

- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- `apps/node/src/test/unit/skills.test.ts`
- `apps/node/src/cli/registry.ts` if a tightly related usage string must stay in sync
- `sites/docs/source-map.yaml` only if generator ownership changes are required

### Steps

1. Review the current registry-read failure and warning text in
   `localSkillsRegistry.ts`, then compare it with the shipped baseline captured
   in `tasks/agent-host-orientation/plan.md`.
2. Tighten failure messages so they mention the durable installed registry path
   and the relevant next step. Preserve the existing path-selection behavior
   unless a direct contradiction is found.
3. Add focused regression coverage in `apps/node/src/test/unit/skills.test.ts`
   for the changed guidance text where the message is part of the intended user
   contract.
4. If any help or generated CLI reference text changed as part of the same work,
   regenerate docs before closing the phase.

### Acceptance Criteria

- Registry-read guidance no longer implies that setting
  `CLAWPERATOR_SKILLS_REGISTRY` is the only normal fix after install.
- The changed messages reference the installed home path and a concrete next
  step.
- Focused tests cover the intended guidance changes where practical.
- Node build, tests, and docs build all pass together.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Expected Commit

```text
fix(node): clarify skills discovery remediation
```
