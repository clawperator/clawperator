import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizeActionType, getCanonicalActionType } from "../../contracts/aliases.js";

describe("normalizeActionType", () => {
  it("returns canonical for alias", () => {
    assert.strictEqual(normalizeActionType("tap"), "click");
    assert.strictEqual(normalizeActionType("type_text"), "enter_text");
    assert.strictEqual(normalizeActionType("wait_for"), "wait_for_node");
    assert.strictEqual(normalizeActionType("key_press"), "press_key");
  });

  it("returns same for already canonical", () => {
    assert.strictEqual(normalizeActionType("click"), "click");
    assert.strictEqual(normalizeActionType("enter_text"), "enter_text");
  });

  it("throws for unknown type", () => {
    assert.throws(() => normalizeActionType("unknown_type"));
  });
});

describe("getCanonicalActionType", () => {
  it("maps type_text to enter_text", () => {
    assert.strictEqual(getCanonicalActionType("type_text"), "enter_text");
  });

  it("maps key_press to press_key", () => {
    assert.strictEqual(getCanonicalActionType("key_press"), "press_key");
  });
});
