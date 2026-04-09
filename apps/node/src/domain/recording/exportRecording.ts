import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { ERROR_CODES } from "../../contracts/errors.js";
import {
  RECORDING_EXPORT_VERSION,
  type RawRecordingEvent,
  type RecordingExportArtifact,
  type RecordingExportCounts,
  type RecordingExportEvent,
  type RecordingExportPackageTransition,
  type RecordingExportSnapshot,
  type RecordingExportSnapshotMode,
  type RecordingExportTimeline,
} from "./recordingEventTypes.js";
import { validateRecordingNdjson } from "./recordingValidation.js";

export async function exportRecordingFile(
  inputFile: string,
  outputFile?: string,
  snapshotMode: RecordingExportSnapshotMode = "omit",
): Promise<{ outputFile: string; exportData: RecordingExportArtifact }> {
  const resolvedInputFile = await resolveRecordingInputFile(inputFile);
  const content = await readRecordingInputFile(resolvedInputFile);
  const exportData = exportRecording(content, snapshotMode);
  const resolvedOutputFile = outputFile ?? getDefaultRecordingExportPath(resolvedInputFile);

  try {
    await fs.mkdir(dirname(resolvedOutputFile), { recursive: true });
    await fs.writeFile(resolvedOutputFile, JSON.stringify(exportData, null, 2), "utf-8");
  } catch (error) {
    throw {
      code: ERROR_CODES.RECORDING_EXPORT_FAILED,
      message: `Failed to write recording export to ${resolvedOutputFile}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return { outputFile: resolvedOutputFile, exportData };
}

async function resolveRecordingInputFile(inputFile: string): Promise<string> {
  let stats;
  try {
    stats = await fs.stat(inputFile);
  } catch (error) {
    throw buildRecordingExportIoError("inspect", inputFile, error);
  }
  if (!stats.isDirectory()) {
    return inputFile;
  }

  let entries;
  try {
    entries = await fs.readdir(inputFile, { withFileTypes: true });
  } catch (error) {
    throw buildRecordingExportIoError("read", inputFile, error);
  }
  const candidates = await Promise.all(
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".ndjson"))
      .map(async entry => {
        const fullPath = join(inputFile, entry.name);
        let entryStats;
        try {
          entryStats = await fs.stat(fullPath);
        } catch (error) {
          throw buildRecordingExportIoError("inspect", fullPath, error);
        }
        return {
          path: fullPath,
          mtimeMs: entryStats.mtimeMs,
          name: entry.name,
        };
      })
  );

  if (candidates.length === 0) {
    throw {
      code: ERROR_CODES.RECORDING_EXPORT_FAILED,
      message: `No NDJSON recording files were found in directory ${inputFile}`,
    };
  }

  candidates.sort((a, b) => {
    if (a.mtimeMs !== b.mtimeMs) {
      return b.mtimeMs - a.mtimeMs;
    }
    return a.name.localeCompare(b.name);
  });

  return candidates[0]!.path;
}

async function readRecordingInputFile(inputFile: string): Promise<string> {
  try {
    return await fs.readFile(inputFile, "utf-8");
  } catch (error) {
    throw buildRecordingExportIoError("read", inputFile, error);
  }
}

function buildRecordingExportIoError(
  operation: "inspect" | "read",
  targetPath: string,
  error: unknown,
): { code: string; message: string } {
  return {
    code: ERROR_CODES.RECORDING_EXPORT_FAILED,
    message: `Failed to ${operation} recording export input ${targetPath}: ${error instanceof Error ? error.message : String(error)}`,
  };
}

export function exportRecording(
  ndjson: string,
  snapshotMode: RecordingExportSnapshotMode = "omit",
): RecordingExportArtifact {
  const { header, events } = validateRecordingNdjson(ndjson);

  return {
    exportVersion: RECORDING_EXPORT_VERSION,
    session: {
      sessionId: header.sessionId,
      schemaVersion: header.schemaVersion,
      startedAt: header.startedAt,
      operatorPackage: header.operatorPackage,
    },
    snapshotMode,
    events: events.map((event, index) => buildExportEvent(event, snapshotMode, events[index - 1])),
    counts: buildCounts(events),
    packageTransitions: buildPackageTransitions(events),
    timeline: buildTimeline(events),
  };
}

export function getDefaultRecordingExportPath(inputFile: string): string {
  return inputFile.endsWith(".ndjson")
    ? `${inputFile.slice(0, -".ndjson".length)}.export.json`
    : `${inputFile}.export.json`;
}

export function parseRecordingExportArtifactJson(json: string): RecordingExportArtifact {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("recording context must be valid JSON");
  }

  if (!isRecordingExportArtifact(parsed)) {
    throw new Error("recording context must match the recording export artifact schema");
  }

  return parsed;
}

function buildExportEvent(
  event: RawRecordingEvent,
  snapshotMode: RecordingExportSnapshotMode,
  previousEvent?: RawRecordingEvent,
): RecordingExportEvent {
  const base = {
    seq: event.seq,
    ts: event.ts,
    deltaMsSincePrevious: previousEvent ? event.ts - previousEvent.ts : null,
  };

  switch (event.type) {
    case "window_change":
      return {
        ...base,
        type: event.type,
        packageName: event.packageName,
        className: event.className,
        title: event.title,
        snapshot: buildSnapshot(event.snapshot, snapshotMode),
      };
    case "click":
      return {
        ...base,
        type: event.type,
        packageName: event.packageName,
        resourceId: event.resourceId,
        text: event.text,
        contentDesc: event.contentDesc,
        bounds: event.bounds,
        snapshot: buildSnapshot(event.snapshot, snapshotMode),
      };
    case "scroll":
      return {
        ...base,
        type: event.type,
        packageName: event.packageName,
        resourceId: event.resourceId,
        scrollX: event.scrollX,
        scrollY: event.scrollY,
        maxScrollX: event.maxScrollX,
        maxScrollY: event.maxScrollY,
        snapshot: buildSnapshot(event.snapshot, snapshotMode),
      };
    case "press_key":
      return {
        ...base,
        type: event.type,
        key: event.key,
        snapshot: buildSnapshot(event.snapshot, snapshotMode),
      };
    case "text_change":
      return {
        ...base,
        type: event.type,
        packageName: event.packageName,
        resourceId: event.resourceId,
        text: event.text,
        snapshot: buildSnapshot(event.snapshot, snapshotMode),
      };
  }
}

function buildSnapshot(
  rawSnapshot: string | null | undefined,
  snapshotMode: RecordingExportSnapshotMode,
): RecordingExportSnapshot {
  const present = typeof rawSnapshot === "string" && rawSnapshot.length > 0;
  return {
    present,
    xml: snapshotMode === "include" && present ? rawSnapshot : null,
  };
}

function buildCounts(events: RawRecordingEvent[]): RecordingExportCounts {
  const byType: Record<string, number> = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;
  }

  return {
    totalEvents: events.length,
    byType,
  };
}

function buildTimeline(events: RawRecordingEvent[]): RecordingExportTimeline {
  if (events.length === 0) {
    return {
      firstEventTs: null,
      lastEventTs: null,
      durationMs: null,
    };
  }

  const firstEventTs = events[0].ts;
  const lastEventTs = events[events.length - 1].ts;
  return {
    firstEventTs,
    lastEventTs,
    durationMs: lastEventTs - firstEventTs,
  };
}

function buildPackageTransitions(events: RawRecordingEvent[]): RecordingExportPackageTransition[] {
  const transitions: RecordingExportPackageTransition[] = [];
  let previousPackageName: string | undefined;

  for (const event of events) {
    const packageName = getEventPackageName(event);
    if (packageName === undefined) {
      continue;
    }

    if (previousPackageName !== undefined && packageName !== previousPackageName) {
      transitions.push({
        seq: event.seq,
        ts: event.ts,
        fromPackageName: previousPackageName,
        toPackageName: packageName,
      });
    }

    previousPackageName = packageName;
  }

  return transitions;
}

function getEventPackageName(event: RawRecordingEvent): string | undefined {
  switch (event.type) {
    case "window_change":
    case "click":
    case "scroll":
    case "text_change":
      return event.packageName;
    case "press_key":
      return undefined;
  }
}

function isRecordingExportArtifact(value: unknown): value is RecordingExportArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (value.exportVersion !== RECORDING_EXPORT_VERSION) {
    return false;
  }

  if (!isRecordingExportSession(value.session)) {
    return false;
  }

  if (value.snapshotMode !== "omit" && value.snapshotMode !== "include") {
    return false;
  }

  if (!Array.isArray(value.events) || !value.events.every(isRecordingExportEvent)) {
    return false;
  }

  if (!isRecordingExportCounts(value.counts)) {
    return false;
  }

  if (!Array.isArray(value.packageTransitions) || !value.packageTransitions.every(isRecordingExportPackageTransition)) {
    return false;
  }

  return isRecordingExportTimeline(value.timeline);
}

function isRecordingExportSession(value: unknown): boolean {
  return isRecord(value)
    && typeof value.sessionId === "string"
    && typeof value.schemaVersion === "number"
    && typeof value.startedAt === "number"
    && typeof value.operatorPackage === "string";
}

function isRecordingExportCounts(value: unknown): boolean {
  return isRecord(value)
    && typeof value.totalEvents === "number"
    && isRecord(value.byType)
    && Object.values(value.byType).every(count => typeof count === "number");
}

function isRecordingExportPackageTransition(value: unknown): boolean {
  return isRecord(value)
    && typeof value.seq === "number"
    && typeof value.ts === "number"
    && typeof value.fromPackageName === "string"
    && typeof value.toPackageName === "string";
}

function isRecordingExportTimeline(value: unknown): boolean {
  return isRecord(value)
    && isNullableNumber(value.firstEventTs)
    && isNullableNumber(value.lastEventTs)
    && isNullableNumber(value.durationMs);
}

function isRecordingExportEvent(value: unknown): boolean {
  if (!isRecord(value) || typeof value.seq !== "number" || typeof value.ts !== "number") {
    return false;
  }

  if (!(value.deltaMsSincePrevious === null || typeof value.deltaMsSincePrevious === "number")) {
    return false;
  }

  if (!isRecordingExportSnapshot(value.snapshot)) {
    return false;
  }

  switch (value.type) {
    case "window_change":
      return typeof value.packageName === "string"
        && isNullableString(value.className)
        && isNullableString(value.title);
    case "click":
      return typeof value.packageName === "string"
        && isNullableString(value.resourceId)
        && isNullableString(value.text)
        && isNullableString(value.contentDesc)
        && isBounds(value.bounds);
    case "scroll":
      return typeof value.packageName === "string"
        && isNullableString(value.resourceId)
        && typeof value.scrollX === "number"
        && typeof value.scrollY === "number"
        && typeof value.maxScrollX === "number"
        && typeof value.maxScrollY === "number";
    case "press_key":
      return value.key === "back";
    case "text_change":
      return typeof value.packageName === "string"
        && isNullableString(value.resourceId)
        && typeof value.text === "string";
    default:
      return false;
  }
}

function isRecordingExportSnapshot(value: unknown): boolean {
  return isRecord(value)
    && typeof value.present === "boolean"
    && isNullableString(value.xml);
}

function isBounds(value: unknown): boolean {
  return isRecord(value)
    && typeof value.left === "number"
    && typeof value.top === "number"
    && typeof value.right === "number"
    && typeof value.bottom === "number";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
