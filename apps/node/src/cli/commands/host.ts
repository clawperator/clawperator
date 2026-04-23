import type { OutputOptions } from "../output.js";
import { formatSuccess } from "../output.js";
import { setupHost } from "../../domain/host/hostSetup.js";

export async function cmdHostSetup(options: OutputOptions & {
  installedAt?: string;
  cliVersion?: string;
  apkVersion?: string;
  lastDeviceSerial?: string;
}): Promise<string> {
  const result = await setupHost({
    installedAt: options.installedAt,
    cliVersion: options.cliVersion,
    apkVersion: options.apkVersion,
    lastDeviceSerial: options.lastDeviceSerial,
    env: process.env,
  });

  if (!result.ok) {
    process.exitCode = 1;
  }

  return formatSuccess(result, options);
}
