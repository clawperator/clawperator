import assert from "node:assert";
import { describe, it } from "node:test";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { ResultEnvelope } from "../../contracts/result.js";
import { createMcpExecutionIds } from "../../mcp/executionIds.js";
import { buildMcpErrorResult, buildMcpSuccessResult, normalizeMcpError } from "../../mcp/errors.js";
import { extractStepDataValue, parseReadAllResult } from "../../mcp/results.js";
import { mapSelectorToNodeMatcher, mcpSelectorSchema } from "../../mcp/selectors.js";
import { getCoreMcpTools } from "../../mcp/tools/core.js";
import { getNamedMcpTools } from "../../mcp/tools/named.js";
import { executionToolOptionsSchema } from "../../mcp/tools/common.js";

describe("createMcpExecutionIds", () => {
  it("generates distinct IDs with the expected prefix", () => {
    const first = createMcpExecutionIds("snapshot");
    const second = createMcpExecutionIds("snapshot");

    assert.match(first.commandId, /^mcp-snapshot-/);
    assert.match(first.taskId, /^mcp-snapshot-/);
    assert.notStrictEqual(first.commandId, second.commandId);
    assert.notStrictEqual(first.taskId, second.taskId);
  });
});

describe("mapSelectorToNodeMatcher", () => {
  it("maps each MCP selector field to the canonical NodeMatcher field", () => {
    const matcher = mapSelectorToNodeMatcher({
      id: "com.example:id/cta",
      role: "button",
      text: "Continue",
      textContains: "Cont",
      desc: "Continue button",
      descContains: "button",
    });

    assert.deepStrictEqual(matcher, {
      resourceId: "com.example:id/cta",
      role: "button",
      textEquals: "Continue",
      textContains: "Cont",
      contentDescEquals: "Continue button",
      contentDescContains: "button",
    });
  });

  it("rejects an all-empty selector instead of passing it through", () => {
    assert.throws(
      () => mapSelectorToNodeMatcher({}, "selector"),
      /selector must include at least one non-empty selector field/
    );
  });

  it("rejects whitespace-only selector fields at the MCP boundary", () => {
    const parsed = mcpSelectorSchema.safeParse({ text: "   " });
    assert.strictEqual(parsed.success, false);
  });

  it("rejects an empty selector object at the MCP boundary", () => {
    const parsed = mcpSelectorSchema.safeParse({});
    assert.strictEqual(parsed.success, false);
  });
});

describe("extractStepDataValue", () => {
  it("extracts snapshot text when present", () => {
    const envelope: ResultEnvelope = {
      commandId: "c1",
      taskId: "t1",
      status: "success",
      stepResults: [
        { id: "snap", actionType: "snapshot_ui", success: true, data: { text: "<hierarchy />" } },
      ],
    };

    const extracted = extractStepDataValue(envelope, {
      actionType: "snapshot_ui",
      dataKey: "text",
      errorKey: "error",
    });

    assert.deepStrictEqual(extracted, {
      ok: true,
      step: envelope.stepResults[0],
      value: "<hierarchy />",
    });
  });

  it("returns the snapshot extraction error when text is missing", () => {
    const envelope: ResultEnvelope = {
      commandId: "c1",
      taskId: "t1",
      status: "failed",
      stepResults: [
        { id: "snap", actionType: "snapshot_ui", success: false, data: { error: "SNAPSHOT_EXTRACTION_FAILED" } },
      ],
      error: "failed",
    };

    const extracted = extractStepDataValue(envelope, {
      actionType: "snapshot_ui",
      dataKey: "text",
      errorKey: "error",
    });

    assert.deepStrictEqual(extracted, {
      ok: false,
      error: "SNAPSHOT_EXTRACTION_FAILED",
      message: "snapshot_ui step result did not include text.",
      step: envelope.stepResults[0],
    });
  });

  it("extracts read_text data from the canonical text key", () => {
    const envelope: ResultEnvelope = {
      commandId: "c1",
      taskId: "t1",
      status: "success",
      stepResults: [
        { id: "read", actionType: "read_text", success: true, data: { text: "[\"alpha\",\"beta\"]", all: "true" } },
      ],
    };

    const extracted = extractStepDataValue(envelope, {
      actionType: "read_text",
      dataKey: "text",
      errorKey: "error",
    });

    assert.deepStrictEqual(extracted, {
      ok: true,
      step: envelope.stepResults[0],
      value: "[\"alpha\",\"beta\"]",
    });
  });

  it("returns a defined missing-data error instead of undefined", () => {
    const envelope: ResultEnvelope = {
      commandId: "c1",
      taskId: "t1",
      status: "success",
      stepResults: [
        { id: "read", actionType: "read_text", success: true, data: {} },
      ],
    };

    const extracted = extractStepDataValue(envelope, {
      actionType: "read_text",
      dataKey: "text",
      errorKey: "error",
    });

    assert.deepStrictEqual(extracted, {
      ok: false,
      error: "MCP_STEP_DATA_MISSING",
      message: "read_text step result did not include text.",
      step: envelope.stepResults[0],
    });
  });

  it("returns MCP_STEP_NOT_FOUND when no matching step exists", () => {
    const envelope: ResultEnvelope = {
      commandId: "c1",
      taskId: "t1",
      status: "success",
      stepResults: [
        { id: "press", actionType: "press_key", success: true, data: {} },
      ],
    };

    const extracted = extractStepDataValue(envelope, {
      actionType: "read_text",
      dataKey: "text",
      errorKey: "error",
    });

    assert.deepStrictEqual(extracted, {
      ok: false,
      error: "MCP_STEP_NOT_FOUND",
      message: "No read_text step result was present in the envelope.",
    });
  });
});

