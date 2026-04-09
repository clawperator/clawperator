import { z } from "zod";
import type { NodeMatcher } from "../contracts/selectors.js";
import { isNodeMatcherEmpty } from "../contracts/selectors.js";

export const mcpSelectorSchema = z.object({
  id: z.string().optional(),
  role: z.string().optional(),
  text: z.string().optional(),
  textContains: z.string().optional(),
  desc: z.string().optional(),
  descContains: z.string().optional(),
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
