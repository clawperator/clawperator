import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkAdbPresence,
  checkAdbServer,
  checkNodeVersion,
  checkDefaultOrchestratedSkillAgentCli,
  checkInstalledOrchestratedSkillAgentCliAvailability,
  checkAuthoringSkillsStaleness,
} from "../../../domain/doctor/checks/hostChecks.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";
import { getCliVersion } from "../../../domain/version/compatibility.js";

describe("Doctor: hostChecks", () => {
    const tempRoots: string[] = [];

    afterEach(async () => {
        await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
    });

    async function makeTempRoot(prefix: string): Promise<string> {
        const root = await mkdtemp(join(tmpdir(), prefix));
        tempRoots.push(root);
        return root;
    }

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

    describe("checkDefaultOrchestratedSkillAgentCli", () => {
        it("returns a warning when the default orchestrated skill agent CLI is missing", async () => {
            const runner = new FakeProcessRunner();
            const config = getDefaultRuntimeConfig({ runner });
            const originalPath = process.env.PATH;

            try {
                process.env.PATH = "";
                const result = await checkDefaultOrchestratedSkillAgentCli(config);

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
                const result = await checkDefaultOrchestratedSkillAgentCli(config);

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

        it("accepts .js agent launchers on PATH using the same resolution rules as runtime", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const original = process.env.CLAWPERATOR_SKILL_AGENT_CLI;
            const originalPath = process.env.PATH;
            const fakeDir = await mkdtemp(join(tmpdir(), "clawperator-agent-cli-js-"));
            const fakeAgentPath = join(fakeDir, "my-agent.js");
            await writeFile(fakeAgentPath, "console.log('ok');\n", "utf8");
            process.env.CLAWPERATOR_SKILL_AGENT_CLI = "my-agent.js";

            try {
                process.env.PATH = `${fakeDir}${delimiter}${originalPath ?? ""}`;
                const result = await checkDefaultOrchestratedSkillAgentCli(config);

                assert.strictEqual(result.status, "pass");
                assert.match(result.summary, /my-agent\.js/);
                assert.deepStrictEqual(result.evidence, {
                    configuredCli: "my-agent.js",
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
                const result = await checkDefaultOrchestratedSkillAgentCli(config);

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

    describe("checkInstalledOrchestratedSkillAgentCliAvailability", () => {
        it("passes when the local registry has no orchestrated skills", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-skills-none-"));
            const registryPath = join(root, "skills", "skills-registry.json");

            try {
                await mkdir(join(root, "skills"), { recursive: true });
                await writeFile(
                    registryPath,
                    JSON.stringify({
                        schemaVersion: "1.0",
                        generatedAt: "2026-04-13T00:00:00Z",
                        skills: [],
                    }),
                    "utf8"
                );
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "pass");
                assert.match(result.summary, /No orchestrated skills/i);
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });

        it("passes when installed orchestrated skills resolve via cliPath", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-skills-ok-"));
            const skillId = "com.test.doctor-agent-cli-path";
            const skillDir = join(root, "skills", skillId);
            const scriptsDir = join(skillDir, "scripts");
            const registryPath = join(root, "skills", "skills-registry.json");

            try {
                await mkdir(scriptsDir, { recursive: true });
                const launcherPath = join(scriptsDir, "fake-agent");
                await writeFile(join(skillDir, "SKILL.md"), `# ${skillId}\n`, "utf8");
                await writeFile(join(scriptsDir, "main.js"), "console.log('ok');\n", "utf8");
                await writeFile(launcherPath, "#!/bin/sh\nexit 0\n", "utf8");
                await chmod(launcherPath, 0o755);
                await writeFile(
                    join(skillDir, "skill.json"),
                    JSON.stringify({
                        id: skillId,
                        applicationId: "com.test",
                        intent: "doctor-agent-cli-path",
                        summary: "Doctor test skill",
                        path: `skills/${skillId}`,
                        skillFile: `skills/${skillId}/SKILL.md`,
                        scripts: [`skills/${skillId}/scripts/run.js`],
                        artifacts: [],
                        agent: {
                            cli: "codex",
                            cliPath: "scripts/fake-agent",
                        },
                    }),
                    "utf8"
                );
                await writeFile(
                    registryPath,
                    JSON.stringify({
                        schemaVersion: "1.0",
                        generatedAt: "2026-04-13T00:00:00Z",
                        skills: [{
                            id: skillId,
                            applicationId: "com.test",
                            intent: "doctor-agent-cli-path",
                            summary: "Doctor test skill",
                            path: `skills/${skillId}`,
                            skillFile: `skills/${skillId}/SKILL.md`,
                            scripts: [`skills/${skillId}/scripts/main.js`],
                            artifacts: [],
                        }],
                    }),
                    "utf8"
                );
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "pass");
                assert.match(result.summary, /resolved their configured agent CLI/i);
                assert.deepStrictEqual(result.evidence, { checkedSkills: 1 });
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });

        it("passes when installed orchestrated skills use backslash-separated skill paths with cliPath", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-skills-win-path-"));
            const skillId = "com.test.doctor-agent-win-path";
            const skillDir = join(root, "skills", skillId);
            const scriptsDir = join(skillDir, "scripts");
            const registryPath = join(root, "skills", "skills-registry.json");

            try {
                await mkdir(scriptsDir, { recursive: true });
                const launcherPath = join(scriptsDir, "fake-agent");
                await writeFile(join(skillDir, "SKILL.md"), `# ${skillId}\n`, "utf8");
                await writeFile(join(scriptsDir, "main.js"), "console.log('ok');\n", "utf8");
                await writeFile(launcherPath, "#!/bin/sh\nexit 0\n", "utf8");
                await chmod(launcherPath, 0o755);
                await writeFile(
                    join(skillDir, "skill.json"),
                    JSON.stringify({
                        id: skillId,
                        applicationId: "com.test",
                        intent: "doctor-agent-win-path",
                        summary: "Doctor test skill",
                        path: `skills\\${skillId}`,
                        skillFile: `skills\\${skillId}\\SKILL.md`,
                        scripts: [`skills\\${skillId}\\scripts\\run.js`],
                        artifacts: [],
                        agent: {
                            cli: "codex",
                            cliPath: "scripts/fake-agent",
                        },
                    }),
                    "utf8"
                );
                await writeFile(
                    registryPath,
                    JSON.stringify({
                        schemaVersion: "1.0",
                        generatedAt: "2026-04-13T00:00:00Z",
                        skills: [{
                            id: skillId,
                            applicationId: "com.test",
                            intent: "doctor-agent-win-path",
                            summary: "Doctor test skill",
                            path: `skills\\${skillId}`,
                            skillFile: `skills\\${skillId}\\SKILL.md`,
                            scripts: [`skills\\${skillId}\\scripts\\run.js`],
                            artifacts: [],
                        }],
                    }),
                    "utf8"
                );
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "pass");
                assert.match(result.summary, /resolved their configured agent CLI/i);
                assert.deepStrictEqual(result.evidence, { checkedSkills: 1 });
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });

        it("warns when an installed orchestrated skill has an unresolved cliPath", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-skills-missing-cli-"));
            const skillId = "com.test.doctor-missing-cli-path";
            const skillDir = join(root, "skills", skillId);
            const scriptsDir = join(skillDir, "scripts");
            const registryPath = join(root, "skills", "skills-registry.json");

            try {
                await mkdir(scriptsDir, { recursive: true });
                await writeFile(join(skillDir, "SKILL.md"), `# ${skillId}\n`, "utf8");
                await writeFile(join(scriptsDir, "main.js"), "console.log('ok');\n", "utf8");
                await writeFile(
                    join(skillDir, "skill.json"),
                    JSON.stringify({
                        id: skillId,
                        applicationId: "com.test",
                        intent: "doctor-missing-cli-path",
                        summary: "Doctor missing cliPath skill",
                        path: `skills/${skillId}`,
                        skillFile: `skills/${skillId}/SKILL.md`,
                        scripts: [`skills/${skillId}/scripts/run.js`],
                        artifacts: [],
                        agent: {
                            cli: "codex",
                            cliPath: "scripts/does-not-exist",
                        },
                    }),
                    "utf8"
                );
                await writeFile(
                    registryPath,
                    JSON.stringify({
                        schemaVersion: "1.0",
                        generatedAt: "2026-04-13T00:00:00Z",
                        skills: [{
                            id: skillId,
                            applicationId: "com.test",
                            intent: "doctor-missing-cli-path",
                            summary: "Doctor missing cliPath skill",
                            path: `skills/${skillId}`,
                            skillFile: `skills/${skillId}/SKILL.md`,
                            scripts: [`skills/${skillId}/scripts/main.js`],
                            artifacts: [],
                        }],
                    }),
                    "utf8"
                );
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "warn");
                assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
                assert.match(result.summary, /unresolved agent CLI dependencies/i);
                assert.ok(result.detail?.includes(skillId));
                assert.deepStrictEqual(result.evidence, {
                    checkedSkills: 1,
                    unreadableSkills: [],
                    failingSkills: [skillId],
                });
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });

        it("warns when installed skill metadata is unreadable", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-skills-bad-manifest-"));
            const skillId = "com.test.doctor-bad-manifest";
            const skillDir = join(root, "skills", skillId);
            const scriptsDir = join(skillDir, "scripts");
            const registryPath = join(root, "skills", "skills-registry.json");

            try {
                await mkdir(scriptsDir, { recursive: true });
                await writeFile(join(skillDir, "SKILL.md"), `# ${skillId}\n`, "utf8");
                await writeFile(join(scriptsDir, "run.js"), "console.log('ok');\n", "utf8");
                await writeFile(join(skillDir, "skill.json"), "{not-json", "utf8");
                await writeFile(
                    registryPath,
                    JSON.stringify({
                        schemaVersion: "1.0",
                        generatedAt: "2026-04-13T00:00:00Z",
                        skills: [{
                            id: skillId,
                            applicationId: "com.test",
                            intent: "doctor-bad-manifest",
                            summary: "Doctor bad manifest skill",
                            path: `skills/${skillId}`,
                            skillFile: `skills/${skillId}/SKILL.md`,
                            scripts: [`skills/${skillId}/scripts/run.js`],
                            artifacts: [],
                        }],
                    }),
                    "utf8"
                );
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "warn");
                assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
                assert.match(result.summary, /could not be inspected because their skill metadata is unreadable/i);
                assert.ok(result.detail?.includes(skillId));
                assert.deepStrictEqual(result.evidence, {
                    checkedSkills: 0,
                    unreadableSkills: [skillId],
                    failingSkills: [skillId],
                });
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });

        it("ignores unreadable non-orchestrated skill metadata for the orchestrated agent readiness check", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-skills-bad-non-agent-"));
            const skillId = "com.test.doctor-bad-non-agent";
            const skillDir = join(root, "skills", skillId);
            const scriptsDir = join(skillDir, "scripts");
            const registryPath = join(root, "skills", "skills-registry.json");

            try {
                await mkdir(scriptsDir, { recursive: true });
                await writeFile(join(skillDir, "SKILL.md"), `# ${skillId}\n`, "utf8");
                await writeFile(join(scriptsDir, "main.js"), "console.log('ok');\n", "utf8");
                await writeFile(join(skillDir, "skill.json"), "{not-json", "utf8");
                await writeFile(
                    registryPath,
                    JSON.stringify({
                        schemaVersion: "1.0",
                        generatedAt: "2026-04-13T00:00:00Z",
                        skills: [{
                            id: skillId,
                            applicationId: "com.test",
                            intent: "doctor-bad-non-agent",
                            summary: "Doctor bad non-agent skill",
                            path: `skills/${skillId}`,
                            skillFile: `skills/${skillId}/SKILL.md`,
                            scripts: [`skills/${skillId}/scripts/main.js`],
                            artifacts: [],
                        }],
                    }),
                    "utf8"
                );
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "pass");
                assert.match(result.summary, /No orchestrated skills/i);
                assert.deepStrictEqual(result.evidence, {
                    checkedSkills: 0,
                });
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });

        it("warns when the configured skills registry is unreadable", async () => {
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            const originalRegistry = process.env.CLAWPERATOR_SKILLS_REGISTRY;
            const root = await mkdtemp(join(tmpdir(), "clawperator-doctor-bad-registry-"));
            const registryPath = join(root, "skills-registry.json");

            try {
                await writeFile(registryPath, "{not-json", "utf8");
                process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;

                const result = await checkInstalledOrchestratedSkillAgentCliAvailability(config);
                assert.strictEqual(result.status, "warn");
                assert.strictEqual(result.code, ERROR_CODES.HOST_DEPENDENCY_MISSING);
                assert.match(result.summary, /could not inspect the local skills registry/i);
                assert.match(result.detail ?? "", /Unexpected token|JSON/i);
            } finally {
                await rm(root, { recursive: true, force: true });
                if (originalRegistry === undefined) {
                    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
                } else {
                    process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistry;
                }
            }
        });
    });

    describe("checkAuthoringSkillsStaleness", () => {
        it("passes when the authoring skills install dir does not exist", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-missing-");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir: join(root, "missing-authoring-skills"),
            });

            assert.strictEqual(result.status, "pass");
            assert.strictEqual(result.summary, "Authoring skills not yet installed.");
        });

        it("warns when the authoring skills install path is a regular file", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-file-conflict-");
            const installedDir = join(root, "authoring-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await writeFile(installedDir, "not a directory\n", "utf8");

            const result = await checkAuthoringSkillsStaleness(config, { installedDir });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, `Authoring skills install path exists but is not a directory: ${installedDir}.`);
            assert.deepStrictEqual(result.fix?.steps, [
                { kind: "manual", value: `Remove or rename the conflicting path at ${installedDir}.` },
                { kind: "shell", value: "clawperator authoring-skills install" },
            ]);
        });

        it("warns when the authoring skills install path is a dangling symlink", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-dangling-link-");
            const installedDir = join(root, "authoring-skills");
            const missingTarget = join(root, "missing-target");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await symlink(missingTarget, installedDir);

            const result = await checkAuthoringSkillsStaleness(config, { installedDir });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, `Authoring skills install path is a dangling symlink: ${installedDir}.`);
            assert.deepStrictEqual(result.fix?.steps, [
                { kind: "manual", value: `Remove or rename the conflicting path at ${installedDir}.` },
                { kind: "shell", value: "clawperator authoring-skills install" },
            ]);
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                cliVersion: getCliVersion(),
                pathType: "dangling-symlink",
            });
        });

        it("warns when the CLI version metadata cannot be read", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-cli-version-fail-");
            const installedDir = join(root, "authoring-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                getCliVersionFn: () => {
                    throw new Error("package.json version is missing");
                },
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, "CLI version metadata could not be read.");
        });

        it("warns when the authoring skills install dir exists but version.txt is missing", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-no-version-");
            const installedDir = join(root, "authoring-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(installedDir, { recursive: true });

            const result = await checkAuthoringSkillsStaleness(config, { installedDir });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, "Authoring skills version file is missing.");
            assert.deepStrictEqual(result.fix?.steps, [{ kind: "shell", value: "clawperator authoring-skills update" }]);
        });

        it("passes when version.txt matches the current CLI version", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-current-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await symlink(join(installedDir, "skill-author-by-recording"), join(claudeSkillsDir, "skill-author-by-recording"));
            await symlink(join(installedDir, "skill-author-by-recording"), join(codexSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "pass");
            assert.strictEqual(result.summary, "Authoring skills are up to date.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
            });
        });

        it("warns when the Claude discovery link is missing", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-missing-claude-link-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await symlink(join(installedDir, "skill-author-by-recording"), join(codexSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.summary, "Authoring skills discovery links are incomplete or invalid.");
            assert.deepStrictEqual(result.fix?.steps, [{ kind: "shell", value: "clawperator authoring-skills update" }]);
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
                brokenDiscoveryByDir: {
                    claude: [{
                        actualTarget: undefined,
                        dirLabel: "claude",
                        discoveryDir: claudeSkillsDir,
                        skillName: "skill-author-by-recording",
                        issue: "missing",
                        expectedTarget: join(installedDir, "skill-author-by-recording"),
                    }],
                    codex: [],
                },
            });
        });

        it("warns when the Codex discovery link is missing", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-missing-codex-link-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await symlink(join(installedDir, "skill-author-by-recording"), join(claudeSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.summary, "Authoring skills discovery links are incomplete or invalid.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
                brokenDiscoveryByDir: {
                    claude: [],
                    codex: [{
                        actualTarget: undefined,
                        dirLabel: "codex",
                        discoveryDir: codexSkillsDir,
                        skillName: "skill-author-by-recording",
                        issue: "missing",
                        expectedTarget: join(installedDir, "skill-author-by-recording"),
                    }],
                },
            });
        });

        it("warns when a managed discovery link points to the wrong target", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-wrong-link-target-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const wrongTargetRoot = join(root, "wrong-target", "skill-author-by-recording");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(wrongTargetRoot, { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await symlink(wrongTargetRoot, join(claudeSkillsDir, "skill-author-by-recording"));
            await symlink(join(installedDir, "skill-author-by-recording"), join(codexSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.summary, "Authoring skills discovery links are incomplete or invalid.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
                brokenDiscoveryByDir: {
                    claude: [{
                        dirLabel: "claude",
                        discoveryDir: claudeSkillsDir,
                        skillName: "skill-author-by-recording",
                        issue: "wrong-target",
                        expectedTarget: join(installedDir, "skill-author-by-recording"),
                        actualTarget: wrongTargetRoot,
                    }],
                    codex: [],
                },
            });
        });

        it("warns when a discovery entry is a conflicting non-symlink", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-conflicting-entry-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await writeFile(join(claudeSkillsDir, "skill-author-by-recording"), "not a symlink\n", "utf8");
            await symlink(join(installedDir, "skill-author-by-recording"), join(codexSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.summary, "Authoring skills discovery links are incomplete or invalid.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
                brokenDiscoveryByDir: {
                    claude: [{
                        actualTarget: undefined,
                        dirLabel: "claude",
                        discoveryDir: claudeSkillsDir,
                        skillName: "skill-author-by-recording",
                        issue: "conflict",
                        expectedTarget: join(installedDir, "skill-author-by-recording"),
                    }],
                    codex: [],
                },
            });
        });

        it("warns when a managed discovery link is dangling", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-broken-link-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const missingTarget = join(root, "missing-target");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await symlink(missingTarget, join(claudeSkillsDir, "skill-author-by-recording"));
            await symlink(join(installedDir, "skill-author-by-recording"), join(codexSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.summary, "Authoring skills discovery links are incomplete or invalid.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
                brokenDiscoveryByDir: {
                    claude: [{
                        dirLabel: "claude",
                        discoveryDir: claudeSkillsDir,
                        skillName: "skill-author-by-recording",
                        issue: "broken",
                        expectedTarget: join(installedDir, "skill-author-by-recording"),
                        actualTarget: missingTarget,
                    }],
                    codex: [],
                },
            });
        });

        it("warns when version.txt differs from the current CLI version", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-stale-");
            const installedDir = join(root, "authoring-skills");
            const claudeSkillsDir = join(root, "claude-skills");
            const codexSkillsDir = join(root, "codex-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await mkdir(claudeSkillsDir, { recursive: true });
            await mkdir(codexSkillsDir, { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await symlink(join(installedDir, "skill-author-by-recording"), join(claudeSkillsDir, "skill-author-by-recording"));
            await symlink(join(installedDir, "skill-author-by-recording"), join(codexSkillsDir, "skill-author-by-recording"));
            await writeFile(join(installedDir, "version.txt"), "0.0.1\n", "utf8");

            const result = await checkAuthoringSkillsStaleness(config, {
                installedDir,
                claudeSkillsDir,
                codexSkillsDir,
            });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, `Authoring skills (v0.0.1) are outdated (CLI is v${getCliVersion()}).`);
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: "0.0.1",
                cliVersion: getCliVersion(),
            });
        });

        it("warns when version.txt matches but no installed skill directory contains SKILL.md", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-empty-tree-");
            const installedDir = join(root, "authoring-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "broken-skill"), { recursive: true });
            await writeFile(join(installedDir, "version.txt"), `${getCliVersion()}\n`, "utf8");

            const result = await checkAuthoringSkillsStaleness(config, { installedDir });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, "Authoring skills install is missing expected packaged skills.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                installedVersion: getCliVersion(),
                cliVersion: getCliVersion(),
                expectedSkills: ["skill-author-by-recording"],
                missingSkills: ["skill-author-by-recording"],
            });
        });

        it("warns when version.txt cannot be read for a non-ENOENT reason", async () => {
            const root = await makeTempRoot("clawperator-doctor-authoring-skills-unreadable-version-");
            const installedDir = join(root, "authoring-skills");
            const config = getDefaultRuntimeConfig({ runner: new FakeProcessRunner() });
            await mkdir(join(installedDir, "skill-author-by-recording"), { recursive: true });
            await writeFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "# skill-author-by-recording\n", "utf8");
            await mkdir(join(installedDir, "version.txt"), { recursive: true });

            const result = await checkAuthoringSkillsStaleness(config, { installedDir });

            assert.strictEqual(result.status, "warn");
            assert.strictEqual(result.code, ERROR_CODES.AUTHORING_SKILLS_STALE);
            assert.strictEqual(result.summary, "Authoring skills version file could not be read.");
            assert.deepStrictEqual(result.evidence, {
                installedDir,
                versionPath: join(installedDir, "version.txt"),
                cliVersion: getCliVersion(),
            });
        });
    });
});
