import * as fs from "node:fs/promises";
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
  const content = await fs.readFile(inputFile, "utf-8");
  const exportData = exportRecording(content, snapshotMode);
  const resolvedOutputFile = outputFile ?? getDefaultRecordingExportPath(inputFile);

  try {
    await fs.writeFile(resolvedOutputFile, JSON.stringify(exportData, null, 2), "utf-8");
  } catch (error) {
    throw {
      code: ERROR_CODES.RECORDING_EXPORT_FAILED,
      message: `Failed to write recording export to ${resolvedOutputFile}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return { outputFile: resolvedOutputFile, exportData };
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
