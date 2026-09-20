# Android Settings version details with Codex

These two orchestrated examples read the exact Android OS release version and
Build number from Settings UI:

- `com.android.settings.get-version-details-codex`: Codex chooses each action.
- `com.android.settings.get-version-details-codex-with-jev`: Codex can delegate
  bounded navigation decisions to Jev, then recover and verify the result.

Implementation lives in the [skills repository](https://github.com/clawperator/clawperator-skills).
The examples open Settings, navigate, scroll, read values, and capture evidence.
They do not change settings, tap Build number, use device properties as answers,
or launch directly into a known About activity. English labels and recognized
row shapes are required. A different OEM route may end in an honest failure.

## Select and check the environment

Follow [Host Agent Orientation](../host-agents.md): inspect the chosen CLI's
version/help, discover devices, select the intended serial, inspect installed
Operator variants, and check compatibility before doctor. An incompatible debug
Operator does not invalidate a compatible release Operator. Carry the selected
pair explicitly; do not upgrade or reinstall just to match these examples.

Use a POSIX host for the examples' process-group cleanup and an authenticated Codex executable that supports the selected model and
`codex exec --ephemeral --sandbox workspace-write --json`. Select it through
`PATH` (the wrapper resolves `codex`) or `CLAWPERATOR_SKILL_AGENT_CLI`, which accepts
a plain executable name on `PATH`, not a full path. Confirm `codex --version`
and test model availability separately from device readiness. Codex account
login can be used; these examples do not require a separate OpenAI API key.
A model-compatibility error is a host-agent failure, not an Android transport fault.

From the skills repository root, configure the run. Replace all placeholders:

```bash
export CLAWPERATOR_BIN="<absolute_cli_executable_or_index.js>"
export CLAWPERATOR_SKILLS_REGISTRY="$PWD/skills/skills-registry.json"
export VERSION_CODEX_MODEL="<model_supported_by_selected_codex>"
export VERSION_CODEX_EFFORT="high"
export VERSION_RUN_DIR="<fresh_absolute_local_artifact_directory>"
```

For branch development, build the main repository's `apps/node` package and set
`CLAWPERATOR_BIN` to its `dist/cli/index.js`. In the following commands,
`clawperator` means that same selected invocation (`node <absolute_index.js>` for
a JavaScript entry point). Selecting a CLI for the outer command and a different
one in `CLAWPERATOR_BIN` would make the evidence misleading.

```bash
clawperator version --check-compat --device <device_serial> --operator-package <operator_package> --output json
clawperator doctor --device <device_serial> --operator-package <operator_package> --output json
clawperator skills validate com.android.settings.get-version-details-codex --dry-run
clawperator skills validate com.android.settings.get-version-details-codex-with-jev --dry-run
```

Require `compatible: true`, then doctor exit 0 and `criticalOk: true`. Retain the
compatibility and doctor reports beside the run artifacts to identify the APK
version and readiness conditions. Static validation alone cannot prove UI behavior.

The operator package is normally `com.clawperator.operator` for release use;
use the explicitly chosen development package for branch validation. Ensure
exclusive device access, including other agents and manual interaction. The
harness reserves the serial against other copies of these examples, but cannot
lock out arbitrary adb clients. An abandoned reservation after a host crash
requires inspecting its `owner.json` and confirming the old process group has
stopped before removing it; the harness does not steal locks automatically.

## Run one example at a time

```bash
clawperator skills run com.android.settings.get-version-details-codex --device <device_serial> --operator-package <operator_package> --timeout 300000 --output json
```

For the second example, create a new `VERSION_RUN_DIR` and provide `JEV_API_KEY`
through the local environment without printing or embedding it in arguments:

```bash
clawperator skills run com.android.settings.get-version-details-codex-with-jev --device <device_serial> --operator-package <operator_package> --timeout 300000 --output json
```

Codex-only execution neither needs nor forwards the Jev key. The Jev example
checks for the key before navigation. See [Jev decisions](settings-version-jev.md)
for exactly what leaves the device and how proposals are validated.

The examples declare instruction version `1.1.0`. Compared with the unversioned
prototype, callers must now set `VERSION_CODEX_MODEL`; remove any assumption that
a particular model is available on every host. The model is required explicitly;
there is no machine-specific model default.
Effort defaults to `high` and must be supported by the selected model. A supplied
artifact directory must be absolute and unused. Even a failed attempt claims its
directory. Without one, the harness creates a temporary directory. Retain the
whole directory, including failures, in an ignored local location.

## Interpret success and failure

The launcher checks a compact receipt against `verified-result.json`, then emits
one `[Clawperator-Skill-Result]` frame. The CLI wraps it as `skillResult` and owns
its `source` field. Check the wrapper outcome and nested status; a process exit
or successful navigation alone does not establish the requested values.

This excerpt is from a locally verified emulator run (Android 15). Envelope
indexes belong to that run and will differ in your output:

```json
{
  "skillResult": {
    "status": "success",
    "result": {
      "kind": "json",
      "value": {
        "androidVersion": "15",
        "buildNumber": "AE3A.240806.036",
        "evidence": {
          "androidVersion": {"execEnvelopeIndex": 12, "stepResultId": "read-value"},
          "buildNumber": {"execEnvelopeIndex": 17, "stepResultId": "read-value"}
        }
      }
    },
    "terminalVerification": {"status": "verified"}
  }
}
```

Each value must match both its unique snapshot row association and a successful
`read-value` result. Both fields can be collected on different screens within the
same run. Finish reacquires Settings evidence and captures a final screenshot;
it does not assert that both rows are simultaneously visible. References index
only real `execEnvelopes`, not raw command slots. A failed command without an
envelope stays in the ledger and cannot become a null or invented envelope.

A failure can have no success receipt. For example, this nested excerpt reports
a configuration failure before device work:

```json
{
  "status": "failed",
  "contractVersion": "1.0.0",
  "result": null,
  "checkpoints": [],
  "terminalVerification": {"status": "failed"},
  "diagnostics": {"reason": "VERSION_CODEX_MODEL must be explicitly configured"}
}
```

Valid failed or indeterminate frames retain their original reason. Never replace
one with a missing-receipt error. For command failures, inspect the raw response
and [execution failure evidence](../api/errors.md#execution-failure-evidence):
requested work and readiness probes have separate identities. A not-dispatched
command may have earlier effects. Observe before retrying an uncertain mutation.
Post-processing can fail after execution. Snapshot extraction failure and compact
truncation are separate reasons to stop and reacquire, not usable partial proof.

## Evidence and timing

| Artifact | Interpretation |
| --- | --- |
| `run-identity.json`, `metadata.json` | Run claim, selected model/effort, resolved agent executable/version, CLI invocation/version, device/package, direct transport, prompt and source hashes. These local files contain machine paths and serials. |
| `events.json`, `command-N.json`, `.stdout`, `.stderr` | Ordered command ledger, correlation and retained failure evidence, complete responses and per-command wall time. Command indexes are not envelope indexes. |
| `state.json` | Collected rows, snapshot/read indexes, offered actions, and any explicit overlay review. |
| `jev.json`, `fallbacks.json` | Every Jev request attempt/response and client latency, plus fallback reasons. An initial-observation failure may produce fallback evidence with zero Jev calls. |
| `codex.jsonl`, `codex.stderr`, `last-message.txt` | Agent transcript, host failures and final receipt or failure. Tool calls and agent turns are observable; they are not an exact internal model-request count. |
| `verified-result.json`, `final.png` | Locally verified full result and final screen. Absent on many failure paths. |
| `child-exit.json`, `run-summary.json` | Child status/timeout and process-group cleanup; harness wall time and outcome. Harness time excludes outer CLI startup and validation; measure the entire outer invocation for end-to-end time. |

Do not add overlapping command, model, and harness times and call the sum total
latency. Retain external start/end timestamps when comparing end-to-end runs.
Record all attempts and recoveries, not only passing runs. Keep raw screenshots,
hierarchies, transcripts and paths private; publish sanitized values, counts,
source identity, outcome and artifact references. A few passes do not establish
general reliability or resolve the historical Samsung readiness cause.

## Local validation example

Fresh checks on 2026-09-20 used CLI 0.12.0 with Operator 0.12.0-d, direct
transport, an authenticated Codex executable reporting 0.155.0-alpha.9.2, and an
explicit model/effort selection. Both fields were independently reverified from
the retained run evidence after each success.

| Device | Mode | Exact Android version / Build number | Outer wall time | Jev attempts / fallbacks |
| --- | --- | --- | --- | --- |
| AOSP emulator | Codex | `15` / `AE3A.240806.036` | 68.39 s | 0 / 0 |
| AOSP emulator, Settings restarted | Codex + Jev | `15` / `AE3A.240806.036` | 65.82 s | 4 / 1 |
| Pixel 10 Pro | Codex | `17` / `CP2A.260705.006` | 84.90 s | 0 / 0 |
| Pixel 10 Pro, Settings restarted | Codex + Jev | `17` / `CP2A.260705.006` | 58.19 s | 6 / 0 |

The emulator fallback rejected an uncertain Jev answer; Codex then completed the
UI proof. A separate resumed-screen run completed in 32.72 s without a Jev request
because the fields were already visible. That run proves the completion shortcut,
not Jev navigation performance. These are small validation samples, not a speed
benchmark. Live overlays, localization, and Samsung behavior were not re-proved.
The historical Samsung readiness cause remains unresolved.

## Adapt the example

The two `scripts/run.js` files only select the decision mode. `orchestrated_run.js`
owns host configuration, artifact claims and device reservations;
`settings_version_harness.js` owns the Codex child, environment allowlist,
watchdog, receipt validation and result framing. The latter is an example harness,
not a new public generic orchestration API.

Settings labels, supported row shapes, allowed navigation candidates and exact
value verification live in `settings_version_model.js` and
`settings_version_runtime.js`. Known AOSP and Samsung routes in each `SKILL.md`
are hints; current observations determine actions. `settings_version_tool.js`
exposes bounded operations. `settings_version_jev.js` proposes choices outside
the Clawperator actuator. Keep application-specific navigation out of reusable
host lifecycle helpers and out of Clawperator core.

Before reuse, test changed parsing/decisions off-device, validate registry/index
freshness, and prove the intended UI path. See [Authoring](authoring.md) and
[Development workflow](development.md). These examples do not implement a general
context projection API or bundled control-loop skill.
