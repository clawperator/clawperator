import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  loadRegistry,
  findSkillById,
  getRepoRoot,
  type LoadRegistryResult,
} from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { SkillEntry, SkillsRegistry } from "../../contracts/skills.js";
import {
  REGISTRY_READ_FAILED,
  SKILL_ALREADY_EXISTS,
  SKILL_ID_INVALID,
  SKILLS_SCAFFOLD_FAILED,
} from "../../contracts/skills.js";

export interface ScaffoldSkillSuccess {
  ok: true;
  skillId: string;
  registryPath: string;
  skillPath: string;
  files: string[];
}

export interface ScaffoldSkillError {
  ok: false;
  code: string;
  message: string;
}

export interface ScaffoldSkillOptions {
  registryPath?: string;
  summary?: string;
}

function deriveSkillMetadata(skillId: string): {
  applicationId: string;
  intent: string;
} | null {
  const trimmed = skillId.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return null;
  }
  return {
    applicationId: trimmed.slice(0, lastDot),
    intent: trimmed.slice(lastDot + 1),
  };
}

function buildSkillMarkdown(skillId: string, summary: string, scriptPath: string): string {
  return `---
name: ${skillId}
description: ${summary}
---

Starter scaffold for \`${skillId}\`.

Update this file with:

1. what the skill does
2. required arguments and environment
3. expected outputs
4. known caveats

Usage:

\`\`\`bash
node ${scriptPath} <device_id> [receiver_package]
\`\`\`
`;
}

function buildRunShTemplate(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
node "$DIR/run.js" "$@"
`;
}

function buildScriptTemplate(skillId: string, applicationId: string): string {
  return `#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const [, , deviceId, receiverPackage = process.env.CLAWPERATOR_RECEIVER_PACKAGE || "com.clawperator.operator"] = process.argv;

if (!deviceId) {
  console.error("Usage: node run.js <device_id> [receiver_package]");
  process.exit(1);
}

const execution = {
  commandId: "${skillId}-" + Date.now(),
  taskId: "${skillId}",
  source: "${skillId}",
  expectedFormat: "android-ui-automator",
  timeoutMs: 30000,
  actions: [
    { id: "close", type: "close_app", params: { applicationId: "${applicationId}" } },
    { id: "wait_close", type: "sleep", params: { durationMs: 1500 } },
    { id: "open", type: "open_app", params: { applicationId: "${applicationId}" } },
    { id: "wait_open", type: "sleep", params: { durationMs: 3000 } },
    { id: "snap", type: "snapshot_ui" }
  ]
};

try {
  const stdout = execFileSync(
    "clawperator",
    [
      "execute",
      "--device-id",
      deviceId,
      "--receiver-package",
      receiverPackage,
      "--execution",
      JSON.stringify(execution),
      "--output",
      "json",
    ],
    {
      encoding: "utf8",
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  process.stdout.write(stdout);
} catch (err) {
  const stdout = err?.stdout?.toString?.("utf8") ?? "";
  const stderr = err?.stderr?.toString?.("utf8") ?? "";

  if (stdout) {
    process.stdout.write(stdout);
    process.exit(0);
  }

  console.error(stderr || err.message || "clawperator execution failed");
  process.exit(1);
}
`;
}

async function writeRegistry(
  registryPath: string,
  registry: SkillsRegistry,
): Promise<void> {
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadCurrentRegistry(registryPath?: string): Promise<LoadRegistryResult> {
  return loadRegistry(registryPath);
}

export async function scaffoldSkill(
  skillId: string,
  options: string | ScaffoldSkillOptions = {},
): Promise<ScaffoldSkillSuccess | ScaffoldSkillError> {
  const normalizedOptions = typeof options === "string" ? { registryPath: options } : options;
  const summary = normalizedOptions.summary?.trim() || `TODO: describe ${skillId}`;
  const derived = deriveSkillMetadata(skillId);
  if (!derived) {
    return {
      ok: false,
      code: SKILL_ID_INVALID,
      message: "skill_id must contain at least one dot so applicationId and intent can be derived",
    };
  }

  let loaded: LoadRegistryResult;
  try {
    loaded = await loadCurrentRegistry(normalizedOptions.registryPath);
  } catch (error) {
    return {
      ok: false,
      code: REGISTRY_READ_FAILED,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (findSkillById(loaded.registry, skillId)) {
    return {
      ok: false,
      code: SKILL_ALREADY_EXISTS,
      message: `Skill already exists: ${skillId}`,
    };
  }

  const repoRoot = getRepoRoot(loaded.resolvedPath);
  const skillPathRelative = join("skills", skillId);
  const skillRoot = join(repoRoot, skillPathRelative);
  const scriptPathRelative = join(skillPathRelative, "scripts", "run.js");
  const shellScriptPathRelative = join(skillPathRelative, "scripts", "run.sh");
  const skillFileRelative = join(skillPathRelative, "SKILL.md");
  if (await fileExists(skillRoot)) {
    return {
      ok: false,
      code: SKILL_ALREADY_EXISTS,
      message: `Skill directory already exists: ${skillRoot}`,
    };
  }

  const skillEntry: SkillEntry = {
    id: skillId,
    applicationId: derived.applicationId,
    intent: derived.intent,
    summary,
    path: skillPathRelative,
    skillFile: skillFileRelative,
    scripts: [scriptPathRelative, shellScriptPathRelative],
    artifacts: [],
  };

  try {
    await mkdir(join(skillRoot, "scripts"), { recursive: true });
    await writeFile(join(skillRoot, "SKILL.md"), buildSkillMarkdown(skillId, skillEntry.summary, scriptPathRelative), "utf8");
    await writeFile(join(skillRoot, "skill.json"), `${JSON.stringify(skillEntry, null, 2)}\n`, "utf8");
    await writeFile(join(skillRoot, "scripts", "run.js"), buildScriptTemplate(skillId, derived.applicationId), "utf8");
    const runShPath = join(skillRoot, "scripts", "run.sh");
    await writeFile(runShPath, buildRunShTemplate(), "utf8");
    await chmod(runShPath, 0o755);

    const updatedRegistry: SkillsRegistry = {
      ...loaded.registry,
      skills: [...loaded.registry.skills, skillEntry].sort((a, b) => a.id.localeCompare(b.id)),
    };
    await mkdir(dirname(loaded.resolvedPath), { recursive: true });
    await writeRegistry(loaded.resolvedPath, updatedRegistry);
  } catch (error) {
    return {
      ok: false,
      code: SKILLS_SCAFFOLD_FAILED,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    ok: true,
    skillId,
    registryPath: loaded.resolvedPath,
    skillPath: skillRoot,
    files: [
      join(skillRoot, "SKILL.md"),
      join(skillRoot, "skill.json"),
      join(skillRoot, "scripts", "run.js"),
      join(skillRoot, "scripts", "run.sh"),
    ],
  };
}
