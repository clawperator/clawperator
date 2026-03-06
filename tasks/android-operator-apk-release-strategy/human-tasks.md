# Android Operator APK Release Strategy - Human Tasks

## Purpose

This file lists the tasks that require human access, human decisions, or human approval. These items should be completed in parallel with repo implementation work.

## Status Model

Use these markers while working through the list:

- `[ ]` not started
- `[-]` in progress
- `[x]` complete

## 1. Release Policy Decisions

- [x] Confirm that stable releases must always be signed with the production release keystore.
- [x] Confirm that releases use the production release keystore.
- [x] Confirm that only tags created from `main` are allowed to publish stable releases.
  - Current decision: allow tags to be created from any branch, so long as that does not introduce too much operational complexity.
- [ ] Confirm whether Cloudflare Worker deployment will be:
  - manual at first
  - or automated from GitHub Actions
  Answer: My preference is to configure automatic deployment through the Cloudflare dashboard. 
- [x] Confirm that there is no separate beta channel for now.
  - Current decision: use one stable release path only.

## 2. Android Release Signing

- [x] Generate a production Android signing keystore for Clawperator.
  - Created keystore: `clawperator-release.jks`
  - Alias: `clawperator-release`
  - Keystore type: `PKCS12`
  - Certificate subject: `CN=Clawperator, OU=Clawpilled, O=Towerdock Pty Ltd, L=Brisbane, ST=Qld, C=AU`
  - SHA-256 fingerprint: `FF:A5:20:15:98:FF:36:A9:99:9B:B5:FF:56:D3:F9:59:12:16:18:AB:CF:F1:12:9F:CB:6C:76:FC:50:F2:6F:30`
- [x] Record and securely store:
  - keystore filename
  - key alias
  - keystore password
  - key password
- [x] Decide the long-term backup location for the keystore.
  - Requirement: at least one secure backup outside a single laptop.
- [x] Decide who has access to the keystore and credentials.
  - Current state: stored in password manager with private operational metadata.
- [x] Base64-encode the keystore for GitHub Actions secret storage.
- [x] Perform a local dry run with the release keystore to confirm Gradle signing works before wiring CI.
  - Verified `./gradlew :app:clean :app:assembleRelease`
  - Verified APK signing with `apksigner verify --print-certs`

## 3. GitHub Repository Secrets

- [x] Add Android signing secrets to GitHub Actions secrets.
  - Repository secret names:
  - `CLAWPERATOR_ANDROID_KEYSTORE_BASE64`
  - `CLAWPERATOR_ANDROID_KEYSTORE_PASSWORD`
  - `CLAWPERATOR_ANDROID_KEY_ALIAS`
  - `CLAWPERATOR_ANDROID_KEY_PASSWORD`
- [x] Add Cloudflare credentials for R2 upload.
  - Repository secret names:
  - `CLAWPERATOR_CLOUDFLARE_ACCOUNT_ID`
  - `CLAWPERATOR_CLOUDFLARE_ACCESS_KEY_ID`
  - `CLAWPERATOR_CLOUDFLARE_SECRET_ACCESS_KEY`
  - `CLAWPERATOR_CLOUDFLARE_R2_BUCKET`
  - `CLAWPERATOR_CLOUDFLARE_DOWNLOADS_BASE_URL`
- [ ] If Worker deployment will be automated, add Worker deployment credentials too.
- [x] Confirm whether secrets should live at repo scope or org scope.
  - Current decision: repository scope.
  - Recommendation: org scope if multiple repos or maintainers will share ownership.

## 4. Cloudflare Setup

- [ ] Decide which Cloudflare account will own the APK hosting infrastructure.
- [ ] Confirm billing ownership for that account.
- [x] Create the R2 bucket for release artifacts.
  - Recommended bucket purpose: Clawperator release binaries only.
- [x] Configure the custom domain `downloads.clawperator.com`.
- [x] Ensure DNS for `clawperator.com` can support the `/operator.apk` routing approach.
- [ ] Decide whether the Worker will live in the same account as the R2 bucket.
  - Recommendation: yes, to reduce cross-account friction.
- [ ] Create the Worker that will serve redirect logic, or approve CI to deploy it later.
- [x] Create least-privilege API credentials for CI.
- [x] Verify that the credentials can:
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

- Deferred from this PR.
- Keep Android and Node versions aligned, but do not gate Android release work on npm publishing.
- [ ] Configure npm Trusted Publishing for GitHub Actions instead of token-based publish.
  - Package settings URL: `https://www.npmjs.com/package/clawperator/access`
  - Trusted Publisher type: `GitHub Actions`
  - Organization or user: `clawpilled`
  - Repository: `clawperator`
  - Workflow filename: `publish-npm.yml`
  - Environment name: leave empty unless GitHub Environments are introduced later
- [ ] After Trusted Publishing is configured on npm, update `.github/workflows/publish-npm.yml` to use OIDC-based publish instead of `NPM_TOKEN`.
  - Reason: npm token auth works, but publish is still being rejected; npm guidance is to move CI publishing to Trusted Publishing (OIDC).

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

- [ ] Provide or approve a safe release tag for end-to-end testing.
  - Example: `v0.1.0`
- [x] Review the first successful release pipeline run.
  - Verified with `v0.1.0-alpha.2` before simplifying version policy.
- [x] Manually verify that the release pipeline can:
  - create a GitHub Release
  - upload the APK to R2
  - generate checksum metadata
- [x] Manually verify the first stable `latest.json` update using a plain semver tag.
  - Verified with `v0.1.2`
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
3. Add GitHub Actions secrets.
4. Set up Cloudflare account resources and credentials.
5. Review the implementation PR for workflows and docs.
6. Run one release dry run.
7. Run one stable release after workflow validation passes.

## Notes for the Implementing Agent

The implementation can proceed before every item here is complete, but the following are hard blockers for a successful end-to-end release:

- Android release keystore and secrets
- Cloudflare R2 bucket and credentials
- GitHub Actions secrets

Worker deployment can be deferred if the initial rollout uses a simpler redirect path, but the R2 bucket and metadata contract cannot be deferred.
