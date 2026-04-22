import { access, cp, lstat, mkdir, readdir, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getCliVersion } from "../version/compatibility.js";
import { DEFAULT_BUNDLED_SKILLS_DIR } from "./skillsConfig.js";

const BUNDLED_SKILLS_SOURCE_ENV_VAR = "CLAWPERATOR_BUNDLED_SKILLS";
const VERSION_FILENAME = "version.txt";

export interface BundledSkillDiscoveryDirEntry {
  label: string;
  dir: string;
}

export interface CopyBundledSkillsSuccess {
  ok: true;
  skills: string[];
  installedDir: string;
  agentDiscoveryDirs: BundledSkillDiscoveryDirEntry[];
}

export interface CopyBundledSkillsError {
  ok: false;
  code: string;
  message: string;
}

export interface CopyBundledSkillsOptions {
  sourceDir?: string;
  installedDir?: string;
  claudeSkillsDir?: string;
  codexSkillsDir?: string;
  agentsSkillsDir?: string;
  codexHome?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  cliVersion?: string;
}

function resolveBundledSkillsSourceDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../bundled-skills");
}

export function resolvePackagedBundledSkillsSourceDir(
  options: Pick<CopyBundledSkillsOptions, "sourceDir" | "env"> = {}
): string {
  const env = options.env ?? process.env;
  return options.sourceDir
    ?? (env[BUNDLED_SKILLS_SOURCE_ENV_VAR] !== undefined && env[BUNDLED_SKILLS_SOURCE_ENV_VAR] !== ""
      ? env[BUNDLED_SKILLS_SOURCE_ENV_VAR]
      : resolveBundledSkillsSourceDir());
}

function resolveHomeDir(options: CopyBundledSkillsOptions): string {
  return resolve(options.homeDir ?? homedir());
}

export function resolveBundledSkillsInstalledDir(options: Pick<CopyBundledSkillsOptions, "installedDir" | "homeDir"> = {}): string {
  if (options.installedDir) {
    return resolve(options.installedDir);
  }
  if (options.homeDir) {
    return join(resolveHomeDir(options), ".clawperator", "bundled-skills");
  }
  return DEFAULT_BUNDLED_SKILLS_DIR;
}

export function resolveClaudeSkillsDir(options: CopyBundledSkillsOptions): string {
  if (options.claudeSkillsDir) {
    return resolve(options.claudeSkillsDir);
  }
  return join(resolveHomeDir(options), ".claude", "skills");
}

export function resolveCodexSkillsDir(options: CopyBundledSkillsOptions): string {
  if (options.codexSkillsDir) {
    return resolve(options.codexSkillsDir);
  }
  const env = options.env ?? process.env;
  const codexHome = options.codexHome ?? env.CODEX_HOME;
  if (codexHome !== undefined && codexHome !== "") {
    return join(resolve(codexHome), "skills");
  }
  return join(resolveHomeDir(options), ".codex", "skills");
}

export function resolveAgentsSkillsDir(options: CopyBundledSkillsOptions): string {
  if (options.agentsSkillsDir) {
    return resolve(options.agentsSkillsDir);
  }
  return join(resolveHomeDir(options), ".agents", "skills");
}

