import { mkdir, readFile, rename, chmod, lstat, unlink, writeFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { DEFAULT_BUNDLED_SKILLS_DIR, DEFAULT_OPERATOR_PACKAGE } from "../skills/skillsConfig.js";
import { getCliVersion } from "../version/compatibility.js";

export type HostArtifactKey =
  | "installState"
  | "mcpConfigSnippet"
  | "agentGuide"
  | "sharedAgentBridge";

export type HostArtifactStatus = "written" | "updated" | "skipped" | "failed";

export interface HostArtifactOutcome {
  artifact: HostArtifactKey;
  path: string;
  status: HostArtifactStatus;
  message?: string;
}

export interface HostArtifactMaterializationResult {
  ok: boolean;
  artifacts: HostArtifactOutcome[];
  summary: {
    written: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}

export interface MaterializeHostArtifactsOptions {
  installedAt?: string;
  cliVersion?: string | null;
  registryPath?: string | null;
  apkVersion?: string | null;
  lastDeviceSerial?: string | null;
  adbPath?: string | null;
  operatorPackage?: string;
  logDir?: string;
  codexConfigPath?: string;
  claudeConfigPathMac?: string;
  claudeConfigPathLinux?: string;
  bundledSkillsDir?: string;
  clawperatorDir?: string;
  sharedAgentsPath?: string;
  cliWrapperPath?: string;
  cliJsPath?: string | null;
  processExecPath?: string;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}

interface RuntimeSkillSummary {
  applicationId: string;
  skills: Array<{
    id: string;
    intent: string;
    summary: string;
    example: string;
  }>;
}

interface RuntimeGuideInfo {
  resolvedPath: string | null;
  hintPath: string;
  applications: RuntimeSkillSummary[] | null;
  unreadableRegistry: boolean;
}

const DEFAULT_REGISTRY_SUBPATH = join(".clawperator", "skills", "skills", "skills-registry.json");
const SHARED_BRIDGE_START = "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->";
const SHARED_BRIDGE_END = "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:END -->";

function nullIfBlank(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value.length > 0 ? value : null;
}

function getHomeDir(env: NodeJS.ProcessEnv | undefined): string {
  const home = env?.HOME;
  if (typeof home === "string" && home.length > 0) {
    return home;
  }
  return homedir();
}

function trimConfiguredPath(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readPreviousInstallStateRegistryPath(clawperatorDir: string): Promise<string | undefined> {
  const installStatePath = join(clawperatorDir, "install-state.json");
  try {
    const raw = await readFile(installStatePath, "utf8");
    const parsed = JSON.parse(raw) as { registryPath?: unknown };
    return typeof parsed.registryPath === "string" && parsed.registryPath.length > 0
      ? parsed.registryPath
      : undefined;
  } catch {
    return undefined;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function ensurePrivateClawperatorDir(clawperatorDir: string): Promise<void> {
  await mkdir(clawperatorDir, { recursive: true, mode: 0o700 });
  try {
    await chmod(clawperatorDir, 0o700);
  } catch {
    // Best-effort permission tightening only.
  }
}

async function secureFileIfPresent(path: string): Promise<void> {
  if (!(await fileExists(path))) {
    return;
  }
  try {
    await chmod(path, 0o600);
  } catch {
    // Best-effort permission tightening only.
  }
}

async function writeArtifactFile(path: string, content: string, mode?: number): Promise<HostArtifactStatus> {
  let existing: string | undefined;
  try {
    existing = await readFile(path, "utf8");
    if (existing === content) {
      return "skipped";
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  await mkdir(dirname(path), { recursive: true });

  const tempPath = join(dirname(path), `.clawperator-host-artifact.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tempPath, content, { encoding: "utf8", mode });
  if (mode !== undefined) {
    try {
      await chmod(tempPath, mode);
    } catch {
      // Best-effort only.
    }
  }

  try {
    await rename(tempPath, path);
  } finally {
    if (await fileExists(tempPath)) {
      await unlink(tempPath);
    }
  }

  return existing === undefined ? "written" : "updated";
}

function resolveInstalledAt(options: MaterializeHostArtifactsOptions): string {
  if (typeof options.installedAt === "string" && options.installedAt.length > 0) {
    return options.installedAt;
  }
  return (options.now ?? (() => new Date()))().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function toCliFlagName(inputName: string): string {
  return inputName.replace(/_/g, "-");
}

function normalizeGuideValue(value: string): string {
  return String(value).replace(/\r\n?/g, "\n");
}

function pushLiteralBlock(lines: string[], value: string, indent = ""): void {
  const literalIndent = `${indent}    `;
  lines.push(literalIndent);
  for (const line of normalizeGuideValue(value).split("\n")) {
    lines.push(literalIndent + line);
  }
}

function buildSkillRunExample(skill: Record<string, unknown>): string {
  const id = typeof skill.id === "string" && skill.id.length > 0 ? skill.id : "unknown-skill";
  const contract = skill.contract;
  const inputs = contract && typeof contract === "object" && contract !== null && "inputs" in contract
    && contract.inputs && typeof contract.inputs === "object" && contract.inputs !== null
    ? Object.keys(contract.inputs as Record<string, unknown>).sort((left, right) => left.localeCompare(right))
    : [];
  const args = inputs.map((inputName) => `--${toCliFlagName(inputName)} <${inputName}>`);
  return ["clawperator", "skills", "run", id, ...args].join(" ");
}

async function resolveRuntimeGuideInfo(
  options: MaterializeHostArtifactsOptions,
  clawperatorDir: string,
): Promise<RuntimeGuideInfo> {
  const homeDir = getHomeDir(options.env);
  const defaultRegistryPath = join(homeDir, DEFAULT_REGISTRY_SUBPATH);
  const configuredRegistryPath = trimConfiguredPath(options.env?.CLAWPERATOR_SKILLS_REGISTRY);
  const previousRegistryPath = await readPreviousInstallStateRegistryPath(clawperatorDir);
  const explicitRegistryPath = trimConfiguredPath(options.registryPath ?? undefined);
  const installPhaseRegistryPath = trimConfiguredPath(options.env?.SKILLS_REGISTRY_PATH);

  const candidates = [
    installPhaseRegistryPath,
    explicitRegistryPath,
    configuredRegistryPath,
    previousRegistryPath,
    defaultRegistryPath,
  ].filter((value, index, all): value is string => value !== undefined && all.indexOf(value) === index);

  const hintPath = candidates[0] ?? defaultRegistryPath;

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as { skills?: unknown };
      if (!Array.isArray(parsed.skills)) {
        return {
          resolvedPath: candidate,
          hintPath,
          applications: null,
          unreadableRegistry: true,
        };
      }

      const byApplication = new Map<string, RuntimeSkillSummary["skills"]>();
      for (const rawSkill of parsed.skills) {
        if (!rawSkill || typeof rawSkill !== "object") {
          continue;
        }

        const skill = rawSkill as Record<string, unknown>;
        const applicationId = typeof skill.applicationId === "string" && skill.applicationId.length > 0
          ? skill.applicationId
          : "unknown.application";
        const entries = byApplication.get(applicationId) ?? [];
        entries.push({
          id: typeof skill.id === "string" && skill.id.length > 0 ? skill.id : "unknown-skill",
          intent: typeof skill.intent === "string" && skill.intent.length > 0 ? skill.intent : "unknown",
          summary: typeof skill.summary === "string" && skill.summary.length > 0 ? skill.summary : "No summary provided.",
          example: buildSkillRunExample(skill),
        });
        byApplication.set(applicationId, entries);
      }

      const applications = Array.from(byApplication.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([applicationId, skills]) => ({
          applicationId,
          skills: skills.slice().sort((left, right) => {
            if (left.intent !== right.intent) {
              return left.intent.localeCompare(right.intent);
            }
            return left.id.localeCompare(right.id);
          }),
        }));

      return {
        resolvedPath: candidate,
        hintPath,
        applications,
        unreadableRegistry: false,
      };
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR"))) {
        return {
          resolvedPath: candidate,
          hintPath,
          applications: null,
          unreadableRegistry: true,
        };
      }
    }
  }

  return {
    resolvedPath: null,
    hintPath,
    applications: null,
    unreadableRegistry: false,
  };
}

function buildInstallStateContent(options: MaterializeHostArtifactsOptions, resolvedRegistryPath: string | null): string {
  const installState = {
    schemaVersion: 1,
    installedAt: resolveInstalledAt(options),
    cliVersion: options.cliVersion === undefined ? getCliVersion() : nullIfBlank(options.cliVersion),
    registryPath: resolvedRegistryPath,
    apkVersion: nullIfBlank(options.apkVersion),
    lastDeviceSerial: nullIfBlank(options.lastDeviceSerial),
  };
  return `${JSON.stringify(installState, null, 2)}\n`;
}

function resolveCliJsPath(options: MaterializeHostArtifactsOptions): string {
  const explicitPath = options.cliJsPath;
  if (typeof explicitPath === "string") {
    return explicitPath;
  }

  const envOverride = options.env?.CLAWPERATOR_CLI_JS_PATH;
  if (typeof envOverride === "string") {
    return envOverride;
  }

  const argvPath = process.argv[1];
  if (typeof argvPath === "string" && argvPath.length > 0) {
    return resolve(argvPath);
  }

  return "";
}

function buildMcpConfigSnippetContent(options: MaterializeHostArtifactsOptions, clawperatorDir: string): string {
  const operatorPackage = options.operatorPackage ?? DEFAULT_OPERATOR_PACKAGE;
  const logDir = options.logDir ?? join(clawperatorDir, "logs");
  const homeDir = getHomeDir(options.env);
  const codexConfigPath = options.codexConfigPath ?? join(options.env?.CODEX_HOME ?? join(homeDir, ".codex"), "config.toml");
  const claudeConfigPathMac = options.claudeConfigPathMac ?? join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  const claudeConfigPathLinux = options.claudeConfigPathLinux ?? join(homeDir, ".config", "Claude", "claude_desktop_config.json");
  const cliWrapperPath = options.cliWrapperPath ?? options.env?.CLAWPERATOR_BIN_PATH ?? "clawperator";
  const cliJsPath = resolveCliJsPath(options);
  const adbPath = nullIfBlank(options.adbPath ?? options.env?.ADB_PATH);
  const adbPlaceholder = "<set ADB_PATH to your adb binary>";
  const adbValue = adbPath ?? adbPlaceholder;
  const useNodeForm = cliJsPath.length > 0;
  const command = useNodeForm ? (options.processExecPath ?? process.execPath) : cliWrapperPath;
  const args = useNodeForm ? [cliJsPath, "mcp", "serve"] : ["mcp", "serve"];
  const serverConfig = {
    command,
    args,
    env: {
      ADB_PATH: adbValue,
      CLAWPERATOR_OPERATOR_PACKAGE: operatorPackage,
      CLAWPERATOR_LOG_DIR: logDir,
      CLAWPERATOR_LOG_LEVEL: "info",
    },
  };

  const notes = [
    "This snippet is generated for the current host.",
    "Regenerate it with clawperator host materialize-artifacts if the clawperator binary path or adb path changes.",
  ];

  if (!useNodeForm) {
    notes.push(
      "Could not resolve the Clawperator CLI JS entrypoint, so this snippet uses the npm shell wrapper. Claude Desktop and other GUI MCP clients usually do not inherit your shell PATH; if launch fails, replace \"command\" with \"node\" and \"args\" with [\"<installed_clawperator_path>/dist/cli/index.js\", \"mcp\", \"serve\"]."
    );
  }

  if (adbPath === null) {
    notes.push(
      `adb was not found on PATH at materialization time. Replace ADB_PATH (${adbPlaceholder}) with the absolute path to your adb binary before using this snippet.`
    );
  }

  const tomlArgs = args.map((value) => JSON.stringify(value)).join(", ");
  const snippet = {
    notes,
    claudeDesktop: {
      configPathHints: [claudeConfigPathMac, claudeConfigPathLinux],
      mergeKey: "mcpServers",
      entry: {
        clawperator: serverConfig,
      },
    },
    codex: {
      configPath: codexConfigPath,
      entryToml: [
        "[mcp_servers.clawperator]",
        `command = ${JSON.stringify(command)}`,
        `args = [${tomlArgs}]`,
        "[mcp_servers.clawperator.env]",
        `ADB_PATH = ${JSON.stringify(adbValue)}`,
        `CLAWPERATOR_OPERATOR_PACKAGE = ${JSON.stringify(operatorPackage)}`,
        `CLAWPERATOR_LOG_DIR = ${JSON.stringify(logDir)}`,
        "CLAWPERATOR_LOG_LEVEL = \"info\"",
        "",
      ].join("\n"),
    },
    genericStdioConsumer: {
      serverName: "clawperator",
      server: serverConfig,
    },
  };

  return `${JSON.stringify(snippet, null, 2)}\n`;
}

async function listInstalledBundledSkillNames(bundledSkillsDir: string): Promise<{
  installed: string[];
  hasVersionFile: boolean;
}> {
  const installed: string[] = [];
  if (!(await fileExists(bundledSkillsDir))) {
    return { installed, hasVersionFile: false };
  }

  const entries = await readdir(bundledSkillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = join(bundledSkillsDir, entry.name, "SKILL.md");
    if (await fileExists(skillPath)) {
      installed.push(entry.name);
    }
  }

  installed.sort((left, right) => left.localeCompare(right));
  return {
    installed,
    hasVersionFile: await fileExists(join(bundledSkillsDir, "version.txt")),
  };
}

async function buildAgentGuideContent(
  options: MaterializeHostArtifactsOptions,
  runtimeGuide: RuntimeGuideInfo,
): Promise<string> {
  const bundledSkillsDir = options.bundledSkillsDir ?? DEFAULT_BUNDLED_SKILLS_DIR;
  const { installed, hasVersionFile } = await listInstalledBundledSkillNames(bundledSkillsDir);
  const hasSkills = installed.length > 0;
  const hasOrientation = installed.includes("clawperator-agent-orientation");
  const hasUpgrade = installed.includes("clawperator-upgrade");
  const hasDiscovery = installed.includes("clawperator-skill-author-by-agent-discovery");
  const hasRecording = installed.includes("clawperator-skill-author-by-recording");

  const lines: string[] = [
    "# Clawperator",
    "",
    "Deterministic Android automation runtime for AI agents.",
    "",
    "## Quick start",
    "",
    "clawperator doctor --json    # verify readiness",
    "clawperator snapshot --json  # capture device state",
    "clawperator click --text \"Settings\" --json  # tap an element",
    "",
    "## Documentation",
    "",
    "- LLM guide: https://docs.clawperator.com/llms.txt",
    "- Full docs: https://docs.clawperator.com/llms-full.txt",
    "- Setup guide: https://docs.clawperator.com/setup/",
    "",
    "## Runtime Skills",
    "",
    "Use the installed runtime-skill registry to discover and run app workflows:",
    "- `clawperator skills list`",
    "- `clawperator skills search --keyword \"<term>\"`",
    "- `clawperator skills get <id>`",
    "- `clawperator skills run <id>`",
  ];

  if (runtimeGuide.resolvedPath === null) {
    lines.push(
      "",
      "Runtime skills not available on this host right now.",
      "Expected registry path:",
      `\`${runtimeGuide.hintPath}\``,
      "",
      "Repair or manual bootstrap:",
      "- run `clawperator skills install`",
    );
  } else if (runtimeGuide.unreadableRegistry || runtimeGuide.applications === null) {
    lines.push(
      "",
      "Runtime skills not available on this host right now.",
      "Expected registry path:",
      `\`${runtimeGuide.hintPath}\``,
      "",
      "The registry exists but could not be read.",
      "Repair or manual bootstrap:",
      "- run `clawperator skills install`",
    );
  } else {
    lines.push("", "Registry path:");
    pushLiteralBlock(lines, runtimeGuide.resolvedPath);
    lines.push("", "Inspect required inputs before running with `clawperator skills get <id>`.");

    if (runtimeGuide.applications.length === 0) {
      lines.push("", "Runtime skills registry is present, but it does not contain any installed skills.");
    } else {
      for (const application of runtimeGuide.applications) {
        lines.push("", "### Application", "", "App ID:");
        pushLiteralBlock(lines, application.applicationId);
        lines.push("");

        for (const skill of application.skills) {
          lines.push("- Skill", "  id:");
          pushLiteralBlock(lines, skill.id, "  ");
          lines.push("  intent:");
          pushLiteralBlock(lines, skill.intent, "  ");
          lines.push("  summary:");
          pushLiteralBlock(lines, skill.summary, "  ");
          lines.push("  example:");
          pushLiteralBlock(lines, skill.example, "  ");
        }
      }
    }
  }

  if (hasSkills) {
    lines.push(
      "",
      "## Bundled Skills",
      "",
      "First-party Clawperator bundled skills are installed at:",
      bundledSkillsDir,
      "",
    );

    if (hasOrientation) {
      lines.push(
        "- `clawperator-agent-orientation`: first-run orientation skill for an",
        "  unfamiliar host. It checks readiness, chooses the correct Clawperator front",
        "  door, and points back to the canonical public docs for the chosen path.",
      );
    }
    if (hasUpgrade) {
      lines.push(
        "- `clawperator-upgrade`: packaged whole-product upgrade route. It reruns the",
        "  canonical installer at `https://clawperator.com/install.sh`, verifies the",
        "  result with `clawperator doctor --json`, and reports the next blocking",
        "  repair step when setup is still incomplete.",
      );
    }
    if (hasDiscovery) {
      lines.push(
        "- `clawperator-skill-author-by-agent-discovery`: zero-results front door when",
        "  `clawperator skills for-app <package_id>` and",
        "  `clawperator skills search --keyword \"<term>\"` found no relevant runtime",
        "  skill. Discovery stays bounded, produces one routing artifact, and chooses",
        "  the next truthful step.",
      );
    }
    if (hasRecording) {
      lines.push(
        "- `clawperator-skill-author-by-recording`: proving workflow after discovery returns",
        "  `proceed_to_recording`, or when the app route is already well understood",
        "  and you need a real-device recording to draft a reusable runtime skill.",
      );
    }

    lines.push("", "Installed entries on this host:");
    for (const skillName of installed) {
      lines.push(`- ${skillName}`);
    }

    if (hasOrientation && hasUpgrade && hasDiscovery && hasRecording) {
      lines.push(
        "",
        "Recommended first-run flow:",
        "- If the current host is unfamiliar, start with `clawperator-agent-orientation`",
        "- If this installed Clawperator environment needs a whole-product refresh, use `clawperator-upgrade`",
        "- Choose one runtime-skill discovery probe: `clawperator skills for-app <package_id>` or `clawperator skills search --keyword \"<term>\"`",
        "- If there is no relevant runtime-skill match, inspect `clawperator bundled-skills list --json`",
        "- Start the guided route with `clawperator-skill-author-by-agent-discovery`",
        "- Use `clawperator-skill-author-by-recording` only after discovery returns `proceed_to_recording`",
      );
    } else {
      lines.push(
        "",
        "Installed bundled-skill front doors are incomplete on this host.",
        "",
        "Repair it with:",
        "- run `clawperator bundled-skills update`",
      );
      if (!hasOrientation) {
        lines.push("- missing `clawperator-agent-orientation`");
      }
      if (!hasUpgrade) {
        lines.push("- missing `clawperator-upgrade`");
      }
      if (!hasDiscovery) {
        lines.push("- missing `clawperator-skill-author-by-agent-discovery`");
      }
      if (!hasRecording) {
        lines.push("- missing `clawperator-skill-author-by-recording`");
      }
    }

    if (!hasVersionFile) {
      lines.push(
        "",
        "Version metadata is missing for this install.",
        "Refresh it with:",
        "- run `clawperator bundled-skills update`",
      );
    }
  } else {
    lines.push(
      "",
      "## Bundled Skills",
      "",
      "First-party Clawperator bundled skills are not currently configured on this host.",
      "",
      "Expected packaged front doors after install:",
      "- `clawperator-agent-orientation`: first-run orientation for unfamiliar hosts",
      "- `clawperator-upgrade`: packaged whole-product upgrade route through install.sh and doctor",
      "- `clawperator-skill-author-by-agent-discovery`: zero-results front door when runtime-skill discovery found no relevant match",
      "- `clawperator-skill-author-by-recording`: proving workflow after discovery returns `proceed_to_recording`",
      "",
      "Repair or manual bootstrap:",
      "- run `clawperator bundled-skills install`",
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSharedAgentBridgeContent(sharedAgentsContent: string, localAgentGuidePath: string): string {
  const bridgeBlock = [
    SHARED_BRIDGE_START,
    "## Clawperator",
    "",
    "Clawperator runtime skills stay in the `clawperator` CLI surface.",
    "Do not mirror them into shared agent skill directories.",
    "",
    "Start here:",
    `- \`${localAgentGuidePath}\``,
    "- if the host is unfamiliar and the local guide lists it, start with `clawperator-agent-orientation`",
    "- `clawperator skills for-app <package_id>`",
    "- `clawperator skills search --keyword \"<term>\"`",
    "- `clawperator skills get <skill_id>`",
    "- `clawperator bundled-skills list --json`",
    "",
    "If runtime-skill discovery finds no relevant match, follow the local guide for the bundled-skill front doors installed on this host.",
    "Confirm the local guide lists `clawperator-agent-orientation`, `clawperator-upgrade`, `clawperator-skill-author-by-agent-discovery`, and `clawperator-skill-author-by-recording` before starting the discovery-to-proving route.",
    "Use `clawperator skills run <skill_id>` after you have identified the right runtime skill.",
    SHARED_BRIDGE_END,
  ].join("\n");

  const bridgePattern = new RegExp(
    `${escapeRegExp(SHARED_BRIDGE_START)}[\\s\\S]*?${escapeRegExp(SHARED_BRIDGE_END)}`,
    "g",
  );
  const cleaned = sharedAgentsContent.replace(bridgePattern, "");
  const separator = cleaned.length === 0
    ? ""
    : (cleaned.endsWith("\n\n") ? "" : (cleaned.endsWith("\n") ? "\n" : "\n\n"));
  return `${cleaned}${separator}${bridgeBlock}`;
}

export async function materializeHostArtifacts(
  options: MaterializeHostArtifactsOptions = {},
): Promise<HostArtifactMaterializationResult> {
  const homeDir = getHomeDir(options.env);
  const clawperatorDir = options.clawperatorDir ?? join(homeDir, ".clawperator");
  const installStatePath = join(clawperatorDir, "install-state.json");
  const mcpConfigSnippetPath = join(clawperatorDir, "mcp-config-snippet.json");
  const agentGuidePath = join(clawperatorDir, "AGENTS.md");
  const sharedAgentsPath = options.sharedAgentsPath ?? join(homeDir, ".agents", "AGENTS.md");

  await ensurePrivateClawperatorDir(clawperatorDir);
  const runtimeGuide = await resolveRuntimeGuideInfo(options, clawperatorDir);

  const results: HostArtifactOutcome[] = [];

  const installStateContent = buildInstallStateContent(options, runtimeGuide.resolvedPath);
  try {
    const status = await writeArtifactFile(installStatePath, installStateContent, 0o600);
    await secureFileIfPresent(installStatePath);
    results.push({ artifact: "installState", path: installStatePath, status });
  } catch (error) {
    results.push({
      artifact: "installState",
      path: installStatePath,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const mcpConfigSnippetContent = buildMcpConfigSnippetContent(options, clawperatorDir);
  try {
    const status = await writeArtifactFile(mcpConfigSnippetPath, mcpConfigSnippetContent, 0o600);
    await secureFileIfPresent(mcpConfigSnippetPath);
    results.push({ artifact: "mcpConfigSnippet", path: mcpConfigSnippetPath, status });
  } catch (error) {
    results.push({
      artifact: "mcpConfigSnippet",
      path: mcpConfigSnippetPath,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const agentGuideContent = await buildAgentGuideContent(options, runtimeGuide);
    const status = await writeArtifactFile(agentGuidePath, agentGuideContent, 0o600);
    await secureFileIfPresent(agentGuidePath);
    results.push({ artifact: "agentGuide", path: agentGuidePath, status });
  } catch (error) {
    results.push({
      artifact: "agentGuide",
      path: agentGuidePath,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!(await fileExists(sharedAgentsPath))) {
    results.push({
      artifact: "sharedAgentBridge",
      path: sharedAgentsPath,
      status: "skipped",
      message: "Shared agent guide not found; skipping Clawperator bridge update.",
    });
  } else {
    try {
      const sharedAgentsStat = await lstat(sharedAgentsPath);
      if (!sharedAgentsStat.isFile()) {
        throw new Error(`${sharedAgentsPath} must be a regular file`);
      }

      const sharedAgentsContent = await readFile(sharedAgentsPath, "utf8");
      const nextContent = buildSharedAgentBridgeContent(sharedAgentsContent, agentGuidePath);
      const status = await writeArtifactFile(sharedAgentsPath, nextContent, sharedAgentsStat.mode & 0o777);
      results.push({ artifact: "sharedAgentBridge", path: sharedAgentsPath, status });
    } catch (error) {
      results.push({
        artifact: "sharedAgentBridge",
        path: sharedAgentsPath,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = results.reduce(
    (accumulator, result) => {
      accumulator[result.status] += 1;
      return accumulator;
    },
    { written: 0, updated: 0, skipped: 0, failed: 0 },
  );

  return {
    ok: summary.failed === 0,
    artifacts: results,
    summary,
  };
}
