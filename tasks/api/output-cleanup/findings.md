# API Output Cleanup Findings

## Surface Under Review

- CLI output-format flags and defaults.
- Result schema expectations for agent-consumed commands.
- Docs and help examples that currently teach `--json` on most API calls.

## Current State

The Node CLI already defaults to JSON output. In `apps/node/src/cli/index.ts`,
`getGlobalOpts()` initializes `output` to `"json"`, and `--json` only marks JSON
output as explicit. The same parser also accepts `--output json` and
`--format json`.

`apps/node/src/cli/output.ts` also describes the intended model directly:
agent-facing output is machine-readable JSON by default.

The friction is that the public docs, help text, generated skill examples,
runtime hints, and some tests still teach `--json` as if every API call needs
it. This makes the API look more awkward than it actually is and encourages
agents to cargo-cult an unnecessary flag into every command.

There is one behavioral exception that conflicts with the default-JSON model:
`read --all` and `read-value --all` require explicit JSON output through
`--json`, `--output json`, or `--format json`, even though the default output is
already JSON.

## Agent UX Assessment

For an API-first actuator, the command an agent should naturally try is:

```bash
clawperator snapshot
clawperator click --text "Accept"
clawperator scroll-until --text "Accept" --click
```

That should produce parseable JSON by default. Requiring or heavily documenting
`--json` makes the common path feel like a human CLI with an optional machine
mode, when Clawperator's primary product surface is the machine-readable API.

The current implementation is already mostly aligned with the better model. The
docs and help text are lagging behind the code.

## Recommendation

Make the formal agent-facing contract:

> Clawperator CLI commands return JSON by default. Use `--output pretty` only
> when a human-readable rendering is desired.

Keep `--json` as a permanent compatibility alias. It is familiar from adjacent
tools and should continue to work, but it should no longer be taught as required
in primary examples.

Do not add a new `--result-format json` flag. The existing `--output json` and
`--format json` aliases already cover explicit format selection. Adding a third
spelling would create unnecessary vocabulary without removing friction.

## Proposed Implementation Path

1. Update CLI help so primary usage examples omit `--json` for action/API
   commands.
2. Keep global help explicit that:
   - output defaults to JSON
   - `--json` is a compatibility shorthand for JSON output
   - `--output pretty` selects human-readable output
3. Remove the explicit-JSON requirement for `read --all` and `read-value --all`.
   Default JSON should satisfy the machine-readability requirement.
4. Update authored docs under `docs/` so the common path omits `--json`.
5. Update generated skill scaffolding and runtime hints so new examples do not
   reinforce the old habit.
6. Preserve `--json`, `--output json`, and `--format json` behavior for backward
   compatibility.
7. Add focused regression coverage showing representative commands return
   parseable JSON without `--json`, including:
   - `snapshot`
   - `read --all`
   - `read-value --all`
   - `skills list`
   - at least one error path

## Risk Notes

- This should not be a breaking runtime change because JSON is already the
  default.
- The main compatibility risk is documentation churn and tests that assert old
  example strings.
- Pretty output should remain opt-in. Do not flip the default for human
  convenience, because agents are the primary consumer.
- Generated docs must be rebuilt through the docs workflow after authored docs
  change.
