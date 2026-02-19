/**
 * Node matcher / selector contract (aligns with Android NodeMatcher).
 */
export interface NodeMatcher {
  resourceId?: string;
  role?: string;
  textEquals?: string;
  textContains?: string;
}

export function isNodeMatcherEmpty(m: NodeMatcher): boolean {
  return (
    (m.resourceId == null || m.resourceId === "") &&
    (m.role == null || m.role === "") &&
    (m.textEquals == null || m.textEquals === "") &&
    (m.textContains == null || m.textContains === "")
  );
}

export function nodeMatcherToParams(m: NodeMatcher): Record<string, string> {
  const out: Record<string, string> = {};
  if (m.resourceId) out.resourceId = m.resourceId;
  if (m.role) out.role = m.role;
  if (m.textEquals) out.textEquals = m.textEquals;
  if (m.textContains) out.textContains = m.textContains;
  return out;
}
