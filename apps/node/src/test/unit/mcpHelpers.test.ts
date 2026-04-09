import assert from "node:assert";
import { describe, it } from "node:test";
import type { ResultEnvelope } from "../../contracts/result.js";
import { createMcpExecutionIds } from "../../mcp/executionIds.js";
import { normalizeMcpError } from "../../mcp/errors.js";
import { extractStepDataValue } from "../../mcp/results.js";
import { mapSelectorToNodeMatcher, mcpSelectorSchema } from "../../mcp/selectors.js";
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
