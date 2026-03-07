# TODO Before Public Release

This checklist tracks the remaining pre-launch work after the release, docs, installer, landing, skills, and doctor improvements completed on March 6-8, 2026.

## Remaining Work

- [ ] Implement explicit CLI/APK version compatibility checks. See `tasks/version-handshaking/plan.md`.
- [ ] Add a compatibility reference doc and troubleshooting coverage for version mismatch remediation.
- [ ] Add `clawperator version --check-compat` so users and agents can verify the installed pair directly.
- [ ] Decide whether execution-time compatibility enforcement should ship in the normal execution path or remain doctor-only for now.
- [ ] Run a real-device validation pass covering installer flow, APK install/upgrade, doctor, and handshake on the release APK.

## Current State

- Release automation, APK hosting, and stable redirect URLs are in place.
- Public docs and landing sites are live and aligned to the hosted install flow.
- Skills install/update/search/run support exists in the Node CLI.
- Doctor now distinguishes critical failures from warnings and skips handshake when the APK is missing.
