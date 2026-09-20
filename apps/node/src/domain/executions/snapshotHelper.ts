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
    });
  }

  return snapshots.map(record => {
    const validationError = validateSnapshotXml(record.snapshot);
    return validationError === undefined ? record : {
      ...record, snapshot: "", validationError,
      diagnosticPreview: record.snapshot.slice(0, 1024),
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

/** Bounded SAX validation; declarations and external entities are never resolved. */
export function validateSnapshotXml(xml: string): string | undefined {
  if (xml.length === 0) return "missing_payload";
  if (Buffer.byteLength(xml, "utf8") > 8 * 1024 * 1024) return "payload_limit";
  let depth = 0;
  let root: string | undefined;
  const parser = new SaxesParser();
  parser.on("doctype", () => { throw new Error("doctype_forbidden"); });
  parser.on("error", () => { throw new Error("malformed_xml"); });
  parser.on("opentag", tag => {
    if (depth === 0) root = tag.name;
    if (++depth > 256) throw new Error("depth_limit");
  });
  parser.on("closetag", () => { depth--; });
  try {
    parser.write(xml).close();
    return root === "hierarchy" ? undefined : "invalid_root";
  } catch (error) {
    return error instanceof Error ? error.message : "malformed_xml";
  }
}
