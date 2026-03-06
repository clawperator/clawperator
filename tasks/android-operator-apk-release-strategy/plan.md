# Android Operator APK Release Strategy

## Objective

Ship a release system that satisfies all of the following at once:

- `https://clawperator.com/operator.apk` always installs the latest stable APK
- immutable versioned APKs remain available for rollback, audit, and reproducibility
- `scripts/install.sh` can fetch, verify, and optionally install the correct APK
- GitHub tag pushes drive the Android APK release process today
- Node publishing remains version-aligned and should publish via npm Trusted Publishing

## Recommendation

Adopt a hybrid model:

- GitHub Releases remains the release event and public changelog surface
- Cloudflare R2 plus `downloads.clawperator.com` becomes the canonical binary distribution origin
- `clawperator.com/operator.apk` becomes a short-cache redirect to the current stable version

This is the right split because GitHub Releases is good for provenance, release notes, and visibility, while R2 is better for stable URLs, cache control, metadata pointers, and future channel management.

## End State

### Public URLs

- `https://clawperator.com/operator.apk` -> latest stable redirect
- `https://downloads.clawperator.com/operator/latest.json` -> stable metadata pointer
- `https://downloads.clawperator.com/operator/vX.Y.Z/operator-vX.Y.Z.apk` -> immutable versioned APK
- `https://downloads.clawperator.com/operator/vX.Y.Z/operator-vX.Y.Z.apk.sha256` -> immutable checksum

### Release Source of Truth

Use `latest.json` as the source of truth for installers and redirect logic:

```json
{
  "version": "1.0.0",
  "channel": "stable",
  "apk_url": "https://downloads.clawperator.com/operator/v1.0.0/operator-v1.0.0.apk",
  "sha256_url": "https://downloads.clawperator.com/operator/v1.0.0/operator-v1.0.0.apk.sha256",
  "github_release_url": "https://github.com/clawpilled/clawperator/releases/tag/v1.0.0",
  "published_at": "2026-03-06T00:00:00Z"
}
```

## Decisions

### 0. Use one product version across Node and Android

For the immediate future, Clawperator should use a single release version for:

- the Node API / CLI package
- the Android operator APK

Examples:

- npm package `1.0.0` pairs with Android APK `1.0.0`

This should be treated as a release philosophy and workflow constraint until there is a deliberate API-versioning scheme that justifies decoupling them.

Implications:

- one git tag represents one coherent product release across both surfaces
- release notes should describe the combined Node and Android change set
- Android CI should publish the APK from that tag
- npm publishing should publish the Node package from that same tag using Trusted Publishing
- docs should describe one product version, not separate Android and Node release trains

Non-goal for now:

- do not introduce a separate API version, protocol version, or independent Android versioning track unless a concrete compatibility problem forces it

### 1. Keep GitHub Releases, but stop treating it as the install URL

GitHub Releases should still be created on every `v*` tag because Phase 6 in `docs/todo-soft-launch.md` already depends on that workflow and because GitHub is useful for:

- release notes
- human discovery
- immutable public artifacts
- provenance linked to a commit and tag

But docs, installer UX, and stable redirects should move to the Clawperator domain and R2 metadata model.

### 2. Build from the actual Android app module

The authoritative Android application module in this repo is `:app`, defined in [`settings.gradle.kts`](../../settings.gradle.kts).

That means the workflow should verify and use:

- `./gradlew :app:assembleRelease` for release APKs
- `./gradlew :app:assembleDebug` only for local debug flows

Do not rely on `:apps:android:app:assembleRelease`. That path is not declared in `settings.gradle.kts`.

### 3. Treat versioned APKs as immutable forever

Rollback must mean updating the pointer in `latest.json`, not replacing an existing file. This is necessary for:

- reproducibility
- checksum stability
- cache correctness
- incident rollback without artifact ambiguity

### 4. Use a Worker-backed redirect path, not a hardcoded static redirect

Prefer:

- `/operator.apk` handled by Cloudflare Worker
- Worker reads `latest.json`
- Worker 302 redirects to the versioned immutable APK URL

This avoids redirect drift, keeps channel logic centralized, and supports future auth or rate limiting if needed.

