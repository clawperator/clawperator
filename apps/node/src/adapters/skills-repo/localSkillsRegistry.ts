import { readFile } from "node:fs/promises";
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
  let path = registryPath ?? configuredPath ?? getDefaultRegistryPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    if (!registryPath && !configuredPath) {
      throw new Error(
        `Registry not found at default path: ${path}. ` +
        "Set CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."
      );
    }

    if (!registryPath && configuredPath) {
      throw new Error(
        `Registry not found at configured path: ${path}. ` +
        "Update CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."
      );
    }

    const fallback = join(process.cwd(), "..", "..", "skills", "skills-registry.json");
    if (fallback !== path) {
      try {
        raw = await readFile(fallback, "utf-8");
        path = fallback;
      } catch {
        throw new Error(
          `Registry not found. Checked: ${path}, ${fallback}. ` +
          "Run from repo root, set CLAWPERATOR_SKILLS_REGISTRY, or run clawperator skills install."
        );
      }
    } else {
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
 * Resolve artifact path to absolute. Registry artifact entries are like "skills/.../artifacts/ac-status.recipe.json".
 */
export function resolveArtifactPath(registryPath: string, artifactRelativePath: string): string {
  const repoRoot = getRepoRoot(registryPath);
  return join(repoRoot, artifactRelativePath);
}

/**
 * Get artifact path (relative to repo root) from skill by name (e.g. "ac-status" -> skills/.../artifacts/ac-status.recipe.json).
 */
export function getArtifactPathFromSkill(skill: SkillEntry, artifactName: string): string | undefined {
  const base = artifactName.replace(/\.recipe\.json$/i, "");
  const candidate = `${base}.recipe.json`;
  return skill.artifacts.find((a) => a.endsWith("/" + candidate) || a === candidate) ?? undefined;
}
