import { isClawperatorError } from "../contracts/errors.js";

export interface McpErrorPayload {
  code?: string;
  message: string;
  [key: string]: unknown;
}

export interface McpToolResult {
  content: [{ type: "text"; text: string }];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function buildMcpSuccessResult(payload: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    ...(isRecord(payload) ? { structuredContent: payload } : {}),
  };
}

export function buildMcpErrorResult(error: unknown): McpToolResult {
  const payload = normalizeMcpError(error);
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true,
  };
}

export function normalizeMcpError(error: unknown): McpErrorPayload {
  if (isClawperatorError(error)) {
    return { ...error };
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
    const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
    const payload: McpErrorPayload = {
      message: typeof maybeMessage === "string" && maybeMessage.length > 0 ? maybeMessage : "Unknown MCP error",
    };
    if (typeof maybeCode === "string" && maybeCode.length > 0) {
      payload.code = maybeCode;
    }
    for (const [key, value] of Object.entries(error)) {
      if (key === "message" || key === "code") {
        continue;
      }
      payload[key] = value;
    }
    return payload;
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
