import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  skillContractSchema,
  type SkillAgentConfig,
  type SkillContract,
} from "../../contracts/skills.js";
import { resolveRepoRelativeSkillPath } from "./pathUtils.js";

export interface SkillManifestMetadata {
  skillJsonPath: string;
  agent: SkillAgentConfig | null;
  contract: SkillContract | null;
}

export interface SkillManifestReadSuccess {
  ok: true;
  metadata: SkillManifestMetadata;
}

export interface SkillManifestReadFailure {
  ok: false;
  message: string;
}

export type SkillManifestReadResult = SkillManifestReadSuccess | SkillManifestReadFailure;

export interface SkillManifestFileReadSuccess {
  ok: true;
  skillJsonPath: string;
  raw: string;
}

export interface SkillManifestFileReadFailure {
  ok: false;
  skillJsonPath: string;
  message: string;
}

export type SkillManifestFileReadResult = SkillManifestFileReadSuccess | SkillManifestFileReadFailure;

function formatSkillJsonError(skillJsonPath: string, detail: string): string {
  return `Unable to read trusted skill result source metadata from ${skillJsonPath}: ${detail}`;
}

function parseAgentConfig(
  skillJsonPath: string,
  parsedUnknown: Record<string, unknown>
): { ok: true; agent: SkillAgentConfig | null } | SkillManifestReadFailure {
  if (!Object.prototype.hasOwnProperty.call(parsedUnknown, "agent")) {
    return { ok: true, agent: null };
  }

  const rawAgent = parsedUnknown.agent;
  if (typeof rawAgent !== "object" || rawAgent === null || Array.isArray(rawAgent)) {
    return {
      ok: false,
      message: formatSkillJsonError(skillJsonPath, "skill.json agent must be an object when present"),
    };
  }

  const agentRecord = rawAgent as Record<string, unknown>;
  const cli = typeof agentRecord.cli === "string" ? agentRecord.cli.trim() : "";
  if (cli.length === 0) {
    return {
      ok: false,
      message: formatSkillJsonError(skillJsonPath, "skill.json agent.cli must be a non-empty string when agent is present"),
    };
  }

  let cliPath: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(agentRecord, "cliPath")) {
    if (agentRecord.cliPath === null) {
      cliPath = null;
    } else if (typeof agentRecord.cliPath === "string" && agentRecord.cliPath.trim().length > 0) {
      cliPath = agentRecord.cliPath.trim();
    } else {
      return {
        ok: false,
        message: formatSkillJsonError(skillJsonPath, "skill.json agent.cliPath must be a non-empty string or null when present"),
      };
    }
  }

  let timeoutMs: number | undefined;
  if (Object.prototype.hasOwnProperty.call(agentRecord, "timeoutMs")) {
    if (
      typeof agentRecord.timeoutMs !== "number" ||
      !Number.isInteger(agentRecord.timeoutMs) ||
      agentRecord.timeoutMs <= 0
    ) {
      return {
        ok: false,
        message: formatSkillJsonError(skillJsonPath, "skill.json agent.timeoutMs must be a positive integer when present"),
      };
    }
    timeoutMs = agentRecord.timeoutMs;
  }

  return {
    ok: true,
    agent: {
      cli,
      cliPath,
      timeoutMs,
    },
  };
}

function parseContractConfig(
  skillJsonPath: string,
  parsedUnknown: Record<string, unknown>
): { ok: true; contract: SkillContract | null } | SkillManifestReadFailure {
  if (!Object.prototype.hasOwnProperty.call(parsedUnknown, "contract")) {
    return { ok: true, contract: null };
  }

  const parsed = skillContractSchema.safeParse(parsedUnknown.contract);
  if (!parsed.success) {
    return {
      ok: false,
      message: formatSkillJsonError(
        skillJsonPath,
        `skill.json contract is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")}`
      ),
    };
  }

  return {
    ok: true,
    contract: parsed.data,
  };
}

export function parseSkillManifestMetadata(
  skillJsonPath: string,
  parsedUnknown: unknown
): SkillManifestReadResult {
  if (typeof parsedUnknown !== "object" || parsedUnknown === null || Array.isArray(parsedUnknown)) {
    return {
      ok: false,
      message: formatSkillJsonError(skillJsonPath, "skill.json must contain a JSON object"),
    };
  }

  const parsedRecord = parsedUnknown as Record<string, unknown>;
  const agentResult = parseAgentConfig(skillJsonPath, parsedRecord);
  if (!agentResult.ok) {
    return agentResult;
  }

  const contractResult = parseContractConfig(skillJsonPath, parsedRecord);
  if (!contractResult.ok) {
    return contractResult;
  }

  return {
    ok: true,
    metadata: {
      skillJsonPath,
      agent: agentResult.agent,
      contract: contractResult.contract,
    },
  };
}

export async function readSkillManifestMetadata(
  repoRoot: string,
  skillPath: string
): Promise<SkillManifestReadResult> {
  const fileResult = await readSkillManifestFile(repoRoot, skillPath);
  if (!fileResult.ok) {
    return {
      ok: false,
      message: fileResult.message,
    };
  }

  try {
    const parsedUnknown = JSON.parse(fileResult.raw) as unknown;
    return parseSkillManifestMetadata(fileResult.skillJsonPath, parsedUnknown);
  } catch (error) {
    return {
      ok: false,
      message: formatSkillJsonError(fileResult.skillJsonPath, error instanceof Error ? error.message : String(error)),
    };
  }
}

export async function readSkillManifestFile(
  repoRoot: string,
  skillPath: string
): Promise<SkillManifestFileReadResult> {
  const skillJsonPath = resolveRepoRelativeSkillPath(repoRoot, join(skillPath, "skill.json"));
  try {
    const raw = await readFile(skillJsonPath, "utf-8");
    return {
      ok: true,
      skillJsonPath,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      skillJsonPath,
      message: formatSkillJsonError(skillJsonPath, error instanceof Error ? error.message : String(error)),
    };
  }
}
