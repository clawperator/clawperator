import { describe, it } from "node:test";
import assert from "node:assert";
import { extractSnapshotFromLogs } from "../../domain/executions/snapshotHelper.js";

describe("extractSnapshotFromLogs", () => {
  it("extracts hierarchy xml from logcat -v tag output with abbreviated tags", () => {
    const lines = [
      "D/w       : [TaskRunnerManager] Task execution started",
      "D/E       : [TaskScope] Logging UI tree",
      "D/E       : [TaskScope] UI Hierarchy:",
      "D/E       : <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
      "D/E       : <hierarchy rotation=\"0\">",
      "D/E       :   <node index=\"0\" text=\"Settings\" resource-id=\"android:id/title\" />",
      "D/E       : </hierarchy>",
      "D/o       : [Clawperator-Command] stage-success commandId=cmd-1 taskId=task-1 id=logUiTree",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" resource-id=\"android:id/title\" />",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("preserves colons in marker and hierarchy lines", () => {
    const lines = [
      "D/E       : [TaskScope] UI Hierarchy:",
      "D/E       : <hierarchy rotation=\"0\">",
      "D/E       :   <node index=\"0\" text=\"UTC: Brisbane\" resource-id=\"android:id/title\" />",
      "D/E       : </hierarchy>",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"UTC: Brisbane\" resource-id=\"android:id/title\" />",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("returns null when no hierarchy marker is present", () => {
    const lines = [
      "D/w       : [TaskRunnerManager] Task execution started",
      "D/E       : [TaskScope] Logging UI tree",
    ];

    assert.strictEqual(extractSnapshotFromLogs(lines), null);
  });
});
