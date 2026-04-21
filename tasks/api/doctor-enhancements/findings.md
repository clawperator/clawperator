# Doctor Enhancements Findings

## Purpose

Review the "device ready" recommendation from the actual implementation, not
from expectations, and tighten the proposed path so it fits the current
Clawperator Node CLI, doctor, execution, serve, MCP, Android operator, and
shared skills-helper architecture.

## Sources

- `apps/node/src/domain/doctor/DoctorService.ts`
- `apps/node/src/domain/doctor/checks/deviceChecks.ts`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- `apps/node/src/domain/doctor/criticalChecks.ts`
- `apps/node/src/domain/devices/resolveDevice.ts`
- `apps/node/src/domain/executions/runExecution.ts`
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/cli/commands/serve.ts`
- `apps/node/src/mcp/tools/common.ts`
- `apps/node/src/contracts/doctor.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/contracts/result.ts`
- `apps/node/src/contracts/aliases.ts`
- `apps/node/src/domain/executions/validateExecution.ts`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/runtime/OperatorCommandReceiver.kt`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/ClawperatorResultEnvelope.kt`
- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceState.kt`
- `apps/android/shared/core/common/src/main/kotlin/action/devicestate/DeviceStateSystem.kt`
- `apps/android/shared/core/common/src/main/kotlin/action/keyguard/KeyguardManagerSystem.kt`
- `apps/android/shared/app/app-adapter/src/main/kotlin/clawperator/application/ApplicationAndroid.kt`
- `../clawperator-skills/skills/utils/common.js`
- `docs/api/doctor.md`
- `docs/skills/runtime.md`

## Verified Architecture

### 1. `doctor` is the canonical diagnostics report, but it is parameterized by target selection

What the code actually does:

- `DoctorService` owns the ordered diagnostics sequence for host checks, device
  discovery, device capability, APK presence, version compatibility, settings,
  handshake, and optional smoke checks.
- `criticalOk` is derived only from `criticalChecks.ts`, not from all checks.
- `doctor --json` can still exit `0` in the multi-device case when
  `device.discovery` returns `warn` with
  `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`.
- `docs/api/doctor.md` already documents that callers must require exit code `0`
  and `criticalOk == true`, and must also ensure they are talking about the
  same resolved `deviceId`.

Implication:

- "device ready" is not a global truth. It is a statement about one resolved
  `deviceId` plus one `operatorPackage`.
- Any new readiness contract must stay target-specific and must not forget the
  existing multi-device ambiguity rule.

### 2. `doctor_ping` is internal-only today

What the code actually does:

- `doctor_ping` is intentionally excluded from the public execution contract in
  both `contracts/aliases.ts` and `validateExecution.ts`.
- `DoctorService.runHandshake()` bypasses normal public execution validation and
  dispatches `doctor_ping` directly through `broadcastAgentCommand()`.
- `UiActionEngine.executeDoctorPing()` currently returns only:
  - `developer_options_enabled`
  - `usb_debugging_enabled`

Implication:

- Extending `doctor_ping` is architecturally consistent, but it remains an
  internal diagnostic action, not a new public action type.
- The findings should not imply that agents or skill authors will call
  `doctor_ping` directly through the public API.

### 3. Android already has the lock and boot-state primitives, but Node never sees them

What the code actually does:

- `DeviceStateSystem` exposes:
  - `queryDeviceLocked`
  - `queryScreenOn()`
  - `isUserUnlocked`
- `KeyguardManagerSystem` provides the lock truth.
- `ApplicationAndroid` delays app initialization until `isUserUnlocked`.

What is missing:

- None of those fields are surfaced through the current doctor diagnostic
  payload.
- Default `doctor` therefore never asks the operator whether the device is
  currently interactive.

Implication:

- The gap is real, but it is broader than only "lock screen".

## Findings

### 1. The current recommendation overstates how far `doctor` can be treated as a runtime gate

The current task pack says `doctor` is already the readiness authority. That is
only partly true.