### 5. Release signing must be explicit before broad public launch

The current Android Gradle config in [`apps/android/app/app.gradle.kts`](../../apps/android/app/app.gradle.kts) falls back to a debug keystore when release env vars are absent. That is acceptable for internal CI continuity, but not for a durable public update story.

Before stable launch:

- provision a real release keystore
- wire it into CI secrets
- confirm upgrade continuity across versions with the same signing identity

## Human Intervention Required

The following items are not fully automatable from this repo alone and require explicit human setup, access, or policy decisions.

### Cloudflare Account and Domain Setup

Human tasks:

- complete or confirm the Cloudflare account ownership model for this infrastructure
- approve whether `/operator.apk` stays a Worker route or another Cloudflare-managed redirect mechanism
- create and deploy the Cloudflare Worker route for `/operator.apk` if Worker-based delivery is retained
- configure any remaining cache, DNS, and zone-level settings needed for the public stable URL

Why human-owned:

- domain ownership, billing, and account permissions live outside the repo
- credentials must be created and stored securely by an account owner

### Android Release Signing

Human tasks:

- generate the Android release keystore
- choose secure storage and backup policy for the keystore
- define the alias and passwords
- add the signing material to GitHub Actions secrets
- validate at least one signed upgrade path on a physical device before stable launch

Why human-owned:

- the keystore is the long-term trust anchor for app updates
- losing or rotating it incorrectly breaks the upgrade path for users

### GitHub Actions Secrets

Human tasks:

- add Android signing secrets
- add Cloudflare R2 credentials
- add any Worker deployment credentials if separate from R2 credentials

Why human-owned:

- secret issuance and repository/org secret scope require account access and operational judgment

### Release Policy Decisions

Human tasks:

- decide whether stable tags can be cut from any branch or only from `main`
- decide who is allowed to publish stable tags
- decide whether Cloudflare Worker deployment happens from the same release workflow or a separate infrastructure workflow

Why human-owned:

- these are governance and risk decisions, not implementation details

### Post-Launch Operations

Human tasks:

- approve rollbacks when a stable release is bad
- rotate credentials when needed
- maintain ownership documentation for Cloudflare, GitHub, npm, and signing material

Why human-owned:

- incident ownership and access control should remain explicit

## Workstreams

## Workstream 1: Artifact and Metadata Contract

### Deliverables

- R2 bucket structure for the stable channel
- JSON metadata contract for `latest.json`
- SHA-256 checksum generation contract
- naming convention for APK artifacts

### Plan

1. Standardize artifact names:
   - `operator-vX.Y.Z.apk`
   - `operator-vX.Y.Z.apk.sha256`
2. Store them under:
   - `operator/vX.Y.Z/`
3. Publish mutable pointers:
   - `operator/latest.json`
4. Include channel and GitHub release URL in metadata for supportability.

### Acceptance Criteria

- Any installer can resolve latest stable from one small JSON document
- Any published version can be downloaded directly later
- Rollback is a metadata update only

## Workstream 2: Cloudflare Delivery Layer

### Deliverables

- `downloads.clawperator.com` backed by R2
- Worker that serves metadata-aware redirects
- caching headers for APKs, metadata, and redirects

### Plan

1. Create R2 bucket for release artifacts.
2. Bind Worker to the bucket.
3. Implement routes:
   - `/operator.apk` -> stable channel redirect
   - `/operator/latest.json` passthrough
4. Set headers:
   - versioned APKs: `public, max-age=31536000, immutable`
   - metadata JSON: `public, max-age=60`
   - redirect response: short TTL or `no-store`
5. Set `Content-Type` to `application/vnd.android.package-archive`.
6. Set `Content-Disposition` so downloaded filename is versioned and human-readable.

### Human Dependencies

- Cloudflare account access
- DNS control for `clawperator.com`
- credentials for CI upload and optional Worker deployment

### Acceptance Criteria

- `clawperator.com/operator.apk` always resolves to the current stable immutable artifact
- clients never need to know bucket internals
- cache behavior is predictable and rollback-safe

## Workstream 3: GitHub Actions Release Pipeline

