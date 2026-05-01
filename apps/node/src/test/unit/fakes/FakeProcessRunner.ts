import { type ProcessRunner, type ProcessResult } from "../../../adapters/android-bridge/processRunner.js";

export class FakeProcessRunner implements ProcessRunner {
    private queue: Array<{ result: ProcessResult; onRun?: () => void | Promise<void> }> = [];
    public calls: { command: string, args: string[], options?: { detached?: boolean; stdio?: any; shell?: boolean } }[] = [];

    queueResult(result: ProcessResult, onRun?: () => void | Promise<void>) {
        this.queue.push({ result, onRun });
    }

    queueError(code: number, errorMsg: string, stdout = "", stderr = "") {
        this.queue.push({
            result: {
                code,
                stdout,
                stderr: stderr || errorMsg,
                error: Object.assign(new Error(errorMsg), { code: code === 127 ? "ENOENT" : code })
            }
        });
    }

    async run(command: string, args: string[], _options?: { timeoutMs?: number; cwd?: string; input?: string }): Promise<ProcessResult> {
        this.calls.push({ command, args });
        const queued = this.queue.shift();
        if (!queued) {
            throw new Error(`Unexpected command execution in fake: ${command} ${args.join(" ")}`);
        }
        await queued.onRun?.();
        return queued.result;
    }

    runShell(command: string, options?: { timeoutMs?: number; cwd?: string }): Promise<ProcessResult> {
        return this.run("bash", ["-lc", command], options);
    }

    spawn(command: string, args: string[], options?: { detached?: boolean; stdio?: any; shell?: boolean }): any {
        this.calls.push({ command, args, options });
        return { unref() {} };
    }
}
