# Public `skill.md` Agent Setup Entrypoint Work Breakdown

Parent plan: `tasks/install/skill.md/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 adds the public landing artifacts and install
validation. Phase 2 migrates durable guidance into authored docs and regenerates
the docs site as needed.

This task is deliberately narrow. It creates a public agent setup entrypoint for
Clawperator. It does not change runtime behavior, add plugin metadata, publish a
runtime skill, or implement well-known skill discovery endpoints.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Read the source files before editing. Do not copy package names, Node
  requirements, or command names from memory.
- Keep `/skill.md` direct and static. Do not redirect it to GitHub raw content.
- Keep `/agents.md` direct and static. Do not leave the existing `/agents.md`
  redirect pointing at `/index.md`.
- Keep the public skill focused on setup, repair, verification, and orientation.
- Do not mention debug `.dev` Operator package defaults in public skill content.
- Do not add `.codex-plugin`, `.claude-plugin`, public skills registry metadata,
  or well-known skill discovery endpoints in this task.
- Do not edit generated docs output directly. Update authored docs first, then
  use the docs build workflow.
- Add validation for the new public Markdown contract before treating the
  landing change as complete.
- Use one commit per coherent phase unless implementation reveals a smaller
  natural breakpoint.

## Required Reading

Read these files in this order before writing code or docs.

| File | Why it matters |
| --- | --- |
| `tasks/install/skill.md/plan.md` | Stable scope, deterministic decisions, and validation gates |
| `tasks/install/skill.md/findings.md` | Evidence base for the Link pattern and Clawperator mapping |
| `docs/internal/design/node-api-design-guiding-principles.md` | Agent-facing API and command UX principles |
| `apps/node/package.json` | Package name, version, and Node engine requirement |
| `apps/node/src/cli/registry.ts` | CLI command names, install route, MCP route, and device flags |
| `apps/node/src/domain/host/hostSetup.ts` | Local host setup artifacts written by `clawperator install` |
| `sites/landing/public/install.sh` | Shell bootstrap behavior and delegation to `clawperator install` |
| `sites/landing/public/index.md` | Existing landing Markdown surface |
| `sites/landing/public/llms.txt` | Existing crawler and agent discovery surface |
| `sites/landing/public/_redirects` | Current redirects that affect `/agents.md` |
| `sites/landing/public/landing-sitemap.xml` | Landing sitemap that must include new public URLs |
| `validation/install/README.md` | Install harness conventions |
| `validation/install/test_install.sh` | Suite entrypoint to wire the new harness into |
| `docs/setup.md` | Public setup docs to align in Phase 2 |
| `docs/host-agents.md` | Host-agent orientation docs to align in Phase 2 |

## PR / Phase Plan

| PR | Branch | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `install/public-skill-md` | Public setup skill, `agents.md`, validation, and docs alignment | 1, 2 | thinking, default | none |

## Phase 1: Landing Artifacts and Install Validation

### Agent Tier

thinking

### Goal

Add the public `skill.md` and `agents.md` entrypoints, make them discoverable
from landing machine surfaces, and validate their contract.

### Files or Surfaces To Change

- `sites/landing/public/skill.md`
- `sites/landing/public/agents.md`
- `sites/landing/public/_redirects`
- `sites/landing/public/index.md`
- `sites/landing/public/llms.txt`
- `sites/landing/public/landing-sitemap.xml`
- `sites/landing/public/sitemap.xml` if the landing sitemap timestamp is
  changed
- `validation/install/test_skill_md.sh`
- `validation/install/test_install.sh`
- `validation/install/README.md`

### Steps

1. Reopen `apps/node/package.json`, `apps/node/src/cli/registry.ts`,
   `apps/node/src/domain/host/hostSetup.ts`, and
   `sites/landing/public/install.sh`. Confirm the current package name, Node
   requirement, setup commands, host artifacts, and install behavior before
   writing public text.
2. Add `sites/landing/public/skill.md`.
   - Prefer a short YAML frontmatter block with `name`, `description`,
     `license`, `compatibility`, and `metadata`.
   - If adding a "last verified" marker, derive the package version from
     `apps/node/package.json` during implementation.
   - Include the content contract from `plan.md`.
   - Use exact commands only after verifying them against source.
   - Keep runtime guidance limited to readiness checks and handoff routes.
3. Add `sites/landing/public/agents.md`.
   - Include the exact public prompt:
     `Read https://clawperator.com/skill.md and get me set up with Clawperator.`
   - Include the shell fallback:
     `curl -fsSL https://clawperator.com/install.sh | bash`
   - Link to `/skill.md`, `/install.sh`, docs, `llms.txt`, and
     `llms-full.txt`.
   - Keep it compact. Do not create a full `/agents` page redesign.
4. Update `sites/landing/public/_redirects`.
   - Remove the stale `/agents.md /index.md 308` rule.
   - Retarget `/agent.md /agents.md 308` and `/for-agents.md /agents.md 308`
     so those aliases reach the new page, not `/index.md`.
   - Preserve existing `/agent /agents 308` and `/for-agents /agents 308`
     behavior because `/agents` is the existing rendered landing route.
5. Update `sites/landing/public/index.md`.
   - Add a small "Tell your agent" entry near the existing installation
     snippet.
   - Do not expand the landing page into a long setup guide.
6. Update `sites/landing/public/llms.txt`.
   - Add links for `https://clawperator.com/skill.md` and
     `https://clawperator.com/agents.md`.
   - Keep the docs-site links as the canonical technical documentation.
