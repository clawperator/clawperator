# Android Operator APK Release Strategy - Human Tasks

## Purpose

This file lists the tasks that require human access, human decisions, or human approval. These items should be completed in parallel with repo implementation work.

## Status Model

Use these markers while working through the list:

- `[ ]` not started
- `[-]` in progress
- `[x]` complete

## 1. Release Policy Decisions

- [ ] Confirm that stable releases must always be signed with the production release keystore.
- [ ] Confirm whether prerelease builds (`alpha`, `beta`) must also use the production release keystore.
  - Recommendation: yes, if operationally possible.
- [ ] Confirm that only tags created from `main` are allowed to publish stable releases.
  - Recommendation: yes.
- [ ] Confirm whether Cloudflare Worker deployment will be:
  - manual at first
  - or automated from GitHub Actions
- [ ] Confirm whether `/operator-beta.apk` should ship in the first implementation or be deferred until after stable is working.
  - Recommendation: implement now because the metadata model already supports it.

## 2. Android Release Signing

- [ ] Generate a production Android signing keystore for Clawperator.
- [ ] Record and securely store:
  - keystore filename
  - key alias
  - keystore password
  - key password
- [ ] Decide the long-term backup location for the keystore.
  - Requirement: at least one secure backup outside a single laptop.
- [ ] Decide who has access to the keystore and credentials.
- [ ] Base64-encode the keystore for GitHub Actions secret storage.
- [ ] Perform a local dry run with the release keystore to confirm Gradle signing works before wiring CI.

## 3. GitHub Repository Secrets

- [ ] Add `NPM_TOKEN` to GitHub Actions secrets.
- [ ] Add Android signing secrets to GitHub Actions secrets.
  - Suggested names:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- [ ] Add Cloudflare credentials for R2 upload.
  - Exact names can be finalized during workflow implementation.
- [ ] If Worker deployment will be automated, add Worker deployment credentials too.
- [ ] Confirm whether secrets should live at repo scope or org scope.
  - Recommendation: org scope if multiple repos or maintainers will share ownership.

## 4. Cloudflare Setup

- [ ] Decide which Cloudflare account will own the APK hosting infrastructure.
- [ ] Confirm billing ownership for that account.
- [ ] Create the R2 bucket for release artifacts.
  - Recommended bucket purpose: Clawperator release binaries only.
- [ ] Configure the custom domain `downloads.clawperator.com`.
- [ ] Ensure DNS for `clawperator.com` can support the `/operator.apk` routing approach.
- [ ] Decide whether the Worker will live in the same account as the R2 bucket.
  - Recommendation: yes, to reduce cross-account friction.
- [ ] Create the Worker that will serve redirect logic, or approve CI to deploy it later.
- [ ] Create least-privilege API credentials for CI.
- [ ] Verify that the credentials can:
  - upload objects to R2
  - update metadata pointer files
  - optionally deploy/update the Worker

## 5. Domain and Routing Approval

- [ ] Approve the public URL structure:
  - `https://clawperator.com/operator.apk`
  - `https://downloads.clawperator.com/operator/latest.json`
  - `https://clawperator.com/operator-beta.apk`
- [ ] Confirm whether `clawperator.com/operator.apk` should be a Worker route or a redirect rule backed by a Worker fetch.
  - Recommendation: Worker route.
- [ ] Approve cache behavior:
  - versioned APKs are immutable and long cached
  - metadata is short cached
  - redirect path is short cached or not stored

## 6. npm Publishing Ownership

- [ ] Confirm which npm account or organization owns the `clawperator` package.
- [ ] Ensure the token used for CI has publish rights to that package.
- [ ] Confirm tag policy:
  - prerelease tags publish to npm `alpha`
  - stable tags publish to npm `latest`

## 7. Documentation and Ownership Records

- [ ] Record who owns:
  - GitHub repo admin access
  - Cloudflare account access
  - npm package ownership
  - Android signing key custody
- [ ] Record where the following are stored:
  - keystore backup
  - release credentials
  - rollback instructions
- [ ] Approve `docs/RELEASING.md` once it is drafted so it becomes the operational runbook.

## 8. Test and Verification Tasks

- [ ] Provide or approve a safe prerelease tag for end-to-end testing.
  - Example: `v1.0.0-alpha.1`
- [ ] Review the first successful prerelease pipeline run.
- [ ] Manually verify that the prerelease:
  - created a GitHub prerelease
  - uploaded the APK to R2
  - generated correct checksum metadata
  - did not move the stable pointer
- [ ] Manually verify the first stable release pipeline run.
- [ ] Validate installation on a real Android device using:
  - direct `adb install`
  - `clawperator.com/operator.apk`
  - `scripts/install.sh`
- [ ] Validate that an upgraded build installs cleanly over the previous release-signed build.

## 9. Rollback Readiness

- [ ] Decide who has authority to approve a stable rollback.
- [ ] Confirm who can edit the stable metadata pointer in an incident.
- [ ] Confirm whether rollback is:
  - manual pointer edit
  - or a scripted operation
- [ ] Approve the rollback principle:
  - never replace versioned APK files
  - only move `latest.json` back to a known-good version

## 10. Recommended Order

1. Finalize release policy decisions.
2. Generate and back up the Android release keystore.
3. Set up Cloudflare account resources and credentials.
4. Add GitHub Actions secrets.
5. Review the implementation PR for workflows and docs.
6. Run one prerelease dry run.
7. Run one stable release after prerelease validation passes.

## Notes for the Implementing Agent

The implementation can proceed before every item here is complete, but the following are hard blockers for a successful end-to-end release:

- Android release keystore and secrets
- Cloudflare R2 bucket and credentials
- GitHub Actions secrets

Worker deployment can be deferred if the initial rollout uses a simpler redirect path, but the R2 bucket and metadata contract cannot be deferred.
