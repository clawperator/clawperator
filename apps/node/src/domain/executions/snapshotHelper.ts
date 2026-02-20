/**
 * Shared logic for extracting UI snapshot text from logcat lines.
 */
export function extractSnapshotFromLogs(lines: string[]): string | null {
  const snapshotLines = lines
    .filter((l) => l.includes("TaskScopeDefault:"))
    .map((l) => {
      // Extract everything after the tag
      const tagIndex = l.indexOf("TaskScopeDefault:");
      return tagIndex !== -1 ? l.slice(tagIndex + "TaskScopeDefault:".length).trim() : "";
    })
    // Filter out the [TaskScope] prefix common in logs
    .map((s) => (s.startsWith("[TaskScope]") ? s.slice("[TaskScope]".length).trim() : s))
    // Only keep lines that look like hierarchy content or tree
    .filter((s) => s.startsWith("<") || s.startsWith("?") || s.includes("text=") || s.includes("res="));

  return snapshotLines.length > 0 ? snapshotLines.join("\n") : null;
}
