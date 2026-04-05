# API Alias Follow-up

## Context

During the eval work, one recurring agent instinct was to think in terms of an
"open app" command. The concrete suggestion was to consider preserving or adding
a more explicit app-opening alias on the public CLI/API surface.

This note records that suggestion as follow-up work. It is not a statement that
the alias is missing from the runtime contract today. It is a product/API
ergonomics note based on agent behavior.

## Current Shipped Behavior

Current canonical action type:

- `open_app`

Current public CLI behavior:

- `clawperator open <target>`
- if `<target>` looks like a URI, `open` dispatches to `open_uri`
- otherwise `open` treats `<target>` as an app package and dispatches to `open_app`

Current removed-command migration hint:

- `action open-app` suggests `open`

Relevant code and docs:

- `apps/node/src/cli/registry.ts`
- `docs/api/navigation.md`
- `docs/api/actions.md`

## Follow-up Question

Should the public surface also accept an explicit app-opening alias such as:

- `open-app`
- `open_app`
- another narrowly scoped synonym for `open <applicationId>`

## Why This Came Up

- Agents often reason in terms of explicit verbs like "open app" rather than a
  target-dispatching `open` command.
- `open` is concise, but it combines two behaviors:
  - open a URI
  - open an app package
- That can be perfectly valid for humans while still being less obvious to an
  agent trying to guess the command surface from docs or prior intuition.

## Evaluation Criteria

If this is revisited later, the decision should be based on:

- whether eval transcripts show repeated agent confusion around app opening
- whether an added alias improves first-try success without making the CLI less deterministic
- whether the alias should be CLI-only or also reflected in docs as an accepted synonym
- whether the existing `open` routing plus docs examples are already sufficient

## Important Constraint

Do not change the canonical action type because of this note. The current
canonical execution action is still:

- `open_app`

This note is only about whether the human/agent-facing command surface should
accept a clearer alias for the existing behavior.
