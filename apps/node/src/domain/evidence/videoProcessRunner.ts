import { NodeProcessRunner, type ProcessResult } from "../../adapters/android-bridge/processRunner.js";

/** Video subprocesses have hard deadlines and bounded captured diagnostics. */
export class VideoProcessRunner extends NodeProcessRunner {
  override async run(command: string, args: string[], options?: { timeoutMs?: number; cwd?: string; input?: string }): Promise<ProcessResult> {
    if (options?.cwd !== undefined || options?.input !== undefined) throw new Error("Video subprocesses do not accept cwd or stdin overrides");
    return new Promise(resolve => {
      const child = this.spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
      let stdout = "", stderr = "", bytes = 0;
      let settled = false;
      const finish = (result: ProcessResult) => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ code: null, stdout, stderr: "Video subprocess timed out", error: new Error("Video subprocess timed out") });
      }, options?.timeoutMs ?? 10000);
      const collect = (chunk: Buffer, errorStream: boolean) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > 16 * 1024 * 1024) {
          child.kill("SIGKILL");
          finish({ code: null, stdout, stderr: "Video subprocess output exceeded 16 MiB" });
        } else if (errorStream) stderr += chunk.toString(); else stdout += chunk.toString();
      };
      child.stdout?.on("data", (chunk: Buffer) => collect(chunk, false));
      child.stderr?.on("data", (chunk: Buffer) => collect(chunk, true));
      child.on("error", (error: Error) => finish({ code: 1, stdout, stderr, error }));
      child.on("close", (code: number | null) => finish({ code, stdout, stderr }));
    });
  }
}
