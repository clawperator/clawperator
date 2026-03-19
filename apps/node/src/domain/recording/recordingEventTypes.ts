/**
 * Type definitions for recording events and step log.
 * Aligns with the NDJSON schema and step log format from the Record feature PRD.
 */

// Header - first line of the NDJSON file
export interface RecordingHeader {
  type: "recording_header";
  schemaVersion: number;
  sessionId: string;
  startedAt: number; // epoch ms
  operatorPackage: string; // package that produced this recording
}

// Raw event types from Android NDJSON
export interface WindowChangeEvent {
  ts: number;
  seq: number;
  type: "window_change";
  packageName: string;
  className: string | null;
  title: string | null;
  snapshot?: string | null;
}

export interface ClickEvent {
  ts: number;
  seq: number;
  type: "click";
  packageName: string;
  resourceId: string | null;
  text: string | null;
  contentDesc: string | null;
  bounds: { left: number; top: number; right: number; bottom: number };
  snapshot?: string | null;
}

export interface ScrollEvent {
  ts: number;
  seq: number;
  type: "scroll";
  packageName: string;
  resourceId: string | null;
  scrollX: number;
  scrollY: number;
  maxScrollX: number;
  maxScrollY: number;
  snapshot?: string | null;
}

export interface PressKeyEvent {
  ts: number;
  seq: number;
  type: "press_key";
  key: "back";
  snapshot?: string | null;
}

export interface TextChangeEvent {
  ts: number;
  seq: number;
  type: "text_change";
  packageName: string;
  resourceId: string | null;
  text: string;
  snapshot?: string | null;
}

export type RawRecordingEvent =
  | WindowChangeEvent
  | ClickEvent
  | ScrollEvent
  | PressKeyEvent
  | TextChangeEvent;

// Step types emitted by the parser (v1)
export interface OpenAppStep {
  seq: number;
  type: "open_app";
  packageName: string;
  uiStateBefore: string | null;
}

export interface ClickStep {
  seq: number;
  type: "click";
  packageName: string;
  resourceId: string | null;
  text: string | null;
  contentDesc: string | null;
  bounds: { left: number; top: number; right: number; bottom: number };
  uiStateBefore: string | null;
}

export type RecordingStep = OpenAppStep | ClickStep;

// Step log output from record parse
export interface RecordingStepLog {
  sessionId: string;
  schemaVersion: number;
  steps: RecordingStep[];
  _warnings?: string[]; // present only when parser generated warnings; absent if clean
}
