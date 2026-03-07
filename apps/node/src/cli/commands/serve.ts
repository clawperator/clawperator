import express from "express";
import { Server } from "node:http";
import { runExecution } from "../../domain/executions/runExecution.js";
import { listDevices } from "../../domain/devices/listDevices.js";
import { listSkills } from "../../domain/skills/listSkills.js";
import { getSkill } from "../../domain/skills/getSkill.js";
import { searchSkills } from "../../domain/skills/searchSkills.js";
import { runSkill } from "../../domain/skills/runSkill.js";
import { clawperatorEvents, CLAW_EVENT_TYPES } from "../../domain/observe/events.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { SKILL_NOT_FOUND } from "../../contracts/skills.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

interface ServeOptions {
  port: number;
  host: string;
  verbose: boolean;
}

export async function cmdServe(options: ServeOptions): Promise<void> {
  try {
    await startServer(options);
    // Long running
    return new Promise(() => {});
  } catch (e) {
    console.error(`❌ Failed to start server: ${String(e)}`);
    process.exit(1);
  }
}

export async function startServer(options: ServeOptions): Promise<Server> {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

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
      case ERROR_CODES.NO_DEVICES: return 404;
      case ERROR_CODES.MULTIPLE_DEVICES_DEVICE_ID_REQUIRED: return 400;
      case ERROR_CODES.EXECUTION_VALIDATION_FAILED: return 400;
      case ERROR_CODES.PAYLOAD_TOO_LARGE: return 413;
      case ERROR_CODES.RESULT_ENVELOPE_TIMEOUT: return 504;
      default: return 400;
    }
  }

  // REST: Execute command
  app.post("/execute", async (req, res) => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ ok: false, error: { code: "INVALID_BODY", message: "Invalid or missing JSON body" } });
      return;
    }

    const { execution, deviceId, receiverPackage } = req.body;
    
    if (!execution) {
      res.status(400).json({ ok: false, error: { code: "MISSING_EXECUTION", message: "Missing 'execution' in body" } });
      return;
    }

    if (deviceId !== undefined && typeof deviceId !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_DEVICE_ID", message: "'deviceId' must be a string" } });
      return;
    }

    if (receiverPackage !== undefined && typeof receiverPackage !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_RECEIVER_PACKAGE", message: "'receiverPackage' must be a string" } });
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
      res.status(400).json({ ok: false, error: { code: "INVALID_BODY", message: "Invalid or missing JSON body" } });
      return;
    }

    const { deviceId, receiverPackage } = req.body;
    
    if (deviceId !== undefined && typeof deviceId !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_DEVICE_ID", message: "'deviceId' must be a string" } });
      return;
    }

    if (receiverPackage !== undefined && typeof receiverPackage !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_RECEIVER_PACKAGE", message: "'receiverPackage' must be a string" } });
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
      res.status(400).json({ ok: false, error: { code: "INVALID_BODY", message: "Invalid or missing JSON body" } });
      return;
    }

    const { deviceId, receiverPackage } = req.body;

    if (deviceId !== undefined && typeof deviceId !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_DEVICE_ID", message: "'deviceId' must be a string" } });
      return;
    }

    if (receiverPackage !== undefined && typeof receiverPackage !== "string") {
      res.status(400).json({ ok: false, error: { code: "INVALID_RECEIVER_PACKAGE", message: "'receiverPackage' must be a string" } });
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

  // REST: List or search skills
  app.get("/skills", async (req, res) => {
    try {
      const app = req.query.app as string | undefined;
      const intent = req.query.intent as string | undefined;
      const keyword = req.query.keyword as string | undefined;

      if (app || intent || keyword) {
        const result = await searchSkills({ app, intent, keyword });
        if (result.ok) {
          res.json({ ok: true, skills: result.skills, count: result.skills.length });
        } else {
          res.status(500).json({ ok: false, error: { code: result.code, message: result.message } });
        }
      } else {
        const result = await listSkills();
        if (result.ok) {
          res.json({ ok: true, skills: result.skills, count: result.skills.length });
        } else {
          res.status(500).json({ ok: false, error: { code: result.code, message: result.message } });
        }
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: String(e) } });
    }
  });

  // REST: Get skill by ID
  app.get("/skills/:skillId", async (req, res) => {
    try {
      const result = await getSkill(req.params.skillId);
      if (result.ok) {
        res.json({ ok: true, skill: result.skill });
      } else {
        const status = result.code === SKILL_NOT_FOUND ? 404 : 500;
        res.status(status).json({ ok: false, error: { code: result.code, message: result.message } });
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: String(e) } });
    }
  });

  // REST: Run skill (convenience)
  app.post("/skills/:skillId/run", async (req, res) => {
    try {
      const { deviceId, args } = req.body || {};
      const scriptArgs: string[] = [];
      if (deviceId && typeof deviceId === "string") scriptArgs.push(deviceId);
      if (Array.isArray(args)) scriptArgs.push(...args.map(String));

      const result = await runSkill(req.params.skillId, scriptArgs);
      if (result.ok) {
        res.json({
          ok: true,
          skillId: result.skillId,
          output: result.output,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
        });
      } else {
        res.status(400).json({
          ok: false,
          error: {
            code: result.code,
            message: result.message,
            skillId: result.skillId,
            exitCode: result.exitCode,
            stderr: result.stderr,
          },
        });
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

    const cleanup = () => {
      clawperatorEvents.off(CLAW_EVENT_TYPES.RESULT, onResult);
      clawperatorEvents.off(CLAW_EVENT_TYPES.EXECUTION, onExecution);
    };

    const onResult = (data: { deviceId: string; envelope: any }) => {
      try {
        if (!res.writableEnded) {
          res.write(`event: ${CLAW_EVENT_TYPES.RESULT}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (err) {
        console.error(`⚠️ SSE write failed: ${String(err)}`);
        cleanup();
      }
    };

    const onExecution = (data: { deviceId: string; input: unknown; result: any }) => {
      try {
        if (!res.writableEnded) {
          res.write(`event: ${CLAW_EVENT_TYPES.EXECUTION}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (err) {
        console.error(`⚠️ SSE execution write failed: ${String(err)}`);
        cleanup();
      }
    };

    clawperatorEvents.on(CLAW_EVENT_TYPES.RESULT, onResult);
    clawperatorEvents.on(CLAW_EVENT_TYPES.EXECUTION, onExecution);

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
      res.write(`event: heartbeat\n`);
      res.write(`data: ${JSON.stringify({ code: "CONNECTED", message: "Clawperator SSE stream active" })}\n\n`);
    } catch (err) {
      console.error(`⚠️ SSE heartbeat failed: ${String(err)}`);
      cleanup();
    }
  });

  // Error handler middleware (must be registered after all routes)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // JSON parse error
    if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
      res.status(400).json({ ok: false, error: { code: "INVALID_JSON", message: "Malformed JSON body" } });
      return;
    }
    // Payload too large
    if (err && (err.status === 413 || err.type === "entity.too.large")) {
      res.status(413).json({ ok: false, error: { code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: "Payload exceeds 100kb limit" } });
      return;
    }
    
    // Catch-all 500
    if (options.verbose) console.error(`[HTTP] Unhandled error: ${String(err)}`);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(options.port, options.host, () => {
      const addr = server.address();
      const actualPort = addr && typeof addr === "object" ? addr.port : options.port;
      console.log(`🚀 Clawperator API server listening on http://${options.host}:${actualPort}`);
      if (options.verbose) {
        console.log(`- GET  /devices`);
        console.log(`- POST /execute`);
        console.log(`- POST /observe/snapshot`);
        console.log(`- POST /observe/screenshot`);
        console.log(`- GET  /skills`);
        console.log(`- GET  /skills/:skillId`);
        console.log(`- POST /skills/:skillId/run`);
        console.log(`- GET  /events (SSE)`);
      }
      resolve(server);
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
}
