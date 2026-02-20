import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";

export interface ParsedTerminal {
  envelope: ResultEnvelope;
  terminalSource: TerminalSource;
}

/**
 * Parse result envelope: [Clawperator-Result] only (canonical envelope).
 * Returns envelope, null if not an envelope, or 'malformed' if prefix exists but JSON is invalid.
 */
export function parseResultEnvelope(line: string, commandId: string): ResultEnvelope | 'malformed' | null {
  const trimmed = line.trim();
  const prefixIndex = trimmed.indexOf(RESULT_ENVELOPE_PREFIX);
  if (prefixIndex === -1) return null;
  const json = trimmed.slice(prefixIndex + RESULT_ENVELOPE_PREFIX.length).trim();
  try {
    const data = JSON.parse(json) as ResultEnvelope;
    if (data.commandId === commandId) return data;
    return null; // different commandId
  } catch {
    return 'malformed';
  }
}

/**
 * Parse terminal result: [Clawperator-Result] only (canonical envelope).
 * Returns envelope plus terminalSource for observability.
 */
export function parseTerminalEnvelope(line: string, commandId: string): ParsedTerminal | 'malformed' | null {
  const envelope = parseResultEnvelope(line, commandId);
  if (typeof envelope === 'object' && envelope !== null) {
    return { envelope, terminalSource: "clawperator_result" };
  }
  return envelope;
}
