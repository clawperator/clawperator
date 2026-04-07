import { describe, it } from "node:test";
import assert from "node:assert";
import { checkJavaVersion } from "../../../domain/doctor/checks/buildChecks.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";

describe("Doctor: buildChecks", () => {
    describe("checkJavaVersion", () => {
        it("returns pass when Java 17 is installed", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 0, stdout: "", stderr: 'openjdk version "17.0.9" 2023-10-17' });

            const result = await checkJavaVersion(config);

            assert.strictEqual(result.status, "pass");
            assert.strictEqual((result as any).summary, "Java 17+ is installed.");
            assert.strictEqual(runner.calls.length, 1);
            assert.strictEqual(runner.calls[0].command, "java");
            assert.deepStrictEqual(runner.calls[0].args, ["-version"]);
        });

        it("returns pass when Java 21 is installed", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 0, stdout: "", stderr: 'openjdk version "21.0.1" 2023-10-17' });

            const result = await checkJavaVersion(config);

            assert.strictEqual(result.status, "pass");
        });

        it("returns fail when Java 11 is installed", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 0, stdout: "", stderr: 'openjdk version "11.0.20" 2023-07-18' });

            const result = await checkJavaVersion(config);

            assert.strictEqual(result.status, "fail");
            assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
            assert.strictEqual((result as any).summary, "Java 17 or 21 is required for Android builds.");
        });

        it("returns fail when Java 22 is installed", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 0, stdout: "", stderr: 'openjdk version "22.0.1" 2024-04-16' });

            const result = await checkJavaVersion(config);

            assert.strictEqual(result.status, "fail");
            assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
        });

        it("returns fail when Java command is not found", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            // Simulates command not found - NodeProcessRunner resolves with code 127, empty output
            runner.queueResult({ code: 127, stdout: "", stderr: "" });

            const result = await checkJavaVersion(config);

            // With the current runner, code 127 with empty output hits the try path,
            // versionOutput is empty, matches no pattern, returns fail via HOST_DEPENDENCY_MISSING
            assert.strictEqual(result.status, "fail");
        });
    });
});
