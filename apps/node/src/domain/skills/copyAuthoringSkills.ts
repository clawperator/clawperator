import { access, cp, lstat, mkdir, readdir, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getCliVersion } from "../version/compatibility.js";
import { DEFAULT_AUTHORING_SKILLS_DIR } from "./skillsConfig.js";

const AUTHORING_SKILLS_SOURCE_ENV_VAR = "CLAWPERATOR_AUTHORING_SKILLS";
const VERSION_FILENAME = "version.txt";

export interface CopyAuthoringSkillsSuccess {
  ok: true;
  skills: string[];
  installedDir: string;
  agentDirs: string[];
}

export interface CopyAuthoringSkillsError {
  ok: false;
  code: string;
  message: string;
}

export interface CopyAuthoringSkillsOptions {
  sourceDir?: string;
  installedDir?: string;
  claudeSkillsDir?: string;
  codexSkillsDir?: string;
  codexHome?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  cliVersion?: string;
}

function resolveAuthoringSkillsSourceDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../authoring-skills");
}

function resolveHomeDir(options: CopyAuthoringSkillsOptions): string {
  return options.homeDir ?? homedir();
}

function resolveInstalledDir(options: CopyAuthoringSkillsOptions): string {
  if (options.installedDir) {
    return options.installedDir;
  }
  if (options.homeDir) {
    return join(options.homeDir, ".clawperator", "authoring-skills");
  }
  return DEFAULT_AUTHORING_SKILLS_DIR;
}

function resolveClaudeSkillsDir(options: CopyAuthoringSkillsOptions): string {
  return options.claudeSkillsDir ?? join(resolveHomeDir(options), ".claude", "skills");
}