describe("parseReadAllResult", () => {
  it("returns MCP_STEP_DATA_INVALID when read all=true value is not valid JSON", () => {
    const result = parseReadAllResult("not-json");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "MCP_STEP_DATA_INVALID");
    assert.strictEqual(result.message, "read returned invalid JSON array data");
  });

  it("returns MCP_STEP_DATA_INVALID when read all=true value parses to a non-array", () => {
    const result = parseReadAllResult("\"a string\"");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "MCP_STEP_DATA_INVALID");
    assert.strictEqual(result.message, "read returned non-array data for all=true");
  });

  it("returns MCP_STEP_DATA_INVALID when read all=true array contains a non-string", () => {
    const result = parseReadAllResult("[1,2,3]");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "MCP_STEP_DATA_INVALID");
    assert.strictEqual(result.message, "read returned non-string items in array for all=true");
  });

  it("returns ok with string array when read all=true value is a valid string array", () => {
    const result = parseReadAllResult("[\"a\",\"b\"]");
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.deepStrictEqual(result.values, ["a", "b"]);
    }
  });
});

describe("executionToolOptionsSchema", () => {
  it("trims deviceId and operatorPackage at the MCP boundary", () => {
    const parsed = executionToolOptionsSchema.parse({
      deviceId: " emulator-5554 ",
      operatorPackage: " com.clawperator.operator.dev ",
    });

    assert.deepStrictEqual(parsed, {
      deviceId: "emulator-5554",
      operatorPackage: "com.clawperator.operator.dev",
    });
  });

  it("rejects negative timeoutMs", () => {
    const parsed = executionToolOptionsSchema.safeParse({
      timeoutMs: -1,
    });

    assert.strictEqual(parsed.success, false);
  });
});

describe("MCP tool schemas", () => {
  it("requires selector-bearing tools to advertise at least one selector field", () => {
    const clickTool = getNamedMcpTools().find(tool => tool.name === "click");
    assert.ok(clickTool);

    const selectorSchema = (clickTool!.inputSchema as {
      properties?: { selector?: { minProperties?: number; properties?: Record<string, { pattern?: string }> } };
    }).properties?.selector;

    assert.strictEqual(selectorSchema?.minProperties, 1);
    assert.strictEqual(selectorSchema?.properties?.id?.pattern, "\\S");
    assert.strictEqual(selectorSchema?.properties?.text?.pattern, "\\S");
  });

  it("requires open tool string arguments to reject whitespace-only values in the published schema", () => {
    const openTool = getNamedMcpTools().find(tool => tool.name === "open");
    assert.ok(openTool);

    const schema = openTool!.inputSchema as {
      properties?: { appId?: { pattern?: string }; uri?: { pattern?: string } };
    };

    assert.strictEqual(schema.properties?.appId?.pattern, "\\S");
    assert.strictEqual(schema.properties?.uri?.pattern, "\\S");
  });

  it("rejects empty execute action ids and types before dispatch", async () => {
    const executeTool = getCoreMcpTools().find(tool => tool.name === "execute");
    assert.ok(executeTool);

    await assert.rejects(
      async () => executeTool!.handler({
        actions: [
          {
            id: " ",
            type: "tap",
          },
        ],
      }),
      (error: unknown) => {
        if (!(error instanceof McpError)) {
          return false;
        }
        return error.code === ErrorCode.InvalidParams;
      },
    );
  });
});

