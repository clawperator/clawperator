import { SaxesParser } from "saxes";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ResultEnvelope } from "../../contracts/result.js";

export interface SnapshotPresentationOptions {
  compact?: boolean;
  maxNodes?: number;
  maxTextChars?: number;
  rawPath?: string;
  saveRaw?: boolean;
  maxChars?: number;
}

export interface CompactSnapshotNode {
  nodePath: string;
  parentPath: string | null;
  resourceId: string | null;
  className: string | null;
  text: string | null;
  contentDescription: string | null;
  bounds: string | null;
  textTruncated: boolean;
  contentDescriptionTruncated: boolean;
  checked: boolean | null;
  checkable: boolean | null;
  selected: boolean | null;
  enabled: boolean | null;
  clickable: boolean | null;
  scrollable: boolean | null;
  visibleToUser: boolean | null;
  accessibilityDataSensitive: boolean | null;
}

export function validateSnapshotPresentationOptions(options: SnapshotPresentationOptions): void {
  for (const [name, maximum] of [["maxNodes", 1000], ["maxTextChars", 4096]] as const) {
    const value = options[name];
    if (value !== undefined && (!options.compact || !Number.isInteger(value) || value < 1 || value > maximum)) {
      throw { code: "USAGE", message: `${name} requires compact and an integer from 1 to ${maximum}` };
    }
  }
  if (options.compact && options.maxChars !== undefined) {
    throw { code: "USAGE", message: "compact and maxChars cannot be combined" };
  }
  if (options.rawPath !== undefined && options.rawPath.trim().length === 0) {
    throw { code: "USAGE", message: "rawPath must be nonblank" };
  }
}

export function projectCompactSnapshot(xml: string, ids: Pick<ResultEnvelope, "commandId" | "taskId">, options: SnapshotPresentationOptions = {}) {
  validateSnapshotPresentationOptions({ ...options, compact: true });
  const maxNodes = options.maxNodes ?? 100;
  const maxTextChars = options.maxTextChars ?? 256;
  const nodes: CompactSnapshotNode[] = [];
  const stack: Array<{ path: string | null; children: number }> = [];
  let totalNodes = 0;
  let fieldTruncated = false;
  const parser = new SaxesParser({ xmlns: false });
  parser.on("doctype", () => { throw new Error("DTD declarations are prohibited"); });
  const rejectHierarchyText = (text: string) => {
    if (text.trim()) throw new Error("Unexpected hierarchy text");
  };
  parser.on("text", rejectHierarchyText);
  parser.on("cdata", rejectHierarchyText);
  parser.on("opentag", tag => {
    if (stack.length === 0) {
      if (tag.name !== "hierarchy") throw new Error("Expected hierarchy root");
      stack.push({ path: null, children: 0 });
      return;
    }
    if (tag.name !== "node") throw new Error("Expected hierarchy node");
    const parent = stack[stack.length - 1];
    const index = parent.children++;
    const nodePath = parent.path === null ? String(index) : `${parent.path}.${index}`;
    stack.push({ path: nodePath, children: 0 });
    totalNodes++;
    if (nodes.length >= maxNodes) return;
    const attrs = tag.attributes;
    const state = (key: string) => attrs[key] === "true" ? true : attrs[key] === "false" ? false : null;
    const field = (key: string) => {
      if (attrs[key] === undefined) return { value: null, truncated: false };
      const points = Array.from(attrs[key]);
      return { value: points.slice(0, maxTextChars).join(""), truncated: points.length > maxTextChars };
    };
    const text = field("text");
    const description = field("content-desc");
    fieldTruncated ||= text.truncated || description.truncated;
    nodes.push({
      nodePath, parentPath: parent.path,
      resourceId: attrs["resource-id"] ?? null, className: attrs.class ?? null,
      text: text.value, contentDescription: description.value, bounds: attrs.bounds ?? null,
      textTruncated: text.truncated, contentDescriptionTruncated: description.truncated,
      checked: state("checked"), checkable: state("checkable"), selected: state("selected"),
      enabled: state("enabled"), clickable: state("clickable"), scrollable: state("scrollable"),
      visibleToUser: state("visible-to-user"), accessibilityDataSensitive: state("accessibility-data-sensitive"),
    });
  });
  parser.on("closetag", () => { stack.pop(); });
  try { parser.write(xml).close(); }
  catch (error) {
    throw { code: "SNAPSHOT_EXTRACTION_FAILED", message: `Cannot project snapshot: ${String(error)}` };
  }
  return { schemaVersion: 1 as const, ...ids, totalNodes, returnedNodes: nodes.length,
    omittedNodes: totalNodes - nodes.length, truncated: fieldTruncated || totalNodes > nodes.length, nodes };
}

/** Format a copy; the canonical execution envelope and its verdict remain untouched. */
export async function presentSnapshot(envelope: ResultEnvelope, options: SnapshotPresentationOptions) {
  validateSnapshotPresentationOptions(options);
  const step = envelope.stepResults.find(item => item.actionType === "snapshot" && item.success && item.data.text !== undefined);
  let rawArtifactPath: string | undefined;
  try {
    if (!step) throw { code: "SNAPSHOT_EXTRACTION_FAILED", message: "Snapshot XML is unavailable" };
    if (options.rawPath !== undefined || options.saveRaw) {
      try {
        const destination = options.rawPath !== undefined ? resolve(options.rawPath)
          : join(await mkdtemp(join(tmpdir(), "clawperator-snapshot-")), "hierarchy.xml");
        await writeFile(destination, step.data.text, { encoding: "utf8", flag: "wx", mode: 0o600 });
        rawArtifactPath = destination;
      } catch {
        throw { code: "SNAPSHOT_ARTIFACT_WRITE_FAILED", message: "Could not exclusively write raw snapshot artifact" };
      }
    }
    if (!options.compact) return { envelope, ...(rawArtifactPath !== undefined ? { rawArtifactPath } : {}) };
    const compact = { ...projectCompactSnapshot(step.data.text, {
      commandId: envelope.commandId, taskId: envelope.taskId,
    }, options), ...(rawArtifactPath !== undefined ? { rawArtifactPath } : {}) };
    return {
      envelope: { ...envelope, stepResults: envelope.stepResults.map(item => {
        if (item.actionType !== "snapshot") return item;
        const { text: _text, ...data } = item.data;
        return { ...item, data };
      }) }, compact,
    };
  } catch (error) {
    throw { ...(error as object), envelope, ...(rawArtifactPath !== undefined ? { rawArtifactPath } : {}) };
  }
}
