# Selectors

## Purpose

Define the `NodeMatcher` contract used across execution payloads, explain how CLI selector flags map into that contract, and document the mutual-exclusion rules that prevent ambiguous selector input.

## Sources

- Contract shape: `apps/node/src/contracts/selectors.ts`
- Execution validation: `apps/node/src/domain/executions/validateExecution.ts`
- CLI selector parsing: `apps/node/src/cli/selectorFlags.ts`
- `read-value` label selector handling: `apps/node/src/cli/registry.ts`

## `NodeMatcher` Contract

The raw selector object shared by `matcher`, `container`, `expectedNode`, and `labelMatcher` is:

```json
{
  "resourceId": "optional string",
  "role": "optional string",
  "textEquals": "optional string",
  "textContains": "optional string",
  "contentDescEquals": "optional string",
  "contentDescContains": "optional string"
}
```

Meaning of each field:

| Field | Match behavior |
| --- | --- |
| `resourceId` | exact Android resource ID match |
| `role` | exact accessibility role match |
| `textEquals` | exact visible-text match |
| `textContains` | substring visible-text match |
| `contentDescEquals` | exact content-description match |
| `contentDescContains` | substring content-description match |

Rules enforced by Node:

- a matcher may contain one field or several fields
- multiple fields combine into one object, so the runtime receives all of them together
- empty matcher objects are invalid
- blank strings are rejected before or during validation depending on how the matcher was built
- selector objects are strict in execution validation, so unknown keys are rejected
- when the shared CLI parser sees no selector flags at all, it returns an empty matcher object and the command decides whether selectors are required for that command

Concrete payload example:

```json
{
  "matcher": {
    "role": "button",
    "textContains": "Settings"
  }
}
```

Success condition for that selector object:

- the object uses only the six supported matcher keys
- at least one value is non-empty

## Where Selectors Appear

`NodeMatcher` is reused in several action parameters:

| Action parameter | Meaning |
| --- | --- |
| `params.matcher` | primary target node for actions such as `click`, `read_text`, `enter_text`, `wait_for_node`, `scroll_until`, and `scroll_and_click` |
| `params.container` | optional ancestor or scrollable container constraint |
| `params.expectedNode` | navigation target for `wait_for_navigation` |
| `params.labelMatcher` | label node for `read_key_value_pair` |

Example execution fragment:

```json
{
  "id": "read-1",
  "type": "read_text",
  "params": {
    "matcher": { "textEquals": "Battery" },
    "container": { "resourceId": "android:id/list" }
  }
}
```

## CLI Selector Forms

For most commands, the CLI offers two equivalent ways to build a `NodeMatcher`:

1. Shorthand flags such as `--text`, `--text-contains`, `--id`, `--desc`, `--desc-contains`, and `--role`
2. Raw JSON via `--selector '<json>'`

Container selectors follow the same pattern:

1. Shorthand flags such as `--container-text`, `--container-id`, and `--container-role`
2. Raw JSON via `--container-selector '<json>'`

The parser resolves shorthand flags into the same `NodeMatcher` object used by raw JSON. For example:

```bash
clawperator wait --text "Done" --role button
```

becomes the matcher:

```json
{
  "textEquals": "Done",
  "role": "button"
}
```

## Selector Flags

<!-- CODE-DERIVED: selector-flags -->

Even without the generated table, the authored contract is:

- `--text` maps to `textEquals`
- `--text-contains` maps to `textContains`
- `--id` maps to `resourceId`
- `--desc` maps to `contentDescEquals`
- `--desc-contains` maps to `contentDescContains`
- `--role` maps to `role`
- `--selector` accepts a raw `NodeMatcher` JSON object
- container-prefixed forms map to the same fields on `params.container`

## Mutual Exclusion And Validation Rules

Element selector rules:

- `--selector` is mutually exclusive with all shorthand element selector flags
- duplicate value flags such as repeating `--text` or `--id` are rejected
- `--selector` must be valid JSON
- `--selector` must parse to a JSON object, not an array or scalar
- blank values such as `--text ""` or `--selector ""` are rejected
- `click --coordinate <x> <y>` is mutually exclusive with every element selector flag
- `click --coordinate ... --focus` is invalid because coordinate clicks do not support `clickType = "focus"`

