import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdHostMaterializeArtifacts } from "../../cli/commands/host.js";
import { materializeHostArtifacts } from "../../domain/host/materializeArtifacts.js";

const ENV_KEYS = [
  "HOME",
  "CODEX_HOME",
  "ADB_PATH",
  "CLAWPERATOR_SKILLS_REGISTRY",
  "SKILLS_REGISTRY_PATH",
] as const;

const ORIGINAL_ENV = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

afterEach(async () => {
  process.exitCode = undefined;
  for (const [key, value] of ORIGINAL_ENV.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function makeTempHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "clawperator-host-artifacts-"));
}

async function writeRuntimeRegistry(homeDir: string): Promise<string> {
  const registryPath = join(homeDir, ".clawperator", "skills", "skills", "skills-registry.json");
  await mkdir(join(homeDir, ".clawperator", "skills", "skills"), { recursive: true });
  await writeFile(
    registryPath,
    `${JSON.stringify({
      schemaVersion: "1.0",
      generatedAt: "2026-04-23T00:00:00Z",
      skills: [
        {
          id: "com.example.weather.check-status",
          applicationId: "com.example.weather",
          intent: "check_status",
          summary: "Checks the current weather status",
          contract: {
            inputs: {
              city_name: {
                type: "string",
              },
            },
          },
        },
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  return registryPath;
}

async function writeBundledSkill(homeDir: string, skillName: string): Promise<void> {
  const skillDir = join(homeDir, ".clawperator", "bundled-skills", skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), `# ${skillName}\n`, "utf8");
}

describe("materializeHostArtifacts", () => {
  it("writes install-state JSON with the expected required and nullable fields", async () => {
    const homeDir = await makeTempHome();

    try {
      await materializeHostArtifacts({
        env: { HOME: homeDir },
        installedAt: "2026-04-23T10:11:12Z",
        cliVersion: "1.2.3",
        cliJsPath: "/opt/clawperator/dist/cli/index.js",
        processExecPath: "/usr/local/bin/node",
      });

      const installStatePath = join(homeDir, ".clawperator", "install-state.json");
      const parsed = JSON.parse(await readFile(installStatePath, "utf8"));

      assert.deepStrictEqual(parsed, {
        schemaVersion: 1,
        installedAt: "2026-04-23T10:11:12Z",
        cliVersion: "1.2.3",
        registryPath: null,
        apkVersion: null,
        lastDeviceSerial: null,
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("writes MCP snippet JSON with the expected top-level sections", async () => {
    const homeDir = await makeTempHome();

    try {
      await materializeHostArtifacts({
        env: { HOME: homeDir, CODEX_HOME: join(homeDir, ".codex") },
        installedAt: "2026-04-23T10:11:12Z",
        adbPath: "/opt/android/platform-tools/adb",
        cliJsPath: "/opt/clawperator/dist/cli/index.js",
        processExecPath: "/usr/local/bin/node",
      });

      const snippetPath = join(homeDir, ".clawperator", "mcp-config-snippet.json");
      const parsed = JSON.parse(await readFile(snippetPath, "utf8"));

      assert.deepStrictEqual(Object.keys(parsed), [
        "notes",
        "claudeDesktop",
        "codex",
        "genericStdioConsumer",
      ]);
      assert.strictEqual(parsed.claudeDesktop.mergeKey, "mcpServers");
      assert.match(parsed.codex.entryToml, /\[mcp_servers\.clawperator\]/);
      assert.match(parsed.codex.entryToml, /\[mcp_servers\.clawperator\.env\]/);
      assert.strictEqual(parsed.genericStdioConsumer.server.serverName, undefined);
      assert.deepStrictEqual(parsed.genericStdioConsumer.server.args, [
        "/opt/clawperator/dist/cli/index.js",
        "mcp",
        "serve",
      ]);
      assert.strictEqual(parsed.genericStdioConsumer.server.env.ADB_PATH, "/opt/android/platform-tools/adb");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("writes AGENTS.md content using installed runtime skill information when available", async () => {
    const homeDir = await makeTempHome();

    try {
      const registryPath = await writeRuntimeRegistry(homeDir);
      await writeBundledSkill(homeDir, "clawperator-agent-orientation");
      await writeBundledSkill(homeDir, "clawperator-upgrade");
      await writeBundledSkill(homeDir, "clawperator-skill-author-by-agent-discovery");
      await writeBundledSkill(homeDir, "clawperator-skill-author-by-recording");
      await writeFile(join(homeDir, ".clawperator", "bundled-skills", "version.txt"), "0.7.4\n", "utf8");

      await materializeHostArtifacts({
        env: { HOME: homeDir, CLAWPERATOR_SKILLS_REGISTRY: registryPath },
        installedAt: "2026-04-23T10:11:12Z",
        cliJsPath: "/opt/clawperator/dist/cli/index.js",
        processExecPath: "/usr/local/bin/node",
      });

      const guidePath = join(homeDir, ".clawperator", "AGENTS.md");
      const guide = await readFile(guidePath, "utf8");

      assert.match(guide, /## Runtime Skills/);
      assert.match(guide, new RegExp(registryPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(guide, /### Application/);
      assert.match(guide, /com\.example\.weather/);
      assert.match(guide, /com\.example\.weather\.check-status/);
      assert.match(guide, /clawperator skills run com\.example\.weather\.check-status --city-name <city_name>/);
      assert.match(guide, /Recommended first-run flow:/);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("keeps the shared-agent bridge bounded and idempotent", async () => {
    const homeDir = await makeTempHome();

    try {
      const sharedAgentsPath = join(homeDir, ".agents", "AGENTS.md");
      await mkdir(join(homeDir, ".agents"), { recursive: true });
      await writeFile(
        sharedAgentsPath,
        [
          "# Shared Guide",
          "",
          "Intro text",
          "",
          "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->",
          "outdated bridge",
          "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:END -->",
          "",
          "Footer text",
          "",
        ].join("\n"),
        "utf8",
      );

      const first = await materializeHostArtifacts({
        env: { HOME: homeDir },
        installedAt: "2026-04-23T10:11:12Z",
        cliJsPath: "/opt/clawperator/dist/cli/index.js",
        processExecPath: "/usr/local/bin/node",
      });
      const second = await materializeHostArtifacts({
        env: { HOME: homeDir },
        installedAt: "2026-04-23T10:11:12Z",
        cliJsPath: "/opt/clawperator/dist/cli/index.js",
        processExecPath: "/usr/local/bin/node",
      });

      const bridge = await readFile(sharedAgentsPath, "utf8");
      assert.match(bridge, /# Shared Guide/);
      assert.match(bridge, /Footer text/);
      assert.strictEqual((bridge.match(/CLAWPERATOR_SHARED_AGENT_BRIDGE:START/g) ?? []).length, 1);
      assert.strictEqual((bridge.match(/CLAWPERATOR_SHARED_AGENT_BRIDGE:END/g) ?? []).length, 1);
      assert.match(bridge, /Clawperator runtime skills stay in the `clawperator` CLI surface\./);

      const firstBridge = first.artifacts.find((artifact) => artifact.artifact === "sharedAgentBridge");
      const secondBridge = second.artifacts.find((artifact) => artifact.artifact === "sharedAgentBridge");
      assert.strictEqual(firstBridge?.status, "updated");
      assert.strictEqual(secondBridge?.status, "skipped");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});

describe("cmdHostMaterializeArtifacts", () => {
  it("reports deterministic JSON outcomes for reruns", async () => {
    const homeDir = await makeTempHome();

    try {
      process.env.HOME = homeDir;
      delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
      delete process.env.SKILLS_REGISTRY_PATH;
      delete process.env.ADB_PATH;
      process.env.CODEX_HOME = join(homeDir, ".codex");

      await mkdir(join(homeDir, ".agents"), { recursive: true });
      await writeFile(join(homeDir, ".agents", "AGENTS.md"), "# Shared\n", "utf8");

      const first = JSON.parse(await cmdHostMaterializeArtifacts({
        format: "json",
        installedAt: "2026-04-23T10:11:12Z",
      }));
      const second = JSON.parse(await cmdHostMaterializeArtifacts({
        format: "json",
        installedAt: "2026-04-23T10:11:12Z",
      }));

      assert.deepStrictEqual(first.artifacts.map((artifact: { artifact: string; status: string }) => artifact.artifact), [
        "installState",
        "mcpConfigSnippet",
        "agentGuide",
        "sharedAgentBridge",
      ]);
      assert.deepStrictEqual(second.artifacts.map((artifact: { status: string }) => artifact.status), [
        "skipped",
        "skipped",
        "skipped",
        "skipped",
      ]);
      assert.deepStrictEqual(second.summary, {
        written: 0,
        updated: 0,
        skipped: 4,
        failed: 0,
      });
      assert.strictEqual(second.ok, true);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
