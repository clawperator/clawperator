/**
 * Action type aliases: input-only conveniences that normalize to canonical types.
 * Canonical form is stored and logged. Table is explicit/versioned.
 */
const ACTION_ALIAS_TO_CANONICAL: Record<string, string> = {
  open_url: "open_uri",
  tap: "click",
  press: "click",
  wait_for: "wait_for_node",
  find: "wait_for_node",
  find_node: "wait_for_node",
  read: "read_text",
  snapshot: "snapshot_ui",
  sleep: "sleep",
  screenshot: "take_screenshot",
  capture_screenshot: "take_screenshot",
  type_text: "enter_text",
  text_entry: "enter_text",
  input_text: "enter_text",
  key_press: "press_key",
};

// NOTE: "doctor_ping" is intentionally absent. It is an internal diagnostic action
// used only by `clawperator doctor` via broadcastAgentCommand, not the agent-facing API.
export const CANONICAL_ACTION_TYPES = [
  "open_app",
  "open_uri",
  "close_app",
  "start_recording",
  "stop_recording",
  "wait_for_node",
  "click",
  "scroll_and_click",
  "scroll",
  "scroll_until",
  "read_text",
  "enter_text",
  "snapshot_ui",
  "take_screenshot",
  "sleep",
  "press_key",
  "wait_for_navigation",
  "read_key_value_pair",
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
