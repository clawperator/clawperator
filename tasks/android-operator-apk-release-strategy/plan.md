# Android Operator APK Release Strategy

## Current State

Done:

- docs site is live at `docs.clawperator.com`
- tagged releases build the signed Android APK
- tagged releases publish APK artifacts and checksums to R2
- tagged releases update `https://downloads.clawperator.com/operator/latest.json`
- `https://clawperator.com/operator.apk` redirects to the current stable APK
- `https://clawperator.com/apk` and `https://clawperator.com/install.apk` work as equivalent aliases
- Android release signing is configured and validated
- npm publishing is aligned to the same version/tag flow via Trusted Publishing

What remains is mostly installer validation and final product-surface cleanup.

## Remaining Work

### Workstream 4: `install.sh` APK Awareness

Status:

- mostly implemented in [`scripts/install.sh`](../../scripts/install.sh)

Already done:

- resolves `latest.json`
- downloads the APK and checksum
- verifies SHA-256
- supports optional `adb install -r`
- points at `https://downloads.clawperator.com/operator/latest.json` by default

Remaining tasks:

1. Run a full end-to-end test of `scripts/install.sh` against the live hosted APK flow.
2. Verify behavior on a real Android device with:
   - no APK installed
   - an older release-signed APK already installed
3. Verify the installer messaging and fallback behavior when:
   - `adb` is missing
   - multiple devices are connected
   - checksum verification fails
4. Decide whether the script should mention only `operator.apk` publicly or also surface `/apk` and `/install.apk` as convenience URLs.

Acceptance criteria:

- a clean machine can use `scripts/install.sh` to fetch and verify the latest APK
- a connected device can be upgraded via the installer without manual artifact hunting
- failure modes are understandable and do not leave ambiguity about next steps

### Workstream 5: Documentation and Product Surface

Status:

- partially complete

Already done:

- release runbook exists in [`docs/RELEASING.md`](../../docs/RELEASING.md)
- setup and troubleshooting docs point toward the hosted APK flow
- docs site is live

Remaining tasks:

1. Update install-facing docs to reflect the live stable redirect flow precisely.
2. Decide the canonical public install URL for docs and product copy:
   - likely keep `https://clawperator.com/operator.apk` as canonical
   - treat `/apk` and `/install.apk` as convenience aliases
3. Verify all user-facing docs are consistent:
   - [`README.md`](../../README.md)
   - [`docs/first-time-setup.md`](../../docs/first-time-setup.md)
   - [`docs/troubleshooting.md`](../../docs/troubleshooting.md)
   - [`apps/node/README.md`](../../apps/node/README.md)
4. Remove this planning doc once installer validation is complete.

Acceptance criteria:

- docs consistently describe the real release/install path
- there is one obvious stable install URL for users
- no stale references remain to GitHub Releases as the primary install method

## Recommended Next Task

The next AI-agent task should be:

1. exercise `scripts/install.sh` against the live infrastructure
2. fix any installer issues discovered
3. update user-facing docs based on the verified installer behavior
4. report exactly what still requires a real-device manual check

## Definition of Done for This Task

This task can be considered complete when:

- `scripts/install.sh` is verified against the live hosted APK flow
- the stable hosted APK path is documented cleanly
- remaining manual checks are reduced to real-device validation only
