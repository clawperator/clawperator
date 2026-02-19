import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";

export interface ParsedTerminal {
  envelope: ResultEnvelope;
  terminalSource: TerminalSource;
}

/**
 * Parse a single line for [Clawperator-Result] JSON envelope.
 * Supports full line starting with prefix or logcat format (tag: [Clawperator-Result] {...}).
 */
export function parseResultEnvelope(line: string, commandId: string): ResultEnvelope | null {
  const trimmed = line.trim();
  const prefixIndex = trimmed.indexOf(RESULT_ENVELOPE_PREFIX);
  if (prefixIndex === -1) return null;
  const json = trimmed.slice(prefixIndex + RESULT_ENVELOPE_PREFIX.length).trim();
  try {
    const data = JSON.parse(json) as ResultEnvelope;
    if (data.commandId === commandId) return data;
  } catch {
    return null;
  }
  return null;
}

/**
 * Parse terminal result: [Clawperator-Result] only (canonical envelope).
 * Returns envelope plus terminalSource for observability.
 */
export function parseTerminalEnvelope(line: string, commandId: string): ParsedTerminal | null {
  const envelope = parseResultEnvelope(line, commandId);
  if (envelope !== null) {
    return { envelope, terminalSource: "clawperator_result" };
  }
  return null;
}
