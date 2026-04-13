import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  compareRecordingBaselineWithSkillResult,
  isMeaningfulCompareDivergence,
  loadRecordingExportBaselineFile,
  loadSkillResultFromSkillsRunFile,
  normalizeRecordingExportForCompare,
} from "../../domain/recording/compareRecording.js";
import type { SkillResult } from "../../contracts/skillResult.js";
import type { RecordingExportArtifact } from "../../domain/recording/recordingEventTypes.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixturesRoot = join(packageRoot, "src", "test", "fixtures", "recording-compare");
const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function readJsonFixture<T>(name: string): Promise<T> {
  const filePath = join(fixturesRoot, name);
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const cliPath = join(packageRoot, "dist", "cli", "index.js");
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: packageRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("recording compare normalization", () => {
  it("normalizes the canonical Solax baseline export into checkpoint compare input", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const expected = await readJsonFixture("solax-baseline-success.normalized.json");

    assert.deepStrictEqual(normalizeRecordingExportForCompare(baseline), expected);
  });

  it("normalizes the sanitized retained baseline identically to the canonical baseline", async () => {
    const canonical = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const sanitized = await readJsonFixture<RecordingExportArtifact>("solax-baseline-sanitized.export.json");
    const canonicalExpected = await readJsonFixture("solax-baseline-success.normalized.json");
    const sanitizedExpected = await readJsonFixture("solax-baseline-sanitized.normalized.json");

    assert.deepStrictEqual(normalizeRecordingExportForCompare(canonical), canonicalExpected);
    assert.deepStrictEqual(normalizeRecordingExportForCompare(sanitized), sanitizedExpected);
    assert.deepStrictEqual(sanitizedExpected, canonicalExpected);
  });
});

describe("recording compare outcomes", () => {
  it("reports literal match for a replay SkillResult that matches the baseline", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-replay-success.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.compareMode, "literal");
    assert.strictEqual(report.outcome, "literal_match");
    assert.strictEqual(report.pathMatches, true);
    assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), false);
  });

  it("reports semantic match for an agent-driven run whose checkpoints and outcome match", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-success.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.compareMode, "semantic");
    assert.strictEqual(report.outcome, "semantic_match");
    assert.strictEqual(report.pathMatches, true);
  });

  it("reports outcome_matches_path_differs when an agent-driven run reaches the goal through a different path", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-success-path-differs.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.compareMode, "semantic");
    assert.strictEqual(report.outcome, "outcome_matches_path_differs");
    assert.strictEqual(report.pathMatches, false);
    assert.strictEqual(report.firstDivergence?.baselineCheckpoint, "discharge_to_row_focused");
    assert.strictEqual(report.firstDivergence?.actualCheckpoint, "device_discharging_card_opened");
    assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), false);
  });

  it("reports baseline_drift when a replay-style run diverges from the normalized checkpoint path", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-baseline-drift.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.compareMode, "literal");
    assert.strictEqual(report.outcome, "baseline_drift");
    assert.strictEqual(report.firstDivergence?.baselineCheckpoint, "discharge_to_row_focused");
    assert.strictEqual(report.firstDivergence?.actualCheckpoint, "device_discharging_card_opened");
    assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), true);
  });

  it("reports verification_failed when checkpoints match but terminal verification fails", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-verification-failed.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.outcome, "verification_failed");
    assert.strictEqual(report.pathMatches, true);
    assert.strictEqual(report.terminalVerificationStatus, "failed");
  });

  it("reports verification_indeterminate when the run does not prove terminal verification", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-indeterminate.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.outcome, "verification_indeterminate");
    assert.strictEqual(report.pathMatches, true);
    assert.strictEqual(report.terminalVerificationStatus, "missing");
  });

  it("reports upstream_failure when the skill fails without an explicit runtime-state classification", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-upstream-failure.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.outcome, "upstream_failure");
    assert.strictEqual(report.firstDivergence?.baselineCheckpoint, "target_text_entered");
    assert.strictEqual(report.firstDivergence?.actualCheckpoint, "target_text_entered");
    assert.strictEqual(report.firstDivergence?.actualStatus, "failed");
  });

  it("reports runtime_poisoned when the SkillResult carries an explicit poisoned runtime state", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-runtime-poisoned.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.outcome, "runtime_poisoned");
  });

  it("reports runtime_unavailable when the SkillResult carries an explicit unavailable runtime state", async () => {
    const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-runtime-unavailable.skillresult.json");

    const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
    assert.strictEqual(report.outcome, "runtime_unavailable");
  });
});

describe("recording compare file loading", () => {
  it("loads a baseline export file and a saved skills run wrapper", async () => {
    const baseline = await loadRecordingExportBaselineFile(join(fixturesRoot, "solax-baseline-success.export.json"));
    const skillResult = await loadSkillResultFromSkillsRunFile(join(fixturesRoot, "solax-skills-run-success.json"));

    assert.strictEqual(baseline.session.sessionId, "solax-session-001");
    assert.strictEqual(skillResult.source.kind, "agent");
  });
});

