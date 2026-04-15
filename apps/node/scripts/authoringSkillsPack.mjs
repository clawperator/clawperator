import { cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authoringSkillsDir = resolve(packageDir, "authoring-skills");
const statePath = resolve(packageDir, ".authoring-skills-pack-state.json");

async function prepack() {
  const entries = await readdir(authoringSkillsDir);
  const symlinks = [];

  for (const entry of entries) {
    const entryPath = resolve(authoringSkillsDir, entry);
    const stat = await lstat(entryPath);
    if (!stat.isSymbolicLink()) {
      continue;
    }

    const target = await readlink(entryPath);
    const resolvedTarget = resolve(authoringSkillsDir, target);
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
    const entryPath = resolve(authoringSkillsDir, entry);
    await rm(entryPath, { recursive: true, force: true });
    await symlink(target, entryPath);
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
