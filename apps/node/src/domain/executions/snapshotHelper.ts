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
      if (currentSnapshot) {
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
      if (currentSnapshot) {
        snapshots.push({
          snapshot: currentSnapshot,
          commandId: currentSnapshotCommandId,
        });
      }
      currentSnapshotLines = null;
      currentSnapshotTag = null;
      currentSnapshotCommandId = undefined;
      continue;
    }

    currentSnapshotLines.push(message);
    if (trimmed === "</hierarchy>") {
      const currentSnapshot = currentSnapshotLines.join("\n").trim();
      if (currentSnapshot) {
        snapshots.push({
          snapshot: currentSnapshot,
          commandId: currentSnapshotCommandId,
        });
      }
      currentSnapshotLines = null;
      currentSnapshotTag = null;
      currentSnapshotCommandId = undefined;
    }
  }

  const trailingSnapshot = currentSnapshotLines?.join("\n").trim();
  if (trailingSnapshot) {
    snapshots.push({
      snapshot: trailingSnapshot,
      commandId: currentSnapshotCommandId,
    });
  }

  return snapshots;
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