### Deliverables

- `.github/workflows/release-apk.yml`
- `.github/workflows/publish-npm.yml`
- release job that publishes to GitHub Releases and R2
- synchronized versioning between npm and Android artifacts

### Plan

1. Keep tag trigger `v*`, but protect execution through branch discipline and documentation.
2. In `release-apk.yml`:
   - checkout code
   - setup JDK 17
   - `chmod +x ./gradlew`
   - build `./gradlew :app:assembleRelease`
   - generate SHA-256 checksum
   - create GitHub Release using `softprops/action-gh-release`
   - upload APK to GitHub Release
   - upload APK and checksum to R2
   - write and upload `latest.json`
3. Treat plain semver tags as the release model for now.
4. In `publish-npm.yml`:
   - trigger on release tags
   - use npm Trusted Publishing (OIDC) instead of `NPM_TOKEN`
   - request `id-token: write`
5. Ensure the Android artifact version and npm package version are derived from the same release tag and remain in sync.

### Human Dependencies

- GitHub repository admin access to add secrets
- Cloudflare credentials already provisioned
- release keystore already provisioned
- a human-approved tagging policy

### Operational Rule

Stable releases update:

- GitHub Release
- R2 versioned artifact
- `latest.json`
- `/operator.apk` effective target

### Acceptance Criteria

- one tag push creates a complete APK release across GitHub and R2
- release notes stay visible on GitHub even though install traffic uses Clawperator URLs
- Android and Node artifacts remain version-aligned and publish from the same tag

## Workstream 4: `install.sh` APK Awareness

### Deliverables

- installer support for hosted APK retrieval
- checksum verification
- optional `adb install`
- clear behavior across macOS and Linux

### Plan

Update [install.sh](/Users/chrislacy/clawpilled/clawperator/scripts/install.sh) so it:

1. Downloads `https://downloads.clawperator.com/operator/latest.json`
2. Extracts `apk_url` and `sha256_url`
3. Downloads both files to `~/.clawperator/`
4. Verifies SHA-256 using:
   - `shasum -a 256` on macOS
   - `sha256sum` on Linux
5. If `adb` exists:
   - detect connected device count
   - if exactly one device is connected, offer install
   - use `adb install -r` for standard update flow
   - use `adb install -r -d` only when explicitly opting into downgrade support
6. Print next steps if no device is connected.

### Additional Installer Changes

- replace current GitHub Releases messaging in docs output with the stable Clawperator URL
- keep a fallback message that GitHub Releases contains historical artifacts and notes
- add failure messaging for checksum mismatch that explicitly tells the user to delete the local APK and retry

### Acceptance Criteria

- installer can fully set up CLI and retrieve the latest stable APK
- APK install path is verifiable and deterministic
- no successful install can occur after checksum mismatch

## Workstream 5: Documentation and Product Surface

### Deliverables

- updated docs references
- release and hosting documentation
- explicit human runbooks for secrets and rollback

### Plan

1. Update docs that currently point users to GitHub Releases:
   - [README.md](/Users/chrislacy/clawpilled/clawperator/README.md)
   - [apps/node/README.md](/Users/chrislacy/clawpilled/clawperator/apps/node/README.md)
   - [docs/first-time-setup.md](/Users/chrislacy/clawpilled/clawperator/docs/first-time-setup.md)
   - [docs/troubleshooting.md](/Users/chrislacy/clawpilled/clawperator/docs/troubleshooting.md)
   - doctor output strings in [buildChecks.ts](/Users/chrislacy/clawpilled/clawperator/apps/node/src/domain/doctor/checks/buildChecks.ts) where user-facing
2. Create `docs/RELEASING.md` to describe:
   - tag creation
   - APK build and publish flow
   - R2 pointer updates
   - rollback procedure
   - required secrets
3. Create or update `CHANGELOG.md` so GitHub Releases and docs tell the same story.
4. Document the current release model:
   - stable is the only public channel for now
   - beta and prerelease channels are deferred until there is a concrete need

### Acceptance Criteria

- docs no longer force end users through GitHub Releases for normal installation
- operators have a documented rollback and verification path
- public messaging matches actual infrastructure

