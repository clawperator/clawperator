# Agent Host Orientation and CLI Discoverability Work Breakdown

Parent plan: `tasks/agent-host-orientation/plan.md`

## Executive Summary

This pack no longer represents greenfield work.

The original 4-phase follow-up is now shipped on branches that already contain
`docs/host-agents.md`, public cross-links around that route, top-level CLI help
that points at it, and installed-home registry remediation text.

For this pack, two decisions are settled baseline:

- `docs/host-agents.md` is the chosen canonical post-install orientation route
- installed-home-first registry remediation is a guidance change only, not a
  `loadRegistry()` precedence change

Use this work breakdown to avoid redoing that shipped work. The only remaining
implementation work, if this pack is reopened, is residual public docs cleanup
for env-var-first discovery guidance that contradicts the shipped installed-home
flow.

## Status

| Item | Value |
| --- | --- |
| State | shipped |
| Total historical phases | 5 |
| Historical completed phases | 1, 2, 3, 4, 5 |
| Remaining active phases | 0 |
| Current / Next | done |
| Blockers | none |

## Hard Rules

- Do not reopen or expand PR #196.
- Do not recreate the canonical public route. `docs/host-agents.md` is already
  the shipped first stop.
- Do not create a second competing "start here" page.
- Do not redo top-level CLI and `skills` help alignment unless current code has
  regressed.
- Use `.agents/skills/docs-author/SKILL.md` for authored docs changes.
- Do not hand-edit `sites/docs/.build/`, `sites/docs/site/`, or generated
  `api/cli.md` content. Regenerate them from source.
- Do not add new commands or change runtime behavior in this pack.
- Keep `skills for-app` as the primary app-oriented discovery surface.
- If the plan and current code disagree, trust the code and update the task
  pack rather than implementing the stale assumption.
- Do not read retired onboarding task files as execution context. All baseline
  context this pack needs is already captured in
  `tasks/agent-host-orientation/plan.md`.

## Required Reading

Read these files in this order before making residual cleanup changes.

| File | Why it matters |
| --- | --- |
| `tasks/agent-host-orientation/plan.md` | Stable contract and current status |
| `docs/host-agents.md` | Current canonical public route |
| `docs/index.md` | Current docs-home entry point and link to the canonical route |
| `docs/setup.md` | Current install and artifact guidance |
| `docs/skills/overview.md` | Current runtime-skills discovery flow |
| `docs/api/mcp.md` | Current MCP front-door guidance |
| `docs/api/environment.md` | Residual env-var-first guidance that may still need cleanup |
| `docs/skills/runtime.md` | Residual runtime docs guidance that may still need cleanup |
| `docs/quickstart.md` | Current direct-automation public page |
| `docs/internal/design/agent-host-integration.md` | Durable design rules for host-agent orientation |
| `sites/docs/mkdocs.yml` | Public nav and published route ownership |
| `sites/docs/source-map.yaml` | Generated-page ownership, especially `api/cli.md` |
| `apps/node/src/cli/registry.ts` | Current top-level CLI help and `skills` help |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Current registry-read remediation text |
| `.agents/skills/docs-author/SKILL.md` | Required authoring workflow for docs work |

## Historical Shipped Phases

These phases are already shipped and should be treated as baseline, not as open
implementation work:

1. canonical public host-agent route selection
2. public docs cross-link alignment around that route
3. top-level CLI and `skills` help orientation alignment
4. registry-read remediation alignment around the installed home path

If any of those surfaces regress later, open a new task or add a narrow
follow-up note instead of pretending this work is still not started.

Settled interpretation for future readers:

- `docs/host-agents.md` is the canonical post-install route
- `docs/setup.md` remains install and readiness only
- `docs/quickstart.md` remains direct automation and observe / decide / act
- registry remediation guidance should favor
  `~/.clawperator/skills/skills/skills-registry.json` as the normal post-install
  recovery path
- explicit `CLAWPERATOR_SKILLS_REGISTRY` still wins when set, including the
  current fail-fast behavior for blank or misconfigured values

## Phase 5: Residual Public Docs Contradiction Cleanup

### Agent Tier

default

### Goal

Remove or explicitly narrow the remaining public docs guidance that still
pushes users toward env-var-first registry remediation instead of the shipped
installed-home discovery flow and canonical host-agent route.

### Files or Surfaces To Change

- `docs/api/environment.md`
- `docs/skills/runtime.md`
- `docs/host-agents.md` only if the canonical route needs a new cross-reference
- `docs/skills/overview.md` or `docs/setup.md` only if a cross-reference must
  stay in sync
- generated docs outputs through the normal docs build workflow

These residual contradictions are explicit follow-up scope, not hidden debt.
Do not claim repo-wide discovery-guidance consistency until they are cleaned up.

### Steps

1. Compare the current guidance in `docs/api/environment.md` and
   `docs/skills/runtime.md` against the shipped baseline in
   `docs/host-agents.md`, `docs/skills/overview.md`, and
   `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`.
2. Rewrite residual env-var-first instructions so they do not imply that
   setting `CLAWPERATOR_SKILLS_REGISTRY` is the only normal post-install fix.
3. Point those pages at the installed home path
   `~/.clawperator/skills/skills/skills-registry.json` plus a concrete next
   command such as `clawperator skills list --json` or
   `clawperator skills install`.
4. Add or tighten cross-links back to `docs/host-agents.md` when a reader needs
   the higher-level "skills versus MCP" decision flow.
5. Regenerate the docs site and verify that the public route and link graph stay
   consistent.

### Acceptance Criteria

- `docs/host-agents.md` remains the only canonical post-install route.
- `docs/api/environment.md` and `docs/skills/runtime.md` no longer contradict
  the shipped installed-home discovery flow.
- No page implies that `CLAWPERATOR_SKILLS_REGISTRY` is the only normal
  remediation path after install.
- Docs build succeeds with the updated authored pages and generated outputs in
  sync.

### Validation

```bash
./scripts/docs_build.sh
rg -n "CLAWPERATOR_SKILLS_REGISTRY|skills list --json|host-agents" docs/api/environment.md docs/skills/runtime.md docs/host-agents.md docs/skills/overview.md
```

### Expected Commit

```text
docs(agent-host): align residual discovery guidance
```

## Deferred Work

If future contradictions appear outside the files above, record them here
explicitly instead of silently widening this pack again. Examples:

- new public docs pages that bypass `docs/host-agents.md`
- future CLI regressions that stop pointing at the canonical route
- registry-resolution behavior changes in code that require new remediation text