What is true:

- `doctor` is the canonical diagnostics report and the canonical place to
  explain why a target is or is not ready.

What needs tightening:

- `doctor` is not itself the runtime execution primitive.
- `doctor` success is only meaningful after device resolution and package
  alignment.
- `doctor` does not currently gate `runExecution()`, `runSkill()`, or
  `/skills/:skillId/run`.

Recommended wording:

- Treat `doctor` as the canonical diagnostics authority, not as proof that all
  runtime entrypoints already enforce the same readiness contract.

### 2. The blind spot is "interactive device state", not just "locked screen"

The previous findings proposed a `DEVICE_LOCKED` path immediately. That may be
too narrow.

The actual operator-side facts available today are:

- `deviceLocked`
- `screenOn`
- `userUnlocked`

From first principles, a device is only "ready for interactive automation" when
the runtime can interact with the foreground UI deterministically. In the
current architecture, that implies at least:

- a resolved target device
- the expected operator package
- a compatible and reachable operator runtime
- an interactive device state

Chosen failing predicate:

- the device is not currently interactive, using structured state such as:
  - `deviceLocked == true`
  - `screenOn == false`
  - `userUnlocked == false`

Recommendation:

- Use a machine code aligned to the chosen predicate, such as
  `DEVICE_NOT_INTERACTIVE`, not `DEVICE_LOCKED`.
- Expose the booleans as structured evidence so callers can see why the device
  was considered non-interactive.

### 3. Do not duplicate the full doctor sequence inside every execution path

The earlier recommendation said to factor readiness into a helper and have
`DoctorService`, `runExecution()`, and `clawperator skills run` all call it.
That needs narrowing.

What `runExecution()` already does today:

- validates execution input
- resolves the target device
- checks APK presence
- performs Node-side `close_app` adb preflight
- dispatches the actual command and waits for the canonical envelope

What that means architecturally:

- the command dispatch itself is already the real handshake for direct
  execution paths
- adding version checks and handshake-like diagnostics before every command
  would create duplicate authorities, extra latency, and new drift between
  "doctor logic" and "execution logic"

Recommendation:

- Split the problem into:
  - a doctor diagnostic check for interactive state
  - a narrow reusable interactive-state probe, if needed
- Do not reuse the entire doctor sequence as a per-command preflight.

### 4. Skill-entry wrappers should preserve the original product goal

The current findings mention `clawperator skills run`, but there is another
skill execution surface:

- CLI: `cmdSkillsRun()` in `apps/node/src/cli/commands/skills.ts`
- HTTP: `POST /skills/:skillId/run` in `apps/node/src/cli/commands/serve.ts`

Important differences:

- `cmdSkillsRun()` currently does only a banner-time APK presence check.
- `/skills/:skillId/run` does not do that banner check at all.
- `/skills/:skillId/run` calls `runSkill()` directly after validation.
- `runSkill()` itself is only a process launcher plus result-frame verifier. It
  does not know device readiness.

From the original problem statement, the desired product behavior is:

- a central, obvious "device not ready" result before a skill run starts
- no need for individual skills to invent lock-screen-specific handling

That means the earlier recommendation to let skills fail only on their first
internal `clawperator exec` call was too weak for the stated goal.

Recommendation:

- Add pre-spawn readiness enforcement to both high-level skill entrypoints:
  - CLI `cmdSkillsRun()`
  - HTTP `POST /skills/:skillId/run`
- Keep the gate narrow:
  - resolve the target tuple
  - run the shared interactive-state probe
  - fail before spawning the skill process if the device is not interactive
- Keep `runSkill()` itself as a launcher and verifier, not a readiness
  authority.

This preserves one clear product contract:

- high-level skill wrappers fail early with the same structured readiness
  surface
- direct skill scripts and helper-driven `clawperator exec` calls still rely on
  low-level execution preflight

### 5. The serve skill-run surface needs an `operatorPackage` decision

