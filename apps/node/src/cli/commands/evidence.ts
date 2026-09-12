import { captureEvidence, type EvidenceCaptureOptions, type EvidenceCaptureDependencies } from "../../domain/evidence/capture.js";
import { formatError, formatSuccess, type OutputOptions } from "../output.js";
import { startVideo, stopVideo, videoStatus } from "../../domain/evidence/video.js";
import { getStringOptStrict, UsageError } from "../registry.js";
export async function cmdEvidenceCapture(options: EvidenceCaptureOptions & OutputOptions, dependencies?: EvidenceCaptureDependencies): Promise<string> {
  try { return formatSuccess(await captureEvidence(options, dependencies), options); }
  catch (error) { return formatError(error, options); }
}


export async function cmdEvidenceVideo(ctx: { rest: string[]; deviceId?: string; operatorPackage?: string; timeoutMs?: number; format: OutputOptions["format"] }): Promise<string> {
  if (ctx.timeoutMs !== undefined) throw new UsageError("Video uses fixed startup and stop budgets; --timeout applies only to still capture");
  const operation = ctx.rest[1];
  const get = (flag: string) => getStringOptStrict(ctx.rest, flag);
  if (!["start", "status", "stop"].includes(operation)) throw new UsageError("Use evidence video start, status, or stop");
  if (operation !== "start") {
    if (ctx.rest.some(value => ["--output-dir", "--duration-seconds", "--size", "--label", "--context-json"].includes(value))) throw new UsageError("Capture options are valid only for video start");
    const session = get("--session");
    if (session === undefined) throw new UsageError("Video status/stop requires --session");
    try { return formatSuccess(await (operation === "status" ? videoStatus : stopVideo)({ session, deviceId: ctx.deviceId, operatorPackage: ctx.operatorPackage }), ctx); }
    catch (error) { return formatError(error, ctx); }
  }
  if (ctx.rest.includes("--session")) throw new UsageError("Video start does not accept --session");
  const outputDir = get("--output-dir"), duration = get("--duration-seconds"), size = get("--size");
  if (outputDir === undefined || duration === undefined || !/^\d+$/.test(duration)) throw new UsageError("Video start requires --output-dir and integer --duration-seconds");
  const contextJson = get("--context-json");
  let context: Record<string, unknown> | undefined;
  if (contextJson !== undefined) {
    try { context = JSON.parse(contextJson); } catch { throw new UsageError("--context-json must be a JSON object"); }
  }
  const index = ctx.rest.indexOf("--label");
  const label = index >= 0 && ctx.rest[index + 1] === "" ? "" : get("--label");
  try { return formatSuccess(await startVideo({ outputDir, durationSeconds: Number(duration), size, context, label, deviceId: ctx.deviceId, operatorPackage: ctx.operatorPackage }), ctx); }
  catch (error) { return formatError(error, ctx); }
}
