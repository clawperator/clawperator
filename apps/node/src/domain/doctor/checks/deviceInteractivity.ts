import { randomUUID } from "node:crypto";
import { runAdb, type AdbResult } from "../../../adapters/android-bridge/adbClient.js";
import { broadcastAgentCommand } from "../../../adapters/android-bridge/broadcastAgentCommand.js";
import { waitForResultEnvelope, type LogcatResult } from "../../../adapters/android-bridge/logcatResultReader.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES, type ErrorCode } from "../../../contracts/errors.js";
import { type StepResult } from "../../../contracts/result.js";

export type WaitForResultEnvelopeFn = typeof waitForResultEnvelope;

export interface InternalInteractiveState {
  screenOn: boolean;
  interactive: boolean;
  deviceLocked: boolean;
  userUnlocked: boolean;
}

export interface InteractiveStateEvidence extends Record<string, unknown> {
  deviceLocked: boolean;
  screenOn: boolean;
  userUnlocked: boolean;
}

export interface InteractiveStateProbeFailure {
  code: ErrorCode;
  message: string;
}

export interface InteractiveAutomationReadyError {
  code: ErrorCode;
  message: string;
  details?: InteractiveStateEvidence;
}

export type InteractiveStateProbeResult =
  | { ok: true; state: InternalInteractiveState }
  | { ok: false; code: ErrorCode; message: string };

export type InteractiveAutomationReadyResult =
  | { ok: true; state: InternalInteractiveState }
  | { ok: false; error: InteractiveAutomationReadyError };

export type WakeAttemptMethod =
  | "cmd_power_wakeup"
  | "keycode_wakeup"
  | "keycode_home";

export interface WakeAttempt {
  method: WakeAttemptMethod;
  adbResult: AdbResult;
}

export interface EnsureDeviceAwakeResult {
  status:
    | "already_awake"
    | "awake"
    | "awake_but_locked"
    | "still_asleep"
    | "transport_failed"
    | "probe_failed";
  attempts: WakeAttempt[];
  state?: InternalInteractiveState;
  error?: InteractiveStateProbeFailure;
}

interface WakeCommand {
  method: WakeAttemptMethod;
  args: string[];
}

const DEFAULT_WAKE_SETTLE_DELAY_MS = 750;
const DOCTOR_PING_ACTION_ID = "h1";

const WAKE_COMMANDS: WakeCommand[] = [
  {
    method: "cmd_power_wakeup",
    args: ["shell", "cmd", "power", "wakeup"],
  },
  {
    method: "keycode_wakeup",
    args: ["shell", "input", "keyevent", "KEYCODE_WAKEUP"],
  },
  {
    method: "keycode_home",
    args: ["shell", "input", "keyevent", "KEYCODE_HOME"],
  },
];

export async function runDoctorPingCommand(
  config: RuntimeConfig,
  waitForEnvelope: WaitForResultEnvelopeFn = waitForResultEnvelope
): Promise<LogcatResult> {
  const commandId = `doctor-handshake-${Date.now()}-${randomUUID()}`;
  const payload = JSON.stringify({
    commandId,
    taskId: "doctor-handshake",
    source: "clawperator-doctor",
    expectedFormat: "android-ui-automator",
    actions: [{ id: DOCTOR_PING_ACTION_ID, type: "doctor_ping" }],
    timeoutMs: 5000,
  });

  return waitForEnvelope(
    config,
    { commandId, timeoutMs: 7000 },
    async () => broadcastAgentCommand(config, payload)
  );
}

export function parseDoctorPingInteractiveState(stepResult: StepResult): InternalInteractiveState {
  const screenOn = parseStrictBoolean(stepResult, "screen_on");

  return {
    screenOn,
    interactive: screenOn,
    deviceLocked: parseStrictBoolean(stepResult, "device_locked"),
    userUnlocked: parseStrictBoolean(stepResult, "user_unlocked"),
  };
}

export function isInteractiveAutomationReady(
  state: Pick<InternalInteractiveState, "screenOn" | "deviceLocked" | "userUnlocked">
): boolean {
  return state.screenOn && !state.deviceLocked && state.userUnlocked;
}

