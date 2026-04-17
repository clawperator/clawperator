import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { SkillsRegistry, SkillEntry } from "../../contracts/skills.js";

/**
 * Default registry path. When running from repo root (e.g. node apps/node/dist/cli/index.js), cwd is repo root.
 * When running from apps/node, cwd is apps/node so we try parent parent (repo root).
 */
function getDefaultRegistryPath(): string {
  const cwd = process.cwd();
  return join(cwd, "skills", "skills-registry.json");
}

function getInstalledHomeRegistryPath(): string {
  return join(homedir(), ".clawperator", "skills", "skills", "skills-registry.json");
}

function getRepoRelativeFallbackPath(): string {
  return join(process.cwd(), "..", "..", "skills", "skills-registry.json");
}

export function getRegistryPath(): string {
  return process.env.CLAWPERATOR_SKILLS_REGISTRY ?? getDefaultRegistryPath();
}

/**
 * Repo root: directory containing the skills/ folder (parent of skills/).
 */
export function getRepoRoot(registryPath: string): string {
  return dirname(dirname(registryPath));
}

export interface LoadRegistryResult {
  registry: SkillsRegistry;
  resolvedPath: string;
}

export async function loadRegistry(registryPath?: string): Promise<LoadRegistryResult> {
  const configuredPath = process.env.CLAWPERATOR_SKILLS_REGISTRY;
  const defaultPath = getDefaultRegistryPath();
  let path = registryPath ?? configuredPath ?? defaultPath;
  let raw: string | undefined;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    if (!registryPath && configuredPath) {
      process.stderr.write(
        `Error: Registry file not found at ${path} (from CLAWPERATOR_SKILLS_REGISTRY). ` +
        "Check that the path is correct.\n"
      );
      throw new Error(
        `Registry not found at configured path: ${path}. ` +
        "Update CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."
      );
    }

    const candidates = [
      getRepoRelativeFallbackPath(),
      getInstalledHomeRegistryPath(),
    ].filter((candidate, index, all) => candidate !== path && all.indexOf(candidate) === index);

    for (const candidate of candidates) {
      try {
        raw = await readFile(candidate, "utf-8");
        path = candidate;
        break;
      } catch {
        continue;
      }
    }

    if (raw === undefined) {
      if (!registryPath && !configuredPath) {
        process.stderr.write(
          "Warning: CLAWPERATOR_SKILLS_REGISTRY is not set. " +
          "Run 'clawperator skills install' to configure the registry path.\n"
        );
        throw new Error(
          `Registry not found. Checked: ${[path, ...candidates].join(", ")}. ` +
          "Set CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."
        );
      }

      if (candidates.length > 0) {
        throw new Error(
          `Registry not found. Checked: ${[path, ...candidates].join(", ")}. ` +
          "Run from repo root, set CLAWPERATOR_SKILLS_REGISTRY, or run clawperator skills install."
        );
      }

      throw new Error(`Registry not found: ${path}. Run from repo root or set CLAWPERATOR_SKILLS_REGISTRY.`);
    }
  }
  const data = JSON.parse(raw) as SkillsRegistry;
  if (!Array.isArray(data.skills)) {
    throw new Error("Invalid registry: skills array required");
  }
  return { registry: data, resolvedPath: path };
}

export function findSkillById(registry: SkillsRegistry, skillId: string): SkillEntry | undefined {
  return registry.skills.find((s) => s.id === skillId);
}

/**
 * Resolve artifact path to absolute. Registry artifact entries are like "skills/.../artifacts/climate-status.recipe.json".
 */
export function resolveArtifactPath(registryPath: string, artifactRelativePath: string): string {
  const repoRoot = getRepoRoot(registryPath);
  return join(repoRoot, artifactRelativePath);
}

/**
 * Get artifact path (relative to repo root) from skill by name (e.g. "climate-status" -> skills/.../artifacts/climate-status.recipe.json).
 */
export function getArtifactPathFromSkill(skill: SkillEntry, artifactName: string): string | undefined {
  const base = artifactName.replace(/\.recipe\.json$/i, "");
  const candidate = `${base}.recipe.json`;
  return skill.artifacts.find((a) => a.endsWith("/" + candidate) || a === candidate) ?? undefined;
}
