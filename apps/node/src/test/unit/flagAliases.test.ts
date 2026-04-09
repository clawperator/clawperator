import { describe, it } from "node:test";
import assert from "node:assert";
import {
  normalizeCliFlagAliases,
  normalizeCliFlagAliasesBeforeForwardSeparator,
  type CliFlagAliasSpec,
} from "../../cli/flagAliases.js";

const TEST_ALIASES: readonly CliFlagAliasSpec[] = [
  { canonical: "--output", aliases: ["--format"] },
  { canonical: "--timeout", aliases: ["--timeout-ms"] },
] as const;

describe("normalizeCliFlagAliases", () => {
  it("maps configured alias flags to canonical flags", () => {
    const normalized = normalizeCliFlagAliases(
      ["--format", "json", "--timeout-ms", "5000"],
      TEST_ALIASES,
    );
    assert.deepStrictEqual(normalized, ["--output", "json", "--timeout", "5000"]);
  });
});

describe("normalizeCliFlagAliasesBeforeForwardSeparator", () => {
  it("normalizes only tokens before the first forward separator", () => {
    const normalized = normalizeCliFlagAliasesBeforeForwardSeparator(
      ["--format", "json", "--", "--timeout-ms", "script-value"],
      TEST_ALIASES,
    );
    assert.deepStrictEqual(normalized, ["--output", "json", "--", "--timeout-ms", "script-value"]);
  });

  it("normalizes all tokens when no forward separator is present", () => {
    const normalized = normalizeCliFlagAliasesBeforeForwardSeparator(
      ["--timeout-ms", "5000"],
      TEST_ALIASES,
    );
    assert.deepStrictEqual(normalized, ["--timeout", "5000"]);
  });
});
