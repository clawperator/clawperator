import type { RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import type { DoctorCheckResult } from "../../../contracts/doctor.js";
import { inspectVideoDependencies, videoDependencyError, VIDEO_DEPENDENCIES_DOCS, VIDEO_DEPENDENCIES_HINT } from "../../evidence/videoDependencies.js";

export async function checkVideoDependencies(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const issues = await inspectVideoDependencies(config.runner);
  const evidence = { capability: "video-recording", dependencies: issues };
  if (issues.length === 0) return {
    id: "host.video.dependencies", status: "pass",
    summary: "Optional video recording host dependencies are available.", evidence,
  };
  const error = videoDependencyError(issues);
  return {
    id: "host.video.dependencies", status: "warn", code: error.code,
    summary: error.message,
    detail: "Optional for normal device readiness and still screenshots; required for video recording.",
    evidence,
    fix: {
      title: "Install or repair optional video recording dependencies",
      platform: "any",
      steps: [{ kind: "manual", value: VIDEO_DEPENDENCIES_HINT }],
      docsUrl: VIDEO_DEPENDENCIES_DOCS,
    },
  };
}
