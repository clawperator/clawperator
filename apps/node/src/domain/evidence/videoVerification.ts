import type { ProcessRunner } from "../../adapters/android-bridge/processRunner.js";
import { checked, fail } from "./videoSupport.js";

export const VIDEO_DECODE_TIMEOUT_MS = 120_000;

export interface VideoProbeMetadata { codec: string | null; actualSize: string | null; mediaDurationMs: number | null }

export async function verifyVideo(runner: ProcessRunner, path: string, requestedSize: string, onProbe?: (metadata: VideoProbeMetadata) => void, expectedFrames?: number): Promise<{ codec: string; actualSize: string; mediaDurationMs: number }> {
  const probe = JSON.parse(await checked(runner, "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,duration:format=duration", "-of", "json", path]));
  const stream = probe.streams?.[0];
  const actualSize = `${stream?.width}x${stream?.height}`;
  const mediaDurationMs = Number(stream?.duration ?? probe.format?.duration) * 1000;
  onProbe?.({ codec: typeof stream?.codec_name === "string" ? stream.codec_name : null,
    actualSize: Number.isInteger(stream?.width) && stream.width > 0 && Number.isInteger(stream?.height) && stream.height > 0 ? actualSize : null,
    mediaDurationMs: Number.isFinite(mediaDurationMs) && mediaDurationMs >= 0 ? mediaDurationMs : null });
  if (actualSize !== requestedSize || !Number.isFinite(mediaDurationMs) || mediaDurationMs <= 0 || typeof stream?.codec_name !== "string") fail("Video dimensions or duration do not match the requested recording");
  // Decode only the probed stream through EOF without retaining decoded pixels.
  // Preserve its timebase: null-output defaults can invent duplicate DTS for VFR media.
  // The single-output -vsync option also supports hosts predating -fps_mode (FFmpeg 5.1).
  const decoded = await runner.run("ffmpeg", [
    "-v", "error", "-nostdin", "-nostats", "-xerror", "-max_alloc", "268435456",
    "-threads", "2", "-err_detect", "explode", "-i", path, "-map", "0:v:0",
    "-an", "-sn", "-dn", "-threads", "1", "-vsync", "0", "-enc_time_base", "-1",
    "-stats_period", "60", "-progress", "pipe:1", "-f", "null", "-",
  ], { timeoutMs: VIDEO_DECODE_TIMEOUT_MS });
  if (decoded.code !== 0 || decoded.error || decoded.stderr.trim()) {
    fail(`Full video decode failed: ${decoded.stderr || decoded.error?.message || `exit ${decoded.code}`}`);
  }
  const completed = decoded.stdout.trim().split(/progress=continue\r?\n/).at(-1)!;
  if (!/^frame=\s*[1-9]\d*\s*$/m.test(completed) || !/\bprogress=end$/.test(completed)) {
    fail("Video decoder did not report complete decoding with at least one frame");
  }
  const frames = Number(completed.match(/^frame=\s*(\d+)\s*$/m)![1]);
  if (expectedFrames !== undefined && frames !== expectedFrames) fail(`Video segment frame count changed: expected ${expectedFrames}, decoded ${frames}`);
  return { codec: stream.codec_name, actualSize, mediaDurationMs };
}
