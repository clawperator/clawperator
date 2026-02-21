import { describe, it } from "node:test";
import assert from "node:assert";
import { runHandshake } from "../../../domain/doctor/checks/readinessChecks.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../../contracts/errors.js";

describe("runHandshake", () => {
    const config = getDefaultRuntimeConfig({
        deviceId: "test-device",
        receiverPackage: "com.test.operator",
    });

    it("returns pass when envelope status is success", async () => {
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
        const mockWait = async () => ({
            ok: false as const,
            timeout: true as const,
            diagnostics: {
                code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
                message: "Timeout details",
                lastCorrelatedEvents: [],
                broadcastDispatchStatus: "sent",
            }
        });

        const result = await runHandshake(config, mockWait);
        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.RESULT_ENVELOPE_TIMEOUT);
    });

    it("returns fail on broadcast failure", async () => {
        const mockWait = async () => ({
            ok: false as const,
            broadcastFailed: true as const,
            diagnostics: {
                code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
                message: "Dispatch failed",
                lastCorrelatedEvents: [],
                broadcastDispatchStatus: "failed",
            }
        });

        const result = await runHandshake(config, mockWait);
        assert.strictEqual(result.status, "fail");
        assert.strictEqual(result.code, ERROR_CODES.RECEIVER_NOT_INSTALLED);
    });
});