Earlier in this task pack, readiness is correctly framed as specific to:

- resolved `deviceId`
- chosen `operatorPackage`

But `POST /skills/:skillId/run` currently accepts only:

- `deviceId`
- `args`
- `timeoutMs`
- `expectContains`

and does not accept `operatorPackage`.

Implication:

- the current serve skill-run surface cannot participate fully in the same
  target-specific readiness contract as the CLI wrapper
- without a change here, wrapper-level readiness would drift across the two
  skill entrypoints

Recommendation:

- add optional `operatorPackage` input to `POST /skills/:skillId/run`
- resolve it with the same precedence used elsewhere in serve:
  - explicit request value first
  - then request-independent environment/default resolution
- pass the resolved package both to:
  - the pre-spawn readiness probe
  - the skill env as `CLAWPERATOR_OPERATOR_PACKAGE`

This keeps the target tuple explicit and consistent across CLI and HTTP skill
entrypoints.

### 6. Shared skill helpers are part of the architecture and cannot be ignored

`../clawperator-skills/skills/utils/common.js` still shells out to
`clawperator exec` directly. That helper is used by runtime skill scripts
outside the Node wrapper flow.

Important consequences:

- A fix that only changes `cmdSkillsRun()` will not help users who run the
  skill script directly.
- A fix that only changes `doctor` will not prevent direct helper-driven
  execution from hitting the same problem.

Recommendation:

- Keep the shared helper thin, and do not add standalone readiness probing
  there for this change.
- Once Node preflight is added to direct execution paths, scripts using
  `clawperator exec` through this helper will inherit the stable low-level
  failure on their first internal CLI call.
- This is acceptable because the stronger early-failure contract belongs at the
  high-level skill wrappers, not inside every direct script helper.

### 7. The task pack currently blurs two different failure surfaces

This is the most important contract distinction the original findings missed.

Current direct execution behavior:

- `runExecution()` returns `ok: false` for Node-side preflight failures such as
  device resolution failure or missing APK.
- `runExecution()` returns `ok: true` when it successfully receives a canonical
  envelope, even if `envelope.status == "failed"`.
- CLI `exec` and HTTP `/execute` preserve that distinction.
- MCP tools currently normalize failed envelopes into MCP tool errors.

Architectural consequence:

- If interactive-state failure is detected inside the Android runtime and
  emitted as an envelope error code, that is not the same as a Node preflight
  failure.
- If the team wants a locked or non-interactive device to surface as
  transport-level `ok: false` everywhere, that is a broader Node contract
  decision, not just a doctor enhancement.

Chosen model:

- Node preflight failure for execution entrypoints in Node.

Recommendation:

- Return top-level `ok: false` before dispatch when the resolved device is not
  interactive.
- Update HTTP status mapping and other Node callers accordingly.
- Use an explicit serve mapping for the new top-level error instead of letting
  it fall through to `500`. Prefer a deliberate conflict-style status such as
  `409` for the non-interactive-device preflight path.
- Do not introduce an Android envelope error code for this change unless later
  race handling makes it necessary.

### 8. A Node-only preflight is race-prone; the Android runtime remains the final authority

Even if Node checks interactive state immediately before a run, the device can
lock after the preflight and before or during command execution.

That means:

- doctor is the diagnostic authority
- Node preflight is the chosen enforcement point for this change
- the design intentionally accepts residual races where the device becomes
  non-interactive after preflight and before execution finishes

Recommendation:

- Record this as an accepted limitation of the current rollout, not as
  something to solve in the same task by adding Android envelope authority.

### 9. The rollout implications are broader than the original findings listed

Missing implications from the earlier draft:

- `apps/node/src/contracts/errors.ts`
  - add a stable code only after the predicate is defined
- `apps/node/src/domain/doctor/criticalChecks.ts`
  - mark the new interactive-state check critical if that is the intended gate
- `apps/node/src/cli/commands/serve.ts`
  - `mapErrorToStatus()` will need a deliberate mapping if Node starts
    returning this as a top-level error
