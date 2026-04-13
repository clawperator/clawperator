import { readFile } from "node:fs/promises";
import { ERROR_CODES } from "../../contracts/errors.js";
import {
  skillResultSchema,
  validateSupportedSkillResultContractVersion,
  type SkillCheckpointStatus,
  type SkillResult,
  type SkillTerminalVerification,
} from "../../contracts/skillResult.js";
import {
  parseRecordingExportArtifactJson,
} from "./exportRecording.js";
import type {
  RecordingExportArtifact,
  RecordingExportClickEvent,
  RecordingExportEvent,
  RecordingExportTextChangeEvent,
  RecordingExportWindowChangeEvent,
} from "./recordingEventTypes.js";

export type RecordingCompareMode = "literal" | "semantic";
export type RecordingCompareModeInput = RecordingCompareMode | "auto";

export type RecordingCompareOutcome =
  | "literal_match"
  | "semantic_match"
  | "outcome_matches_path_differs"
  | "baseline_drift"
  | "verification_failed"
  | "verification_indeterminate"
  | "upstream_failure"
  | "runtime_poisoned"
  | "runtime_unavailable"
  | "normalization_insufficient"
  | "baseline_uncovered"
  | "baseline_weakly_covered";

export interface NormalizedRecordingCheckpoint {
  id: string;
  expectedStatus: "ok";
  sourceEventSeq: number;
  eventType: RecordingExportEvent["type"];
  summary: string;
}

export interface NormalizedRecordingBaseline {
  appPackage: string | null;
  checkpoints: NormalizedRecordingCheckpoint[];
}

export interface RecordingCompareFirstDivergence {
  index: number;
  baselineCheckpoint: string | null;
  actualCheckpoint: string | null;
  baselineStatus: "ok" | null;
  actualStatus: SkillCheckpointStatus | null;
  baselineSummary?: string;
  actualNote?: string;
}

export interface RecordingCompareReport {
  compareMode: RecordingCompareMode;
  outcome: RecordingCompareOutcome;
  summary: string;
  pathMatches: boolean;
  terminalVerificationStatus: SkillTerminalVerification["status"] | "missing";
  baseline: {
    appPackage: string | null;
    checkpointIds: string[];
  };
  actual: {
    skillId: string;
    sourceKind: SkillResult["source"]["kind"];
    status: SkillResult["status"];
    runtimeState: SkillResult["diagnostics"] extends { runtimeState?: infer T } ? T : string | undefined;
    checkpointIds: string[];
  };
  baselineCoverage: {
    declared: number;
    covered: number;
  };
  normalizationStrategy: "solax_heuristic";
  minimumSemanticCoverage: number;
  firstDivergence?: RecordingCompareFirstDivergence;
}

interface ComparableActualCheckpoint {
  id: string;
  status: SkillCheckpointStatus;
  note?: string;
}

const TERMINAL_CHECKPOINT_IDS = new Set(["terminal_state_verified"]);
const SOLAX_PRIMARY_PACKAGE = "com.solaxcloud.starter";
const SOLAX_BASELINE_CHECKPOINT_ORDER = [
  "app_opened",
  "discharge_to_row_focused",
  "target_text_entered",
  "save_completed",
] as const;
const SOLAX_MINIMUM_SEMANTIC_COVERAGE = 2;

function lowerCaseStrings(values: Array<string | null | undefined>): string[] {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.toLowerCase());
}

function eventStrings(event: RecordingExportEvent): string[] {
  switch (event.type) {
    case "window_change":
      return lowerCaseStrings([event.packageName, event.className, event.title, event.snapshot.xml ?? undefined]);
    case "click":
      return lowerCaseStrings([
        event.packageName,
        event.resourceId,
        event.text,
        event.contentDesc,
        event.snapshot.xml ?? undefined,
      ]);
    case "text_change":
      return lowerCaseStrings([event.packageName, event.resourceId, event.text, event.snapshot.xml ?? undefined]);
    case "scroll":
      return lowerCaseStrings([event.packageName, event.resourceId, event.snapshot.xml ?? undefined]);
    case "press_key":
      return lowerCaseStrings([event.key, event.snapshot.xml ?? undefined]);
  }
}

