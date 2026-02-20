import { spawn } from "node:child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: Error;
}

export interface ProcessRunner {
  run(command: string, args: string[], options?: { timeoutMs?: number }): Promise<ProcessResult>;
  // For logcat/streaming
  spawn(command: string, args: string[]): any; 
}

export class NodeProcessRunner implements ProcessRunner {
  async run(command: string, args: string[], options?: { timeoutMs?: number }): Promise<ProcessResult> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d) => (stdout += d.toString()));
      proc.stderr?.on("data", (d) => (stderr += d.toString()));
      
      const timeoutMs = options?.timeoutMs ?? 30_000;
      const t = setTimeout(() => {
        proc.kill("SIGTERM");
      }, timeoutMs);

      proc.on("error", (err) => {
        clearTimeout(t);
        resolve({ stdout, stderr, code: (err as any).code === "ENOENT" ? 127 : 1, error: err });
      });

      proc.on("close", (code) => {
        clearTimeout(t);
        resolve({ stdout, stderr, code: code ?? null });
      });
    });
  }

  spawn(command: string, args: string[]): any {
    return spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
  }
}
