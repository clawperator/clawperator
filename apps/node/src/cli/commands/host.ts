import type { OutputOptions } from "../output.js";
import { formatSuccess } from "../output.js";
import { materializeHostArtifacts } from "../../domain/host/materializeArtifacts.js";

export async function cmdHostMaterializeArtifacts(options: OutputOptions & {
  installedAt?: string;
  cliVersion?: string;
  apkVersion?: string;
  lastDeviceSerial?: string;
}): Promise<string> {
  const result = await materializeHostArtifacts({
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