function determinePrimaryPackage(artifact: RecordingExportArtifact): string | null {
  const counts = new Map<string, number>();
  for (const event of artifact.events) {
    if (!("packageName" in event) || typeof event.packageName !== "string" || event.packageName.length === 0) {
      continue;
    }
    counts.set(event.packageName, (counts.get(event.packageName) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = -1;
  for (const [packageName, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = packageName;
      winnerCount = count;
    }
  }
  return winner;
}

function summarizeWindowChange(event: RecordingExportWindowChangeEvent): string {
  return `window_change:${event.packageName}`;
}

function summarizeClick(event: RecordingExportClickEvent): string {
  if (typeof event.text === "string" && event.text.trim().length > 0) {
    return `click:${event.packageName}:${event.text.trim().toLowerCase()}`;
  }
  if (typeof event.contentDesc === "string" && event.contentDesc.trim().length > 0) {
    return `click:${event.packageName}:${event.contentDesc.trim().toLowerCase()}`;
  }
  if (typeof event.resourceId === "string" && event.resourceId.trim().length > 0) {
    return `click:${event.packageName}:${event.resourceId.trim().toLowerCase()}`;
  }
  return `click:${event.packageName}:seq-${event.seq}`;
}

function summarizeTextChange(event: RecordingExportTextChangeEvent): string {
  if (typeof event.resourceId === "string" && event.resourceId.trim().length > 0) {
    return `text_change:${event.packageName}:${event.resourceId.trim().toLowerCase()}`;
  }
  return `text_change:${event.packageName}:seq-${event.seq}`;
}

function summarizeEvent(event: RecordingExportEvent): string {
  switch (event.type) {
    case "window_change":
      return summarizeWindowChange(event);
    case "click":
      return summarizeClick(event);
    case "text_change":
      return summarizeTextChange(event);
    case "scroll":
      return `scroll:${event.packageName}:${event.resourceId ?? "unknown"}`;
    case "press_key":
      return `press_key:${event.key}`;
  }
}

function includesAny(haystack: string[], needles: string[]): boolean {
  return needles.some((needle) => haystack.some((value) => value.includes(needle)));
}

function firstMatchingEvent(
  artifact: RecordingExportArtifact,
  predicate: (event: RecordingExportEvent) => boolean
): RecordingExportEvent | undefined {
  return artifact.events.find(predicate);
}

function lastMatchingEvent(
  artifact: RecordingExportArtifact,
  predicate: (event: RecordingExportEvent) => boolean
): RecordingExportEvent | undefined {
  for (let index = artifact.events.length - 1; index >= 0; index -= 1) {
    const event = artifact.events[index];
    if (event && predicate(event)) {
      return event;
    }
  }
  return undefined;
}

function asNormalizedCheckpoint(id: string, event: RecordingExportEvent): NormalizedRecordingCheckpoint {
  return {
    id,
    expectedStatus: "ok",
    sourceEventSeq: event.seq,
    eventType: event.type,
    summary: summarizeEvent(event),
  };
}

export function normalizeRecordingExportForCompare(
  artifact: RecordingExportArtifact
): NormalizedRecordingBaseline {
  const appPackage = determinePrimaryPackage(artifact);
  if (appPackage !== SOLAX_PRIMARY_PACKAGE) {
    return {
      appPackage,
      checkpoints: [],
    };
  }
  const inPrimaryPackage = (event: RecordingExportEvent): boolean =>
    appPackage === null || !("packageName" in event) || event.packageName === appPackage;

  const appOpenedEvent = firstMatchingEvent(
    artifact,
    (event): event is RecordingExportWindowChangeEvent => event.type === "window_change" && inPrimaryPackage(event)
  );
  const dischargeRowEvent = firstMatchingEvent(
    artifact,
    (event): event is RecordingExportClickEvent =>
      event.type === "click"
      && inPrimaryPackage(event)
      && includesAny(eventStrings(event), ["discharge to", "discharge_row", "discharge"])
  );
  const textEnteredEvent = lastMatchingEvent(
    artifact,
    (event): event is RecordingExportTextChangeEvent =>
      event.type === "text_change"
      && inPrimaryPackage(event)
      && typeof event.text === "string"
      && event.text.trim().length > 0
  );
  const saveEvent = lastMatchingEvent(
    artifact,
    (event): event is RecordingExportClickEvent =>
      event.type === "click"
      && inPrimaryPackage(event)
      && includesAny(eventStrings(event), ["save"])
  ) ?? lastMatchingEvent(
    artifact,
    (event): event is RecordingExportClickEvent =>
      event.type === "click"
      && inPrimaryPackage(event)
      && includesAny(eventStrings(event), ["confirm"])
  );

  const eventMap = new Map<string, RecordingExportEvent>();
  if (appOpenedEvent) {
    eventMap.set("app_opened", appOpenedEvent);
  }
  if (dischargeRowEvent) {
    eventMap.set("discharge_to_row_focused", dischargeRowEvent);
  }
  if (textEnteredEvent) {
    eventMap.set("target_text_entered", textEnteredEvent);
  }
  if (saveEvent) {
    eventMap.set("save_completed", saveEvent);
  }

  return {
    appPackage,
    checkpoints: SOLAX_BASELINE_CHECKPOINT_ORDER
      .map((id) => {
        const event = eventMap.get(id);
        return event ? asNormalizedCheckpoint(id, event) : null;
      })
      .filter((checkpoint): checkpoint is NormalizedRecordingCheckpoint => checkpoint !== null),
  };
}

function comparableActualCheckpoints(skillResult: SkillResult): ComparableActualCheckpoint[] {
  return skillResult.checkpoints
    .filter((checkpoint) => !TERMINAL_CHECKPOINT_IDS.has(checkpoint.id))
    .map((checkpoint) => ({
      id: checkpoint.id,
      status: checkpoint.status,
      note: checkpoint.note,
    }));
}

function computeBaselineCoverage(
  baseline: NormalizedRecordingBaseline,
  actualCheckpoints: ComparableActualCheckpoint[]
): { declared: number; covered: number } {
  const actualIds = new Set(actualCheckpoints.map((checkpoint) => checkpoint.id));
  const declared = baseline.checkpoints.length;
  const covered = baseline.checkpoints.filter((checkpoint) => actualIds.has(checkpoint.id)).length;
  return { declared, covered };
}

function findFirstDivergence(
  baseline: NormalizedRecordingBaseline,
  actualCheckpoints: ComparableActualCheckpoint[],
  actualStatus: SkillResult["status"]
): RecordingCompareFirstDivergence | undefined {
  const maxLength = Math.max(baseline.checkpoints.length, actualCheckpoints.length);
  for (let index = 0; index < maxLength; index += 1) {
    const baselineCheckpoint = baseline.checkpoints[index];
    const actualCheckpoint = actualCheckpoints[index];

    if (!baselineCheckpoint && actualCheckpoint) {
      return {
        index,
        baselineCheckpoint: "unexpected_extra_checkpoint",
        actualCheckpoint: actualCheckpoint.id,
        baselineStatus: null,
        actualStatus: actualCheckpoint.status,
        actualNote: actualCheckpoint.note,
      };
    }

    if (baselineCheckpoint && !actualCheckpoint) {
      return {
        index,
        baselineCheckpoint: baselineCheckpoint.id,
        actualCheckpoint: actualStatus === "failed"
          ? "failed_before_expected_checkpoint"
          : "missing_expected_checkpoint",
        baselineStatus: baselineCheckpoint.expectedStatus,
        actualStatus: null,
        baselineSummary: baselineCheckpoint.summary,
      };
    }

    if (
      baselineCheckpoint
      && actualCheckpoint
      && (baselineCheckpoint.id !== actualCheckpoint.id || actualCheckpoint.status !== baselineCheckpoint.expectedStatus)
    ) {
      return {
        index,
        baselineCheckpoint: baselineCheckpoint.id,
        actualCheckpoint: actualCheckpoint.id,
        baselineStatus: baselineCheckpoint.expectedStatus,
        actualStatus: actualCheckpoint.status,
        baselineSummary: baselineCheckpoint.summary,
        actualNote: actualCheckpoint.note,
      };
    }
  }

  return undefined;
}

function terminalVerificationStatus(skillResult: SkillResult): SkillTerminalVerification["status"] | "missing" {
  return skillResult.terminalVerification?.status ?? "missing";
}

function inferredCompareMode(skillResult: SkillResult, requestedMode: RecordingCompareModeInput): RecordingCompareMode {
  if (requestedMode !== "auto") {
    return requestedMode;
  }
  return skillResult.source.kind === "agent" ? "semantic" : "literal";
}

function summarizeOutcome(
  outcome: RecordingCompareOutcome,
  firstDivergence: RecordingCompareFirstDivergence | undefined
): string {
  switch (outcome) {
    case "literal_match":
      return "checkpoint sequence matched the recording baseline and terminal verification was proved";
    case "semantic_match":
      return "agent-driven run matched the baseline checkpoints and terminal verification was proved";
    case "outcome_matches_path_differs":
      return "terminal verification matched even though the runtime path differed from the recording baseline";
    case "verification_failed":
      return "checkpoint sequence matched the recording baseline but terminal verification did not match the requested outcome";
    case "verification_indeterminate":
      return "the skill run did not prove its declared terminal verification";
    case "runtime_poisoned":
      return "the skill reported a poisoned runtime state before compare could confirm baseline equivalence";
    case "runtime_unavailable":
      return "the skill reported an unavailable runtime state before compare could confirm baseline equivalence";
    case "upstream_failure":
      return "the skill failed before compare could confirm baseline equivalence";
    case "normalization_insufficient":
      return "baseline normalization could not extract the required checkpoint set from this recording export";
    case "baseline_uncovered":
      return "terminal verification passed but no baseline checkpoints appeared in the actual run";
    case "baseline_weakly_covered":
      return "terminal verification passed but baseline coverage was too weak to treat compare as trustworthy";
    case "baseline_drift":
      if (firstDivergence) {
        return `first meaningful divergence at baseline checkpoint ${firstDivergence.baselineCheckpoint ?? "<none>"}`;
      }
      return "the skill diverged from the recording baseline";
  }
}

function determineOutcome(options: {
  compareMode: RecordingCompareMode;
  pathMatches: boolean;
  skillResult: SkillResult;
  baselineCoverage: {
    declared: number;
    covered: number;
  };
}): RecordingCompareOutcome {
  const {
    compareMode,
    pathMatches,
    skillResult,
    baselineCoverage,
  } = options;
  const runtimeState = skillResult.diagnostics?.runtimeState;
  const verificationStatus = terminalVerificationStatus(skillResult);

  if (skillResult.status === "failed") {
    if (runtimeState === "poisoned") {
      return "runtime_poisoned";
    }
    if (runtimeState === "unavailable") {
      return "runtime_unavailable";
    }
    return "upstream_failure";
  }

  if (verificationStatus === "verified") {
    if (compareMode === "literal") {
      return pathMatches ? "literal_match" : "baseline_drift";
    }
    if (pathMatches) {
      return "semantic_match";
    }
    if (baselineCoverage.declared > 0 && baselineCoverage.covered === 0) {
      return "baseline_uncovered";
    }
    if (baselineCoverage.covered < SOLAX_MINIMUM_SEMANTIC_COVERAGE) {
      return "baseline_weakly_covered";
    }
    return "outcome_matches_path_differs";
  }

  if (verificationStatus === "failed") {
    return pathMatches ? "verification_failed" : "baseline_drift";
  }

  return pathMatches ? "verification_indeterminate" : "baseline_drift";
}

export function isMeaningfulCompareDivergence(outcome: RecordingCompareOutcome): boolean {
  return !["literal_match", "semantic_match", "outcome_matches_path_differs"].includes(outcome);
}

export function compareRecordingBaselineWithSkillResult(
  artifact: RecordingExportArtifact,
  skillResult: SkillResult,
  options: { mode?: RecordingCompareModeInput } = {}
): RecordingCompareReport {
  const baseline = normalizeRecordingExportForCompare(artifact);
  if (baseline.checkpoints.length < SOLAX_BASELINE_CHECKPOINT_ORDER.length) {
    const actualCps = comparableActualCheckpoints(skillResult);
    const coverage = computeBaselineCoverage(baseline, actualCps);
    const mode = inferredCompareMode(skillResult, options.mode ?? "auto");
    return {
      compareMode: mode,
      outcome: "normalization_insufficient",
      summary: summarizeOutcome("normalization_insufficient", undefined),
      pathMatches: false,
      terminalVerificationStatus: terminalVerificationStatus(skillResult),
      baseline: {
        appPackage: baseline.appPackage,
        checkpointIds: baseline.checkpoints.map((checkpoint) => checkpoint.id),
      },
      actual: {
        skillId: skillResult.skillId,
        sourceKind: skillResult.source.kind,
        status: skillResult.status,
        runtimeState: skillResult.diagnostics?.runtimeState,
        checkpointIds: actualCps.map((checkpoint) => checkpoint.id),
      },
      baselineCoverage: coverage,
      normalizationStrategy: "solax_heuristic",
      minimumSemanticCoverage: SOLAX_MINIMUM_SEMANTIC_COVERAGE,
    };
  }
  const actualCheckpoints = comparableActualCheckpoints(skillResult);
  const baselineCoverage = computeBaselineCoverage(baseline, actualCheckpoints);
  const compareMode = inferredCompareMode(skillResult, options.mode ?? "auto");
  const firstDivergence = findFirstDivergence(baseline, actualCheckpoints, skillResult.status);
  const pathMatches = firstDivergence === undefined;
  const outcome = determineOutcome({
    compareMode,
    pathMatches,
    skillResult,
    baselineCoverage,
  });

  return {
    compareMode,
    outcome,
    summary: summarizeOutcome(outcome, firstDivergence),
    pathMatches,
    terminalVerificationStatus: terminalVerificationStatus(skillResult),
    baseline: {
      appPackage: baseline.appPackage,
      checkpointIds: baseline.checkpoints.map((checkpoint) => checkpoint.id),
    },
    actual: {
      skillId: skillResult.skillId,
      sourceKind: skillResult.source.kind,
      status: skillResult.status,
      runtimeState: skillResult.diagnostics?.runtimeState,
      checkpointIds: actualCheckpoints.map((checkpoint) => checkpoint.id),
    },
    baselineCoverage,
    normalizationStrategy: "solax_heuristic",
    minimumSemanticCoverage: SOLAX_MINIMUM_SEMANTIC_COVERAGE,
    ...(firstDivergence ? { firstDivergence } : {}),
  };
}

export async function loadRecordingExportBaselineFile(path: string): Promise<RecordingExportArtifact> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (error) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Failed to read compare baseline file ${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    return parseRecordingExportArtifactJson(raw);
  } catch (error) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare baseline file ${path} is not a valid recording export artifact: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function loadSkillResultFromSkillsRunFile(path: string): Promise<SkillResult> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (error) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Failed to read compare result file ${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare result file ${path} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare result file ${path} must be a saved skills run JSON object`,
    };
  }

  if (!("skillResult" in parsed)) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare result file ${path} is missing the top-level skillResult field`,
    };
  }

  const candidate = (parsed as { skillResult?: unknown }).skillResult;
  if (candidate === null || candidate === undefined) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare result file ${path} did not include a parsed skillResult`,
    };
  }

  const result = skillResultSchema.safeParse(candidate);
  if (!result.success) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare result file ${path} contained an invalid skillResult: ${result.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")}`,
    };
  }

  const contractVersionValidation = validateSupportedSkillResultContractVersion(result.data.contractVersion);
  if (!contractVersionValidation.ok) {
    throw {
      code: ERROR_CODES.RECORDING_COMPARE_FAILED,
      message: `Compare result file ${path} contained an unsupported skillResult contractVersion: ${contractVersionValidation.message}`,
    };
  }

  return result.data;
}
