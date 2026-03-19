import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../contracts/errors.js";

export interface PullRecordingResult {
  localPath: string;
  sessionId: string;
}

export interface PullRecordingOptions {
  sessionId?: string;
  outputDir: string;
}

// Safe session ID pattern: alphanumeric, hyphens, and underscores only
// Matches the Android writer's safe-character policy
const SAFE_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateSessionId(sessionId: string): void {
  if (!SAFE_SESSION_ID_PATTERN.test(sessionId)) {
    throw {
      code: ERROR_CODES.RECORDING_SESSION_NOT_FOUND,
      message: `Invalid session ID format: ${sessionId}`,
    };
  }
}

export async function pullRecording(
  config: RuntimeConfig,
  options: PullRecordingOptions
): Promise<PullRecordingResult> {
  let sessionId: string;

  // Step 1 & 2: Determine session ID
  if (options.sessionId) {
    sessionId = options.sessionId;
    validateSessionId(sessionId);
  } else {
    // Read from latest pointer file
    const latestPointerPath = `/sdcard/Android/data/${config.receiverPackage}/files/recordings/latest`;
    const result = await runAdb(config, ["shell", "cat", latestPointerPath]);

    if (result.code !== 0 || !result.stdout.trim()) {
      throw {
        code: ERROR_CODES.RECORDING_SESSION_NOT_FOUND,
        message: "No recording session found on device. Start a recording first.",
      };
    }

    sessionId = result.stdout.trim();
    validateSessionId(sessionId);
  }

  // Step 3: Construct remote path
  const remotePath = `/sdcard/Android/data/${config.receiverPackage}/files/recordings/${sessionId}.ndjson`;

  // Step 4: Ensure output directory exists
  await fs.mkdir(options.outputDir, { recursive: true });

  // Step 5: Construct local path
  const localPath = path.join(options.outputDir, `${sessionId}.ndjson`);

  // Step 6: Run adb pull
  const pullResult = await runAdb(config, ["pull", remotePath, localPath]);

  // Step 7: Check for errors
  if (pullResult.code !== 0) {
    throw {
      code: ERROR_CODES.RECORDING_PULL_FAILED,
      message: `Failed to pull recording from device: ${pullResult.stderr || "Unknown error"}`,
    };
  }

  return { localPath, sessionId };
}
