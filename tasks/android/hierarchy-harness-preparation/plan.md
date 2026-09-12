# Make hierarchy regression preparation deterministic

R12, follow-up to R10. Status: implemented locally; debug API 36 preparation verified; release/API 35 proof remains blocked. One implementation PR.

## Outcome and observed failure

The hierarchy harness must reach a verified Settings homepage from a fresh launch, ordinary restored subpage, or restored search activity. At `a44ad0bf`, `run.py` asserts that `open com.android.settings` succeeded before trying its bounded Back recovery. A restored search page belongs to `com.google.android.settings.intelligence`, so the exact-package launch wait can fail before recovery is reachable.

This is harness preparation, not a reason to weaken `open_app` success or sensitive-root assertions. Simply launching the Settings intent did not reliably clear the restored search task in the audit; verify the resulting screen.

## Scope and decisions

- Implement bounded, observable preparation in the harness. On its dedicated test emulator, explicitly stopping the known Settings/search processes is permitted if needed; do not clear application data, reset the device, or alter network settings.
- Establish the real homepage and a known starting position using meaningful platform selectors. A search field or the words `Search settings` alone must not mistake the search activity for the homepage. Respect the device lock already used by the harness.
- Treat preparation failures separately from query/XML parity failures. Retain commands, selected package, observed foreground package where available, deadlines and original failures. A valid preparation sequence may recover known restored navigation state; it may not retry arbitrary transport failures until green.
- Preserve the Internet sensitive-root, repeated-query, switch-state/bounds, raw/MCP/XML parity, PNG and Display control assertions. Do not change the Display scroll to hide R11.
- Preserve bounded cleanup, selected-device isolation and the manual-only CI policy. Do not weaken the production foreground-package contract or redesign runtime navigation timeouts in this pack. If runtime diagnostics prevent useful preparation evidence, record the specific follow-up instead of absorbing a runtime rewrite.

## Ownership and dependencies

- `validation/sensitive-hierarchy-access/run.py`: preparation, failure artifacts and cleanup.
- `validation/sensitive-hierarchy-access/test_assertions.py` and new adjacent tests as needed: mocked preparation paths and bounded failure.
- `validation/sensitive-hierarchy-access/ci-device.sh`: fixture setup for both variants.
- `.github/workflows/sensitive-hierarchy.yml`: manual release gate, not automatic PR/push execution.
- `validation/sensitive-hierarchy-access/README.md`: durable starting-state, allowed-mutation and failure-stage documentation.

R10 is merged. Preparation can be implemented and validated independently of R11/R13. A complete integrated harness pass requires their runtime defects to be resolved; retain those failures without marking preparation itself broken when its postcondition passed. Coordinate edits to this harness with both packs. Use the docs-author skill if public authored docs change.

## Implementation status (13 September 2026)

The user authorized the assigned API 36 emulator in place of API 35 for this
investigation. Bounded preparation, failure staging, CI Operator launch setup,
regression tests and durable documentation are implemented. See the
[validation record](../../../validation/sensitive-hierarchy-access/README.md#r12-local-evidence-and-remaining-gates).
Debug fresh/subpage/search states reached identical verified homepage anchors.
The full runs failed the unchanged sensitivity assertion on API 36. Release
launches returned correlated `COMMAND_TIMEOUT`; release starting-state proof and
the original API 35 release gate remain unproven. Keep this pack for those
specific follow-ups; do not repeat uncertain mutations or weaken assertions.
