import { z } from "zod";
import { buildClickExecution } from "../../domain/actions/click.js";
import { buildOpenAppExecution } from "../../domain/actions/openApp.js";
import { buildOpenUriExecution } from "../../domain/actions/openUri.js";
import { buildTypeTextExecution } from "../../domain/actions/typeText.js";
import { buildReadExecution } from "../../domain/actions/read.js";
import { buildPressKeyExecution } from "../../domain/actions/pressKey.js";
import { buildWaitExecution } from "../../domain/actions/wait.js";
import { buildScrollUntilExecution } from "../../domain/actions/scrollUntil.js";
import { extractStepDataValue } from "../results.js";
import { mcpSelectorSchema } from "../selectors.js";
import type { McpToolDefinition } from "./index.js";
import {
  buildExecutionSuccessPayload,
  buildSuccessResult,
  buildValidationResult,
  executionToolOptionsSchema,
  mapOptionalSelector,
  mapRequiredSelector,
  parseToolArguments,
  runExecutionTool,
} from "./common.js";

const coordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
}).strict();

const openArgsSchema = executionToolOptionsSchema.extend({
  appId: z.string().optional(),
  uri: z.string().optional(),
}).strict().superRefine((value, ctx) => {
  const hasAppId = value.appId !== undefined;
  const hasUri = value.uri !== undefined;
  if (hasAppId === hasUri) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "open requires exactly one of appId or uri",
      path: ["appId"],
    });
  }
});

const clickArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema.optional(),
  coordinate: coordinateSchema.optional(),
  clickType: z.enum(["default", "long_click", "focus"]).optional(),
}).strict().superRefine((value, ctx) => {
  const hasSelector = value.selector !== undefined;
  const hasCoordinate = value.coordinate !== undefined;
  if (hasSelector === hasCoordinate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "click requires exactly one of selector or coordinate",
      path: ["selector"],
    });
  }
});

const typeArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
  text: z.string(),
  submit: z.boolean().optional(),
  clear: z.boolean().optional(),
}).strict();

const readArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
  all: z.boolean().optional(),
  container: mcpSelectorSchema.optional(),
}).strict();

const pressArgsSchema = executionToolOptionsSchema.extend({
  key: z.enum(["back", "home", "recents"]),
}).strict();

const waitArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
}).strict();

const scrollUntilArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
  container: mcpSelectorSchema.optional(),
  clickAfter: z.boolean().optional(),
}).strict();

function isToolResult<T>(value: T | { content: unknown }): value is { content: unknown } {
  return typeof value === "object" && value !== null && "content" in value;
}

export function getNamedMcpTools(): McpToolDefinition[] {
  return [
    {
      name: "open",
      description: "Open an Android application by package id or launch a URI.",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          uri: { type: "string" },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
      },
      handler: async (args) => {
        const parsed = parseToolArguments(openArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const execution = parsed.appId !== undefined
          ? buildOpenAppExecution(parsed.appId)
          : buildOpenUriExecution(parsed.uri!);
        execution.source = "mcp";
        execution.timeoutMs = parsed.timeoutMs ?? execution.timeoutMs;

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "click",
      description: "Click a matching node or absolute screen coordinate.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "object" },
          coordinate: { type: "object" },
          clickType: { type: "string", enum: ["default", "long_click", "focus"] },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
      },
      handler: async (args) => {
        const parsed = parseToolArguments(clickArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const matcher = parsed.selector !== undefined ? mapRequiredSelector(parsed.selector, "selector") : undefined;
        if (matcher !== undefined && isToolResult(matcher)) {
          return matcher;
        }

        const execution = buildClickExecution(matcher, parsed.clickType ?? "default", parsed.coordinate);
        execution.source = "mcp";
        execution.timeoutMs = parsed.timeoutMs ?? execution.timeoutMs;

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "type",
      description: "Type text into a matching field, optionally clearing first or submitting after.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "object" },
          text: { type: "string" },
          submit: { type: "boolean" },
          clear: { type: "boolean" },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
        required: ["selector", "text"],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(typeArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const selector = mapRequiredSelector(parsed.selector, "selector");
        if (isToolResult(selector)) {
          return selector;
        }

        const execution = buildTypeTextExecution({
          selector,
          text: parsed.text,
          submit: parsed.submit,
          clear: parsed.clear,
        });
        execution.source = "mcp";
        execution.timeoutMs = parsed.timeoutMs ?? execution.timeoutMs;

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "read",
      description: "Read text from a matching node, optionally returning all matches.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "object" },
          all: { type: "boolean" },
          container: { type: "object" },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
        required: ["selector"],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(readArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const selector = mapRequiredSelector(parsed.selector, "selector");
        if (isToolResult(selector)) {
          return selector;
        }

        const container = mapOptionalSelector(parsed.container, "container");
        if (container !== undefined && isToolResult(container)) {
          return container;
        }

        const execution = buildReadExecution(selector, parsed.all, container);
        execution.source = "mcp";
        execution.timeoutMs = parsed.timeoutMs ?? execution.timeoutMs;

        return await runExecutionTool(execution, parsed, (result) => {
          const extracted = extractStepDataValue(result.envelope, {
            actionType: "read_text",
            dataKey: "text",
            errorKey: "error",
          });
          if (!extracted.ok) {
            return buildValidationResult(extracted.message, "read");
          }

          if (parsed.all) {
            try {
              return buildSuccessResult(JSON.parse(extracted.value) as unknown[]);
            } catch {
              return buildValidationResult("read returned invalid JSON array data", "read");
            }
          }

          return buildSuccessResult(extracted.value);
        });
      },
    },
    {
      name: "press",
      description: "Press one of the supported Android navigation keys.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", enum: ["back", "home", "recents"] },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
        required: ["key"],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(pressArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const execution = buildPressKeyExecution(parsed.key);
        execution.source = "mcp";
        execution.timeoutMs = parsed.timeoutMs ?? execution.timeoutMs;

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "wait",
      description: "Wait until a matching node appears.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "object" },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
        required: ["selector"],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(waitArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const selector = mapRequiredSelector(parsed.selector, "selector");
        if (isToolResult(selector)) {
          return selector;
        }

        const execution = buildWaitExecution(selector, parsed.timeoutMs);
        execution.source = "mcp";

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "scroll_until",
      description: "Scroll until a matching node is visible, optionally clicking it afterward.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "object" },
          container: { type: "object" },
          clickAfter: { type: "boolean" },
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
        required: ["selector"],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(scrollUntilArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const selector = mapRequiredSelector(parsed.selector, "selector");
        if (isToolResult(selector)) {
          return selector;
        }

        const container = mapOptionalSelector(parsed.container, "container");
        if (container !== undefined && isToolResult(container)) {
          return container;
        }

        const execution = buildScrollUntilExecution(
          "down",
          selector,
          container,
          parsed.clickAfter ?? false,
          parsed.timeoutMs ?? 30_000,
        );
        execution.source = "mcp";

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
  ];
}