function resolveCodexSkillsDir(options: CopyAuthoringSkillsOptions): string {
  if (options.codexSkillsDir) {
    return options.codexSkillsDir;
  }
  const env = options.env ?? process.env;
  const codexHome = options.codexHome ?? env.CODEX_HOME;
  if (codexHome !== undefined && codexHome !== "") {
    return join(codexHome, "skills");
  }
  return join(resolveHomeDir(options), ".codex", "skills");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathExistsNoFollow(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function discoverAuthoringSkills(sourceDir: string): Promise<string[]> {
  const entries = await readdir(sourceDir);
  const skills: string[] = [];

  for (const entry of entries) {
    const entryPath = join(sourceDir, entry);
    let entryStat;
    try {
      entryStat = await stat(entryPath);
    } catch {
      continue;
    }
    if (!entryStat.isDirectory()) {
      continue;
    }
    if (await pathExists(join(entryPath, "SKILL.md"))) {
      skills.push(entry);
    }
  }

  skills.sort((a, b) => a.localeCompare(b));
  return skills;
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

function normalizeOwnedSkillTarget(installedDir: string, skillName: string): string {
  return resolve(installedDir, skillName);
}

async function resolveSymlinkTarget(path: string): Promise<string | undefined> {
  try {
    const target = await readlink(path);
    return resolve(dirname(path), target);
  } catch {
    return undefined;
  }
}

async function isManagedAgentSymlink(linkPath: string, installedDir: string, skillName: string): Promise<boolean> {
  let entryStat;
  try {
    entryStat = await lstat(linkPath);
  } catch {
    return false;
  }
  if (!entryStat.isSymbolicLink()) {
    return false;
  }

  const resolvedTarget = await resolveSymlinkTarget(linkPath);
  if (resolvedTarget === undefined) {
    return false;
  }

  return resolvedTarget === normalizeOwnedSkillTarget(installedDir, skillName);
}

async function ensureManagedSymlink(targetPath: string, linkPath: string, installedDir: string, skillName: string): Promise<void> {
  const exists = await pathExistsNoFollow(linkPath);
  if (exists) {
    const managed = await isManagedAgentSymlink(linkPath, installedDir, skillName);
    if (!managed) {
      throw new Error(`Refusing to overwrite non-Clawperator skill entry: ${linkPath}`);
    }
    await rm(linkPath, { recursive: true, force: true });
  }

  await mkdir(dirname(linkPath), { recursive: true });
  await symlink(targetPath, linkPath);
}

async function assertManagedSymlinkWritable(linkPath: string, installedDir: string, skillName: string): Promise<void> {
  const exists = await pathExistsNoFollow(linkPath);
  if (!exists) {
    return;
  }

  const managed = await isManagedAgentSymlink(linkPath, installedDir, skillName);
  if (!managed) {
    throw new Error(`Refusing to overwrite non-Clawperator skill entry: ${linkPath}`);
  }
}

async function removeStaleAgentSymlinks(agentDir: string, activeSkills: Set<string>, installedDir: string): Promise<void> {
  const entries = await readdir(agentDir);
  for (const entry of entries) {
    if (activeSkills.has(entry)) {
      continue;
    }
    const entryPath = join(agentDir, entry);
    let entryStat;
    try {
      entryStat = await lstat(entryPath);
    } catch {
      // Agent discovery directories are shared user space. If an entry disappears
      // mid-scan or is unreadable, skip it rather than failing the whole install.
      // We only clean up links we can positively identify as Clawperator-owned.
      continue;
    }
    if (!entryStat.isSymbolicLink()) {
      continue;
    }

    const resolvedTarget = await resolveSymlinkTarget(entryPath);
    if (resolvedTarget === normalizeOwnedSkillTarget(installedDir, entry)) {
      await rm(entryPath, { recursive: true, force: true });
    }
  }
}

export async function copyAuthoringSkills(
  options: CopyAuthoringSkillsOptions = {}
): Promise<CopyAuthoringSkillsSuccess | CopyAuthoringSkillsError> {
  const env = options.env ?? process.env;
  const sourceDir = options.sourceDir
    ?? (env[AUTHORING_SKILLS_SOURCE_ENV_VAR] !== undefined && env[AUTHORING_SKILLS_SOURCE_ENV_VAR] !== ""
      ? env[AUTHORING_SKILLS_SOURCE_ENV_VAR]
      : resolveAuthoringSkillsSourceDir());
  const installedDir = resolveInstalledDir(options);
  const claudeSkillsDir = resolveClaudeSkillsDir(options);
  const codexSkillsDir = resolveCodexSkillsDir(options);

  let sourceStat;
  try {
    sourceStat = await stat(sourceDir);
  } catch {
    return {
      ok: false,
      code: "AUTHORING_SKILLS_SOURCE_NOT_FOUND",
      message: `Authoring skills source directory not found: ${sourceDir}`,
    };
  }

  if (!sourceStat.isDirectory()) {
    return {
      ok: false,
      code: "AUTHORING_SKILLS_SOURCE_NOT_FOUND",
      message: `Authoring skills source path is not a directory: ${sourceDir}`,
    };
  }

  try {
    const skills = await discoverAuthoringSkills(sourceDir);
    if (skills.length === 0) {
      return {
        ok: false,
        code: "AUTHORING_SKILLS_SOURCE_EMPTY",
        message: `No packaged authoring skills with SKILL.md were found in ${sourceDir}`,
      };
    }
    await ensureDirectory(installedDir);
    await ensureDirectory(claudeSkillsDir);
    await ensureDirectory(codexSkillsDir);

    for (const skillName of skills) {
      await assertManagedSymlinkWritable(join(claudeSkillsDir, skillName), installedDir, skillName);
      await assertManagedSymlinkWritable(join(codexSkillsDir, skillName), installedDir, skillName);
    }

    for (const skillName of skills) {
      const sourceSkillDir = join(sourceDir, skillName);
      const targetSkillDir = join(installedDir, skillName);
      await rm(targetSkillDir, { recursive: true, force: true });
      await cp(sourceSkillDir, targetSkillDir, { recursive: true, force: true, dereference: true });
      await ensureManagedSymlink(targetSkillDir, join(claudeSkillsDir, skillName), installedDir, skillName);
      await ensureManagedSymlink(targetSkillDir, join(codexSkillsDir, skillName), installedDir, skillName);
    }

    const activeSkills = new Set(skills);
    await removeStaleAgentSymlinks(claudeSkillsDir, activeSkills, installedDir);
    await removeStaleAgentSymlinks(codexSkillsDir, activeSkills, installedDir);
    await writeFile(join(installedDir, VERSION_FILENAME), `${options.cliVersion ?? getCliVersion()}\n`, "utf8");

    return {
      ok: true,
      skills,
      installedDir,
      agentDirs: [claudeSkillsDir, codexSkillsDir],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: "AUTHORING_SKILLS_INSTALL_FAILED",
      message,
    };
  }
}

export async function listInstalledAuthoringSkills(installDir = DEFAULT_AUTHORING_SKILLS_DIR): Promise<Array<{ name: string; skillPath: string }>> {
  const entries = await readdir(installDir);
  const skills: Array<{ name: string; skillPath: string }> = [];

  for (const entry of entries) {
    const skillPath = join(installDir, entry, "SKILL.md");
    if (await pathExists(skillPath)) {
      skills.push({ name: entry, skillPath });
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export async function readAgentSymlinkTarget(path: string): Promise<string | undefined> {
  return resolveSymlinkTarget(path);
}
