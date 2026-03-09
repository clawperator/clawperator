import { homedir } from "node:os";
import { join } from "node:path";

export const SKILLS_BUNDLE_URL = "https://clawperator.com/install/clawperator-skills.bundle";
export const DEFAULT_SKILLS_DIR = join(homedir(), ".clawperator", "skills");
export const DEFAULT_SKILLS_REGISTRY_SUBPATH = join("skills", "skills-registry.json");

export function getDefaultSkillsRegistryPath(): string {
  return join(DEFAULT_SKILLS_DIR, DEFAULT_SKILLS_REGISTRY_SUBPATH);
}