export async function probeInteractiveState(
  config: RuntimeConfig,
  waitForEnvelope: WaitForResultEnvelopeFn = waitForResultEnvelope
): Promise<InteractiveStateProbeResult> {
  const result = await runDoctorPingCommand(config, waitForEnvelope);

  if (!result.ok) {
    if ("timeout" in result && result.timeout) {
      return {
        ok: false,
        code: result.diagnostics.code,
        message: result.diagnostics.message,
      };
    }

    if ("broadcastFailed" in result && result.broadcastFailed) {
      return {
        ok: false,
        code: result.diagnostics.code,
        message: result.diagnostics.message,
      };
    }

    if ("error" in result) {
      return {
        ok: false,
        code: (result.code as ErrorCode | undefined) ?? ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
        message: result.error,
      };
    }

    return {
      ok: false,
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping failed before a usable result envelope was available.",
    };
  }

  if (result.envelope.status !== "success") {
    return {
      ok: false,
      code: ERROR_CODES.DEVICE_ACCESSIBILITY_NOT_RUNNING,
      message: `Operator returned an error: ${result.envelope.error ?? "Unknown error"}`,
    };
  }

  const doctorPingStep = result.envelope.stepResults.find(step => step.actionType === "doctor_ping");
  if (!doctorPingStep) {
    return {
      ok: false,
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping step result was missing from the result envelope.",
    };
  }

  if (!doctorPingStep.success) {
    return {
      ok: false,
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping step result was unsuccessful.",
    };
  }

  try {
    return {
      ok: true,
      state: parseDoctorPingInteractiveState(doctorPingStep),
    };
  } catch (error) {
    return {
      ok: false,
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureDeviceAwake(
  config: RuntimeConfig,
  options?: {
    probeInteractiveStateFn?: typeof probeInteractiveState;
    settleDelayMs?: number;
  }
): Promise<EnsureDeviceAwakeResult> {
  const probeInteractiveStateFn = options?.probeInteractiveStateFn ?? probeInteractiveState;
  const settleDelayMs = options?.settleDelayMs ?? DEFAULT_WAKE_SETTLE_DELAY_MS;

  const initialProbe = await probeInteractiveStateFn(config);
  if (!initialProbe.ok) {
    return {
      status: "probe_failed",
      attempts: [],
      error: {
        code: initialProbe.code,
        message: initialProbe.message,
      },
    };
  }

  if (initialProbe.state.screenOn) {
    return {
      status: isInteractiveAutomationReady(initialProbe.state) ? "already_awake" : "awake_but_locked",
      attempts: [],
      state: initialProbe.state,
    };
  }

  const attempts: WakeAttempt[] = [];
  let lastObservedState = initialProbe.state;

  for (const command of WAKE_COMMANDS) {
    const adbResult = await runAdb(config, command.args);
    attempts.push({
      method: command.method,
      adbResult,
    });

    await sleep(settleDelayMs);

    const postAttemptProbe = await probeInteractiveStateFn(config);
    if (!postAttemptProbe.ok) {
      return {
        status: "probe_failed",
        attempts,
        error: {
          code: postAttemptProbe.code,
          message: postAttemptProbe.message,
        },
      };
    }

    lastObservedState = postAttemptProbe.state;
    if (didWakeCommandFail(adbResult)) {
      if (postAttemptProbe.state.screenOn) {
        return {
          status: isInteractiveAutomationReady(postAttemptProbe.state) ? "awake" : "awake_but_locked",
          attempts,
          state: postAttemptProbe.state,
        };
      }

      return {
        status: "transport_failed",
        attempts,
        state: postAttemptProbe.state,
        error: buildWakeTransportFailure(adbResult, command.method),
      };
    }

    if (!postAttemptProbe.state.screenOn) {
      continue;
    }

    return {
      status: isInteractiveAutomationReady(postAttemptProbe.state) ? "awake" : "awake_but_locked",
      attempts,
      state: postAttemptProbe.state,
    };
  }

  return {
    status: "still_asleep",
    attempts,
    state: lastObservedState,
  };
}

export async function ensureInteractiveAutomationReady(
  config: RuntimeConfig,
  options?: {
    ensureDeviceAwakeFn?: typeof ensureDeviceAwake;
    probeInteractiveStateFn?: typeof probeInteractiveState;
    settleDelayMs?: number;
  }
): Promise<InteractiveAutomationReadyResult> {
  const ensureDeviceAwakeFn = options?.ensureDeviceAwakeFn ?? ensureDeviceAwake;
  const wakeResult = await ensureDeviceAwakeFn(config, {
    probeInteractiveStateFn: options?.probeInteractiveStateFn,
    settleDelayMs: options?.settleDelayMs,
  });

  switch (wakeResult.status) {
    case "already_awake":
    case "awake":
      if (wakeResult.state && isInteractiveAutomationReady(wakeResult.state)) {
        return { ok: true, state: wakeResult.state };
      }
      return {
        ok: false,
        error: {
          code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
          message: "Interactive readiness helper returned success without a usable device state.",
        },
      };
    case "awake_but_locked":
    case "still_asleep":
      if (wakeResult.state) {
        return {
          ok: false,
          error: buildDeviceNotInteractiveError(wakeResult.state),
        };
      }
      return {
        ok: false,
        error: {
          code: ERROR_CODES.DEVICE_NOT_INTERACTIVE,
          message: "Device is not interactive and no interactive-state evidence was available.",
        },
      };
    case "probe_failed":
    case "transport_failed":
      return {
        ok: false,
        error: {
          code: wakeResult.error?.code ?? ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
          message: wakeResult.error?.message ?? "Could not prepare the device for interactive automation.",
          details: wakeResult.state ? toInteractiveStateEvidence(wakeResult.state) : undefined,
        },
      };
  }
}

export function toInteractiveStateEvidence(
  state: Pick<InternalInteractiveState, "deviceLocked" | "screenOn" | "userUnlocked">
): InteractiveStateEvidence {
  return {
    deviceLocked: state.deviceLocked,
    screenOn: state.screenOn,
    userUnlocked: state.userUnlocked,
  };
}

export function buildDeviceNotInteractiveError(
  state: Pick<InternalInteractiveState, "deviceLocked" | "screenOn" | "userUnlocked">
): { code: ErrorCode; message: string; details: InteractiveStateEvidence } {
  return {
    code: ERROR_CODES.DEVICE_NOT_INTERACTIVE,
    message: `Device is not interactive. Interactive automation requires an awake, usable device state. screenOn=${state.screenOn} deviceLocked=${state.deviceLocked} userUnlocked=${state.userUnlocked}`,
    details: toInteractiveStateEvidence(state),
  };
}

function didWakeCommandFail(adbResult: AdbResult): boolean {
  return adbResult.code === null || adbResult.code !== 0;
}

function buildWakeTransportFailure(
  adbResult: AdbResult,
  method: WakeAttemptMethod
): InteractiveStateProbeFailure {
  const detail = adbResult.stderr.trim() || adbResult.stdout.trim() || "Unknown adb transport failure.";
  return {
    code: ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
    message: `Wake attempt ${method} failed before the device became interactive: ${detail}`,
  };
}

function parseStrictBoolean(stepResult: StepResult, key: string): boolean {
  const value = stepResult.data[key];
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error(
    `doctor_ping returned an invalid boolean for ${key}: ${value === undefined ? "missing" : JSON.stringify(value)}`
  );
}

function didWakeCommandFail(adbResult: AdbResult): boolean {
  return adbResult.code === null || adbResult.code !== 0;
}

function buildWakeTransportFailure(
  adbResult: AdbResult,
  method: WakeAttemptMethod
): InteractiveStateProbeFailure {
  const detail = adbResult.stderr.trim() || adbResult.stdout.trim() || "Unknown adb transport failure.";
  return {
    code: ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
    message: `Wake attempt ${method} failed before the device became interactive: ${detail}`,
  };
}

async function sleep(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, durationMs));
}
