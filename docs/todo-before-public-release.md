# TODO Before Public Release

This checklist tracks the remaining pre-launch work after the release, docs, installer, landing, skills, and doctor improvements completed on March 6-8, 2026.

## Remaining Work

- [ ] Decide whether execution-time compatibility enforcement should ship in the normal execution path or remain doctor-only for now.
- [ ] Run a real-device validation pass covering installer flow, APK install/upgrade, doctor, and handshake on the release APK.

## Current State

- Release automation, APK hosting, and stable redirect URLs are in place.
- Public docs and landing sites are live and aligned to the hosted install flow.
- Skills install/update/search/run support exists in the Node CLI.
- Doctor now distinguishes critical failures from warnings and skips handshake when the APK is missing.
- CLI/APK version compatibility checks now ship in `clawperator doctor` and `clawperator version --check-compat`.

## npm Publishing

The workflow uses npm Trusted Publishing (OIDC) for authentication - `id-token: write` is required for this and must stay. Provenance attestation is a separate feature that also uses the OIDC token but requires the source repo to be public. Until the repo is public, the publish workflow runs with `NPM_CONFIG_PROVENANCE=false`. Re-enable `--provenance` in `.github/workflows/publish-npm.yml` when the repo goes public (`id-token: write` is already present and stays regardless).

## Deferred Items (Not in This Roadmap)

These are explicitly deferred beyond the current pre-release work:

- `--safe-logs` flag
- animated demos or video walkthroughs
- community/repository hygiene docs such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`
- CI for skills repo validation
- comprehensive integration tests
- `execute best-effort --goal`
