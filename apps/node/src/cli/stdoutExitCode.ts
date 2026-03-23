/**
 * Decide whether the CLI should set process.exitCode to 1 after printing `result` to stdout.
 * Mirrors the contract documented in cli/index.ts main().
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
