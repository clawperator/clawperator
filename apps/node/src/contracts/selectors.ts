/**
 * Node matcher / selector contract (aligns with Android NodeMatcher).
 */
export interface NodePredicate {
  resourceId?: string;
  role?: string;
  textEquals?: string;
  textContains?: string;
  contentDescEquals?: string;
  contentDescContains?: string;
}

export interface NodeMatcher extends NodePredicate {
  ancestor?: NodePredicate;
  descendant?: NodePredicate;
}

export function isNodeMatcherEmpty(m: NodeMatcher): boolean {
  return !Object.values(m).some(value => value !== undefined && value !== null && value !== "");
}

export function nodeMatcherToParams(m: NodeMatcher): Record<string, unknown> {
  return Object.fromEntries(Object.entries(m).filter(([, value]) => value !== undefined));
}

export interface NodeSummary {
  nodePath: string;
  parentPath: string | null;
  resourceId: string | null;
  className: string;
  role: string;
  label: string;
  contentDescription: string | null;
  bounds: { left: number; top: number; right: number; bottom: number };
  visibleToUser: boolean | null;
  onScreen: boolean;
  enabled: boolean | null;
  clickable: boolean | null;
  checkable: boolean | null;
  checked: boolean | null;
  selected: boolean | null;
  scrollable: boolean | null;
}

export interface NodeQueryResult {
  schemaVersion: 1;
  snapshotId: string;
  capturedAt: string;
  totalMatches: number;
  returnedCount: number;
  truncated: boolean;
  nodes: NodeSummary[];
}
