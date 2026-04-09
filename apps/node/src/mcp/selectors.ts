import { z } from "zod";
import type { NodeMatcher } from "../contracts/selectors.js";
import { isNodeMatcherEmpty } from "../contracts/selectors.js";

const optionalNonEmptyTrimmedSelectorString = z.string().trim().min(1).optional();

export const mcpSelectorSchema = z.object({
  id: optionalNonEmptyTrimmedSelectorString,
  role: optionalNonEmptyTrimmedSelectorString,
  text: optionalNonEmptyTrimmedSelectorString,
  textContains: optionalNonEmptyTrimmedSelectorString,
  desc: optionalNonEmptyTrimmedSelectorString,
  descContains: optionalNonEmptyTrimmedSelectorString,
}).strict();

export type McpSelectorInput = z.infer<typeof mcpSelectorSchema>;

export function mapSelectorToNodeMatcher(
  selector: McpSelectorInput,
  fieldName = "selector"
): NodeMatcher {
  const matcher: NodeMatcher = {
    ...(selector.id !== undefined ? { resourceId: selector.id } : {}),
    ...(selector.role !== undefined ? { role: selector.role } : {}),
    ...(selector.text !== undefined ? { textEquals: selector.text } : {}),
    ...(selector.textContains !== undefined ? { textContains: selector.textContains } : {}),
    ...(selector.desc !== undefined ? { contentDescEquals: selector.desc } : {}),
    ...(selector.descContains !== undefined ? { contentDescContains: selector.descContains } : {}),
  };

  if (isNodeMatcherEmpty(matcher)) {
    throw new Error(`${fieldName} must include at least one non-empty selector field`);
  }

  return matcher;
}
