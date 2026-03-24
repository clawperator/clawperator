import { describe, it } from "node:test";
import assert from "node:assert";
import { buildReadExecution } from "../../domain/actions/read.js";

describe("buildReadExecution", () => {
  it("creates execution with matcher only", () => {
    const execution = buildReadExecution({ textEquals: "Test" });
    assert.strictEqual(execution.actions.length, 1);
    const action = execution.actions[0]!;
    assert.deepStrictEqual(action.params?.matcher, { textEquals: "Test" });
    assert.strictEqual(action.params?.all, undefined);
    assert.strictEqual(action.params?.container, undefined);
  });

  it("includes all flag when readAll is true", () => {
    const execution = buildReadExecution({ textEquals: "Test" }, true);
    const action = execution.actions[0]!;
    assert.strictEqual(action.params?.all, true);
  });

  it("includes container when provided", () => {
    const execution = buildReadExecution(
      { textEquals: "Test" },
      false,
      { resourceId: "com.example:id/list" }
    );
    const action = execution.actions[0]!;
    assert.deepStrictEqual(action.params?.container, { resourceId: "com.example:id/list" });
  });

  it("includes both all and container when provided", () => {
    const execution = buildReadExecution(
      { textEquals: "Test" },
      true,
      { role: "list" }
    );
    const action = execution.actions[0]!;
    assert.strictEqual(action.params?.all, true);
    assert.deepStrictEqual(action.params?.container, { role: "list" });
  });

  it("does not include container property when container is undefined", () => {
    const execution = buildReadExecution({ textEquals: "Test" }, false, undefined);
    const action = execution.actions[0]!;
    assert.strictEqual("container" in (action.params ?? {}), false);
  });
});
