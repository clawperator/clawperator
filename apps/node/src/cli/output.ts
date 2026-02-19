/**
 * Agent-facing output: machine-readable JSON by default.
 */
export type OutputFormat = "json" | "pretty";

export interface OutputOptions {
  format: OutputFormat;
  verbose?: boolean;
}

export function formatSuccess<T>(data: T, options: OutputOptions): string {
  return options.format === "pretty" ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

export function formatError(error: unknown, options: OutputOptions): string {
  const obj =
    typeof error === "object" && error !== null && "code" in error
      ? error
      : { code: "UNKNOWN", message: String(error) };
  if (options.format === "pretty") {
    return JSON.stringify(obj, null, 2);
  }
  return JSON.stringify(obj);
}
