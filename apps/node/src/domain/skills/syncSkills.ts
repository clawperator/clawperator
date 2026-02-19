/**
 * skills sync: stub. Future: sync and pin skills index/cache to a git ref.
 */
export interface SyncSkillsResult {
  ok: true;
  synced: false;
  message: string;
}

export interface SyncSkillsError {
  ok: false;
  code: string;
  message: string;
}

export async function syncSkills(_ref: string): Promise<SyncSkillsResult | SyncSkillsError> {
  return {
    ok: true,
    synced: false,
    message: "skills sync is not implemented; registry is read from skills/skills-registry.json (set CLAWPERATOR_SKILLS_REGISTRY to override).",
  };
}
