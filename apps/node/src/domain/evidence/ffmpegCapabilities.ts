import type { ProcessRunner } from "../../adapters/android-bridge/processRunner.js";

// Pass every frame through and retain demuxer precision, including closely spaced VFR frames.
export const FFMPEG_VIDEO_TIMING_ARGS = ["-fps_mode", "passthrough", "-enc_time_base", "demux"];
export const FFMPEG_VIDEO_REQUIREMENT = "ffmpeg 6.1 or newer with libx264, -fps_mode passthrough, and -enc_time_base demux";

export async function supportsFfmpegVideo(runner: ProcessRunner, versionOutput: string): Promise<boolean> {
  const version = versionOutput.match(/ffmpeg version n?(\d+)\.(\d+)(?:\D|$)/);
  if (!version || Number(version[1]) < 6 || (Number(version[1]) === 6 && Number(version[2]) < 1)) return false;
  // Exercise the installed encoder and actual option values without recording a device or writing a file.
  const probe = await runner.run("ffmpeg", [
    "-v", "error", "-nostdin", "-xerror", "-f", "lavfi", "-i", "color=size=16x16:rate=1000:duration=0.002",
    "-map", "0:v:0", "-frames:v", "2", "-c:v", "libx264", "-threads", "1",
    ...FFMPEG_VIDEO_TIMING_ARGS, "-f", "null", "-",
  ], { timeoutMs: 5000 });
  return probe.code === 0 && !probe.error && probe.stderr.trim() === "";
}