7. Update `sites/landing/public/landing-sitemap.xml`.
   - Add `https://clawperator.com/skill.md`.
   - Add `https://clawperator.com/agents.md`.
   - Update `sites/landing/public/sitemap.xml` only if you update the landing
     sitemap timestamp.
8. Add `validation/install/test_skill_md.sh`.
   - Validate that `sites/landing/public/skill.md` and
     `sites/landing/public/agents.md` exist.
   - Validate that `skill.md` includes the exact public prompt target,
     `clawperator`, Node.js 24+, `clawperator install`, `clawperator doctor`,
     `clawperator devices`, `clawperator snapshot --device <device_serial>`,
     `~/.clawperator/AGENTS.md`, `~/.clawperator/mcp-config-snippet.json`,
     and `clawperator mcp serve`.
   - Validate that `skill.md` does not include stale or out-of-scope strings:
     `@clawperator/node`, `Node.js 18`, `.dev`, `.codex-plugin`,
     `.claude-plugin`, `raw.githubusercontent.com`, or
     `/.well-known/skills`.
   - Validate that `_redirects` no longer redirects `/agents.md`,
     `/agent.md`, or `/for-agents.md` to `/index.md`.
   - Validate that `llms.txt` and `landing-sitemap.xml` include the new URLs.
   - Validate that touched new Markdown files do not contain em dashes.
9. Wire `test_skill_md.sh` into `validation/install/test_install.sh`.
10. Update `validation/install/README.md` to describe the new harness.
11. Run Phase 1 validation.
12. Commit the Phase 1 changes.

### Acceptance Criteria

- `skill.md` and `agents.md` are present under `sites/landing/public/`.
- `/agents.md`, `/agent.md`, and `/for-agents.md` are not redirected to `/index.md`.
- Landing discovery files include `/skill.md` and `/agents.md`.
- The validation harness proves the public Markdown contract and guards against
  stale package, Node, redirect, and out-of-scope claims.
- `./scripts/site_build.sh` succeeds.

### Validation

```bash
bash validation/install/test_skill_md.sh
./validation/install/test_install.sh
./scripts/site_build.sh
```

### Expected Commit

```text
docs(install): add public skill.md setup entrypoint
```

## Phase 2: Public Docs Alignment and Build

### Agent Tier

default

### Goal

Move durable setup guidance into public authored docs and validate the docs
build output. Use the docs skills when editing and building docs.

### Files or Surfaces To Change

- `docs/setup.md`
- `docs/host-agents.md`
- `sites/docs/.build/` if regenerated by the docs workflow
- `sites/docs/site/` if regenerated by `./scripts/docs_build.sh`
- `sites/docs/source-map.yaml` only if a new docs page or generated mapping is
  required
- `sites/docs/mkdocs.yml` only if navigation changes require it

### Steps

1. Use the `docs-author` skill for authored docs edits and the `docs-build`
   skill for docs regeneration.
2. Reopen `docs/setup.md` and `docs/host-agents.md`.
   - Decide whether the new guidance belongs in one or both files.
   - Prefer a small section and cross-link over duplicating the full
     `skill.md` content.
3. Add durable docs guidance for:
   - the public prompt:
     `Read https://clawperator.com/skill.md and get me set up with Clawperator.`
   - when an outside agent should use `/skill.md`
   - how `/skill.md` relates to `clawperator install`
   - how local `~/.clawperator/AGENTS.md` takes over after install
   - where to find MCP configuration after install
4. Keep the docs accurate and current.
   - Do not claim that Clawperator can complete OS prompts, Developer Options,
     USB authorization, Android accessibility permission, or app sign-in without
     human involvement.
   - Do not mention debug `.dev` Operator package defaults in this public setup
     path.
   - Do not document well-known discovery endpoints, registry install support,
     or plugin metadata because this PR does not ship them.
5. Regenerate docs output through the repo docs workflow if docs changes require
   generated outputs.
6. Run Phase 2 validation.
7. Commit the Phase 2 changes.

### Acceptance Criteria

- Authored docs contain durable guidance for the new public agent-directed setup
  entrypoint.
- Durable guidance no longer exists only in `tasks/install/skill.md/`.
- Docs do not over-promise automation across human approval boundaries.
- Docs build succeeds.
- No generated docs file was hand-edited before its source changed.

### Validation

```bash
./scripts/docs_build.sh
! rg -n $'\u2014' docs/setup.md docs/host-agents.md sites/landing/public/skill.md sites/landing/public/agents.md
```

If Phase 2 changes affect install validation text or public landing links, rerun:

```bash
bash validation/install/test_skill_md.sh
```

### Expected Commit

```text
docs: document agent-directed setup entrypoint
```

## Final Review Checklist

- `git diff --check` passes.
- `bash validation/install/test_skill_md.sh` passes.
- `./validation/install/test_install.sh` passes.
- `./scripts/site_build.sh` passes.
- `./scripts/docs_build.sh` passes if authored docs changed.
- No public Markdown file contains em dashes.
- No deleted task or research file contains durable guidance missing from
  authored docs or the new public landing files.
- The final PR description names the intentionally out-of-scope items:
  GitHub raw redirect, bundled setup skill, public skills registry metadata,
  plugin metadata, debug `.dev` defaults, full `/agents` page, and well-known
  discovery endpoints.
