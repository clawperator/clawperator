import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import type { EvidenceDevice, EvidenceError } from "../../contracts/evidence.js";
import { getCliVersion } from "../version/compatibility.js";

export async function collectEvidenceMetadata(config: RuntimeConfig, remaining: () => number): Promise<{ device: EvidenceDevice; errors: EvidenceError[] }> {
  const errors: EvidenceError[] = [];
  const failure = (field: string) => errors.push({ code: "EVIDENCE_CAPTURE_FAILED", stage: "metadata", component: field, message: `Metadata unavailable: ${field}` });
  const read = async (args: string[]): Promise<string | null> => {
    const budget = remaining();
    if (budget <= 0) return null;
    try {
      const result = await runAdb(config, args, { timeoutMs: Math.min(budget, 5000), logOutput: false });
      return result.code === 0 ? result.stdout : null;
    } catch { return null; }
  };
  const properties = await read(["shell", "getprop"]);
  const inventory = new Map<string, string>();
  let inventoryUsable = properties !== null && properties.trim().length > 0;
  // Android properties such as boot history can contain embedded newlines.
  const entry = /^\[([^\[\]\s]+)\]: \[((?:[^\n]|\n(?!\[))*?)\]\r?$/gm;
  let parsedEnd = 0;
  for (const match of (properties ?? "").matchAll(entry)) {
    if (properties!.slice(parsedEnd, match.index).trim().length > 0 || inventory.has(match[1])) {
      inventoryUsable = false;
    }
    inventory.set(match[1], match[2]);
    parsedEnd = match.index + match[0].length;
  }
  if ((properties ?? "").slice(parsedEnd).trim().length > 0) inventoryUsable = false;
  const property = (name: string): string | null => {
    const value = inventory.get(name);
    return value !== undefined && value.length > 0 ? value : null;
  };
  const requiredProperty = (name: string): string | null => {
    const value = property(name);
    if (value === null) failure(name);
    return value;
  };
  const androidVersion = requiredProperty("ro.build.version.release");
  const api = requiredProperty("ro.build.version.sdk");
  const apiLevel = api !== null && /^\d+$/.test(api) ? Number(api) : null;
  if (api !== null && apiLevel === null) failure("apiLevel");
  const manufacturer = requiredProperty("ro.product.manufacturer");
  const model = requiredProperty("ro.product.model");
  const deviceTypeProperties = { "ro.kernel.qemu": property("ro.kernel.qemu"), "ro.boot.qemu": property("ro.boot.qemu") };
  const values = Object.values(deviceTypeProperties);
  const deviceType = !inventoryUsable ? "unknown" : values.includes("1") ? "emulator" : values.every(value => value === null || value === "0") ? "physical" : "unknown";
  if (deviceType === "unknown") failure("deviceType");
  const size = await read(["shell", "wm", "size"]);
  const dimensions = (size ?? "").match(/Override size:\s*(\d+)x(\d+)/) ?? (size ?? "").match(/Physical size:\s*(\d+)x(\d+)/);
  const width = dimensions && Number(dimensions[1]) > 0 ? Number(dimensions[1]) : null;
  const height = dimensions && Number(dimensions[2]) > 0 ? Number(dimensions[2]) : null;
  if (width === null || height === null) failure("display.size");
  const densityText = await read(["shell", "wm", "density"]);
  const densityMatch = (densityText ?? "").match(/Override density:\s*(\d+)/) ?? (densityText ?? "").match(/Physical density:\s*(\d+)/);
  const density = densityMatch && Number(densityMatch[1]) > 0 ? Number(densityMatch[1]) : null;
  if (density === null) failure("display.density");
  const input = await read(["shell", "dumpsys", "input"]);
  const rotationMatch = (input ?? "").match(/Viewport [^\n]*displayId=0,[^\n]*orientation=([0-3])\b/) ?? (input ?? "").match(/SurfaceOrientation:\s*([0-3])\b/);
  const rotation = rotationMatch ? Number(rotationMatch[1]) : null;
  if (rotation === null) failure("display.rotation");
  const packageDump = await read(["shell", "dumpsys", "package", config.operatorPackage]);
  const operatorVersion = (packageDump ?? "").match(/\bversionName=([^\s]+)/)?.[1] ?? null;
  if (operatorVersion === null) failure("operatorVersion");
  let cliVersion: string | null = null;
  try { cliVersion = getCliVersion(); } catch { failure("cliVersion"); }
  return { device: { serial: config.deviceId!, operatorPackage: config.operatorPackage, cliVersion, operatorVersion,
    apiLevel, androidVersion, manufacturer, model, deviceType, deviceTypeProperties, display: { width, height, density, rotation } }, errors };
}
