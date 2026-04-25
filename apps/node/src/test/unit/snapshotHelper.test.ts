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

  it("drops interleaved Configuration log lines from full TaskScopeDefault snapshots", () => {
    const lines = [
      "D/TaskScopeDefault: [TaskScope] UI Hierarchy:",
      "D/TaskScopeDefault: <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
      "D/TaskScopeDefault: <hierarchy rotation=\"0\">",
      "V/Configuration: Updating configuration, locales updated from [] to [en_US]",
      "D/TaskScopeDefault:   <node index=\"0\" text=\"Settings\" />",
      "D/TaskScopeDefault: </hierarchy>",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" />",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("drops multiple interleaved Configuration log lines at different depths", () => {
    const lines = [
      "D/TaskScopeDefault: [TaskScope] UI Hierarchy:",
      "D/TaskScopeDefault: <hierarchy rotation=\"0\">",
      "V/Configuration: Updating configuration, locales updated from [] to [en_US]",
      "D/TaskScopeDefault:   <node index=\"0\" text=\"Root\">",
      "V/Configuration: Updating configuration, locales updated from [en_US] to [en_US]",
      "D/TaskScopeDefault:     <node index=\"0\" text=\"Child\" />",
      "D/TaskScopeDefault:   </node>",
      "D/TaskScopeDefault: </hierarchy>",
    ];

    const result = extractSnapshotFromLogs(lines);
    assert.ok(result !== null, "snapshot must not be null");
    assert.ok(!result.includes("Updating configuration"), "configuration logs must not enter XML");
    assert.strictEqual(
      result,
      [
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Root\">",
        "    <node index=\"0\" text=\"Child\" />",
        "  </node>",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("ignores non-snapshot log lines before the hierarchy marker", () => {
    const lines = [
      "V/Configuration: Updating configuration before snapshot",
      "D/TaskScopeDefault: [TaskScope] UI Hierarchy:",
      "D/TaskScopeDefault: <hierarchy rotation=\"0\">",
      "D/TaskScopeDefault:   <node index=\"0\" text=\"Settings\" />",
      "D/TaskScopeDefault: </hierarchy>",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" />",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("ignores non-snapshot log lines after the hierarchy closes", () => {
    const lines = [
      "D/TaskScopeDefault: [TaskScope] UI Hierarchy:",
      "D/TaskScopeDefault: <hierarchy rotation=\"0\">",
      "D/TaskScopeDefault:   <node index=\"0\" text=\"Settings\" />",
      "D/TaskScopeDefault: </hierarchy>",
      "V/Configuration: Updating configuration after snapshot",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" />",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("drops untagged lines while a snapshot block is open", () => {
    const lines = [
      "D/TaskScopeDefault: [TaskScope] UI Hierarchy:",
      "D/TaskScopeDefault: <hierarchy rotation=\"0\">",
      "Updating configuration, locales updated from [] to [en_US]",
      "D/TaskScopeDefault:   <node index=\"0\" text=\"Settings\" />",
      "D/TaskScopeDefault: </hierarchy>",
    ];

    const result = extractSnapshotFromLogs(lines);
    assert.ok(result !== null, "snapshot must not be null");
    assert.ok(!result.includes("Updating configuration"), "untagged noise must not enter XML");
    assert.strictEqual(
      result,
      [
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" />",
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

  it("extracts hierarchy xml from live logcat time-format TaskScopeDefault lines", () => {
    const lines = [
      "04-25 20:14:52.453 D/TaskScopeDefault(29817): [TaskScope] UI Hierarchy:",
      "04-25 20:14:52.454 D/TaskScopeDefault(29817): <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
      "04-25 20:14:52.455 D/TaskScopeDefault(29817): <hierarchy rotation=\"0\">",
      "04-25 20:14:52.456 V/Configuration(29817): Updating configuration, locales updated from [] to [en_US]",
      "04-25 20:14:52.457 D/TaskScopeDefault(29817):   <node index=\"0\" text=\"Settings\" />",
      "04-25 20:14:52.458 D/TaskScopeDefault(29817): </hierarchy>",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" />",
        "</hierarchy>",
      ].join("\n"),
    );
  });

  it("extracts hierarchy xml from live logcat time-format PID/TID lines", () => {
    const lines = [
      "04-25 20:14:52.453 29817 29817 D TaskScopeDefault: [TaskScope] UI Hierarchy:",
      "04-25 20:14:52.454 29817 29817 D TaskScopeDefault: <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
      "04-25 20:14:52.455 29817 29817 D TaskScopeDefault: <hierarchy rotation=\"0\">",
      "04-25 20:14:52.456 29817 29817 V Configuration: Updating configuration, locales updated from [] to [en_US]",
      "04-25 20:14:52.457 29817 29817 D TaskScopeDefault:   <node index=\"0\" text=\"Settings\" />",
      "04-25 20:14:52.458 29817 29817 D TaskScopeDefault: </hierarchy>",
    ];

    assert.strictEqual(
      extractSnapshotFromLogs(lines),
      [
        "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
        "<hierarchy rotation=\"0\">",
        "  <node index=\"0\" text=\"Settings\" />",
        "</hierarchy>",
      ].join("\n"),
    );
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
