import { cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentSkillsDir = resolve(packageDir, "agent-skills");
const statePath = resolve(packageDir, ".agent-skills-pack-state.json");
const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";

function normalizeDirectorySymlinkTarget(target) {
  return process.platform === "win32" ? resolve(agentSkillsDir, target) : target;
}

async function prepack() {
  const entries = await readdir(agentSkillsDir);
  const symlinks = [];

  for (const entry of entries) {
    const entryPath = resolve(agentSkillsDir, entry);
    const stat = await lstat(entryPath);
    if (!stat.isSymbolicLink()) {
      continue;
    }

    const target = await readlink(entryPath);
    const resolvedTarget = resolve(agentSkillsDir, target);
    symlinks.push({ entry, target });

    await rm(entryPath, { force: true });
    await mkdir(entryPath, { recursive: true });
    await cp(resolvedTarget, entryPath, { recursive: true });
  }

  await writeFile(statePath, `${JSON.stringify({ symlinks }, null, 2)}\n`, "utf8");
}

async function postpack() {
  let rawState;
  try {
    rawState = await readFile(statePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  const { symlinks } = JSON.parse(rawState);
  for (const { entry, target } of symlinks) {
    const entryPath = resolve(agentSkillsDir, entry);
    await rm(entryPath, { recursive: true, force: true });
    await symlink(normalizeDirectorySymlinkTarget(target), entryPath, directorySymlinkType);
  }

  await rm(statePath, { force: true });
}

const mode = process.argv[2];
if (mode === "prepack") {
  await prepack();
} else if (mode === "postpack") {
  await postpack();
} else {
  throw new Error(`Unsupported mode: ${mode}`);
}
