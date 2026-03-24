/**
 * Decide whether the CLI should set process.exitCode to 1 after printing `result` to stdout.
 * Mirrors the contract documented in cli/index.ts main().
 *
 * Device wrappers include `envelope`: exit 1 when `envelope.status === "failed"` or any
 * `envelope.stepResults[].success === false`.
 */
export function shouldCliStdoutForceExitCode1(result: string, usageParseError: boolean): boolean {
  if (usageParseError) {
    return true;
  }
  const trimmed = result.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
      return false;
    }
    if ("envelope" in obj) {
      const envelope = obj.envelope;
      if (envelope !== null && typeof envelope === "object" && !Array.isArray(envelope)) {
        const env = envelope as Record<string, unknown>;
        if (env.status === "failed") {
          return true;
        }
        const steps = env.stepResults;
        if (Array.isArray(steps) && steps.some(s => stepIndicatesFailure(s))) {
          return true;
        }
      }
      return false;
    }
    const code = obj.code;
    if (code === "USAGE" || code === "NOT_IMPLEMENTED") {
      return false;
    }
    if (typeof code === "string" && code.length > 0) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function stepIndicatesFailure(raw: unknown): boolean {
  return (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    (raw as { success?: unknown }).success === false
  );
}