function resolveAgentDiscoveryDirs(options: CopyBundledSkillsOptions): BundledSkillDiscoveryDirEntry[] {
  return [
    { label: "claude", dir: resolveClaudeSkillsDir(options) },
    { label: "codex", dir: resolveCodexSkillsDir(options) },
    { label: "agents", dir: resolveAgentsSkillsDir(options) },
  ];
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

async function discoverBundledSkills(sourceDir: string): Promise<string[]> {
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

export async function listPackagedBundledSkills(sourceDir = resolveBundledSkillsSourceDir()): Promise<string[]> {
  return discoverBundledSkills(sourceDir);
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export function normalizeOwnedSkillTarget(installedDir: string, skillName: string): string {
  return resolve(installedDir, skillName);
}

function normalizeLegacyOwnedSkillTarget(installedDir: string, skillName: string): string {
  return resolve(dirname(installedDir), "agent-skills", skillName);
}

function legacyOwnedSkillTargets(installedDir: string, skillName: string): string[] {
  const target = normalizeLegacyOwnedSkillTarget(installedDir, skillName);
  return target === normalizeOwnedSkillTarget(installedDir, skillName) ? [] : [target];
}

async function resolveSymlinkTarget(path: string): Promise<string | undefined> {
  try {
    const target = await readlink(path);
    return resolve(dirname(path), target);
  } catch {
    return undefined;
  }
}

export interface ManagedBundledSkillLinkInspection {
  ok: boolean;
  status: "missing" | "conflict" | "broken" | "wrong-target" | "ok";
  actualTarget?: string;
  expectedTarget: string;
}

export async function inspectManagedBundledSkillLink(
  linkPath: string,
  installedDir: string,
  skillName: string
): Promise<ManagedBundledSkillLinkInspection> {
  const expectedTarget = normalizeOwnedSkillTarget(installedDir, skillName);

  let entryStat;
  try {
    entryStat = await lstat(linkPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        ok: false,
        status: "missing",
        expectedTarget,
      };
    }
    throw error;
  }

  if (!entryStat.isSymbolicLink()) {
    return {
      ok: false,
      status: "conflict",
      expectedTarget,
    };
  }

  const resolvedTarget = await resolveSymlinkTarget(linkPath);
  if (resolvedTarget === undefined) {
    return {
      ok: false,
      status: "broken",
      expectedTarget,
    };
  }

  try {
    await stat(resolvedTarget);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        ok: false,
        status: "broken",
        actualTarget: resolvedTarget,
        expectedTarget,
      };
    }
    throw error;
  }

  if (resolvedTarget !== expectedTarget) {
    return {
      ok: false,
      status: "wrong-target",
      actualTarget: resolvedTarget,
      expectedTarget,
    };
  }

  return {
    ok: true,
    status: "ok",
    actualTarget: resolvedTarget,
    expectedTarget,
  };
}

async function isManagedBundledSkillSymlink(linkPath: string, installedDir: string, skillName: string): Promise<boolean> {
  const inspection = await inspectManagedBundledSkillLink(linkPath, installedDir, skillName);
  const legacyTargets = new Set(legacyOwnedSkillTargets(installedDir, skillName));
  // A dangling symlink that points at the correct expected target is still considered managed:
  // it means Clawperator previously installed the link but the install dir was subsequently
  // removed. The install/update flow is allowed to recreate it.
  if (!inspection.ok && inspection.status === "broken" && inspection.actualTarget === inspection.expectedTarget) {
    return true;
  }
  // The public rename is a clean break, but rerunning the new install flow
  // should still be able to replace discovery links that Clawperator itself
  // previously managed when they still point at the pre-rename install store.
  if (!inspection.ok && inspection.actualTarget !== undefined && legacyTargets.has(inspection.actualTarget)) {
    return true;
  }
  return inspection.ok;
}

async function ensureManagedSymlink(targetPath: string, linkPath: string, installedDir: string, skillName: string): Promise<void> {
  const exists = await pathExistsNoFollow(linkPath);
  if (exists) {
    const managed = await isManagedBundledSkillSymlink(linkPath, installedDir, skillName);
    if (!managed) {
      throw new Error(`Refusing to overwrite non-Clawperator skill entry: ${linkPath}`);
    }
    await rm(linkPath, { recursive: true, force: true });
  }

  await mkdir(dirname(linkPath), { recursive: true });
  await symlink(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
}

async function assertManagedSymlinkWritable(linkPath: string, installedDir: string, skillName: string): Promise<void> {
  const exists = await pathExistsNoFollow(linkPath);
  if (!exists) {
    return;
  }

  const managed = await isManagedBundledSkillSymlink(linkPath, installedDir, skillName);
  if (!managed) {
    throw new Error(`Refusing to overwrite non-Clawperator skill entry: ${linkPath}`);
  }
}

async function removeStaleBundledSkillSymlinks(agentDir: string, activeSkills: Set<string>, installedDir: string): Promise<void> {
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
    if (
      resolvedTarget === normalizeOwnedSkillTarget(installedDir, entry)
      || legacyOwnedSkillTargets(installedDir, entry).includes(resolvedTarget ?? "")
    ) {
      await rm(entryPath, { recursive: true, force: true });
    }
  }
}

