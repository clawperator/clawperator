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
  app.use(express.json({ limit: "1mb" }));

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
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // REST: Execute command
  app.post("/execute", async (req, res) => {
    const { execution, deviceId, receiverPackage } = req.body;
    
    if (!execution) {
      res.status(400).json({ ok: false, error: "Missing 'execution' in body" });
      return;
    }

    try {
      const result = await runExecution(execution, {
        deviceId,
        receiverPackage,
      });

      if (result.ok) {
        res.json(result);
      } else {
        const status = result.error.code === ERROR_CODES.EXECUTION_CONFLICT_IN_FLIGHT ? 423 : 400;
        res.status(status).json(result);
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // REST: Observe Snapshot
  app.post("/observe/snapshot", async (req, res) => {
    const { deviceId, receiverPackage } = req.body;
    const executionInput = {
      commandId: `serve-snap-${Date.now()}`,
      taskId: `serve-snap-${Date.now()}`,
      source: "serve-api",
      expectedFormat: "android-ui-automator",
      timeoutMs: 30000,
      actions: [{ id: "snap", type: "snapshot_ui", params: { format: "ascii" } }],
    };

    try {
      const result = await runExecution(executionInput, { deviceId, receiverPackage });
      if (result.ok) {
        res.json(result);
      } else {
        const status = result.error.code === ERROR_CODES.EXECUTION_CONFLICT_IN_FLIGHT ? 423 : 400;
        res.status(status).json(result);
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // REST: Observe Screenshot
  app.post("/observe/screenshot", async (req, res) => {
    const { deviceId, receiverPackage } = req.body;
    const executionInput = {
      commandId: `serve-shot-${Date.now()}`,
      taskId: `serve-shot-${Date.now()}`,
      source: "serve-api",
      expectedFormat: "android-ui-automator",
      timeoutMs: 30000,
      actions: [{ id: "shot", type: "take_screenshot" }],
    };

    try {
      const result = await runExecution(executionInput, { deviceId, receiverPackage });
      if (result.ok) {
        res.json(result);
      } else {
        const status = result.error.code === ERROR_CODES.EXECUTION_CONFLICT_IN_FLIGHT ? 423 : 400;
        res.status(status).json(result);
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
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
    const server = app.listen(options.port, "localhost", () => {
      console.log(`🚀 Clawperator API server listening on http://localhost:${options.port}`);
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
