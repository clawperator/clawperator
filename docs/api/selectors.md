# Selectors

## Purpose

Define the `NodeMatcher` contract used in execution payloads and the CLI selector flags that map onto it.

## `NodeMatcher` Contract

`apps/node/src/contracts/selectors.ts` defines this shape:

```json
{
  "resourceId": "<optional>",
  "role": "<optional>",
  "textEquals": "<optional>",
  "textContains": "<optional>",
  "contentDescEquals": "<optional>",
  "contentDescContains": "<optional>"
}
```

Rules:

- A matcher must contain at least one non-empty field.
- Execution validation rejects empty matcher objects.
- Payload actions use `matcher`, `container`, `expectedNode`, or `labelMatcher` fields that all reuse this contract.

## CLI Forms

Two element-selector forms exist:

1. Shorthand flags such as `--text`, `--id`, and `--role`
2. Raw JSON via `--selector '<json>'`

Two container-selector forms exist:

1. Shorthand flags such as `--container-text` and `--container-id`
2. Raw JSON via `--container-selector '<json>'`

## Selector Flags

<!-- CODE-DERIVED: selector-flags -->

## Mutual Exclusion Rules

- `--selector` is mutually exclusive with all shorthand element selector flags.
- `--container-selector` is mutually exclusive with all shorthand container selector flags.
- `--coordinate` is mutually exclusive with every element selector flag and is supported only by `click`.
- `click --coordinate ... --focus` is invalid.
- Duplicate value flags such as repeating `--text` or repeating `--container-id` are rejected.
- Blank selector values such as `--text ""` or `--selector ""` are rejected.

## Container Matching Semantics

Container matchers scope an operation to a matched ancestor container instead of the full screen.

Current uses:

- `read` can pass `container` with `read_text`.
- `scroll`, `scroll_until`, and `scroll_and_click` can pass `container`.

Container matching is optional:

- If no `--container-*` flags are present, the action runs without a container filter.
- If container flags are present, they are resolved into a `NodeMatcher` object and attached to `params.container`.

## JSON Examples

Element matcher:

```json
{"textContains":"Settings","role":"button"}
```

Container matcher:

```json
{"resourceId":"android:id/list"}
```

## CLI Examples

```bash
clawperator click --text "Wi-Fi"
```

```bash
clawperator read --selector '{"resourceId":"android:id/title"}' --json
```

```bash
clawperator scroll-until --text "About phone" --container-id "android:id/list"
```

## Related Pages

- [Actions](actions.md)
- [Errors](errors.md)