describe("recording compare CLI", () => {
  it("returns exit code 0 for replay success", async () => {
    const { stdout, code, stderr } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
      "--result",
      join(fixturesRoot, "solax-skills-run-replay-success.json"),
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 0, stderr);
    const parsed = JSON.parse(stdout) as { outcome?: string; compareMode?: string };
    assert.strictEqual(parsed.outcome, "literal_match");
    assert.strictEqual(parsed.compareMode, "literal");
  });

  it("returns exit code 0 for semantic path-diff success when mode is auto-detected from the saved wrapper", async () => {
    const dir = await makeTempDir("clawperator-recording-compare-");
    const wrapperPath = join(dir, "solax-path-diff.skills-run.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-success-path-differs.skillresult.json");
    await writeFile(wrapperPath, JSON.stringify({
      status: "success",
      skillId: skillResult.skillId,
      output: "agent success with alternate path",
      exitCode: 0,
      durationMs: 1500,
      skillResult,
    }), "utf-8");

    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
      "--result",
      wrapperPath,
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { outcome?: string; compareMode?: string };
    assert.strictEqual(parsed.compareMode, "semantic");
    assert.strictEqual(parsed.outcome, "outcome_matches_path_differs");
  });

  it("returns exit code 1 for a meaningful divergence report", async () => {
    const dir = await makeTempDir("clawperator-recording-compare-");
    const wrapperPath = join(dir, "solax-verification-failed.skills-run.json");
    const skillResult = await readJsonFixture<SkillResult>("solax-result-verification-failed.skillresult.json");
    await writeFile(wrapperPath, JSON.stringify({
      status: "success",
      skillId: skillResult.skillId,
      output: "verification failed",
      exitCode: 0,
      durationMs: 1500,
      skillResult,
    }), "utf-8");

    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
      "--result",
      wrapperPath,
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { outcome?: string };
    assert.strictEqual(parsed.outcome, "verification_failed");
  });

  it("returns USAGE when --baseline is omitted", async () => {
    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--result",
      join(fixturesRoot, "solax-skills-run-success.json"),
    ]);

    assert.strictEqual(code, 0);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.match(parsed.message ?? "", /--baseline/);
  });

  it("returns USAGE when --result is omitted", async () => {
    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
    ]);

    assert.strictEqual(code, 0);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.match(parsed.message ?? "", /--result/);
  });

  it("returns USAGE when --baseline is missing its value", async () => {
    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      "--result",
      join(fixturesRoot, "solax-skills-run-success.json"),
    ]);

    assert.notStrictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /--baseline requires a value/);
  });

  it("returns USAGE when --mode has an invalid value", async () => {
    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
      "--result",
      join(fixturesRoot, "solax-skills-run-success.json"),
      "--mode",
      "bogus",
    ]);

    assert.notStrictEqual(code, 0);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.match(parsed.message ?? "", /auto, literal, semantic/);
  });

  it("returns a typed compare error when the baseline file does not exist", async () => {
    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      "/tmp/does-not-exist.export.json",
      "--result",
      join(fixturesRoot, "solax-skills-run-success.json"),
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "RECORDING_COMPARE_FAILED");
    assert.match(parsed.message ?? "", /Failed to read compare baseline file/);
  });

  it("returns a typed compare error for malformed baseline JSON", async () => {
    const dir = await makeTempDir("clawperator-recording-compare-");
    const baselinePath = join(dir, "bad-baseline.json");
    await writeFile(baselinePath, "{not json}\n", "utf-8");

    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      baselinePath,
      "--result",
      join(fixturesRoot, "solax-skills-run-success.json"),
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "RECORDING_COMPARE_FAILED");
    assert.match(parsed.message ?? "", /not a valid recording export artifact/);
  });

  it("returns a typed compare error for malformed result JSON", async () => {
    const dir = await makeTempDir("clawperator-recording-compare-");
    const resultPath = join(dir, "bad-result.json");
    await writeFile(resultPath, "{not json}\n", "utf-8");

    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
      "--result",
      resultPath,
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "RECORDING_COMPARE_FAILED");
    assert.match(parsed.message ?? "", /must be valid JSON/);
  });

  it("returns a typed compare error when the saved wrapper does not include skillResult", async () => {
    const { stdout, code } = await runCli([
      "recording",
      "compare",
      "--baseline",
      join(fixturesRoot, "solax-baseline-success.export.json"),
      "--result",
      join(fixturesRoot, "solax-skills-run-malformed-wrapper.json"),
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "RECORDING_COMPARE_FAILED");
    assert.match(parsed.message ?? "", /missing the top-level skillResult field/);
  });
});
