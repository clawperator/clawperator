import { describe, it } from "node:test";
import assert from "node:assert";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import { checkAdbPresence, checkAdbServer, checkNodeVersion, checkOrchestratedSkillAgentCli } from "../../../domain/doctor/checks/hostChecks.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";

describe("Doctor: hostChecks", () => {
    function withNodeVersion(version: string, fn: () => Promise<void> | void): Promise<void> | void {
        const originalVersionDescriptor = Object.getOwnPropertyDescriptor(process, "version");
        Object.defineProperty(process, "version", {
            configurable: true,
            value: version,
        });

        const restore = () => {
            if (originalVersionDescriptor) {
                Object.defineProperty(process, "version", originalVersionDescriptor);
                return;
            }

            Reflect.deleteProperty(process as unknown as Record<string, unknown>, "version");
        };

        try {
            const result = fn();
            if (result && typeof (result as Promise<void>).then === "function") {
                return (result as Promise<void>).finally(restore);
            }
            restore();
            return result;
        } catch (error) {
            restore();
            throw error;
        }
    }

    describe("checkNodeVersion", () => {
        it("fails below the Node 24 floor and passes at the floor", async () => {
            await withNodeVersion("v23.11.0", async () => {
                const result = await checkNodeVersion();

                assert.strictEqual(result.status, "fail");
                assert.strictEqual(result.code, ERROR_CODES.NODE_TOO_OLD);
                assert.match((result as any).detail, /Node\.js v24 or newer/);
                assert.match((result as any).fix.steps[0].value, /nvm install 24/);
            });

            await withNodeVersion("v24.0.0", async () => {
                const result = await checkNodeVersion();

                assert.strictEqual(result.status, "pass");
                assert.strictEqual((result as any).summary, "Node version v24.0.0 is compatible.");
            });
        });
    });

    describe("checkAdbPresence", () => {
        it("returns ADB_NOT_FOUND when adb is missing", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueError(127, "ENOENT"); // simulate adb not found for adb version

            const result = await checkAdbPresence(config);

            assert.strictEqual(result.status, "fail");
            assert.strictEqual(result.code, ERROR_CODES.ADB_NOT_FOUND);
            assert.strictEqual(runner.calls.length, 1);
            assert.strictEqual(runner.calls[0].args[0], "version");
        });

        it("returns pass with version when adb is present", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" }); // for check
            runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" }); // for actual display

            const result = await checkAdbPresence(config);

            assert.strictEqual(result.status, "pass");
            assert.strictEqual((result as any).evidence.version, "Android Debug Bridge version 1.0.41");
        });
    });

    describe("checkAdbServer", () => {
        it("returns ADB_SERVER_FAILED when server fails to start", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 1, stdout: "", stderr: "cannot bind to port 5037" });

            const result = await checkAdbServer(config);

            assert.strictEqual(result.status, "fail");
            assert.strictEqual(result.code, ERROR_CODES.ADB_SERVER_FAILED);
            assert.strictEqual((result as any).detail, "cannot bind to port 5037");
        });

        it("returns pass when server starts successfully", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });

            runner.queueResult({ code: 0, stdout: "daemon started successfully", stderr: "" });

            const result = await checkAdbServer(config);

            assert.strictEqual(result.status, "pass");
        });
    });

    describe("checkOrchestratedSkillAgentCli", () => {
        it("returns a warning when the default orchestrated skill agent CLI is missing", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });
            const originalPath = process.env.PATH;

            try {
                process.env.PATH = "";
                const result = await checkOrchestratedSkillAgentCli(config);

                assert.strictEqual(result.status, "warn");
                assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
                assert.match(result.summary, /codex/);
                assert.deepStrictEqual(result.evidence, { configuredCli: "codex" });
            } finally {
                if (originalPath === undefined) {
                    delete process.env.PATH;
                } else {
                    process.env.PATH = originalPath;
                }
            }
        });

        it("respects CLAWPERATOR_SKILL_AGENT_CLI when set", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const original = process.env.CLAWPERATOR_SKILL_AGENT_CLI;
            const originalPath = process.env.PATH;
            const fakeDir = await mkdtemp(join(tmpdir(), "clawperator-agent-cli-"));
            const fakeAgentPath = join(fakeDir, "my-agent");
            await writeFile(fakeAgentPath, "#!/bin/sh\nexit 0\n", "utf8");
            await chmod(fakeAgentPath, 0o755);
            process.env.CLAWPERATOR_SKILL_AGENT_CLI = "my-agent";

            try {
                process.env.PATH = `${fakeDir}${delimiter}${originalPath ?? ""}`;
                const result = await checkOrchestratedSkillAgentCli(config);

                assert.strictEqual(result.status, "pass");
                assert.match(result.summary, /my-agent/);
                assert.deepStrictEqual(result.evidence, {
                    configuredCli: "my-agent",
                    resolvedPath: fakeAgentPath,
                });
            } finally {
                await rm(fakeDir, { recursive: true, force: true });
                if (original === undefined) {
                    delete process.env.CLAWPERATOR_SKILL_AGENT_CLI;
                } else {
                    process.env.CLAWPERATOR_SKILL_AGENT_CLI = original;
                }
                if (originalPath === undefined) {
                    delete process.env.PATH;
                } else {
                    process.env.PATH = originalPath;
                }
            }
        });

        it("warns when CLAWPERATOR_SKILL_AGENT_CLI contains shell syntax instead of a plain executable name", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const original = process.env.CLAWPERATOR_SKILL_AGENT_CLI;
            process.env.CLAWPERATOR_SKILL_AGENT_CLI = "codex; echo pwned";

            try {
                const result = await checkOrchestratedSkillAgentCli(config);

                assert.strictEqual(result.status, "warn");
                assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
                assert.match(result.summary, /not a plain executable name/);
                assert.deepStrictEqual(result.evidence, {
                    configuredCli: "codex; echo pwned",
                });
            } finally {
                if (original === undefined) {
                    delete process.env.CLAWPERATOR_SKILL_AGENT_CLI;
                } else {
                    process.env.CLAWPERATOR_SKILL_AGENT_CLI = original;
                }
            }
        });
    });
});
