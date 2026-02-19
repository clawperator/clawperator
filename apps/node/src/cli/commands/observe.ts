import { observeSnapshot } from "../../domain/observe/snapshot.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";

export async function cmdObserveSnapshot(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  try {
    const result = await observeSnapshot({
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    });
    if (result.ok) {
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    }
    return formatError(result.error, options);
  } catch (e) {
    return formatError(e, options);
  }
}