async function removeStaleInstalledSkills(installedDir: string, activeSkills: Set<string>): Promise<void> {
  const entries = await readdir(installedDir);

  for (const entry of entries) {
    if (entry === VERSION_FILENAME || activeSkills.has(entry)) {
      continue;
    }

    const entryPath = join(installedDir, entry);

    let entryStat;
    try {
      entryStat = await stat(entryPath);
    } catch {
      continue;
    }

    if (!entryStat.isDirectory()) {
      continue;
    }

    if (!(await pathExists(join(entryPath, "SKILL.md")))) {
      continue;
    }

    await rm(entryPath, { recursive: true, force: true });
  }
}

export async function copyBundledSkills(
  options: CopyBundledSkillsOptions = {}
): Promise<CopyBundledSkillsSuccess | CopyBundledSkillsError> {
  const sourceDir = resolvePackagedBundledSkillsSourceDir(options);
  const installedDir = resolveBundledSkillsInstalledDir(options);
  const agentDiscoveryDirs = resolveAgentDiscoveryDirs(options);

  let sourceStat;
  try {
    sourceStat = await stat(sourceDir);
  } catch {
    return {
      ok: false,
      code: "BUNDLED_SKILLS_SOURCE_NOT_FOUND",
      message: `Bundled-skills source directory not found: ${sourceDir}`,
    };
  }

  if (!sourceStat.isDirectory()) {
    return {
      ok: false,
      code: "BUNDLED_SKILLS_SOURCE_NOT_FOUND",
      message: `Bundled-skills source path is not a directory: ${sourceDir}`,
    };
  }

  try {
    const skills = await discoverBundledSkills(sourceDir);
    if (skills.length === 0) {
      return {
        ok: false,
        code: "BUNDLED_SKILLS_SOURCE_EMPTY",
        message: `No packaged bundled-skills with SKILL.md were found in ${sourceDir}`,
      };
    }
    await ensureDirectory(installedDir);
    for (const { dir } of agentDiscoveryDirs) {
      await ensureDirectory(dir);
    }

    for (const skillName of skills) {
      for (const { dir } of agentDiscoveryDirs) {
        await assertManagedSymlinkWritable(join(dir, skillName), installedDir, skillName);
      }
    }

    for (const skillName of skills) {
      const sourceSkillDir = join(sourceDir, skillName);
      const targetSkillDir = join(installedDir, skillName);
      await rm(targetSkillDir, { recursive: true, force: true });
      await cp(sourceSkillDir, targetSkillDir, { recursive: true, force: true, dereference: true });
      for (const { dir } of agentDiscoveryDirs) {
        await ensureManagedSymlink(targetSkillDir, join(dir, skillName), installedDir, skillName);
      }
    }

    const activeSkills = new Set(skills);
    await removeStaleInstalledSkills(installedDir, activeSkills);
    for (const { dir } of agentDiscoveryDirs) {
      await removeStaleBundledSkillSymlinks(dir, activeSkills, installedDir);
    }
    await writeFile(join(installedDir, VERSION_FILENAME), `${options.cliVersion ?? getCliVersion()}\n`, "utf8");

    return {
      ok: true,
      skills,
      installedDir,
      agentDiscoveryDirs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: "BUNDLED_SKILLS_INSTALL_FAILED",
      message,
    };
  }
}

export async function listInstalledBundledSkills(installDir = DEFAULT_BUNDLED_SKILLS_DIR): Promise<Array<{ name: string; skillPath: string }>> {
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

export async function readBundledSkillSymlinkTarget(path: string): Promise<string | undefined> {
  return resolveSymlinkTarget(path);
}
