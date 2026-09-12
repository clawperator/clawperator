import * as fs from "node:fs/promises";
import { join } from "node:path";
import { evidenceManifestSchema, type EvidenceManifest } from "../../contracts/evidence.js";

export async function writeEvidenceManifest(
  outputDir: string,
  manifest: EvidenceManifest,
  files: Pick<typeof fs, "writeFile" | "rename"> = fs,
): Promise<string> {
  const validated = evidenceManifestSchema.parse(manifest);
  const manifestPath = join(outputDir, "manifest.json");
  try {
    await files.writeFile(join(outputDir, "manifest.partial.json"), JSON.stringify(validated, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await files.rename(join(outputDir, "manifest.partial.json"), manifestPath);
  } catch {
    throw { code: "EVIDENCE_CAPTURE_FAILED", message: "Could not atomically persist evidence manifest; captured files remain in the output directory" };
  }
  return manifestPath;
}