- `apps/node/src/cli/commands/serve.ts`
  - `POST /skills/:skillId/run` needs optional `operatorPackage` request input
    and env propagation

## Implementation Tightening

### 10. Implicitly resolved device selection must stay out of the spawned skill env

This was confirmed during phase-4 implementation against the current
`runSkill()` contract.

What the code actually does:

- for script-driven skills, `runSkill()` prepends `CLAWPERATOR_DEVICE_ID` to the
  child argv when that env var is present
- agent-driven skills keep device selection in env and do not consume it as a
  positional child arg

Implication:

- if a high-level wrapper resolves an implicit default device and always writes
  that serial into `CLAWPERATOR_DEVICE_ID`, script-driven skills silently
  receive a new first positional arg even though the caller did not pass
  `--device`
- that changes current runtime behavior and breaks the wrapper boundary this
  pack was supposed to preserve

Chosen implementation rule:

- use the resolved device id for wrapper preflight only
- propagate `CLAWPERATOR_DEVICE_ID` into the spawned skill env only when the
  caller explicitly supplied `--device` or HTTP `deviceId`
- still propagate the resolved `CLAWPERATOR_OPERATOR_PACKAGE` into the skill env
  for both CLI and serve wrappers

This keeps the early readiness gate while preserving the existing `runSkill()`
launcher contract for implicit device resolution.
- `apps/node/src/cli/commands/skills.ts`
  - `cmdSkillsRun()` needs pre-spawn readiness enforcement instead of only a
    banner-time APK check
- `docs/api/doctor.md`
  - update check reference and success semantics
- `docs/skills/runtime.md`
  - update the device prep checklist
- `docs/skills/overview.md`
  - update `skills run` behavior to document wrapper-level readiness failure
- `docs/api/errors.md` and possibly `docs/api/overview.md`
  - update them for the new public Node preflight error surface
- `../clawperator-skills`
  - no behavioral change required beyond inheriting the first-call failure from
    Node preflight

### 10. The current serve and MCP test seams do not naturally prove this new contract end to end

The current codebase has:

- `runExecution.test.ts` for direct execution behavior
- `serveCommand.test.ts` for small exported serve helpers
- `serve.test.ts` for black-box HTTP integration
- `mcpHelpers.test.ts` for MCP helper behavior
- `mcp.test.ts` for black-box stdio integration

Important limitation:

- the serve and MCP integration harnesses do not currently inject a fake
  interactive-state probe or fake `runExecution()` result
- black-box integration tests will only hit `DEVICE_NOT_INTERACTIVE`
  deterministically if the test environment provides a real device in that
  exact state, which is not a stable default assumption for repo tests

Recommendation:

- keep deterministic proof centered on unit tests for the new preflight and for
  any newly exported serve or MCP helper used to map or normalize the error
- add or update black-box integration coverage only if the implementation also
  introduces a deterministic seam that avoids live-device coupling

### 11. The test runner guidance must match the actual Node test script

`apps/node/package.json` uses Node's built-in test runner:

- `npm --prefix apps/node run test`
- `node --test ...`

Implication:

- Jest-style flags such as `--runInBand` are not valid task-pack guidance here
- if the pack wants targeted doctor coverage, it should name explicit built
  `dist/` test files after `npm --prefix apps/node run build`

## Recommended Path Forward

### Phase 1: Define the contract precisely

1. Use the broader "device not interactive" predicate.
2. Name the machine code after the actual predicate, not after the initial bug
   report.
3. Keep the diagnostic evidence explicit:
   - `deviceLocked`
   - `screenOn`
   - `userUnlocked`

### Phase 2: Extend the internal diagnostic state surface

1. Extend `doctor_ping`, or add another internal-only diagnostic action, to
   return the interactive-state booleans.
2. Keep that action internal. Do not add it to the public execution schema or
   public action docs.

### Phase 3: Make doctor report the condition clearly

