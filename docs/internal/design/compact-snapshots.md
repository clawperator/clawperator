# Compact snapshot presentation

The public contract is [Snapshot Format](../../api/snapshot.md#compact-output-and-raw-artifacts).

## Implementation boundaries

`domain/observe/compactSnapshot.ts` owns pure XML projection and exclusive raw
artifact writing. CLI and MCP use that module after canonical capture. No
Android capture behavior, selector matching, action targeting, or raw default
contract changes. Existing runtime skill consumers read raw snapshot actions;
this opt-in presentation requires no sibling skill migration or version bump.

The saxes parser rejects malformed XML. A doctype event always throws before
projection can finish, so internal and external DTD/entity declarations cannot
be used. Built-in and numeric attribute entities are decoded by the parser.
Parsing continues beyond the returned node limit to validate the whole document
and count omitted nodes. The iterative stack follows XML child order rather
than trusting Android's `index` attribute, which may contain gaps.

The raw artifact is written before parsing using exclusive creation and private
file permissions. Malformed XML therefore remains inspectable when saving was
requested. The execution envelope is not rewritten internally. A presentation
failure retains it, and CLI exit-code selection explicitly recognizes snapshot
formatting/write errors even when that envelope reports successful capture.

MCP's general transport filter continues to remove host paths. Only the snapshot
presentation adapter restores generated `nodePath`, `parentPath`, and
`rawArtifactPath` fields. The strict MCP argument schema rejects caller-chosen
raw paths. A managed temporary directory and exclusive file creation isolate
saved snapshots; artifacts are not persistent storage and callers must retain
needed evidence outside temporary storage.

## Validation and compatibility

Local validation on 2026-09-13 used Node CLI 0.10.0 and the branch-built debug
Operator 0.10.0-d on a dedicated Android 16 / API 36 emulator. The Operator APK
was built, installed on the selected target, and its permissions enabled. No
other device was targeted. Settings was opened through the branch CLI and a
separate screenshot visually confirmed the screen.

An independent XML parser compared all projected fields against preorder paths
in each saved raw document: both 20-node prefixes and the complete 143-node tree
matched. Raw artifact bytes matched the raw response's XML string. The capture
had 64,998 raw XML bytes. Example one-run measurements:

| CLI output | Returned nodes | JSON response bytes | End-to-end milliseconds |
| --- | --- | --- | --- |
| Raw, with artifact | 143 in XML | 71,172 | 381 |
| Compact, 32-code-point fields | 20 | 9,191 | 338 |
| Compact, default field limit | 143 | 63,731 | 341 |

These are observations on one screen, not performance guarantees or evidence
that Android capture got faster. Transport metadata and host artifact path
lengths affect response sizes.

Live MCP stdio calls verified compact paths, counts, fields, managed raw files,
and parity with the shared projection. Raw MCP `maxChars: 100` returned matching
100-character XML prefixes in both output locations while preserving the full
raw artifact. Compact and raw MCP calls took 626 ms and 229 ms respectively in
that sample. A live CLI output collision returned
`SNAPSHOT_ARTIFACT_WRITE_FAILED`, exit 1, and the original successful capture
envelope without changing the existing file.

The Node suite passed 1,478 tests. Regression coverage includes malformed XML,
DTD/entity declarations, repeated IDs, empty-label controls, unknown state,
Unicode truncation, a 1,501-node tree, metadata preservation, exclusive file
writes, raw-mode compatibility, CLI validation/exit behavior, and MCP option
validation over stdio. The debug Android build passed. Public docs and generated
reference are validated through the documentation build.

Private raw captures, JSON responses, timing samples, and screenshot evidence
were retained in a host temporary directory outside tracked files. Live proof
covers this emulator and screen; it does not establish a device matrix, older
API behavior, a token budget, or a latency guarantee. Older XML without
visibility/sensitivity attributes is covered offline and produces null state.
