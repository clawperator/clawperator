import { join } from "node:path";

export function normalizeSkillPathSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

export function isOrchestratedHarnessScriptPath(path: string): boolean {
  return normalizeSkillPathSeparators(path).endsWith("/scripts/run.js");
}

export function resolveRepoRelativeSkillPath(repoRoot: string, relativePath: string): string {
  const normalizedPath = normalizeSkillPathSeparators(relativePath);
  if (normalizedPath.startsWith("/") || /^[A-Za-z]:\//.test(normalizedPath)) {
    throw new Error(`Skill path must be relative: ${relativePath}`);
  }

  const segments = normalizedPath
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Skill path must not contain parent directory traversal: ${relativePath}`);
  }
  return join(repoRoot, ...segments);
}
