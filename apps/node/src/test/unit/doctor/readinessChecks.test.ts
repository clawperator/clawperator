import { describe, it } from "node:test";
import assert from "node:assert";
import { checkApkPresence, checkDeviceInteractiveState, runHandshake } from "../../../domain/doctor/checks/readinessChecks.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";

describe("checkApkPresence", () => {
    it("fails when the requested package is missing", async () => {
        const runner = new FakeProcessRunner();
        const config = getDefaultRuntimeConfig({
            runner,
            deviceId: "test-device",
            operatorPackage: "com.test.operator",
        });

        runner.queueResult({ code: 0, stdout: "", stderr: "" });
        runner.queueResult({ code: 0, stdout: "", stderr: "" });

        const result = await checkApkPresence(config);

        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.OPERATOR_NOT_INSTALLED);
        assert.match(result.detail ?? "", /Package com\.test\.operator was not found/);
        assert.strictEqual(result.fix?.docsUrl, "https://docs.clawperator.com/setup/");
    });

    it("fails when package queries cannot run", async () => {
        const runner = new FakeProcessRunner();
        const config = getDefaultRuntimeConfig({
            runner,
            deviceId: "test-device",
            operatorPackage: "com.test.operator",
        });

        runner.queueResult({ code: 1, stdout: "", stderr: "cmd: Can't find service: package", error: new Error("shell failed") });

        const result = await checkApkPresence(config);

        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.DEVICE_SHELL_UNAVAILABLE);
        assert.match(result.detail ?? "", /Can't find service: package/);
    });
});

describe("runHandshake", () => {
    function createConfig(runner = new FakeProcessRunner()) {
        return {
            config: getDefaultRuntimeConfig({
                runner,
                deviceId: "test-device",
                operatorPackage: "com.test.operator",
            }),
            runner,
        };
    }

    it("returns pass when envelope status is success", async () => {
        const { config, runner } = createConfig();
        runner.queueResult({ code: 0, stdout: "", stderr: "" });

        const mockWait = async () => ({
            ok: true as const,
            envelope: { status: "success" as const, commandId: "test-cmd", taskId: "test-task", stepResults: [] },
            terminalSource: "clawperator_result" as const,
        });

        const result = await runHandshake(config, mockWait);
        assert.strictEqual(result.status, "pass");
        assert.strictEqual(result.id, "readiness.handshake");
    });

    it("returns fail when envelope status is error", async () => {
        const { config, runner } = createConfig();
        runner.queueResult({ code: 0, stdout: "", stderr: "" });

        const mockWait = async () => ({
            ok: true as const,
            envelope: { status: "failed" as const, commandId: "test-cmd", taskId: "test-task", stepResults: [], error: "Boom" },
            terminalSource: "clawperator_result" as const,
        });

        const result = await runHandshake(config, mockWait);
        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.DEVICE_ACCESSIBILITY_NOT_RUNNING);
        assert.match(result.detail!, /Boom/);
    });

    it("returns fail on timeout", async () => {
        const { config, runner } = createConfig();
        runner.queueResult({ code: 0, stdout: "", stderr: "" });

        const mockWait = async () => ({
            ok: false as const,
            timeout: true as const,
            diagnostics: {
                code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
                message: "Timeout details",
                lastCorrelatedEvents: [],
                broadcastDispatchStatus: "sent",
                deviceId: "test-device",
                operatorPackage: "com.test.operator",
            }
        });

        const result = await runHandshake(config, mockWait);
        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.RESULT_ENVELOPE_TIMEOUT);
        assert.match(result.detail ?? "", /Broadcast dispatch: sent/);
        assert.match(result.detail ?? "", /Operator package: com\.test\.operator/);
        assert.match(result.detail ?? "", /APK\/CLI version mismatch/);
        assert.ok(result.fix?.steps.some(step => step.kind === "shell" && step.value.includes("clawperator snapshot")));
    });

    it("returns fail on broadcast failure", async () => {
        const { config, runner } = createConfig();
        runner.queueResult({ code: 0, stdout: "", stderr: "" });

        const mockWait = async () => ({
            ok: false as const,
            broadcastFailed: true as const,
            diagnostics: {
                code: ERROR_CODES.OPERATOR_NOT_INSTALLED,
                message: "Dispatch failed",
                lastCorrelatedEvents: [],
                broadcastDispatchStatus: "failed",
            }
        });

        const result = await runHandshake(config, mockWait);
        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.OPERATOR_NOT_INSTALLED);
    });
});

describe("checkDeviceInteractiveState", () => {
    const config = getDefaultRuntimeConfig({
        runner: new FakeProcessRunner(),
        deviceId: "test-device",
        operatorPackage: "com.test.operator",
    });

    it("passes when the foundation probe reports an interactive device", async () => {
        const result = await checkDeviceInteractiveState(
            config,
            async () => ({
                ok: true as const,
                state: {
                    screenOn: true,
                    interactive: true,
                    deviceLocked: false,
                    userUnlocked: true,
                },
            })
        );

        assert.strictEqual(result.status, "pass");
        assert.strictEqual(result.id, "readiness.device.interactive");
        assert.deepStrictEqual(result.evidence, {
            deviceLocked: false,
            screenOn: true,
            userUnlocked: true,
        });
    });

    it("fails with DEVICE_NOT_INTERACTIVE and evidence when the device is not interactive", async () => {
        const result = await checkDeviceInteractiveState(
            config,
            async () => ({
                ok: true as const,
                state: {
                    screenOn: false,
                    interactive: false,
                    deviceLocked: true,
                    userUnlocked: false,
                },
            })
        );

        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.DEVICE_NOT_INTERACTIVE);
        assert.match(result.detail ?? "", /screenOn=false/);
        assert.strictEqual(result.fix?.title, "Recover interactive device state");
        assert.strictEqual(result.deviceGuidance?.screen, "Lock screen / current screen");
        assert.deepStrictEqual(result.evidence, {
            deviceLocked: true,
            screenOn: false,
            userUnlocked: false,
        });
    });

    it("fails when the screen is on but the device is still locked", async () => {
        const result = await checkDeviceInteractiveState(
            config,
            async () => ({
                ok: true as const,
                state: {
                    screenOn: true,
                    interactive: true,
                    deviceLocked: true,
                    userUnlocked: true,
                },
            })
        );

        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.DEVICE_NOT_INTERACTIVE);
        assert.match(result.detail ?? "", /deviceLocked=true/);
        assert.strictEqual(result.fix?.docsUrl, "https://docs.clawperator.com/api/devices/");
    });

    it("fails closed when the foundation probe cannot verify state", async () => {
        const result = await checkDeviceInteractiveState(
            config,
            async () => ({
                ok: false as const,
                code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
                message: "doctor_ping returned an invalid boolean for screen_on: missing",
            })
        );

        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.RESULT_ENVELOPE_MALFORMED);
        assert.strictEqual(result.summary, "Could not verify whether the device is interactive.");
    });
});
