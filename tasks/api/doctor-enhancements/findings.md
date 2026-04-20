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

### 4. A CLI-only `skills run` gate would miss a real parallel entrypoint

The current findings mention `clawperator skills run`, but they miss that there
is another skill execution surface:

- CLI: `cmdSkillsRun()` in `apps/node/src/cli/commands/skills.ts`
- HTTP: `POST /skills/:skillId/run` in `apps/node/src/cli/commands/serve.ts`

Important differences:

- `cmdSkillsRun()` currently does only a banner-time APK presence check.
- `/skills/:skillId/run` does not do that banner check at all.
- `/skills/:skillId/run` calls `runSkill()` directly after validation.
- `runSkill()` itself is only a process launcher plus result-frame verifier. It
  does not know device readiness.

Implication:

- We do not need a high-level skill-entry readiness gate if stable failure on
  the first internal CLI call is acceptable.

Recommendation:

- Do not add pre-spawn readiness enforcement to `cmdSkillsRun()` or
  `/skills/:skillId/run` in this change.
- Let skills fail via the first internal `clawperator exec` or similar command
  after Node preflight has applied there.
- Keep the task pack explicit that the skill wrappers remain launchers, not
  readiness authorities.

### 5. Shared skill helpers are part of the architecture and cannot be ignored

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
  `clawperator exec` through this helper will inherit the stable failure on
  their first internal CLI call.

### 6. The task pack currently blurs two different failure surfaces

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
- Do not introduce an Android envelope error code for this change unless later
  race handling makes it necessary.

### 7. A Node-only preflight is race-prone; the Android runtime remains the final authority

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

### 8. The rollout implications are broader than the original findings listed

Missing implications from the earlier draft:

- `apps/node/src/contracts/errors.ts`
  - add a stable code only after the predicate is defined
- `apps/node/src/domain/doctor/criticalChecks.ts`
  - mark the new interactive-state check critical if that is the intended gate
- `apps/node/src/cli/commands/serve.ts`
  - `mapErrorToStatus()` will need a deliberate mapping if Node starts
    returning this as a top-level error
- `docs/api/doctor.md`
  - update check reference and success semantics
- `docs/skills/runtime.md`
  - update the device prep checklist
- `docs/api/errors.md` and possibly `docs/api/overview.md`
  - update them for the new public Node preflight error surface
- `../clawperator-skills`
  - no behavioral change required beyond inheriting the first-call failure from
    Node preflight

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
- Do not add pre-spawn readiness enforcement to high-level skill wrappers in
  this change.
- Do not add a new Android envelope error code in this change.
- Do not reuse the full doctor sequence before every command.

### Phase 5: Cover all affected entrypoints

Because the chosen change is a low-level Node preflight contract, cover:

- CLI `exec` and action wrappers
- HTTP `/execute`, `/snapshot`, `/screenshot`
- MCP tools via `runExecution()`
- skill scripts indirectly through their first internal CLI call

## Resolved Decisions

1. The failing predicate is the broader "device not interactive" state, not
   only keyguard lock.
2. Enforcement for this task belongs in `doctor` and in narrow Node preflight.
3. Skills do not need a pre-spawn gate. Stable failure on the first internal
   CLI call is sufficient.
4. Android envelope-level enforcement is out of scope for this task and the
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
- let skill wrappers remain thin and rely on first internal CLI-call failure
- document the accepted race instead of expanding this task into Android
  envelope authority
