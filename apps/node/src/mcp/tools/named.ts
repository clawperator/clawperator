import { z } from "zod";
import type { Logger } from "../../adapters/logger.js";
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
  applyMcpExecutionMetadata,
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
  appId: z.string().min(1).optional(),
  uri: z.string().min(1).optional(),
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

const selectorJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    role: { type: "string", minLength: 1 },
    text: { type: "string", minLength: 1 },
    textContains: { type: "string", minLength: 1 },
    desc: { type: "string", minLength: 1 },
    descContains: { type: "string", minLength: 1 },
  },
};

const coordinateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "integer", minimum: 0 },
    y: { type: "integer", minimum: 0 },
  },
  required: ["x", "y"],
};

function buildCommonExecutionSchema(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      deviceId: { type: "string", minLength: 1 },
      operatorPackage: { type: "string", minLength: 1 },
      timeoutMs: { type: "integer" },
      ...properties,
    },
    ...(required.length > 0 ? { required } : {}),
  };
}

export function getNamedMcpTools(logger?: Logger): McpToolDefinition[] {
  return [
    {
      name: "open",
      description: "Open an Android application by package id or launch a URI.",
      inputSchema: {
        ...buildCommonExecutionSchema({
          appId: { type: "string", minLength: 1 },
          uri: { type: "string", minLength: 1 },
        }),
        oneOf: [
          { required: ["appId"], not: { required: ["uri"] } },
          { required: ["uri"], not: { required: ["appId"] } },
        ],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(openArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const execution = applyMcpExecutionMetadata(parsed.appId !== undefined
          ? buildOpenAppExecution(parsed.appId)
          : buildOpenUriExecution(parsed.uri!), "open", parsed.timeoutMs);

        return await runExecutionTool(execution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "click",
      description: "Click a matching node or absolute screen coordinate.",
      inputSchema: {
        ...buildCommonExecutionSchema({
          selector: selectorJsonSchema,
          coordinate: coordinateJsonSchema,
          clickType: { type: "string", enum: ["default", "long_click", "focus"] },
        }),
        oneOf: [
          { required: ["selector"], not: { required: ["coordinate"] } },
          { required: ["coordinate"], not: { required: ["selector"] } },
        ],
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

        const execution = applyMcpExecutionMetadata(
          buildClickExecution(matcher, parsed.clickType ?? "default", parsed.coordinate),
          "click",
          parsed.timeoutMs,
        );

        return await runExecutionTool(execution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "type",
      description: "Type text into a matching field, optionally clearing first or submitting after.",
      inputSchema: buildCommonExecutionSchema({
        selector: selectorJsonSchema,
        text: { type: "string" },
        submit: { type: "boolean" },
        clear: { type: "boolean" },
      }, ["selector", "text"]),
      handler: async (args) => {
        const parsed = parseToolArguments(typeArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const selector = mapRequiredSelector(parsed.selector, "selector");
        if (isToolResult(selector)) {
          return selector;
        }

        const execution = applyMcpExecutionMetadata(buildTypeTextExecution({
          selector,
          text: parsed.text,
          submit: parsed.submit,
          clear: parsed.clear,
        }), "type", parsed.timeoutMs);

        return await runExecutionTool(execution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "read",
      description: "Read text from a matching node, optionally returning all matches.",
      inputSchema: buildCommonExecutionSchema({
        selector: selectorJsonSchema,
        all: { type: "boolean" },
        container: selectorJsonSchema,
      }, ["selector"]),
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

        const execution = applyMcpExecutionMetadata(
          buildReadExecution(selector, parsed.all, container),
          "read",
          parsed.timeoutMs,
        );

        return await runExecutionTool(execution, parsed, logger, (result) => {
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
              const values = JSON.parse(extracted.value) as unknown;
              if (!Array.isArray(values)) {
                return buildValidationResult("read returned non-array data for all=true", "read");
              }
              return buildSuccessResult(values);
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
      inputSchema: buildCommonExecutionSchema({
        key: { type: "string", enum: ["back", "home", "recents"] },
      }, ["key"]),
      handler: async (args) => {
        const parsed = parseToolArguments(pressArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const execution = applyMcpExecutionMetadata(
          buildPressKeyExecution(parsed.key),
          "press",
          parsed.timeoutMs,
        );

        return await runExecutionTool(execution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "wait",
      description: "Wait until a matching node appears.",
      inputSchema: buildCommonExecutionSchema({
        selector: selectorJsonSchema,
      }, ["selector"]),
      handler: async (args) => {
        const parsed = parseToolArguments(waitArgsSchema, args);
        if (isToolResult(parsed)) {
          return parsed;
        }

        const selector = mapRequiredSelector(parsed.selector, "selector");
        if (isToolResult(selector)) {
          return selector;
        }

        const execution = applyMcpExecutionMetadata(
          buildWaitExecution(selector, parsed.timeoutMs),
          "wait",
        );

        return await runExecutionTool(execution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "scroll_until",
      description: "Scroll until a matching node is visible, optionally clicking it afterward.",
      inputSchema: buildCommonExecutionSchema({
        selector: selectorJsonSchema,
        container: selectorJsonSchema,
        clickAfter: { type: "boolean" },
      }, ["selector"]),
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

        const execution = applyMcpExecutionMetadata(buildScrollUntilExecution(
          "down",
          selector,
          container,
          parsed.clickAfter ?? false,
          parsed.timeoutMs ?? 30_000,
        ), "scroll_until");

        return await runExecutionTool(execution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
  ];
}
