import { ERROR_CODES } from "../../contracts/errors.js";
import type {
  RecordingHeader,
  RawRecordingEvent,
  ValidatedRecording,
} from "./recordingEventTypes.js";

export function validateRecordingNdjson(ndjson: string): ValidatedRecording {
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

  const headerLine = lines[0];
  let header: RecordingHeader;
  try {
    const parsed = JSON.parse(headerLine) as RecordingHeader;
    if (
      parsed.type !== "recording_header" ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.operatorPackage !== "string" ||
      typeof parsed.schemaVersion !== "number"
    ) {
      throw new Error("invalid");
    }
    header = parsed;
  } catch {
    throw {
      code: ERROR_CODES.RECORDING_PARSE_FAILED,
      message: "Missing or invalid recording header",
    };
  }

  if (header.schemaVersion !== 1) {
    throw {
      code: ERROR_CODES.RECORDING_SCHEMA_VERSION_UNSUPPORTED,
      message: `Unsupported recording schema version: ${header.schemaVersion}`,
    };
  }

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

    validateEventFields(event, i + 1);
    events.push(event);
  }

  events.sort((a, b) => a.seq - b.seq);
  return { header, events };
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
        event.bounds === null ||
        typeof event.bounds.left !== "number" ||
        typeof event.bounds.top !== "number" ||
        typeof event.bounds.right !== "number" ||
        typeof event.bounds.bottom !== "number"
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
      const unknownType = (event as { type?: unknown }).type;
      throw {
        code: ERROR_CODES.RECORDING_PARSE_FAILED,
        message: `Unknown event type at line ${lineNum}: ${unknownType}`,
      };
    }
  }
}
