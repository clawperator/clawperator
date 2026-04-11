import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillAgentConfig } from "../../contracts/skills.js";

export interface SkillManifestMetadata {
  skillJsonPath: string;
  agent: SkillAgentConfig | null;
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

function formatSkillJsonError(skillJsonPath: string, detail: string): string {
  return `Unable to read trusted skill result source metadata from ${skillJsonPath}: ${detail}`;
}

function parseAgentConfig(
  skillJsonPath: string,
  parsedUnknown: Record<string, unknown>
): SkillManifestReadResult {
  if (!Object.prototype.hasOwnProperty.call(parsedUnknown, "agent")) {
    return {
      ok: true,
      metadata: {
        skillJsonPath,
        agent: null,
      },
    };
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
    metadata: {
      skillJsonPath,
      agent: {
        cli,
        cliPath,
        timeoutMs,
      },
    },
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

  return parseAgentConfig(skillJsonPath, parsedUnknown as Record<string, unknown>);
}

export async function readSkillManifestMetadata(
  repoRoot: string,
  skillPath: string
): Promise<SkillManifestReadResult> {
  const skillJsonPath = join(repoRoot, skillPath, "skill.json");
  try {
    const raw = await readFile(skillJsonPath, "utf-8");
    const parsedUnknown = JSON.parse(raw) as unknown;
    return parseSkillManifestMetadata(skillJsonPath, parsedUnknown);
  } catch (error) {
    return {
      ok: false,
      message: formatSkillJsonError(skillJsonPath, error instanceof Error ? error.message : String(error)),
    };
  }
}
