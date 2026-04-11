#!/usr/bin/env node

const mode = process.argv[2] || "valid";
const skillId = process.env.TEST_SKILL_ID || "com.test.skill-result";
const prefix = "[Clawperator-Skill-Result]";

const basePayload = {
  contractVersion: "1.0.0",
  skillId,
  goal: {
    kind: "set",
    target: "demo",
  },
  inputs: {
    targetPercent: 40,
  },
  status: "success",
  checkpoints: [
    {
      id: "text-checkpoint",
      status: "ok",
      evidence: {
        kind: "text",
        text: "Discharge to 40%",
      },
    },
    {
      id: "json-checkpoint",
      status: "ok",
      evidence: {
        kind: "json",
        value: {
          observed: true,
        },
      },
    },
    {
      id: "exec-checkpoint",
      status: "skipped",
      evidence: {
        kind: "result_envelope_ref",
        execEnvelopeIndex: 0,
        stepResultId: "step-1",
      },
    },
  ],
  terminalVerification: {
    status: "verified",
    expected: {
      kind: "text",
      text: "Discharge to 40%",
    },
    observed: {
      kind: "text",
      text: "Discharge to 40%",
    },
  },
  execEnvelopes: [
    {
      commandId: "cmd-1",
      taskId: "task-1",
      status: "success",
      stepResults: [
        {
          id: "step-1",
          actionType: "tap",
          success: true,
          data: {
            selector: "text=Save",
          },
        },
      ],
      error: null,
    },
  ],
  diagnostics: {
    runtimeState: "healthy",
    warnings: ["minor warning"],
  },
};

function emitFrame(payload) {
  console.log("progress:before-frame");
  console.log(prefix);
  console.log(JSON.stringify(payload));
}

switch (mode) {
  case "valid":
    emitFrame(basePayload);
    break;
  case "legacy":
    console.log("legacy-output-only");
    break;
  case "marker-progress-only":
    console.log("progress:before-marker");
    console.log(prefix);
    console.log("progress:after-marker");
    break;
  case "marker-progress-before-valid-frame":
    console.log("progress:before-marker");
    console.log(prefix);
    console.log("progress:after-marker");
    emitFrame(basePayload);
    break;
  case "frame-with-trailing-output":
    emitFrame(basePayload);
    console.log("trailing-output-after-frame");
    break;
  case "malformed-json":
    console.log(prefix);
    console.log("{not-json");
    break;
  case "multiple":
    emitFrame(basePayload);
    console.log(prefix);
    console.log(JSON.stringify(basePayload));
    break;
  case "unsupported-major":
    emitFrame({
      ...basePayload,
      contractVersion: "2.0.0",
    });
    break;
  case "newer-minor":
    emitFrame({
      ...basePayload,
      contractVersion: "1.2.0",
      extraField: "future",
    });
    break;
  case "raw-envelope-data":
    emitFrame({
      ...basePayload,
      execEnvelopes: [
        {
          commandId: "cmd-raw",
          taskId: "task-raw",
          status: "success",
          stepResults: [
            {
              id: "step-raw",
              actionType: "wait",
              success: true,
              data: {
                duration_ms: 1000,
                ok: true,
                retries: 0,
                note: "kept",
              },
            },
          ],
          error: null,
        },
      ],
    });
    break;
  case "with-source":
    emitFrame({
      ...basePayload,
      source: {
        kind: "script",
      },
    });
    break;
  case "mismatch-skill-id":
    emitFrame({
      ...basePayload,
      skillId: "com.test.other-skill",
    });
    break;
  case "partial-frame-timeout":
    console.log("progress:before-frame");
    console.log(prefix);
    process.stdout.write("{\"contractVersion\":\"1.0.0\"");
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    break;
  case "fail":
    emitFrame({
      ...basePayload,
      status: "failed",
      checkpoints: [
        ...basePayload.checkpoints,
        {
          id: "terminal-state-verified",
          status: "failed",
          note: "value mismatch",
        },
      ],
      terminalVerification: {
        status: "failed",
        expected: {
          kind: "text",
          text: "Discharge to 40%",
        },
        observed: {
          kind: "text",
          text: "Discharge to 35%",
        },
      },
      diagnostics: {
        runtimeState: "poisoned",
      },
    });
    console.error("FAIL_OUTPUT:skill-result");
    process.exit(9);
    break;
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
