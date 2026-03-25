# Navigation Patterns

## Purpose

Show how agents compose `open_app`, `open_uri`, `wait_for_navigation`, and `snapshot_ui` into deterministic navigation workflows.

This page focuses on composition. For full per-action parameter rules, use [Actions](actions.md).

## Sources

- Builders: `apps/node/src/domain/actions/openApp.ts`, `apps/node/src/domain/actions/openUri.ts`, `apps/node/src/domain/actions/waitForNav.ts`
- Validation: `apps/node/src/domain/executions/validateExecution.ts`
- Shared contract: `apps/node/src/contracts/execution.ts`
- Limits: `apps/node/src/contracts/limits.ts`
- CLI command surface: `apps/node/src/cli/registry.ts`
- Selector parsing: `apps/node/src/cli/selectorFlags.ts`

## Why Compose Navigation

Neither `open_app` nor `open_uri` proves that the target screen is ready. In current Clawperator, deterministic navigation usually means:

1. trigger navigation
2. wait for the expected package or expected node
3. observe the resulting screen

The normal three-step shape is:

- `open_app` or `open_uri`
- `wait_for_navigation`
- `snapshot_ui`

Verification pattern - preview a composed navigation payload without dispatching:

```bash
clawperator exec --dry-run --execution '{"commandId":"settings-nav-1","taskId":"settings-nav-1","source":"docs","expectedFormat":"android-ui-automator","timeoutMs":30000,"actions":[{"id":"open","type":"open_app","params":{"applicationId":"com.android.settings"}},{"id":"wait","type":"wait_for_navigation","params":{"expectedPackage":"com.android.settings","timeoutMs":5000}},{"id":"snap","type":"snapshot_ui"}]}'
```

## `open_app`

`open_app` requires:

- `params.applicationId`

Validation rule:

- blank or missing `applicationId` fails with `EXECUTION_VALIDATION_FAILED`

Builder example:

```json
{
  "commandId": "open_app_1700000000000",
  "taskId": "cli-action-open-app",
  "source": "clawperator-cli",
  "timeoutMs": 15000,
  "expectedFormat": "android-ui-automator",
  "actions": [
    {
      "id": "a1",
      "type": "open_app",
      "params": {
        "applicationId": "com.android.settings"
      }
    }
  ]
}
```

Exact builder literals from `buildOpenAppExecution()`:

- `taskId: "cli-action-open-app"`
- `source: "clawperator-cli"`
- `timeoutMs: 15000`
- action id: `a1`

CLI routing pattern:

```bash
clawperator open com.android.settings
```

The `open` command treats a non-URI target as an app package and dispatches to `open_app`.

Exact classification rule from `isOpenCliUriTarget()`:

- `open` routes to `open_uri` only when the target matches `[a-z][a-z0-9+\\-.]*://`
- otherwise `open` treats the target as an app package and routes to `open_app`

Verification:

```bash
clawperator open com.android.settings --json
```

Expected live success shape:

```json
{
  "envelope": {
    "status": "success",
    "stepResults": [
      {
        "id": "a1",
        "actionType": "open_app",
        "success": true,
        "data": {
          "application_id": "com.android.settings"
        }
      }
    ]
  }
}
```

If you want to verify the builder shape without dispatching, use the example payload above with `clawperator exec --validate-only --execution '<json>'`.

What to verify after `open_app`:

- do not rely on the open action alone
- follow with `wait_for_navigation` using `expectedPackage`
- then confirm the target screen with `snapshot_ui` or another read action

Error cases:

- missing or blank `applicationId` in raw JSON: `EXECUTION_VALIDATION_FAILED`
- missing `open` target on the CLI: `MISSING_ARGUMENT`
- both positional target and `--app` on the CLI: `EXECUTION_VALIDATION_FAILED`

## `open_uri`

`open_uri` requires:

- `params.uri`

Validation rules:

- blank or missing `uri` fails
- maximum length is `2048` characters (`LIMITS.MAX_URI_LENGTH`)

Builder example:

```json
{
  "commandId": "open_uri_1700000000000",
  "taskId": "cli-action-open-uri",
  "source": "clawperator-cli",
  "timeoutMs": 15000,
  "expectedFormat": "android-ui-automator",
  "actions": [
    {
      "id": "a1",
      "type": "open_uri",
      "params": {
        "uri": "https://clawperator.com"
      }
    }
  ]
}
```