1. Add a new critical doctor check for interactive state.
2. Ensure the check is target-specific:
   - resolved `deviceId`
   - chosen `operatorPackage`
3. Update the doctor docs to define that the normal readiness path now includes
   this condition.

### Phase 4: Apply the chosen enforcement boundary

- Add doctor diagnostics for `DEVICE_NOT_INTERACTIVE`.
- Add a narrow Node preflight probe before dispatch in execution entrypoints
  such as `runExecution()`.
- Treat that probe as a top-level Node error surface with `ok: false`.
- Add the same narrow pre-spawn readiness probe to high-level skill wrappers:
  - CLI `cmdSkillsRun()`
  - HTTP `POST /skills/:skillId/run`
- Add optional `operatorPackage` input to `POST /skills/:skillId/run` so the
  HTTP skill entrypoint can participate in the same target-specific readiness
  contract as the CLI wrapper.
- Do not add a new Android envelope error code in this change.
- Do not reuse the full doctor sequence before every command.

### Phase 5: Cover all affected entrypoints

Because the chosen change is both a low-level Node preflight contract and a
high-level skill-wrapper contract, cover:

- CLI `exec` and action wrappers
- HTTP `/execute`, `/snapshot`, `/screenshot`
- MCP tools via `runExecution()`
- CLI `skills run`
- HTTP `POST /skills/:skillId/run`
- direct skill scripts indirectly through their first internal CLI call

### Phase 6: Validation matrix

Implementation is not done until the following are covered:

1. Doctor contract:
   - doctor JSON includes the new interactive-state check
   - `criticalOk` is `false` when the device is not interactive
   - check evidence includes the chosen booleans
2. Direct execution preflight:
   - `runExecution()` returns top-level `ok: false` for the new condition
   - no Android dispatch happens on that path
3. Serve HTTP mapping:
   - `/execute`, `/snapshot`, and `/screenshot` return the chosen non-500
     status for the preflight failure
4. MCP normalization:
   - MCP tools surface the preflight failure as an MCP error result
5. Skill wrapper behavior:
   - `cmdSkillsRun()` fails before spawning the skill process when the device is
     not interactive
   - `POST /skills/:skillId/run` does the same
   - the serve skill-run route accepts and propagates optional
     `operatorPackage`
6. Direct script helper path:
   - at least one helper-driven skill path still fails deterministically on the
     first internal CLI call when bypassing the wrapper gate

## Resolved Decisions

1. The failing predicate is the broader "device not interactive" state, not
   only keyguard lock.
2. Enforcement for this task belongs in `doctor` and in narrow Node preflight.
3. High-level skill wrappers do need a pre-spawn gate so the product preserves
   one central readiness result before skill execution starts.
4. Direct script helpers remain thin and rely on low-level execution preflight
   on their first internal CLI call.
5. Android envelope-level enforcement is out of scope for this task and the
   remaining race is accepted for now.

## Bottom Line

The original findings were directionally right that the current readiness path
has a blind spot and that Android, not adb text parsing, should provide the
truth. The draft was not yet precise enough about:

- target-specific readiness versus global readiness
- internal diagnostics versus public API surface
- doctor diagnostics versus runtime execution contracts
- CLI skill wrapper versus serve skill wrapper versus shared skill helpers
- top-level preflight failure versus failed Android envelope semantics

The sharper implementation-ready path is:

- surface interactive-state booleans from the operator through an internal
  diagnostic contract
- make doctor report `DEVICE_NOT_INTERACTIVE` as part of canonical readiness
- add narrow Node preflight enforcement before execution dispatch
- add wrapper-level pre-spawn readiness enforcement for both skill entrypoints
- add optional `operatorPackage` to the serve skill-run route so target
  selection stays explicit and consistent
- leave direct script helpers thin so they still rely on first internal
  CLI-call failure when bypassing wrappers
- pin the validation matrix before implementation starts
- document the accepted race instead of expanding this task into Android
  envelope authority