Container selector rules:

- `--container-selector` is mutually exclusive with all `--container-*` shorthand flags
- duplicate container flags such as repeating `--container-id` are rejected
- `--container-selector` must be valid JSON
- `--container-selector` must parse to a JSON object
- blank values such as `--container-text ""` are rejected
- if no container flags are present, Node omits `params.container`

Validation examples:

Valid:

```bash
clawperator read --text "Price" --container-id "android:id/list" --json
```

Invalid:

```bash
clawperator read --text "Price" --selector '{"textEquals":"Price"}'
```

Why invalid:

- the CLI parser rejects mixing `--selector` with shorthand element flags

## Command-Specific Notes

### Most commands

`click`, `read`, `wait`, `scroll-until`, `scroll-and-click`, and `wait-for-nav` all use the shared selector parser from `selectorFlags.ts`. That means they share the same shorthand-to-JSON mapping and the same mutual-exclusion rules.

Required-vs-optional behavior is decided by the command after parsing:

- `click`, `read`, and `wait` require an element selector unless `click` is using `--coordinate`
- `wait-for-nav` accepts either `--app` or a selector, but still requires at least one of them
- `scroll` has no target selector and uses only optional container selector flags
- `scroll-until` and `scroll-and-click` require a target selector

### `type`

`type` is slightly different because `--text` means “text to enter”, not “textEquals selector”. For element targeting, `type` uses:

- `--id`
- `--desc`
- `--desc-contains`
- `--role`
- `--text-contains`
- `--selector`

Example:

```bash
clawperator type "hello world" --role textfield
```

### `read-value`

`read-value` does not use the general selector parser. It builds `labelMatcher` from three dedicated flags:

| CLI flag | `labelMatcher` field |
| --- | --- |
| `--label` | `textEquals` |
| `--label-id` | `resourceId` |
| `--label-desc` | `contentDescEquals` |

At least one of those flags is required.

Blank label values are rejected, and if you provide none of the three label flags the command returns a usage error before execution is built.

Concrete execution fragment:

```json
{
  "id": "read-value-1",
  "type": "read_key_value_pair",
  "params": {
    "labelMatcher": {
      "textEquals": "Battery"
    }
  }
}
```

## Container Matching Semantics

Container selectors narrow an action to a matched ancestor or scrollable region instead of searching the full screen.

Current uses:

- `read` attaches the matcher as `params.container`
- `scroll` attaches the matcher as `params.container`
- `scroll_until` attaches the matcher as `params.container`
- `scroll_and_click` attaches the matcher as `params.container`

If no container selector is provided:

- `read_text` searches without container scoping
- scroll actions let Android choose the relevant on-screen scrollable container

Example:

```bash
clawperator scroll-until --text "About phone" --container-id "android:id/list"
```

becomes:

```json
{
  "type": "scroll_until",
  "params": {
    "matcher": { "textEquals": "About phone" },
    "container": { "resourceId": "android:id/list" }
  }
}
```

## JSON Examples

Exact text:

```json
{ "textEquals": "Wi-Fi" }
```

Partial text plus role:

```json
{ "textContains": "Sign", "role": "button" }
```

Raw container selector:

```json
{ "resourceId": "android:id/list" }
```

Navigation target:

```json
{
  "expectedPackage": "com.android.settings",
  "expectedNode": { "textEquals": "Settings" }
}
```

## CLI Examples

```bash
clawperator click --text "Wi-Fi"
```

```bash
clawperator read --selector '{"resourceId":"android:id/title"}' --json
```

```bash
clawperator wait --text-contains "Done" --timeout 10000 --json
```

```bash
clawperator scroll-until --text "About phone" --container-id "android:id/list"
```

```bash
clawperator read-value --label "Battery" --json
```

## Related Pages

- [Actions](actions.md)
- [Errors](errors.md)
- [API Overview](overview.md)