Exact builder literals from `buildOpenUriExecution()`:

- `taskId: "cli-action-open-uri"`
- `source: "clawperator-cli"`
- `timeoutMs: 15000`
- action id: `a1`

CLI routing pattern:

```bash
clawperator open https://clawperator.com
```

The `open` command uses `isOpenCliUriTarget()` and routes to `open_uri` when the target matches a URI-with-scheme pattern.

Verification:

```bash
clawperator open https://clawperator.com --json
```

Expected live success shape:

```json
{
  "envelope": {
    "status": "success",
    "stepResults": [
      {
        "id": "a1",
        "actionType": "open_uri",
        "success": true,
        "data": {
          "uri": "https://clawperator.com"
        }
      }
    ]
  }
}
```

If you want to verify the builder shape without dispatching, use the example payload above with `clawperator exec --validate-only --execution '<json>'`.

What Node validates versus what it does not:

- Node validates presence and max length
- Node does not enforce a URI scheme whitelist in `validateExecution.ts`

What to verify after `open_uri`:

- use `wait_for_navigation` if you expect a package or visible node
- use `snapshot_ui` to confirm the actual screen reached

Error cases:

- blank or missing URI in raw JSON: `EXECUTION_VALIDATION_FAILED`
- URI longer than `2048` characters: `EXECUTION_VALIDATION_FAILED`
- missing `open` target on the CLI: `MISSING_ARGUMENT`

## `wait_for_navigation`

`wait_for_navigation` is the navigation-specific confirmation step.

Current public parameters:

| Field | Valid values | Meaning |
| --- | --- | --- |
| `expectedPackage` | optional non-blank string | wait until that package is foreground |
| `expectedNode` | optional `NodeMatcher` | wait until a target node is present |
| `timeoutMs` | required number, `> 0`, `<= 30000` | wait window for navigation confirmation |

Validation rules:

- at least one of `expectedPackage` or `expectedNode` is required
- `timeoutMs` is required
- `timeoutMs` must be positive
- `timeoutMs` must not exceed `30000`

Builder inflation rule:

- execution timeout becomes `max(timeoutMs + 5000, 30000)`

Exact builder literals from `buildWaitForNavExecution()`:

- `source: "clawperator-action"`
- action id: `wait-for-nav`
- action type: `wait_for_navigation`
- default execution timeout when `navTimeoutMs` is omitted: `30000`

Example:

```json
{
  "id": "wait-for-nav",
  "type": "wait_for_navigation",
  "params": {
    "expectedPackage": "com.android.settings",
    "expectedNode": {
      "textEquals": "Connected devices"
    },
    "timeoutMs": 5000
  }
}
```

CLI rule for `wait-for-nav`:

- `--timeout` is required
- at least one of `--app` or a selector is required

CLI validation failures:

- missing `--timeout`: `MISSING_ARGUMENT`
- non-finite `--timeout` or `--timeout <= 0`: `EXECUTION_VALIDATION_FAILED`
- `--timeout > 30000`: `EXECUTION_VALIDATION_FAILED`
- blank `--app` value: `EXECUTION_VALIDATION_FAILED`
- no `--app` and no selector: `MISSING_ARGUMENT`

Verification:

```bash
clawperator wait-for-nav --app com.android.settings --timeout 5000 --validate-only
```

Expected validated execution shape:

```json
{
  "ok": true,
  "validated": true,
  "execution": {
    "source": "clawperator-action",
    "timeoutMs": 30000,
    "actions": [
      {
        "id": "wait-for-nav",
        "type": "wait_for_navigation",
        "params": {
          "expectedPackage": "com.android.settings",
          "timeoutMs": 5000
        }
      }
    ]
  }
}
```

## Common Navigation Sequence

The recommended pattern for deterministic app navigation is:

1. `open_app`
2. `wait_for_navigation`
3. `snapshot_ui`

Example payload:

```json
{
  "commandId": "settings-nav-1",
  "taskId": "settings-nav-1",
  "source": "agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "open",
      "type": "open_app",
      "params": {
        "applicationId": "com.android.settings"
      }
    },
    {
      "id": "wait",
      "type": "wait_for_navigation",
      "params": {
        "expectedPackage": "com.android.settings",
        "timeoutMs": 5000
      }
    },
    {
      "id": "snap",
      "type": "snapshot_ui"
    }
  ]
}
```

