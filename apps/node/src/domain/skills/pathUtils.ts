import { join } from "node:path";

export function normalizeSkillPathSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

export function isOrchestratedHarnessScriptPath(path: string): boolean {
  return normalizeSkillPathSeparators(path).endsWith("/scripts/run.js");
}

export function resolveRepoRelativeSkillPath(repoRoot: string, relativePath: string): string {
  const segments = normalizeSkillPathSeparators(relativePath)
    .split("/")
    .filter((segment) => segment.length > 0);
  return join(repoRoot, ...segments);
}
