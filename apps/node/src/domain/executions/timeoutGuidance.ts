interface TimeoutGuidanceContext {
  deviceId?: string;
  operatorPackage?: string;
}

interface TimeoutGuidanceDiagnostics {
  broadcastDispatchStatus?: string;
  lastCorrelatedEvents?: readonly string[];
}

export function buildResultEnvelopeTimeoutHint(
  diagnostics: TimeoutGuidanceDiagnostics,
  context: TimeoutGuidanceContext
): string | undefined {
  if (diagnostics.broadcastDispatchStatus !== "sent") {
    return undefined;
  }

  if ((diagnostics.lastCorrelatedEvents?.length ?? 0) > 0) {
    return undefined;
  }

  const deviceRef = context.deviceId ?? "<device_id>";
  const packageRef = context.operatorPackage ?? "<package>";

  return [
    "No correlated Android log lines were captured.",
    "This often indicates an APK/CLI version mismatch or an accessibility service issue.",
    `Run 'clawperator doctor --json --device ${deviceRef} --operator-package ${packageRef}' to diagnose.`,
  ].join(" ");
}
