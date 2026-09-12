import { z } from "zod";
import type { Logger } from "../../adapters/logger.js";
import { captureEvidence, validateEvidenceCaptureOptions, type EvidenceCaptureDependencies } from "../../domain/evidence/capture.js";
import { buildMcpErrorResult } from "../errors.js";
import { createSessionDefaults, type SessionDefaults } from "../session.js";
import { buildCommonExecutionSchema, buildValidationResult, executionToolOptionsSchema, mergeWithSessionDefaults, parseToolArguments } from "./common.js";
import type { McpToolDefinition } from "./index.js";

const captureSchema = executionToolOptionsSchema.extend({
  label: z.string().max(2048).optional(), context: z.record(z.unknown()).optional(),
}).strict();
export function getEvidenceMcpTools(logger?: Logger, session: SessionDefaults = createSessionDefaults(), dependencies?: EvidenceCaptureDependencies): McpToolDefinition[] {
  return [{
    name: "evidence_capture",
    description: "Capture a local screenshot and raw hierarchy bundle with correlated metadata and explicit partial failures.",
    inputSchema: buildCommonExecutionSchema({ label: { type: "string", maxLength: 2048 }, context: { type: "object" } }),
    handler: async args => {
      const options = mergeWithSessionDefaults(parseToolArguments(captureSchema, args), session);
      try { validateEvidenceCaptureOptions(options); }
      catch (error) { return buildValidationResult((error as { message: string }).message); }
      try {
        const result = await captureEvidence({ ...options, logger }, dependencies);
        // Only this domain-created manifest path is exposed, never caller paths or capture contents.
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: { ...result }, ...(result.ok ? {} : { isError: true }) };
      } catch (error) { return buildMcpErrorResult(error); }
    },
  }];
}
