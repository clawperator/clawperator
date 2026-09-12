import { captureEvidence, type EvidenceCaptureOptions, type EvidenceCaptureDependencies } from "../../domain/evidence/capture.js";
import { formatError, formatSuccess, type OutputOptions } from "../output.js";

export async function cmdEvidenceCapture(options: EvidenceCaptureOptions & OutputOptions, dependencies?: EvidenceCaptureDependencies): Promise<string> {
  try { return formatSuccess(await captureEvidence(options, dependencies), options); }
  catch (error) { return formatError(error, options); }
}
