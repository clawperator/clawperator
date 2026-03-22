/**
 * inspect ui is an alias of observe snapshot (single implementation).
 */
import { cmdObserveSnapshot } from "./observe.js";
import type { OutputOptions } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdInspectUi(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  receiverPackage?: string;
  timeoutMs?: number;
  logger?: Logger;
}): Promise<string> {
  return cmdObserveSnapshot(options);
}
