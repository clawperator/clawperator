# Safe query consumption and empty-matcher guidance

Status: [TODO]. Priority P2 in the [v0.10.x plan](../../releases/v0.10.x/plan.md).

## Outcome and evidence

Give Node consumers a minimal, validated query-consumption example. The usage
runner successfully consumed `stepResults[].data.query` after a second JSON
parse but had to discover the checks itself. Its empty matcher was a caller
mistake; all-node query works by omitting the matcher.

At `626a169d`, `StepResultData` is intentionally string-valued and
`NodeQueryResult` already defines the typed query shape. CLI help and
`docs/api/actions.md` already describe omitted matchers and serialized output.
Build on that material rather than duplicate it or claim it is absent.

## Scope and decisions

Deliver a runnable minimal Node example and tested validation logic local to the
example; a new exported SDK accessor is not required for this patch. Preserve
the canonical envelope and string payload contract. Check transport/process
outcome, envelope status, failed steps, the intended query step, JSON/schema
shape and truncation before treating nodes as a complete inventory. Keep the
original response available for diagnostics. Zero matches describe one capture;
truncated results cannot prove absence or uniqueness.

Make the rejected `--matcher-json '{}'` error actionable by explaining that
all-node discovery omits the matcher. Keep empty matcher rejection and selector
validation semantics. Reuse suitable existing validation rather than introduce
an alternate query protocol. Do not broaden into arbitrary SDK redesign.

## Owners and docs

- `apps/node/src/domain/actions/query.ts` and `cli/commands/action.ts`: execution
  builder and CLI wrapper (shortened path is under apps/node/src).
- `apps/node/src/contracts/{result,selectors}.ts`: envelope and query shapes.
- `apps/node/src/cli/selectorFlags.ts` and `cli/registry.ts`: validation and help.
- `apps/node/src/test/unit/{query,selectorFlags}.test.ts`: regression owners.
- Extend the query section of `docs/api/actions.md` with the tested example and
  links to `docs/api/selectors.md` using docs-author. Keep the runnable source in
  an appropriate existing example location, or a narrowly named examples folder.

## Acceptance

The example handles valid zero/nonzero results and rejects malformed payloads,
unsupported schema, missing/wrong query steps, failed envelope/steps, process or
transport failures and truncated inventories. It preserves command/task IDs and
raw diagnostics. An all-node invocation with no matcher works; `{}` still fails
with recovery guidance, without weakening other action matcher validation.
