import type { Execution } from "./execution.js";
import { getCanonicalActionType } from "./aliases.js";

const EXECUTION_KEY_ALIASES: Record<string, keyof Execution> = {
  command_id: "commandId",
  task_id: "taskId",
  expected_format: "expectedFormat",
  timeout_ms: "timeoutMs",
};

const ACTION_PARAM_ALIASES: Record<string, string> = {
  application_id: "applicationId",
  app_id: "applicationId",
  appId: "applicationId",
  app: "applicationId",
  package: "applicationId",
  package_id: "applicationId",
  packageId: "applicationId",
  session_id: "sessionId",
  url: "uri",
  duration_ms: "durationMs",
  file: "path",
  filePath: "path",
  output_path: "path",
  selector: "matcher",
  node: "matcher",
  element: "matcher",
  value: "text",
  click_type: "clickType",
  longPress: "clickType",
  within: "container",
  container_selector: "container",
  max_swipes: "maxSwipes",
  distance_ratio: "distanceRatio",
  settle_delay_ms: "settleDelayMs",
  max_scrolls: "maxScrolls",
  max_duration_ms: "maxDurationMs",
  no_position_change_threshold: "noPositionChangeThreshold",
  find_first_scrollable_child: "findFirstScrollableChild",
  click_after: "clickAfter",
  validator_pattern: "validatorPattern",
  expected_package: "expectedPackage",
  expected_node: "expectedNode",
  wait_for: "expectedNode",
  timeout_ms: "timeoutMs",
  label_matcher: "labelMatcher",
  label_selector: "labelMatcher",
};

const MATCHER_KEY_ALIASES: Record<string, string> = {
  resource_id: "resourceId",
  id: "resourceId",
  text: "textEquals",
  text_contains: "textContains",
  content_desc: "contentDescEquals",
  content_desc_equals: "contentDescEquals",
  content_desc_contains: "contentDescContains",
  description: "contentDescEquals",
  description_contains: "contentDescContains",
  accessibility_label: "contentDescEquals",
  accessibility_label_contains: "contentDescContains",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function remapObjectKeys(
  input: Record<string, unknown>,
  aliases: Record<string, string>,
  normalizeValue?: (canonicalKey: string, value: unknown) => unknown,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const canonicalKey = aliases[rawKey] ?? rawKey;
    const value = normalizeValue ? normalizeValue(canonicalKey, rawValue) : rawValue;

    if (Object.prototype.hasOwnProperty.call(output, canonicalKey)) {
      output[canonicalKey] = value;
      continue;
    }
    output[canonicalKey] = value;
  }

  return output;
}

function normalizeMatcherInput(input: unknown): unknown {
  if (!isPlainObject(input)) {
    return input;
  }

  return remapObjectKeys(input, MATCHER_KEY_ALIASES);
}

function normalizeActionParamsInput(input: unknown): unknown {
  if (!isPlainObject(input)) {
    return input;
  }

  return remapObjectKeys(input, ACTION_PARAM_ALIASES, (canonicalKey, value) => {
    if (canonicalKey === "matcher" || canonicalKey === "container" || canonicalKey === "expectedNode" || canonicalKey === "labelMatcher") {
      return normalizeMatcherInput(value);
    }
    if (canonicalKey === "clickType" && value === true) {
      return "long_click";
    }
    return value;
  });
}

function normalizeExecutionActionInput(input: unknown): unknown {
  if (!isPlainObject(input)) {
    return input;
  }

  const normalized = { ...input };
  if (typeof normalized.type === "string") {
    normalized.type = getCanonicalActionType(normalized.type);
  }
  if ("params" in normalized) {
    normalized.params = normalizeActionParamsInput(normalized.params);
  }
  return normalized;
}

export function normalizeExecutionInput(input: unknown): unknown {
  if (!isPlainObject(input)) {
    return input;
  }

  return remapObjectKeys(input, EXECUTION_KEY_ALIASES, (canonicalKey, value) => {
    if (canonicalKey === "actions" && Array.isArray(value)) {
      return value.map((action) => normalizeExecutionActionInput(action));
    }
    return value;
  });
}
