import { describe, it } from "node:test";
import assert from "node:assert";
import { buildReadExecution } from "../../domain/actions/read.js";

describe("buildReadExecution", () => {
  it("creates execution with matcher only", () => {
    const execution = buildReadExecution({ textEquals: "Test" });
    assert.strictEqual(execution.actions.length, 1);
    assert.deepStrictEqual(execution.actions[0].params.matcher, { textEquals: "Test" });
    assert.strictEqual(execution.actions[0].params.all, undefined);
    assert.strictEqual(execution.actions[0].params.container, undefined);
  });

  it("includes all flag when readAll is true", () => {
    const execution = buildReadExecution({ textEquals: "Test" }, true);
    assert.strictEqual(execution.actions[0].params.all, true);
  });

  it("includes container when provided", () => {
    const execution = buildReadExecution(
      { textEquals: "Test" },
      false,
      { resourceId: "com.example:id/list" }
    );
    assert.deepStrictEqual(execution.actions[0].params.container, { resourceId: "com.example:id/list" });
  });

  it("includes both all and container when provided", () => {
    const execution = buildReadExecution(
      { textEquals: "Test" },
      true,
      { role: "list" }
    );
    assert.strictEqual(execution.actions[0].params.all, true);
    assert.deepStrictEqual(execution.actions[0].params.container, { role: "list" });
  });

  it("does not include container property when container is undefined", () => {
    const execution = buildReadExecution({ textEquals: "Test" }, false, undefined);
    assert.strictEqual("container" in execution.actions[0].params, false);
  });
});
