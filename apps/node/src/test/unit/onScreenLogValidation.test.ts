import assert from "node:assert";
import { describe, it } from "node:test";
import { ERROR_CODES } from "../../contracts/errors.js";
import { normalizeActionType } from "../../contracts/aliases.js";
import type { ResultEnvelope } from "../../contracts/result.js";
import { reconcileEnvelopeStatusAfterPostProcessing } from "../../domain/executions/runExecution.js";
import { validateExecution } from "../../domain/executions/validateExecution.js";

function executionFor(type: string, params?: Record<string, unknown>): Record<string, unknown> {
  return {
    commandId: "on-screen-log-command",
    taskId: "on-screen-log-task",
    source: "test",
    expectedFormat: "android-ui-automator",
    timeoutMs: 5000,
    actions: [
      {
        id: "on-screen-log-action",
        type,
        ...(params === undefined ? {} : { params }),
      },
    ],
  };
}

function assertValidationFailure(input: unknown): void {
  assert.throws(
    () => validateExecution(input),
    (error: unknown) => (error as { code?: string }).code === ERROR_CODES.EXECUTION_VALIDATION_FAILED,
  );
}

describe("set_on_screen_log validation", () => {
  it("accepts the required text with all style fields omitted", () => {
    const execution = validateExecution(executionFor("set_on_screen_log", { text: "FLOW-001: Observe settings" }));

    assert.strictEqual(execution.actions[0]?.type, "set_on_screen_log");
    assert.deepStrictEqual(execution.actions[0]?.params, { text: "FLOW-001: Observe settings" });
  });

  it("accepts every physical anchor and text alignment combination", () => {
    for (const anchor of ["left", "right"] as const) {
      for (const textAlign of ["left", "right"] as const) {
        const execution = validateExecution(
          executionFor("set_on_screen_log", { text: `${anchor}-${textAlign}`, anchor, textAlign }),
        );
        assert.strictEqual(execution.actions[0]?.params?.anchor, anchor);
        assert.strictEqual(execution.actions[0]?.params?.textAlign, textAlign);
      }
    }
  });

  it("accepts every numeric boundary, including zero offsets", () => {
    const boundaries: Array<[string, number, number]> = [
      ["topOffsetDp", 0, 1000],
      ["edgeOffsetDp", 0, 1000],
      ["widthDp", 80, 600],
      ["fontSizeSp", 8, 24],
      ["ttlMs", 1000, 3600000],
    ];

    for (const [field, minimum, maximum] of boundaries) {
      for (const value of [minimum, maximum]) {
        const execution = validateExecution(
          executionFor("set_on_screen_log", { text: "boundary", [field]: value }),
        );
        assert.strictEqual(execution.actions[0]?.params?.[field as keyof NonNullable<typeof execution.actions[0]["params"]>], value);
      }
    }
  });

  it("rejects values outside every numeric range", () => {
    const invalidCases: Array<[string, number]> = [
      ["topOffsetDp", -1],
      ["topOffsetDp", 1001],
      ["edgeOffsetDp", -1],
      ["edgeOffsetDp", 1001],
      ["widthDp", 79],
      ["widthDp", 601],
      ["fontSizeSp", 7],
      ["fontSizeSp", 25],
      ["ttlMs", 999],
      ["ttlMs", 3600001],
    ];

    for (const [field, value] of invalidCases) {
      assertValidationFailure(executionFor("set_on_screen_log", { text: "range", [field]: value }));
    }
  });

  it("rejects missing, blank, too-long, and forbidden-control text", () => {
    assertValidationFailure(executionFor("set_on_screen_log", {}));
    assertValidationFailure(executionFor("set_on_screen_log", { text: " \t\n " }));
    assertValidationFailure(executionFor("set_on_screen_log", { text: "x".repeat(2049) }));
    assertValidationFailure(executionFor("set_on_screen_log", { text: "line\rreturn" }));
    assertValidationFailure(executionFor("set_on_screen_log", { text: "nul\u0000byte" }));

    const accepted = validateExecution(executionFor("set_on_screen_log", { text: "one\n\ttwo" }));
    assert.strictEqual(accepted.actions[0]?.params?.text, "one\n\ttwo");
  });

  it("rejects numeric strings, floats, null, NaN, and infinity", () => {
    const invalidCases: Array<Record<string, unknown>> = [
      { topOffsetDp: "8" },
      { edgeOffsetDp: 1.5 },
      { widthDp: null },
      { fontSizeSp: Number.NaN },
      { ttlMs: Number.POSITIVE_INFINITY },
    ];

    for (const invalid of invalidCases) {
      assertValidationFailure(executionFor("set_on_screen_log", { text: "numbers", ...invalid }));
    }
  });

  it("normalizes valid colors and rejects every non-contract color form", () => {
    const normalized = validateExecution(
      executionFor("set_on_screen_log", {
        text: "colors",
        textColor: "#a1b2c3",
        backgroundColor: "#7f0a0b0c",
      }),
    );

    assert.strictEqual(normalized.actions[0]?.params?.textColor, "#FFA1B2C3");
    assert.strictEqual(normalized.actions[0]?.params?.backgroundColor, "#7F0A0B0C");

    for (const value of ["red", "#12345", "#1234567", "#GG0000", "#FFFFFFFFF"]) {
      assertValidationFailure(executionFor("set_on_screen_log", { text: "bad color", textColor: value }));
    }
  });

  it("rejects unknown, irrelevant, and snake-case action parameters", () => {
    assertValidationFailure(executionFor("set_on_screen_log", { text: "unknown", unknown: true }));
    assertValidationFailure(executionFor("set_on_screen_log", { text: "retry", retry: { maxAttempts: 2 } }));
    assertValidationFailure(executionFor("set_on_screen_log", { text: "alias", text_align: "right" }));
    assertValidationFailure(executionFor("set_on_screen_log", { value: "generic parameter alias" }));
  });

  it("does not add an action-type alias", () => {
    assert.throws(() => normalizeActionType("on_screen_log"));
    assert.throws(() => normalizeActionType("SET_ON_SCREEN_LOG"));
    assert.throws(() => normalizeActionType(" clear_on_screen_log "));
    assertValidationFailure(executionFor("on_screen_log", { text: "not canonical" }));
    assertValidationFailure(executionFor("SET_ON_SCREEN_LOG", { text: "not canonical" }));
    assertValidationFailure(executionFor(" clear_on_screen_log "));
  });

  it("preserves the existing enter_text text limit", () => {
    assertValidationFailure(
      executionFor("enter_text", {
        matcher: { resourceId: "com.example:id/field" },
        text: "x".repeat(513),
      }),
    );
  });
});

