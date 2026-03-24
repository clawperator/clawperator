import { describe, it } from "node:test";
import assert from "node:assert";
import { readAllRequiresExplicitJsonError } from "../../cli/registry.js";

describe("readAllRequiresExplicitJsonError", () => {
  it("returns undefined when explicit json was requested via --json", () => {
    assert.strictEqual(
      readAllRequiresExplicitJsonError({ command: "read", format: "json", explicitJsonOutput: true }),
      undefined,
    );
  });

  it("errors when format is json but output was implicit default", () => {
    const out = readAllRequiresExplicitJsonError({
      command: "read-value",
      format: "json",
      explicitJsonOutput: false,
    });
    assert.ok(out);
    assert.match(out, /explicit JSON output/i);
    assert.match(out, /read-value/);
  });

  it("errors when format is pretty", () => {
    const out = readAllRequiresExplicitJsonError({
      command: "read",
      format: "pretty",
      explicitJsonOutput: false,
    });
    assert.ok(out);
    assert.match(out, /read --all requires JSON output/i);
  });
});
