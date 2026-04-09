import * as fs from "node:fs/promises";
import type {
  RecordingStep,
  RecordingStepLog,
  OpenAppStep,
  ClickStep,
  ClickEvent,
} from "./recordingEventTypes.js";
import { validateRecordingNdjson } from "./recordingValidation.js";

export async function parseRecordingFile(filePath: string): Promise<RecordingStepLog> {
  const content = await fs.readFile(filePath, "utf-8");
  return parseRecording(content);
}

export function parseRecording(ndjson: string): RecordingStepLog {
  const { header, events } = validateRecordingNdjson(ndjson);
  const warnings: string[] = [];
  for (const event of events) {
    if (
      (event.type === "window_change" || event.type === "click") &&
      event.snapshot == null
    ) {
      warnings.push(`seq ${event.seq}: snapshot missing on ${event.type} event (uiStateBefore null)`);
    }
  }

  // Step 5: Apply normalization rules (v1)
  const steps: RecordingStep[] = [];
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
      default:
        // validateEventFields() should keep this unreachable for known schema
        // versions. If Android adds a new event type, update the parser in the
        // same change so we do not silently accept a shape we do not normalize.
        break;
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