describe("normalizeMcpError", () => {
  it("redacts raw stdout and stderr from MCP error payloads", () => {
    const payload = normalizeMcpError({
      code: "ADB_FAILED",
      message: "adb failed",
      hint: "Check adb",
      details: {
        stdout: "secret",
        stderr: "secret",
        command: "adb shell",
        safe: "ok",
      },
    });

    assert.deepStrictEqual(payload, {
      code: "ADB_FAILED",
      message: "adb failed",
      hint: "Check adb",
      details: {
        safe: "ok",
      },
    });
  });

  it("preserves envelope and execution context fields needed for MCP diagnostics", () => {
    const payload = normalizeMcpError({
      code: "SNAPSHOT_EXTRACTION_FAILED",
      message: "snapshot extraction failed",
      envelope: {
        commandId: "cmd-1",
        stepResults: [
          {
            id: "snap",
            actionType: "snapshot_ui",
            success: false,
            data: {
              error: "SNAPSHOT_EXTRACTION_FAILED",
              stderr: "secret",
            },
          },
        ],
      },
      deviceId: "device-123",
      terminalSource: "broadcast",
    });

    assert.deepStrictEqual(payload, {
      code: "SNAPSHOT_EXTRACTION_FAILED",
      message: "snapshot extraction failed",
      envelope: {
        commandId: "cmd-1",
        stepResults: [
          {
            id: "snap",
            actionType: "snapshot_ui",
            success: false,
            data: {
              error: "SNAPSHOT_EXTRACTION_FAILED",
            },
          },
        ],
      },
      deviceId: "device-123",
      terminalSource: "broadcast",
    });
  });
});

describe("MCP transport redaction", () => {
  it("redacts host path fields from successful tool payloads", () => {
    const result = buildMcpSuccessResult({
      envelope: {
        stepResults: [
          {
            id: "shot",
            actionType: "take_screenshot",
            success: true,
            data: {
              path: "/tmp/owned.png",
              screenshotPath: "/tmp/owned-again.png",
              safe: "ok",
            },
          },
        ],
      },
      details: {
        logPath: "/tmp/clawperator.log",
      },
      safe: "still-ok",
    });

    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.deepStrictEqual(content, {
      envelope: {
        stepResults: [
          {
            id: "shot",
            actionType: "take_screenshot",
            success: true,
            data: {
              safe: "ok",
            },
          },
        ],
      },
      details: {},
      safe: "still-ok",
    });
    assert.deepStrictEqual(result.structuredContent, content);
  });

  it("redacts host path fields from error payloads", () => {
    const result = buildMcpErrorResult({
      code: "TIMEOUT",
      message: "timed out",
      details: {
        logPath: "/tmp/clawperator.log",
        stdout: "secret",
        nested: {
          filePath: "/tmp/owned.txt",
          safe: "ok",
        },
      },
      envelope: {
        stepResults: [
          {
            id: "shot",
            actionType: "take_screenshot",
            success: false,
            data: {
              path: "/tmp/owned.png",
              safe: "ok",
            },
          },
        ],
      },
    });

    const content = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.deepStrictEqual(content, {
      code: "TIMEOUT",
      message: "timed out",
      details: {
        nested: {
          safe: "ok",
        },
      },
      envelope: {
        stepResults: [
          {
            id: "shot",
            actionType: "take_screenshot",
            success: false,
            data: {
              safe: "ok",
            },
          },
        ],
      },
    });
    assert.deepStrictEqual(result.structuredContent, content);
    assert.strictEqual(result.isError, true);
  });
});
