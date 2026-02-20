/**
 * Node matcher / selector contract (aligns with Android NodeMatcher).
 */
export interface NodeMatcher {
  resourceId?: string;
  role?: string;
  textEquals?: string;
  textContains?: string;
  contentDescEquals?: string;
  contentDescContains?: string;
}

export function isNodeMatcherEmpty(m: NodeMatcher): boolean {
  return (
    (m.resourceId == null || m.resourceId === "") &&
    (m.role == null || m.role === "") &&
    (m.textEquals == null || m.textEquals === "") &&
    (m.textContains == null || m.textContains === "") &&
    (m.contentDescEquals == null || m.contentDescEquals === "") &&
    (m.contentDescContains == null || m.contentDescContains === "")
  );
}

export function nodeMatcherToParams(m: NodeMatcher): Record<string, string> {
  const out: Record<string, string> = {};
  if (m.resourceId) out.resourceId = m.resourceId;
  if (m.role) out.role = m.role;
  if (m.textEquals) out.textEquals = m.textEquals;
  if (m.textContains) out.textContains = m.textContains;
  if (m.contentDescEquals) out.contentDescEquals = m.contentDescEquals;
  if (m.contentDescContains) out.contentDescContains = m.contentDescContains;
  return out;
}
