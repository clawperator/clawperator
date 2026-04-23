import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { cmdInstall } from "../../cli/commands/install.js";
import type { OperatorRemediateResult } from "../../cli/commands/operatorRemediate.js";
import type { HostSetupResult } from "../../domain/host/hostSetup.js";

function makeOperatorRemediationResult(
  overrides: Partial<OperatorRemediateResult> = {},
): OperatorRemediateResult {
  return {
    ok: true,
    operatorPackage: "com.clawperator.operator",
    summary: {
      totalDevices: 1,
      connectedDevices: 1,
      ready: 1,
      warn: 0,
      remediated: 0,
      adbUnready: 0,
      failed: 0,
    },
    devices: [
      {
        deviceId: "serial-solo",
        adbState: "device",
        status: "ready",
        needsSetup: false,
        initialCriticalOk: true,
        finalCriticalOk: true,
        downloadAttempted: false,
        setupAttempted: false,
        doctorFixAttempted: false,
        message: "Device is ready.",
      },
    ],
    message: "All connected devices are ready.",
    ...overrides,
  };
}

function makeHostSetupResult(overrides: Partial<HostSetupResult> = {}): HostSetupResult {
  return {
    ok: true,
    status: "ok",
    message: "Host setup complete.",
    artifacts: [],
    summary: {
      written: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    ...overrides,
  };
}

describe("cmdInstall", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it("threads single-device remediation state into host setup and returns success", async () => {
    const setupHostCalls: Array<Record<string, unknown>> = [];

    const output = await cmdInstall(
      { format: "json", operatorPackage: "com.clawperator.operator" },
      {
        runOperatorRemediateImpl: async () => makeOperatorRemediationResult(),
        syncSkillsImpl: async () => ({
          ok: true,
          synced: true,
          skillsDir: "/tmp/skills",
          registryPath: "/tmp/skills/skills/skills-registry.json",
          message: "Skills synced to /tmp/skills (ref: main)",
        }),
        copyBundledSkillsImpl: async () => ({
          ok: true,
          skills: ["clawperator-agent-orientation"],
          installedDir: "/tmp/bundled-skills",
          agentDiscoveryDirs: [{ label: "codex", dir: "/tmp/codex/skills" }],
        }),
        setupHostImpl: async (options) => {
          setupHostCalls.push(options as unknown as Record<string, unknown>);
          return makeHostSetupResult();
        },
      },
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.status, "ok");
    assert.strictEqual(parsed.lastDeviceSerial, "serial-solo");
    assert.strictEqual(parsed.deviceSelectionRequired, false);
    assert.strictEqual(parsed.steps.skillsInstall.registryPath, "/tmp/skills/skills/skills-registry.json");
    assert.strictEqual(parsed.steps.hostSetup.status, "ok");
    assert.strictEqual(process.exitCode, undefined);
    assert.strictEqual(setupHostCalls.length, 1);
    assert.strictEqual(setupHostCalls[0].registryPath, "/tmp/skills/skills/skills-registry.json");
    assert.strictEqual(setupHostCalls[0].lastDeviceSerial, "serial-solo");
    assert.strictEqual(setupHostCalls[0].operatorPackage, "com.clawperator.operator");
    assert.strictEqual(setupHostCalls[0].cliVersion, null);
  });

  it("returns a warning when multiple connected devices require explicit selection", async () => {
    const output = await cmdInstall(
      { format: "pretty", operatorPackage: "com.clawperator.operator.dev" },
      {
        runOperatorRemediateImpl: async () => makeOperatorRemediationResult({
          operatorPackage: "com.clawperator.operator.dev",
          summary: {
            totalDevices: 2,
            connectedDevices: 2,
            ready: 2,
            warn: 0,
            remediated: 0,
            adbUnready: 0,
            failed: 0,
          },
          devices: [
            {
              deviceId: "serial-alpha",
              adbState: "device",
              status: "ready",
              needsSetup: false,
              initialCriticalOk: true,
              finalCriticalOk: true,
              downloadAttempted: false,
              setupAttempted: false,
              doctorFixAttempted: false,
              message: "Device is ready.",
            },
            {
              deviceId: "serial-beta",
              adbState: "device",
              status: "ready",
              needsSetup: false,
              initialCriticalOk: true,
              finalCriticalOk: true,
              downloadAttempted: false,
              setupAttempted: false,
              doctorFixAttempted: false,
              message: "Device is ready.",
            },
          ],
        }),
        syncSkillsImpl: async () => ({
          ok: true,
          synced: true,
          skillsDir: "/tmp/skills",
          registryPath: "/tmp/skills/skills/skills-registry.json",
          message: "Skills synced to /tmp/skills (ref: main)",
        }),
        copyBundledSkillsImpl: async () => ({
          ok: true,
          skills: ["clawperator-agent-orientation"],
          installedDir: "/tmp/bundled-skills",
          agentDiscoveryDirs: [{ label: "codex", dir: "/tmp/codex/skills" }],
        }),
        setupHostImpl: async () => makeHostSetupResult(),
      },
    );

    assert.match(output, /Clawperator install: WARN/);
    assert.match(output, /Future commands must target one device explicitly with --device\./);
    assert.match(output, /serial-alpha - ready: Device is ready\./);
    assert.strictEqual(process.exitCode, undefined);
  });

  it("fails when no connected Android devices are available even if host setup succeeds", async () => {
    const output = await cmdInstall(
      { format: "json" },
      {
        runOperatorRemediateImpl: async () => makeOperatorRemediationResult({
          summary: {
            totalDevices: 0,
            connectedDevices: 0,
            ready: 0,
            warn: 0,
            remediated: 0,
            adbUnready: 0,
            failed: 0,
          },
          devices: [],
          message: "No connected Android devices found.",
        }),
        syncSkillsImpl: async () => ({
          ok: true,
          synced: true,
          skillsDir: "/tmp/skills",
          registryPath: "/tmp/skills/skills/skills-registry.json",
          message: "Skills synced to /tmp/skills (ref: main)",
        }),
        copyBundledSkillsImpl: async () => ({
          ok: true,
          skills: ["clawperator-agent-orientation"],
          installedDir: "/tmp/bundled-skills",
          agentDiscoveryDirs: [{ label: "codex", dir: "/tmp/codex/skills" }],
        }),
        setupHostImpl: async () => makeHostSetupResult(),
      },
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.status, "failed");
    assert.match(parsed.message, /no connected Android devices were found/i);
    assert.strictEqual(process.exitCode, 1);
  });

  it("fails when connected-device remediation still reports failures", async () => {
    const output = await cmdInstall(
      { format: "json" },
      {
        runOperatorRemediateImpl: async () => makeOperatorRemediationResult({
          ok: false,
          summary: {
            totalDevices: 2,
            connectedDevices: 2,
            ready: 0,
            warn: 0,
            remediated: 1,
            adbUnready: 0,
            failed: 1,
          },
          devices: [
            {
              deviceId: "serial-alpha",
              adbState: "device",
              status: "remediated",
              needsSetup: true,
              initialCriticalOk: false,
              finalCriticalOk: true,
              downloadAttempted: true,
              setupAttempted: true,
              doctorFixAttempted: false,
              message: "Device was remediated and is now ready.",
            },
            {
              deviceId: "serial-beta",
              adbState: "device",
              status: "failed",
              needsSetup: true,
              initialCriticalOk: false,
              finalCriticalOk: false,
              downloadAttempted: true,
              setupAttempted: true,
              doctorFixAttempted: false,
              message: "Critical checks still failing: readiness.version.compatibility",
            },
          ],
          message: "Remediation still required for 1 device.",
        }),
        syncSkillsImpl: async () => ({
          ok: true,
          synced: true,
          skillsDir: "/tmp/skills",
          registryPath: "/tmp/skills/skills/skills-registry.json",
          message: "Skills synced to /tmp/skills (ref: main)",
        }),
        copyBundledSkillsImpl: async () => ({
          ok: true,
          skills: ["clawperator-agent-orientation"],
          installedDir: "/tmp/bundled-skills",
          agentDiscoveryDirs: [{ label: "codex", dir: "/tmp/codex/skills" }],
        }),
        setupHostImpl: async () => makeHostSetupResult(),
      },
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.status, "failed");
    assert.match(parsed.message, /still need remediation/i);
    assert.strictEqual(process.exitCode, 1);
  });

  it("keeps shared-agent-bridge host warnings non-fatal at the install level", async () => {
    const output = await cmdInstall(
      { format: "json" },
      {
        runOperatorRemediateImpl: async () => makeOperatorRemediationResult(),
        syncSkillsImpl: async () => ({
          ok: true,
          synced: true,
          skillsDir: "/tmp/skills",
          registryPath: "/tmp/skills/skills/skills-registry.json",
          message: "Skills synced to /tmp/skills (ref: main)",
        }),
        copyBundledSkillsImpl: async () => ({
          ok: true,
          skills: ["clawperator-agent-orientation"],
          installedDir: "/tmp/bundled-skills",
          agentDiscoveryDirs: [{ label: "codex", dir: "/tmp/codex/skills" }],
        }),
        setupHostImpl: async () => makeHostSetupResult({
          status: "warn",
          message: "Host setup completed with a shared-agent bridge warning; continuing.",
        }),
      },
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.status, "warn");
    assert.strictEqual(parsed.steps.hostSetup.status, "warn");
    assert.match(parsed.message, /shared-agent bridge warning/i);
    assert.strictEqual(process.exitCode, undefined);
  });

  it("treats skills and bundled-skills failures as warnings while preserving a usable install", async () => {
    const output = await cmdInstall(
      { format: "json" },
      {
        runOperatorRemediateImpl: async () => makeOperatorRemediationResult(),
        syncSkillsImpl: async () => ({
          ok: false,
          code: "SKILLS_SYNC_FAILED",
          message: "Skills sync failed: auth required",
        }),
        copyBundledSkillsImpl: async () => ({
          ok: false,
          code: "BUNDLED_SKILLS_COPY_FAILED",
          message: "Bundled-skills copy failed: permission denied",
        }),
        setupHostImpl: async () => makeHostSetupResult(),
      },
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.status, "warn");
    assert.strictEqual(parsed.steps.skillsInstall.ok, false);
    assert.strictEqual(parsed.steps.skillsInstall.status, "warn");
    assert.strictEqual(parsed.steps.bundledSkillsInstall.ok, false);
    assert.strictEqual(parsed.steps.bundledSkillsInstall.status, "warn");
    assert.match(parsed.message, /runtime skills install needs attention/i);
    assert.match(parsed.message, /bundled-skills install needs attention/i);
    assert.strictEqual(process.exitCode, undefined);
  });
});
