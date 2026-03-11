import { describe, it } from "node:test";
import assert from "node:assert";
import { extractSnapshotFromLogs, extractSnapshotsFromLogs } from "../../domain/executions/snapshotHelper.js";

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

  it("rejects TaskScopeDefault: marker (regression: published binary used this wrong marker)", () => {
    const lines = [
      "D/E       : TaskScopeDefault: <hierarchy rotation=\"0\">",
      "D/E       :   <node index=\"0\" text=\"Settings\" />",
      "D/E       : TaskScopeDefault: </hierarchy>",
    ];
    assert.strictEqual(extractSnapshotFromLogs(lines), null);
  });

  it("handles the exact logcat line format the Android app emits (D/E tag prefix)", () => {
    const lines = [
      "D/E       : [TaskScope] UI Hierarchy:",
      "D/E       : <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
      "D/E       : <hierarchy rotation=\"0\">",
      "D/E       :   <node index=\"0\" text=\"\" resource-id=\"\" class=\"android.widget.FrameLayout\" package=\"com.android.vending\" content-desc=\"\" clickable=\"false\" enabled=\"true\" bounds=\"[0,0][1080,2340]\" />",
      "D/E       : </hierarchy>",
    ];

    const result = extractSnapshotFromLogs(lines);
    assert.ok(result !== null, "snapshot must not be null");
    assert.ok(result.includes("<hierarchy"), "must include hierarchy tag");
    assert.ok(result.includes("com.android.vending"), "must include package content");
    assert.ok(!result.includes("D/E"), "must strip logcat tag prefix from extracted content");
  });

  it("returns the latest snapshot and preserves all snapshots in order", () => {
    const lines = [
      "D/E       : [TaskScope] UI Hierarchy:",
      "D/E       : <hierarchy rotation=\"0\">",
      "D/E       :   <node index=\"0\" text=\"First\" />",
      "D/E       : </hierarchy>",
      "D/E       : [TaskScope] UI Hierarchy:",
      "D/E       : <hierarchy rotation=\"0\">",
      "D/E       :   <node index=\"0\" text=\"Second\" />",
      "D/E       : </hierarchy>",
    ];

    assert.deepStrictEqual(extractSnapshotsFromLogs(lines), [
      '<hierarchy rotation="0">\n  <node index="0" text="First" />\n</hierarchy>',
      '<hierarchy rotation="0">\n  <node index="0" text="Second" />\n</hierarchy>',
    ]);
    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      '<hierarchy rotation="0">\n  <node index="0" text="Second" />\n</hierarchy>',
    );
  });
});