describe("clear_on_screen_log validation", () => {
  it("accepts omitted params and an empty object", () => {
    assert.strictEqual(validateExecution(executionFor("clear_on_screen_log")).actions[0]?.type, "clear_on_screen_log");
    assert.deepStrictEqual(validateExecution(executionFor("clear_on_screen_log", {})).actions[0]?.params, {});
  });

  it("rejects nonempty and null params", () => {
    assertValidationFailure(executionFor("clear_on_screen_log", { text: "not allowed" }));
    assertValidationFailure({
      ...executionFor("clear_on_screen_log"),
      actions: [{ id: "clear", type: "clear_on_screen_log", params: null }],
    });
  });
});

describe("on-screen log execution failures", () => {
  it("promotes a known renderer failure step to a failed public envelope", () => {
    const envelope: ResultEnvelope = {
      commandId: "on-screen-log-command",
      taskId: "on-screen-log-task",
      status: "success",
      stepResults: [
        {
          id: "set-panel",
          actionType: "set_on_screen_log",
          success: false,
          data: {
            error: ERROR_CODES.ON_SCREEN_LOG_RENDER_TIMEOUT,
            message: "The panel did not complete a draw before the acknowledgement deadline",
          },
        },
      ],
      error: null,
    };

    reconcileEnvelopeStatusAfterPostProcessing(envelope);

    assert.strictEqual(envelope.status, "failed");
    assert.strictEqual(envelope.errorCode, ERROR_CODES.ON_SCREEN_LOG_RENDER_TIMEOUT);
    assert.strictEqual(
      envelope.error,
      "Step set-panel (set_on_screen_log) failed: ON_SCREEN_LOG_RENDER_TIMEOUT",
    );
    assert.deepStrictEqual(envelope.stepResults[0]?.data, {
      error: ERROR_CODES.ON_SCREEN_LOG_RENDER_TIMEOUT,
      message: "The panel did not complete a draw before the acknowledgement deadline",
    });
  });

  it("does not change envelope error-code behavior for unrelated failures", () => {
    const envelope: ResultEnvelope = {
      commandId: "existing-action-command",
      taskId: "existing-action-task",
      status: "success",
      stepResults: [
        {
          id: "click",
          actionType: "click",
          success: false,
          data: { error: ERROR_CODES.NODE_NOT_FOUND },
        },
      ],
      error: null,
    };

    reconcileEnvelopeStatusAfterPostProcessing(envelope);

    assert.strictEqual(envelope.status, "failed");
    assert.strictEqual(envelope.errorCode, undefined);
  });
});