Machine-checkable success conditions:

- `envelope.status == "success"`
- `stepResults[0].actionType == "open_app"` and `stepResults[0].success == true`
- `stepResults[0].data.application_id == "com.android.settings"`
- `stepResults[1].actionType == "wait_for_navigation"` and `stepResults[1].success == true`
- `stepResults[1].data.resolved_package == "com.android.settings"`
- `stepResults[2].actionType == "snapshot_ui"` and `stepResults[2].success == true`
- `stepResults[2].data.text` exists

Verification command:

```bash
clawperator exec --execution '{"commandId":"settings-nav-1","taskId":"settings-nav-1","source":"docs","expectedFormat":"android-ui-automator","timeoutMs":30000,"actions":[{"id":"open","type":"open_app","params":{"applicationId":"com.android.settings"}},{"id":"wait","type":"wait_for_navigation","params":{"expectedPackage":"com.android.settings","timeoutMs":5000}},{"id":"snap","type":"snapshot_ui"}]}' --device <device_serial> --json
```

## Complete JSON Example

```json
{
  "envelope": {
    "commandId": "settings-nav-1",
    "taskId": "settings-nav-1",
    "status": "success",
    "stepResults": [
      {
        "id": "open",
        "actionType": "open_app",
        "success": true,
        "data": {
          "application_id": "com.android.settings"
        }
      },
      {
        "id": "wait",
        "actionType": "wait_for_navigation",
        "success": true,
        "data": {
          "resolved_package": "com.android.settings",
          "elapsed_ms": "412"
        }
      },
      {
        "id": "snap",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ],
    "error": null
  },
  "deviceId": "<device_serial>",
  "terminalSource": "clawperator_result",
  "isCanonicalTerminal": true
}
```

## Common Failure Modes

### App not installed

There is no dedicated Node validation code for "target app is missing" on `open_app`. This is a runtime problem and usually surfaces as a failed step or unexpected navigation result.

What to do:

- inspect `stepResults[0]`
- follow with `snapshot_ui` or `wait_for_navigation` to see where the device actually landed
- if the Operator package itself is missing instead of the target app, the execution fails earlier with `OPERATOR_NOT_INSTALLED`

### Navigation timeout

When `wait_for_navigation` never sees the expected package or node inside its timeout:

- the wait step fails at runtime
- the overall envelope becomes `status: "failed"`

Recovery:

- increase the action timeout only if the app truly needs more time
- verify the expectation is correct
- use [Snapshot Format](snapshot.md) or [Selectors](selectors.md) to inspect the actual screen

Typical failure branch:

```json
{
  "envelope": {
    "status": "failed",
    "stepResults": [
      {
        "actionType": "wait_for_navigation",
        "success": false,
        "data": {
          "error": "NAVIGATION_TIMEOUT",
          "last_package": "com.android.settings"
        }
      }
    ]
  }
}
```

Runtime detail:

- `wait_for_navigation` timeout failures use `data.error: "NAVIGATION_TIMEOUT"`
- when the runtime observed a foreground package before the timeout expired, it may also include `data.last_package`

### Wrong package on screen

If `open_uri` hands off to a chooser, browser, or another app, `expectedPackage` may not match what actually reached the foreground.

Recovery:

- use `expectedNode` when package alone is too coarse
- capture a snapshot and branch on the observed foreground UI

### Envelope timeout during navigation

If the entire payload runs too long, the caller gets a top-level `RESULT_ENVELOPE_TIMEOUT` error rather than a failed `wait_for_navigation` step.

Recovery:

- check whether the execution-level timeout was budgeted correctly
- use the builder rule `max(actionTimeout + 5000, 30000)` as the minimum
- verify device health with [Doctor](doctor.md) if the timeout is unexpected

## Recommended Pattern

- use `open_app` or `open_uri` only as the trigger
- use `wait_for_navigation` as the readiness gate
- use `snapshot_ui` as the final confirmation step

That three-step flow is the most reliable current navigation pattern for agents.

## Related Pages

- [Actions](actions.md)
- [Snapshot Format](snapshot.md)
- [Timeouts](timeouts.md)
- [Selectors](selectors.md)
- [Errors](errors.md)
