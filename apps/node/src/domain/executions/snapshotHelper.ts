import type { SnapshotExtractionDiagnostics } from "../../contracts/result.js";
import { SaxesParser } from "saxes";

/**
 * Shared logic for extracting UI snapshot text from logcat lines.
 */
export function extractSnapshotFromLogs(lines: string[]): string | null {
  const snapshots = extractSnapshotsFromLogs(lines);
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

export interface ExtractedSnapshotRecord {
  snapshot: string;
  commandId?: string;
  validationError?: string;
  diagnosticPreview?: string;
  extractionDiagnostics?: SnapshotExtractionDiagnostics;
  terminationReason?: SnapshotExtractionDiagnostics["terminationReason"];
}

export function extractSnapshotsFromLogs(lines: string[]): string[] {
  return extractSnapshotRecordsFromLogs(lines).map(record => record.snapshot);
}

export function extractSnapshotRecordsFromLogs(lines: string[]): ExtractedSnapshotRecord[] {
  const parsedLines = lines
    .map(parseLogLine)
    .filter((line): line is ParsedLogLine => line !== null);

  const snapshots: ExtractedSnapshotRecord[] = [];
  let currentSnapshotLines: string[] | null = null;
  let currentSnapshotTag: string | null = null;
  let currentSnapshotCommandId: string | undefined;

  for (const line of parsedLines) {
    const { tag, message } = line;
    const marker = parseSnapshotMarkerMessage(message);
    if (tag !== null && marker !== null) {
      const currentSnapshot = currentSnapshotLines?.join("\n").trim();
      if (currentSnapshot !== undefined) {
        snapshots.push({
          snapshot: currentSnapshot,
          commandId: currentSnapshotCommandId,
          terminationReason: "next_snapshot",
        });
      }

      currentSnapshotLines = [];
      currentSnapshotTag = tag;
      currentSnapshotCommandId = marker.commandId;
      if (marker.firstLineRemainder) {
        currentSnapshotLines.push(marker.firstLineRemainder);
      }
      continue;
    }

    if (currentSnapshotLines === null) {
      continue;
    }

    if (tag !== currentSnapshotTag) {
      continue;
    }

    const trimmed = message.trim();
    if (trimmed.startsWith("[") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
      const currentSnapshot = currentSnapshotLines.join("\n").trim();
      snapshots.push({
        snapshot: currentSnapshot,
        commandId: currentSnapshotCommandId,
        terminationReason: "same_tag_event",
      });
      currentSnapshotLines = null;
      currentSnapshotTag = null;
      currentSnapshotCommandId = undefined;
      continue;
    }

    currentSnapshotLines.push(message);
    if (trimmed === "</hierarchy>") {
      const currentSnapshot = currentSnapshotLines.join("\n").trim();
      snapshots.push({
        snapshot: currentSnapshot,
        commandId: currentSnapshotCommandId,
        terminationReason: "closing_hierarchy",
      });
      currentSnapshotLines = null;
      currentSnapshotTag = null;
      currentSnapshotCommandId = undefined;
    }
  }

  const trailingSnapshot = currentSnapshotLines?.join("\n").trim();
  if (trailingSnapshot !== undefined) {
    snapshots.push({
      snapshot: trailingSnapshot,
      commandId: currentSnapshotCommandId,
      terminationReason: "end_of_capture",
    });
  }

  return snapshots.map(({ terminationReason, ...record }) => {
    const { reason: validationError, diagnostics } = inspectSnapshotXml(record.snapshot);
    return validationError === undefined ? record : {
      ...record, snapshot: "", validationError,
      extractionDiagnostics: { ...diagnostics,
        closingHierarchySeen: /<\/hierarchy\s*>/.test(record.snapshot),
        terminationReason,
      },
      diagnosticPreview: boundedUtf8Preview(record.snapshot, 1024),
    };
  });
}

export function extractSnapshotsForCommand(lines: string[], expectedCommandId: string): string[] {
  const records = extractSnapshotRecordsFromLogs(lines);
  return records
    .filter(record => record.commandId === expectedCommandId)
    .map(record => record.snapshot);
}

export function hasLegacyUntaggedSnapshotMarker(lines: string[]): boolean {
  return lines
    .map(parseLogLine)
    .some(line => line !== null && /^\[TaskScope\] UI Hierarchy:/.test(line.message));
}

interface ParsedLogLine {
  tag: string | null;
  message: string;
}

interface ParsedSnapshotMarker {
  commandId?: string;
  firstLineRemainder: string;
}

function parseLogLine(line: string): ParsedLogLine | null {
  const timeFormatMatch = line.match(
    /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+[A-Z]\/([^(]+)(?:\(\s*\d+\))?:\s?(.*)$/
  );
  if (timeFormatMatch) {
    return {
      tag: timeFormatMatch[1].trim(),
      message: timeFormatMatch[2] ?? "",
    };
  }

  const timeFormatPidTidMatch = line.match(
    /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+[A-Z]\s+([^:]+):\s?(.*)$/
  );
  if (timeFormatPidTidMatch) {
    return {
      tag: timeFormatPidTidMatch[1].trim(),
      message: timeFormatPidTidMatch[2] ?? "",
    };
  }

  if (/^[A-Z]\//.test(line)) {
    const delimiterIndex = line.indexOf(":");
    if (delimiterIndex !== -1) {
      const tag = line.slice(2, delimiterIndex).trim();
      const message = line.slice(delimiterIndex + 1);
      return {
        tag,
        message: message.startsWith(" ") ? message.slice(1) : message,
      };
    }
  }

  const trimmed = line.trim();
  return trimmed.length > 0 ? { tag: null, message: trimmed } : null;
}

function parseSnapshotMarkerMessage(message: string): ParsedSnapshotMarker | null {
  const newFormatMatch = message.match(/^\[TaskScope\] UI Hierarchy \[commandId=([^\]]+)]:\s*(.*)$/);
  if (!newFormatMatch) {
    return null;
  }

  return {
    commandId: newFormatMatch[1],
    firstLineRemainder: newFormatMatch[2]?.trim() ?? "",
  };
}

export function boundedUtf8Preview(source: string, maximumBytes: number): string {
  let bytes = 0;
  let result = "";
  for (const point of source) {
    const size = Buffer.byteLength(point, "utf8");
    if (bytes + size > maximumBytes) break;
    result += point;
    bytes += size;
  }
  return result;
}

/** Bounded SAX validation; declarations and external entities are never resolved. */
export function inspectSnapshotXml(xml: string): { reason?: string; diagnostics: SnapshotExtractionDiagnostics } {
  const diagnostics: SnapshotExtractionDiagnostics = {
    receivedBytes: Buffer.byteLength(xml, "utf8"), sourceValidationCategory: "valid",
  };
  const failed = (reason: string) => ({ reason, diagnostics: { ...diagnostics, sourceValidationCategory: reason } });
  if (xml.length === 0) return failed("missing_payload");
  if (diagnostics.receivedBytes > 8 * 1024 * 1024) return failed("payload_limit");
  let depth = 0;
  let root: string | undefined;
  let reason = "malformed_xml";
  const parser = new SaxesParser();
  parser.on("doctype", () => { reason = "doctype_forbidden"; throw new Error(); });
  parser.on("error", () => { throw new Error(); });
  parser.on("opentag", tag => {
    if (depth === 0) root = tag.name;
    if (++depth > 256) { reason = "depth_limit"; throw new Error(); }
  });
  parser.on("closetag", () => { depth--; });
  try {
    parser.write(xml).close();
    return root === "hierarchy" ? { diagnostics } : failed("invalid_root");
  } catch {
    for (const key of ["line", "column", "position"] as const) {
      const value = parser[key];
      if (Number.isSafeInteger(value) && value >= 0) diagnostics[key] = value;
    }
    return failed(reason);
  }
}

export function validateSnapshotXml(xml: string): string | undefined {
  return inspectSnapshotXml(xml).reason;
}
