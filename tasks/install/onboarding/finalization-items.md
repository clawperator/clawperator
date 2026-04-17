# Install Onboarding Follow-Up Items

These items are intentionally deferred from the install/onboarding cleanup pack.

## Current Pack Status

As of 2026-04-17, the install/onboarding cleanup implementation is complete on
`install/onboarding-impl2` and PR #196 carries the remaining review/merge work.
The items below are still intentionally out of scope for that PR and should not
be folded back into this task pack.

## Deferred Follow-Up

### F6: Skill preflight and first-run requirements metadata

- **Deferred item:** add first-class preflight or `requires` metadata for
  runtime skills and surface it through `skills get`, plus early structured
  precondition failures where appropriate
- **Why deferred:** this is skill contract and runtime maturity work, not
  install/onboarding cleanup. Pulling it into the onboarding pack would blur the
  boundary between host-agent discovery and skill-runtime redesign.
- **Needed later:** separate task pack under the skills or Node surface
- **Dependencies:** none on this onboarding pack, other than preserving the F6
  rationale from `tasks/install/onboarding/findings.md`

### D1: Agent-facing docs information architecture and discoverability pass

- **Deferred item:** do a docs-focused pass that optimizes how quickly an
  unfamiliar agent or human can understand what Clawperator is, how runtime
  skills are discovered after install, and which surface to use first: CLI,
  runtime skills, or MCP.
- **Why deferred:** Phase 4 in this onboarding pack should document the shipped
  behavior that lands in PR-2. A broader docs information-architecture pass is
  still worthwhile, but it should happen after the new install artifacts and
  discovery commands are real so the docs can simplify around shipped behavior
  instead of branch-local intent.
- **Recommended scope later:**
  - tighten `docs/setup.md` so the post-install handoff is explicit:
    `~/.clawperator/AGENTS.md`, `install-state.json`, `mcp-config-snippet.json`,
    and the first discovery commands
  - tighten `docs/skills/overview.md` so runtime skills versus authoring skills
    is obvious and the first-success discovery flow is easy to follow
  - tighten `docs/api/mcp.md` so agent-host readers understand when MCP is the
    right front door versus `clawperator skills` or direct CLI commands
  - consider one new canonical public page for agent-host usage, such as
    "Use Clawperator From An Agent Host", instead of forcing readers to piece
    together setup, skills, and MCP pages themselves
  - cross-link the public pages in the order an unfamiliar host agent would need
    them, not just by subsystem
- **Needed later:** likely a small docs task pack under `tasks/docs/`
- **Dependencies:** onboarding cleanup PR-2 shipped, so the docs pass can
  describe stable behavior instead of speculative behavior

### D2: CLI self-orientation and discoverability pass

- **Deferred item:** review whether the CLI itself should do more to orient a
  zero-context agent or user toward the right next step after install.
- **Why deferred:** the current onboarding pack should first ship the runtime
  discovery behavior and durable artifacts. After that lands, we can make the
  CLI help and error surfaces point at the right stable docs and discovery
  commands instead of guessing ahead of the final shape.
- **Recommended scope later:**
  - review top-level `clawperator --help` for whether it should point to one
    canonical "start here" or "use from an agent host" doc
  - review `clawperator skills --help` for whether it should explicitly mention
    the public runtime skills registry / skills repo and the fastest discovery
    commands
  - tighten registry-read and skill-discovery errors so they reference the
    long-lived installed registry path and the relevant docs, not only env-var
    remediation
  - evaluate whether `skills for-app` should be surfaced prominently in help as
    the shortest path for questions like "what can this host do for Google Home?"
  - prefer linking primary help text to canonical docs, with the public skills
    repo as a secondary deep-link rather than the main orientation surface
- **Needed later:** likely a small Node / CLI task pack under `tasks/node/`
- **Dependencies:** onboarding cleanup PR-1 and PR-2 shipped, so help text can
  reflect the final discovery commands and installed artifact paths
