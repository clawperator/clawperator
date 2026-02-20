import express from "express";
import { Server } from "node:http";
import { runExecution } from "../../domain/executions/runExecution.js";
import { listDevices } from "../../domain/devices/listDevices.js";
import { clawperatorEvents, CLAW_EVENT_TYPES } from "../../domain/observe/events.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

interface ServeOptions {
  port: number;
  verbose: boolean;
}

export async function cmdServe(options: ServeOptions): Promise<void> {
  await startServer(options);
  return new Promise(() => {});
}

export async function startServer(options: ServeOptions): Promise<Server> {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  // JSON parse error handler
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
      res.status(400).json({ ok: false, error: { code: "INVALID_JSON", message: "Malformed JSON body" } });
      return;
    }
    next();
  });

  // Logging middleware
  app.use((req, _res, next) => {
    if (options.verbose) {
      console.log(`[HTTP] ${req.method} ${req.url}`);
    }
    next();
  });

  // REST: List devices
  app.get("/devices", async (_req, res) => {
    try {
      const config = getDefaultRuntimeConfig({
        adbPath: process.env.ADB_PATH,
        receiverPackage: process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      });
      const devices = await listDevices(config);
      res.json({ ok: true, devices });
    } catch (e) {
      res.status(500).json({ 
        ok: false, 
        error: { 
          code: "INTERNAL_ERROR", 
          message: options.verbose ? String(e) : "Failed to list devices" 
        } 
      });
    }
  });

  function mapErrorToStatus(code: string): number {
    switch (code) {
      case ERROR_CODES.EXECUTION_CONFLICT_IN_FLIGHT: return 423;
      case ERROR_CODES.DEVICE_NOT_FOUND: return 404;
      case ERROR_CODES.DEVICE_AMBIGUOUS: return 400;
      case ERROR_CODES.VALIDATION_FAILED: return 400;
      case ERROR_CODES.PAYLOAD_TOO_LARGE: return 413;
      case ERROR_CODES.RESULT_ENVELOPE_TIMEOUT: return 504;
      default: return 400;
    }
  }

  // REST: Execute command
  app.post("/execute", async (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ ok: false, error: "Invalid or missing JSON body" });
      return;
    }

    const { execution, deviceId, receiverPackage } = req.body;
    
    if (!execution) {
      res.status(400).json({ ok: false, error: "Missing 'execution' in body" });
      return;
    }

    if (deviceId !== undefined && typeof deviceId !== "string") {
      res.status(400).json({ ok: false, error: "'deviceId' must be a string" });
      return;
    }

    if (receiverPackage !== undefined && typeof receiverPackage !== "string") {
      res.status(400).json({ ok: false, error: "'receiverPackage' must be a string" });
      return;
    }

    try {
      const result = await runExecution(execution, {
        deviceId,
        receiverPackage: receiverPackage || process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      });

      if (result.ok) {
        res.json(result);
      } else {
        res.status(mapErrorToStatus(result.error.code)).json(result);
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: String(e) } });
    }
  });

  // REST: Observe Snapshot
  app.post("/observe/snapshot", async (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ ok: false, error: "Invalid or missing JSON body" });
      return;
    }

    const { deviceId, receiverPackage } = req.body;
    
    if (deviceId !== undefined && typeof deviceId !== "string") {
      res.status(400).json({ ok: false, error: "'deviceId' must be a string" });
      return;
    }

    if (receiverPackage !== undefined && typeof receiverPackage !== "string") {
      res.status(400).json({ ok: false, error: "'receiverPackage' must be a string" });
      return;
    }

    const ts = Date.now();
    const executionInput = {
      commandId: `serve-snap-${ts}`,
      taskId: `serve-snap-${ts}`,
      source: "serve-api",
      expectedFormat: "android-ui-automator",
      timeoutMs: 30000,
      actions: [{ id: "snap", type: "snapshot_ui", params: { format: "ascii" } }],
    };

    try {
      const result = await runExecution(executionInput, { 
        deviceId, 
        receiverPackage: receiverPackage || process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      });
      if (result.ok) {
        res.json(result);
      } else {
        res.status(mapErrorToStatus(result.error.code)).json(result);
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: String(e) } });
    }
  });

  // REST: Observe Screenshot
  app.post("/observe/screenshot", async (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ ok: false, error: "Invalid or missing JSON body" });
      return;
    }

    const { deviceId, receiverPackage } = req.body;

    if (deviceId !== undefined && typeof deviceId !== "string") {
      res.status(400).json({ ok: false, error: "'deviceId' must be a string" });
      return;
    }

    if (receiverPackage !== undefined && typeof receiverPackage !== "string") {
      res.status(400).json({ ok: false, error: "'receiverPackage' must be a string" });
      return;
    }

    const ts = Date.now();
    const executionInput = {
      commandId: `serve-shot-${ts}`,
      taskId: `serve-shot-${ts}`,
      source: "serve-api",
      expectedFormat: "android-ui-automator",
      timeoutMs: 30000,
      actions: [{ id: "shot", type: "take_screenshot" }],
    };

    try {
      const result = await runExecution(executionInput, { 
        deviceId, 
        receiverPackage: receiverPackage || process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      });
      if (result.ok) {
        res.json(result);
      } else {
        res.status(mapErrorToStatus(result.error.code)).json(result);
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: String(e) } });
    }
  });

  // SSE: Event streaming
  app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const onResult = (data: any) => {
      try {
        if (!res.writableEnded) {
          res.write(`event: ${CLAW_EVENT_TYPES.RESULT}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (err) {
        console.error(`⚠️ SSE write failed: ${String(err)}`);
        clawperatorEvents.off(CLAW_EVENT_TYPES.RESULT, onResult);
      }
    };

    const onExecution = (data: any) => {
      try {
        if (!res.writableEnded) {
          res.write(`event: ${CLAW_EVENT_TYPES.EXECUTION}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (err) {
        console.error(`⚠️ SSE execution write failed: ${String(err)}`);
        clawperatorEvents.off(CLAW_EVENT_TYPES.EXECUTION, onExecution);
      }
    };

    clawperatorEvents.on(CLAW_EVENT_TYPES.RESULT, onResult);
    clawperatorEvents.on(CLAW_EVENT_TYPES.EXECUTION, onExecution);

    const cleanup = () => {
      clawperatorEvents.off(CLAW_EVENT_TYPES.RESULT, onResult);
      clawperatorEvents.off(CLAW_EVENT_TYPES.EXECUTION, onExecution);
    };

    req.on("close", cleanup);
    req.on("error", (err) => {
      if (options.verbose) console.warn(`[HTTP] SSE req error: ${String(err)}`);
      cleanup();
    });
    res.on("error", (err) => {
      if (options.verbose) console.warn(`[HTTP] SSE res error: ${String(err)}`);
      cleanup();
    });

    // Send initial heartbeat
    try {
      res.write(`data: ${JSON.stringify({ code: "CONNECTED", message: "Clawperator SSE stream active" })}\n\n`);
    } catch (err) {
      console.error(`⚠️ SSE heartbeat failed: ${String(err)}`);
      cleanup();
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(options.port, "0.0.0.0", () => {
      console.log(`🚀 Clawperator API server listening on http://0.0.0.0:${options.port}`);
      if (options.verbose) {
        console.log(`- GET  /devices`);
        console.log(`- POST /execute`);
        console.log(`- POST /observe/snapshot`);
        console.log(`- POST /observe/screenshot`);
        console.log(`- GET  /events (SSE)`);
      }
      resolve(server);
    });
  });
}
