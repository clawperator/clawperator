import { homedir } from "node:os";
import { join } from "node:path";

export const SKILLS_REPO_URL = "https://github.com/clawperator/clawperator-skills";

// Legacy URLs that are safe to auto-migrate to SKILLS_REPO_URL.
// User-configured remotes (SSH URLs, forks, mirrors) are intentionally excluded.
export const SKILLS_LEGACY_REMOTE_URLS: readonly string[] = [
  "https://clawperator.com/install/clawperator-skills.bundle",
  "https://clawpilled.com/install/clawperator-skills.bundle",
];
export const DEFAULT_SKILLS_DIR = join(homedir(), ".clawperator", "skills");
export const DEFAULT_SKILLS_REGISTRY_SUBPATH = join("skills", "skills-registry.json");

export function getDefaultSkillsRegistryPath(): string {
  return join(DEFAULT_SKILLS_DIR, DEFAULT_SKILLS_REGISTRY_SUBPATH);
}
