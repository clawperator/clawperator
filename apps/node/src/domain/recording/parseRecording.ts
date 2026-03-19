import * as fs from "node:fs/promises";
import { ERROR_CODES } from "../../contracts/errors.js";
import type {
  RecordingHeader,
  RawRecordingEvent,
  RecordingStep,
  RecordingStepLog,
  OpenAppStep,
  ClickStep,
  ClickEvent,
} from "./recordingEventTypes.js";

export async function parseRecordingFile(filePath: string): Promise<RecordingStepLog> {
  const content = await fs.readFile(filePath, "utf-8");
  return parseRecording(content);
}

export function parseRecording(ndjson: string): RecordingStepLog {
  // Step 1: Split on newlines, skip empty lines, parse each line as JSON
  const lines = ndjson
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    throw {
      code: ERROR_CODES.RECORDING_PARSE_FAILED,
      message: "Empty recording file",
    };
  }

  // Step 2: Parse header - first non-empty line must be a recording_header
  const headerLine = lines[0];
  let header: RecordingHeader;
  try {
    const parsed = JSON.parse(headerLine) as RecordingHeader;
    if (parsed.type !== "recording_header") {
      throw {
        code: ERROR_CODES.RECORDING_PARSE_FAILED,
        message: "Missing or invalid recording header",
      };
    }
    header = parsed;
  } catch {
    throw {
      code: ERROR_CODES.RECORDING_PARSE_FAILED,
      message: "Missing or invalid recording header",
    };
  }

  // Step 3: Reject unsupported schema versions
  if (header.schemaVersion !== 1) {
    throw {
      code: ERROR_CODES.RECORDING_SCHEMA_VERSION_UNSUPPORTED,
      message: `Unsupported recording schema version: ${header.schemaVersion}`,
    };
  }

  // Step 4: Process remaining lines as RawRecordingEvent objects
  const events: RawRecordingEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch {
      throw {
        code: ERROR_CODES.RECORDING_PARSE_FAILED,
        message: `Malformed NDJSON at line ${i + 1}`,
      };
    }
    // Validate required event fields (ts, seq, type)
    const event = parsed as RawRecordingEvent;
    if (
      typeof event.ts !== "number" ||
      typeof event.seq !== "number" ||
      typeof event.type !== "string"
    ) {
      throw {
        code: ERROR_CODES.RECORDING_PARSE_FAILED,
        message: `Invalid event at line ${i + 1}: missing required fields (ts, seq, type)`,
      };
    }
    // Validate event-type-specific required fields
    validateEventFields(event, i + 1);
    events.push(event);
  }

  function validateEventFields(event: RawRecordingEvent, lineNum: number): void {
    switch (event.type) {
      case "window_change": {
        if (typeof event.packageName !== "string") {
          throw {
            code: ERROR_CODES.RECORDING_PARSE_FAILED,
            message: `Invalid window_change event at line ${lineNum}: missing packageName`,
          };
        }
        break;
      }
      case "click": {
        if (
          typeof event.packageName !== "string" ||
          (event.resourceId !== null && typeof event.resourceId !== "string") ||
          (event.text !== null && typeof event.text !== "string") ||
          (event.contentDesc !== null && typeof event.contentDesc !== "string") ||
          typeof event.bounds !== "object" ||
          event.bounds === null
        ) {
          throw {
            code: ERROR_CODES.RECORDING_PARSE_FAILED,
            message: `Invalid click event at line ${lineNum}: missing required fields`,
          };
        }
        break;
      }
      case "scroll": {
        if (
          typeof event.packageName !== "string" ||
          (event.resourceId !== null && typeof event.resourceId !== "string") ||
          typeof event.scrollX !== "number" ||
          typeof event.scrollY !== "number" ||
          typeof event.maxScrollX !== "number" ||
          typeof event.maxScrollY !== "number"
        ) {
          throw {
            code: ERROR_CODES.RECORDING_PARSE_FAILED,
            message: `Invalid scroll event at line ${lineNum}: missing required fields`,
          };
        }
        break;
      }
      case "press_key": {
        if (event.key !== "back") {
          throw {
            code: ERROR_CODES.RECORDING_PARSE_FAILED,
            message: `Invalid press_key event at line ${lineNum}: missing or invalid key`,
          };
        }
        break;
      }
      case "text_change": {
        if (
          typeof event.packageName !== "string" ||
          (event.resourceId !== null && typeof event.resourceId !== "string") ||
          typeof event.text !== "string"
        ) {
          throw {
            code: ERROR_CODES.RECORDING_PARSE_FAILED,
            message: `Invalid text_change event at line ${lineNum}: missing required fields`,
          };
        }
        break;
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unknownType = (event as any).type;
        throw {
          code: ERROR_CODES.RECORDING_PARSE_FAILED,
          message: `Unknown event type at line ${lineNum}: ${unknownType}`,
        };
      }
    }
  }

  // Sort by seq to be safe
  events.sort((a, b) => a.seq - b.seq);

  // Step 5: Apply normalization rules (v1)
  const steps: RecordingStep[] = [];
  const warnings: string[] = [];
  let openAppInferred = false;
  let lastWasClickOrPressKey = false;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    switch (event.type) {
      case "window_change": {
        // Rule A: First window_change becomes open_app
        if (!openAppInferred) {
          const step: OpenAppStep = {
            seq: event.seq,
            type: "open_app",
            packageName: event.packageName,
            uiStateBefore: event.snapshot ?? null,
          };
          steps.push(step);
          openAppInferred = true;
          lastWasClickOrPressKey = false;
        } else if (lastWasClickOrPressKey) {
          // Keep this window_change (it follows a click/press_key)
          // But we don't create a step for it in v1
          lastWasClickOrPressKey = false;
        } else {
          // Rule: Suppress consecutive window_change with no intervening click or press_key
          // (keep only the final one of each such run - which means we just skip this one)
        }
        break;
      }

      case "click": {
        // Rule B: Click extraction
        const clickEvent = event as ClickEvent;
        const step: ClickStep = {
          seq: event.seq,
          type: "click",
          packageName: clickEvent.packageName,
          resourceId: clickEvent.resourceId,
          text: clickEvent.text,
          contentDesc: clickEvent.contentDesc,
          bounds: clickEvent.bounds,
          uiStateBefore: clickEvent.snapshot ?? null,
        };
        steps.push(step);
        lastWasClickOrPressKey = true;
        break;
      }

      case "scroll": {
        // Rule C: Scroll drop with warning
        warnings.push(`seq ${event.seq}: scroll event dropped (not extracted in v1)`);
        // Scroll doesn't break the consecutive window_change chain
        break;
      }

      case "text_change": {
        // Rule D: Text_change passthrough (dropped silently in v1)
        break;
      }

      case "press_key": {
        // Rule E: Press_key passthrough (dropped silently in v1)
        lastWasClickOrPressKey = true;
        break;
      }
    }
  }

  // Step 6: Return the RecordingStepLog
  const stepLog: RecordingStepLog = {
    sessionId: header.sessionId,
    schemaVersion: header.schemaVersion,
    steps,
  };

  // Only include _warnings if there are warnings
  if (warnings.length > 0) {
    stepLog._warnings = warnings;
  }

  // Step 7: Print human-readable summary to stderr
  printStepSummary(steps);

  return stepLog;
}

function printStepSummary(steps: RecordingStep[]): void {
  for (const step of steps) {
    const line = formatStepLine(step);
    process.stderr.write(`${line}\n`);
  }
}

function formatStepLine(step: RecordingStep): string {
  const seqStr = `[${step.seq}]`;
  const typeStr = step.type.padEnd(10);

  if (step.type === "open_app") {
    return `${seqStr} ${typeStr} ${step.packageName}`;
  } else if (step.type === "click") {
    const parts: string[] = [];
    if (step.text) {
      parts.push(`text="${step.text}"`);
    }
    if (step.resourceId) {
      parts.push(`resourceId=${step.resourceId}`);
    }
    if (step.contentDesc) {
      parts.push(`contentDesc="${step.contentDesc}"`);
    }
    const details = parts.length > 0 ? parts.join(" ") : "(no selector)";
    return `${seqStr} ${typeStr} ${details}`;
  }
  return `${seqStr} ${typeStr}`;
}
