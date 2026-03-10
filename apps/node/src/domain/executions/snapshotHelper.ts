/**
 * Shared logic for extracting UI snapshot text from logcat lines.
 */
export function extractSnapshotFromLogs(lines: string[]): string | null {
  const messages = lines
    .map(extractLogMessage)
    .filter((message): message is string => Boolean(message));

  const startIndex = messages.findIndex((message) => message.includes("[TaskScope] UI Hierarchy:"));
  if (startIndex === -1) return null;

  const snapshotLines: string[] = [];
  const firstLineRemainder = messages[startIndex].split("[TaskScope] UI Hierarchy:")[1]?.trim();
  if (firstLineRemainder) {
    snapshotLines.push(firstLineRemainder);
  }

  for (let i = startIndex + 1; i < messages.length; i += 1) {
    const message = messages[i];
    const trimmed = message.trim();

    if (trimmed.startsWith("[") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
      break;
    }

    snapshotLines.push(message);
    if (trimmed === "</hierarchy>") {
      break;
    }
  }

  const snapshot = snapshotLines.join("\n").trim();
  return snapshot.length > 0 ? snapshot : null;
}

function extractLogMessage(line: string): string | null {
  const match = line.match(/^[A-Z]\/.*?:\s?(.*)$/);
  if (match) {
    return match[1];
  }

  const trimmed = line.trim();
  return trimmed.length > 0 ? trimmed : null;
}