## Workstream 6: Security and Release Management

### Deliverables

- keystore and CI secret plan
- checksum policy
- rollback process
- release promotion rules

### Plan

1. Define required secrets:
   - Android release signing secrets
   - Cloudflare R2 credentials
2. Define the npm follow-up plan:
   - keep npm Trusted Publishing configured for `publish-npm.yml`
   - do not depend on `NPM_TOKEN` for the long-term CI publish model
3. Before stable launch, verify:
   - release-signed APK installs cleanly over previous release-signed APK
   - app upgrade path works on a real device
4. Document rollback:
   - repoint `latest.json` to prior stable
   - purge metadata cache if needed
   - do not delete or replace the bad versioned file

### Human Dependencies

- keystore generation and custody
- secret creation in GitHub
- rollback approval authority

### Acceptance Criteria

- stable users receive only release-signed builds
- rollback can be completed without rebuilding artifacts
- credentials and ownership are explicit, not tribal knowledge

## Sequencing

## Phase A: Decide Release Policy

- choose Cloudflare account ownership model
- confirm domain routing for `downloads.clawperator.com`
- confirm npm Trusted Publishing is configured for `publish-npm.yml`

Human gate:

- this phase cannot be completed by code changes alone

## Phase B: Build Distribution Infrastructure

- create R2 bucket
- create Worker
- define metadata schema
- test redirects manually with a placeholder artifact

Human gate:

- account-level Cloudflare setup must exist before CI integration can work

## Phase C: Implement CI

- add `release-apk.yml`
- add `publish-npm.yml`
- add R2 upload and metadata generation
- validate task path using `:app:assembleRelease`

Human gate:

- required GitHub secrets must be present before the workflow can publish successfully

## Phase D: Update Installer and Docs

- modify `scripts/install.sh`
- update docs and doctor messaging
- add `docs/RELEASING.md`
- add `CHANGELOG.md`

## Phase E: Dry Run and Soft Launch

- publish a stable semver tag
- validate GitHub Release, R2 upload, metadata, redirect, checksum, and adb install path
- verify `latest.json` and hosted stable APK behavior end-to-end

Human gate:

- a human should review the first stable release end-to-end before relying on the pipeline

## Risks and Mitigations

### Risk: Wrong Gradle task path in CI

Mitigation:

- use `:app:assembleRelease`
- add a workflow step that prints resolved APK paths before upload

### Risk: Debug signing leaks into stable

Mitigation:

- hard-fail stable release job if release keystore secrets are absent

### Risk: Redirect caching serves stale latest version

Mitigation:

- redirect via Worker backed by short-cache metadata
- redirect to immutable versioned files only

### Risk: Installer breaks on platform checksum differences

Mitigation:

- add a tiny checksum helper that supports both `shasum` and `sha256sum`
- test on macOS and Ubuntu before launch

### Risk: GitHub and R2 drift

Mitigation:

- make one workflow produce both outputs from the same artifact in the same job
- include GitHub release URL inside metadata for operator verification

## Explicit Tasks to Add to Backlog

- create `.github/workflows/release-apk.yml`
- extend release job to upload APK and checksum to Cloudflare R2
- add metadata generation step for `latest.json`
- create Cloudflare Worker for `/operator.apk`
- update `scripts/install.sh` to resolve metadata, verify checksum, and optionally `adb install`
- update all docs that currently point normal users to GitHub Releases
- create `docs/RELEASING.md`
- create `CHANGELOG.md`
- provision Android signing secrets for stable
- provision Cloudflare credentials in GitHub Actions
- configure npm Trusted Publishing for `publish-npm.yml`
- run an end-to-end stable release rehearsal with a test tag

## Success Criteria

This plan is complete when all of the following are true:

- a stable release tag publishes APK artifacts automatically
- `https://clawperator.com/operator.apk` installs the latest stable build via redirect
- `scripts/install.sh` fetches the same stable build, verifies checksum, and can install it over adb
- users can still access historical versions and release notes through GitHub Releases
- rollback to a prior stable version is a metadata change, not a rebuild
- npm publishing works via Trusted Publishing without breaking version alignment
