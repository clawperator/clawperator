/**
 * Tail the Clawperator log file.
 * Dumps existing content then streams new lines as they arrive.
 */
import { createReadStream, existsSync, watchFile, unwatchFile, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Log path resolution (mirrors logic in adapters/logger.ts)
// ---------------------------------------------------------------------------

function expandHomePath(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

function formatDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLogPath(logDir: string, date = new Date()): string {
  return join(logDir, `clawperator-${formatDate(date)}.log`);
}

function resolveLogPath(logDir?: string): string {
  const configuredDir =
    logDir?.trim() ||
    process.env.CLAWPERATOR_LOG_DIR?.trim() ||
    "~/.clawperator/logs";
  const resolvedDir = resolve(expandHomePath(configuredDir));
  return formatLogPath(resolvedDir);
}

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function cmdLogs(options: { logDir?: string }): Promise<void> {
  const logPath = resolveLogPath(options.logDir);

  if (!existsSync(logPath)) {
    process.stderr.write(`No log file found at ${logPath}\n`);
    process.exitCode = 0;
    return;
  }

  // Set up combined dump and stream with no gap
  await dumpAndStreamContent(logPath);
}

async function dumpAndStreamContent(logPath: string): Promise<void> {
  return new Promise((resolve) => {
    let isRunning = true;
    let initialDumpComplete = false;

    // Handle SIGINT/SIGTERM gracefully - install BEFORE any I/O
    const handleSigint = () => {
      isRunning = false;
      unwatchFile(logPath);
      process.exitCode = 0;
      resolve();
    };

    process.on("SIGINT", handleSigint);
    process.on("SIGTERM", handleSigint);

    // Get initial file size before starting the watcher
    let initialSize = 0;
    try {
      initialSize = statSync(logPath).size;
    } catch {
      // If stat fails, we'll track from 0
    }

    // Start watching BEFORE the initial dump to avoid missing any events
    watchFile(logPath, { interval: 500 }, (curr, prev) => {
      if (!isRunning) return;

      if (!initialDumpComplete) {
        // During initial dump, just track the current size
        // The initial dump reads up to initialSize, so any content
        // between initialSize and curr.size will be streamed after
        return;
      }

      if (curr.size > prev.size) {
        // File grew - read the new content
        const stream = createReadStream(logPath, {
          encoding: "utf8",
          start: prev.size,
          end: curr.size - 1,
        });

        stream.on("data", (chunk: string | Buffer) => {
          process.stdout.write(chunk.toString());
        });

        stream.on("error", (err) => {
          process.stderr.write(`[clawperator] Error reading log: ${String(err)}\n`);
        });
      }
    });

    // Dump existing content (only up to initialSize)
    const stream = createReadStream(logPath, { encoding: "utf8", start: 0, end: initialSize > 0 ? initialSize - 1 : undefined });
    let buffer = "";

    stream.on("data", (chunk: string | Buffer) => {
      buffer += chunk;
    });

    stream.on("end", () => {
      // Write existing lines to stdout
      if (buffer.length > 0) {
        // Ensure we end with a newline if the file doesn't
        if (!buffer.endsWith("\n")) {
          buffer += "\n";
        }
        process.stdout.write(buffer);
      }
      initialDumpComplete = true;
      // After dump, watchFile will automatically pick up any new content
      // because curr.size will be > prev.size
    });

    stream.on("error", (err) => {
      process.stderr.write(`[clawperator] Error reading log: ${String(err)}\n`);
      // Still mark as complete so streaming can continue
      initialDumpComplete = true;
    });
  });
}
