import { describe, it } from "node:test";
import assert from "node:assert";
import { validateExecution, validatePayloadSize } from "../../domain/executions/validateExecution.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { LIMITS } from "../../contracts/limits.js";

describe("validateExecution", () => {
  it("accepts valid minimal execution", () => {
    const ex = validateExecution({
      commandId: "cmd-1",
      taskId: "task-1",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 10000,
      actions: [{ id: "a1", type: "sleep", params: { durationMs: 1000 } }],
    });
    assert.strictEqual(ex.commandId, "cmd-1");
    assert.strictEqual(ex.actions[0].type, "sleep");
  });

  it("normalizes action type alias (type_text -> enter_text)", () => {
    const ex = validateExecution({
      commandId: "c",
      taskId: "t",
      source: "s",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "x", type: "type_text", params: { matcher: { resourceId: "id" }, text: "hi" } },
      ],
    });
    assert.strictEqual(ex.actions[0].type, "enter_text");
  });

  it("rejects missing expectedFormat", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "sleep", params: { durationMs: 0 } }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects invalid expectedFormat", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "wrong-format",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "sleep", params: { durationMs: 0 } }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects empty actions", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: 5000,
          actions: [],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects unsupported action type", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "unsupported_action" }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects timeout above max", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: LIMITS.MAX_EXECUTION_TIMEOUT_MS + 1,
          actions: [{ id: "x", type: "sleep", params: { durationMs: 0 } }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects open_app without applicationId", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "open_app", params: {} }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects sleep with negative durationMs", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "sleep", params: { durationMs: -1 } }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects enter_text without matcher", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "enter_text", params: { text: "hello" } }],
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });

  it("rejects unknown top-level fields (strict schema)", () => {
    assert.throws(
      () =>
        validateExecution({
          commandId: "c",
          taskId: "t",
          source: "s",
          expectedFormat: "android-ui-automator",
          timeoutMs: 5000,
          actions: [{ id: "x", type: "sleep", params: { durationMs: 1 } }],
          unexpectedField: "nope",
        }),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED
    );
  });
});

describe("validatePayloadSize", () => {
  it("allows payload within limit", () => {
    validatePayloadSize("{}");
  });

  it("throws for payload over limit", () => {
    const big = "x".repeat(LIMITS.MAX_PAYLOAD_BYTES + 1);
    assert.throws(
      () => validatePayloadSize(big),
      (e: unknown) => (e as { code?: string }).code === ERROR_CODES.PAYLOAD_TOO_LARGE
    );
  });
});
