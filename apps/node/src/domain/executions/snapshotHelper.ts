/**
 * Shared logic for extracting UI snapshot text from logcat lines.
 */
export function extractSnapshotFromLogs(lines: string[]): string | null {
  const snapshots = extractSnapshotsFromLogs(lines);
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

export function extractSnapshotsFromLogs(lines: string[]): string[] {
  const parsedLines = lines
    .map(parseLogLine)
    .filter((line): line is ParsedLogLine => line !== null);

  const snapshots: string[] = [];
  let currentSnapshotLines: string[] | null = null;
  let currentSnapshotTag: string | null = null;

  for (const line of parsedLines) {
    const { tag, message } = line;
    if (tag !== null && message.includes("[TaskScope] UI Hierarchy:")) {
      const currentSnapshot = currentSnapshotLines?.join("\n").trim();
      if (currentSnapshot) {
        snapshots.push(currentSnapshot);
      }

      currentSnapshotLines = [];
      currentSnapshotTag = tag;
      const firstLineRemainder = message.split("[TaskScope] UI Hierarchy:")[1]?.trim();
      if (firstLineRemainder) {
        currentSnapshotLines.push(firstLineRemainder);
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
        snapshots.push(currentSnapshot);
      }
      currentSnapshotLines = null;
      currentSnapshotTag = null;
      continue;
    }

    currentSnapshotLines.push(message);
    if (trimmed === "</hierarchy>") {
      const currentSnapshot = currentSnapshotLines.join("\n").trim();
      if (currentSnapshot) {
        snapshots.push(currentSnapshot);
      }
      currentSnapshotLines = null;
      currentSnapshotTag = null;
    }
  }

  const trailingSnapshot = currentSnapshotLines?.join("\n").trim();
  if (trailingSnapshot) {
    snapshots.push(trailingSnapshot);
  }

  return snapshots;
}

interface ParsedLogLine {
  tag: string | null;
  message: string;
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
