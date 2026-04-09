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
import { buildMcpErrorResult } from "../errors.js";
import { extractStepDataValue } from "../results.js";
import { mcpSelectorSchema } from "../selectors.js";
import type { McpToolDefinition } from "./index.js";
import {
  applyMcpExecutionMetadata,
  buildCommonExecutionSchema,
  buildExecutionSuccessPayload,
  buildSuccessResult,
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
  appId: z.string().trim().min(1).optional(),
  uri: z.string().trim().min(1).optional(),
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
  text: z.string().min(1),
  submit: z.boolean().optional(),
  clear: z.boolean().optional(),
}).strict();

const readArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
  all: z.boolean().optional(),
  container: mcpSelectorSchema.optional(),
  validator: z.literal("regex").optional(),
  validatorPattern: z.string().trim().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.validator === "regex" && value.validatorPattern === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validatorPattern is required when validator is \"regex\"",
      path: ["validatorPattern"],
    });
  }
});

const pressArgsSchema = executionToolOptionsSchema.extend({
  key: z.enum(["back", "home", "recents"]),
}).strict();

const waitArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
}).strict();

const scrollUntilArgsSchema = executionToolOptionsSchema.extend({
  selector: mcpSelectorSchema,
  direction: z.enum(["down", "up", "left", "right"]),
  container: mcpSelectorSchema.optional(),
  clickAfter: z.boolean().optional(),
}).strict();

const nonWhitespaceStringJsonSchema = {
  type: "string",
  minLength: 1,
  pattern: "\\S",
};

const selectorJsonSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    id: nonWhitespaceStringJsonSchema,
    role: nonWhitespaceStringJsonSchema,
    text: nonWhitespaceStringJsonSchema,
    textContains: nonWhitespaceStringJsonSchema,
    desc: nonWhitespaceStringJsonSchema,
    descContains: nonWhitespaceStringJsonSchema,
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

export function getNamedMcpTools(logger?: Logger): McpToolDefinition[] {
  return [
    {
      name: "open",
      description: "Open an Android application by package id or launch a URI.",
      inputSchema: {
        ...buildCommonExecutionSchema({
          appId: nonWhitespaceStringJsonSchema,
          uri: nonWhitespaceStringJsonSchema,
        }),
        oneOf: [
          { required: ["appId"], not: { required: ["uri"] } },
          { required: ["uri"], not: { required: ["appId"] } },
        ],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(openArgsSchema, args);

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

        const matcher = parsed.selector !== undefined ? mapRequiredSelector(parsed.selector, "selector") : undefined;

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
        text: { type: "string", minLength: 1 },
        submit: { type: "boolean" },
        clear: { type: "boolean" },
      }, ["selector", "text"]),
      handler: async (args) => {
        const parsed = parseToolArguments(typeArgsSchema, args);

        const selector = mapRequiredSelector(parsed.selector, "selector");

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
      description: "Read text from a matching node, optionally returning all matches. Supports regex validation via validator and validatorPattern.",
      inputSchema: buildCommonExecutionSchema({
        selector: selectorJsonSchema,
        all: { type: "boolean" },
        container: selectorJsonSchema,
        validator: { type: "string", enum: ["regex"] },
        validatorPattern: nonWhitespaceStringJsonSchema,
      }, ["selector"]),
      handler: async (args) => {
        const parsed = parseToolArguments(readArgsSchema, args);

        const selector = mapRequiredSelector(parsed.selector, "selector");

        const container = mapOptionalSelector(parsed.container, "container");

        const execution = applyMcpExecutionMetadata(
          buildReadExecution({
            selector,
            readAll: parsed.all,
            container,
            validator: parsed.validator,
            validatorPattern: parsed.validatorPattern,
          }),
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
            return buildMcpErrorResult({
              code: extracted.error,
              message: extracted.message,
              envelope: result.envelope,
              deviceId: result.deviceId,
              terminalSource: result.terminalSource,
            });
          }

          if (parsed.all) {
            try {
              const values = JSON.parse(extracted.value) as unknown;
              if (!Array.isArray(values)) {
                return buildMcpErrorResult({
                  code: "MCP_STEP_DATA_INVALID",
                  message: "read returned non-array data for all=true",
                  envelope: result.envelope,
                  deviceId: result.deviceId,
                  terminalSource: result.terminalSource,
                });
              }
              if (!values.every((v) => typeof v === "string")) {
                return buildMcpErrorResult({
                  code: "MCP_STEP_DATA_INVALID",
                  message: "read returned non-string items in array for all=true",
                  envelope: result.envelope,
                  deviceId: result.deviceId,
                  terminalSource: result.terminalSource,
                });
              }
              return buildSuccessResult(values);
            } catch {
              return buildMcpErrorResult({
                code: "MCP_STEP_DATA_INVALID",
                message: "read returned invalid JSON array data",
                envelope: result.envelope,
                deviceId: result.deviceId,
                terminalSource: result.terminalSource,
              });
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

        const selector = mapRequiredSelector(parsed.selector, "selector");

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
      description: "Scroll in the given direction until a matching node is visible, optionally clicking it afterward.",
      inputSchema: buildCommonExecutionSchema({
        selector: selectorJsonSchema,
        direction: { type: "string", enum: ["down", "up", "left", "right"] },
        container: selectorJsonSchema,
        clickAfter: { type: "boolean" },
      }, ["selector", "direction"]),
      handler: async (args) => {
        const parsed = parseToolArguments(scrollUntilArgsSchema, args);

        const selector = mapRequiredSelector(parsed.selector, "selector");

        const container = mapOptionalSelector(parsed.container, "container");

        const execution = applyMcpExecutionMetadata(buildScrollUntilExecution(
          parsed.direction,
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
