/**
 * Shared logic for extracting UI snapshot text from logcat lines.
 */
export function extractSnapshotFromLogs(lines: string[]): string | null {
  const snapshots = extractSnapshotsFromLogs(lines);
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

export function extractSnapshotsFromLogs(lines: string[]): string[] {
  const messages = lines
    .map(extractLogMessage)
    .filter((message): message is string => Boolean(message));

  const snapshots: string[] = [];
  let currentSnapshotLines: string[] | null = null;

  for (const message of messages) {
    if (message.includes("[TaskScope] UI Hierarchy:")) {
      const currentSnapshot = currentSnapshotLines?.join("\n").trim();
      if (currentSnapshot) {
        snapshots.push(currentSnapshot);
      }

      currentSnapshotLines = [];
      const firstLineRemainder = message.split("[TaskScope] UI Hierarchy:")[1]?.trim();
      if (firstLineRemainder) {
        currentSnapshotLines.push(firstLineRemainder);
      }
      continue;
    }

    if (currentSnapshotLines === null) {
      continue;
    }

    const trimmed = message.trim();
    if (trimmed.startsWith("[") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
      const currentSnapshot = currentSnapshotLines.join("\n").trim();
      if (currentSnapshot) {
        snapshots.push(currentSnapshot);
      }
      currentSnapshotLines = null;
      continue;
    }

    currentSnapshotLines.push(message);
    if (trimmed === "</hierarchy>") {
      const currentSnapshot = currentSnapshotLines.join("\n").trim();
      if (currentSnapshot) {
        snapshots.push(currentSnapshot);
      }
      currentSnapshotLines = null;
    }
  }

  const trailingSnapshot = currentSnapshotLines?.join("\n").trim();
  if (trailingSnapshot) {
    snapshots.push(trailingSnapshot);
  }

  return snapshots;
}

function extractLogMessage(line: string): string | null {
  if (/^[A-Z]\//.test(line)) {
    const delimiterIndex = line.indexOf(":");
    if (delimiterIndex !== -1) {
      const message = line.slice(delimiterIndex + 1);
      return message.startsWith(" ") ? message.slice(1) : message;
    }
  }

  const trimmed = line.trim();
  return trimmed.length > 0 ? trimmed : null;
}
