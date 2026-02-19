/**
 * Action type aliases: input-only conveniences that normalize to canonical types.
 * Canonical form is stored and logged. Table is explicit/versioned.
 */
const ACTION_ALIAS_TO_CANONICAL: Record<string, string> = {
  tap: "click",
  press: "click",
  wait_for: "wait_for_node",
  find: "wait_for_node",
  find_node: "wait_for_node",
  read: "read_text",
  snapshot: "snapshot_ui",
  sleep: "sleep",
  type_text: "enter_text",
  text_entry: "enter_text",
  input_text: "enter_text",
};

export const CANONICAL_ACTION_TYPES = [
  "open_app",
  "close_app",
  "wait_for_node",
  "click",
  "scroll_and_click",
  "read_text",
  "enter_text",
  "snapshot_ui",
  "sleep",
] as const;

export type CanonicalActionType = (typeof CANONICAL_ACTION_TYPES)[number];

/**
 * Normalize action type input to canonical form.
 * Returns canonical type or throws if unknown.
 */
export function normalizeActionType(input: string): CanonicalActionType {
  const normalized = input.trim().toLowerCase();
  const canonical =
    ACTION_ALIAS_TO_CANONICAL[normalized] ?? normalized;
  if (!CANONICAL_ACTION_TYPES.includes(canonical as CanonicalActionType)) {
    throw new Error(`Unsupported action type: ${input}`);
  }
  return canonical as CanonicalActionType;
}

export function getCanonicalActionType(input: string): string {
  const normalized = input.trim().toLowerCase();
  return ACTION_ALIAS_TO_CANONICAL[normalized] ?? normalized;
}
