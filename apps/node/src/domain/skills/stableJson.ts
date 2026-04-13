function compareStableObjectKeys(leftKey: string, rightKey: string): number {
  if (leftKey < rightKey) {
    return -1;
  }
  if (leftKey > rightKey) {
    return 1;
  }
  return 0;
}

export function normalizeStableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStableJsonValue(entry));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => compareStableObjectKeys(leftKey, rightKey))
        .map(([key, entryValue]) => [key, normalizeStableJsonValue(entryValue)])
    );
  }
  return value;
}
