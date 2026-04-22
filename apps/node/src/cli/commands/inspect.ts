/**
 * inspect.ts - legacy compatibility shim (no longer registered in COMMANDS).
 * inspect ui was removed from the registered command surface.
 * Use 'snapshot' instead.
 */
import { cmdObserveSnapshot } from "./observe.js";
import type { OutputOptions } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdInspectUi(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  logger?: Logger;
}): Promise<string> {
  return cmdObserveSnapshot(options);
}
