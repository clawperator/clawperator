# Releasing

## Scope

Clawperator currently ships one product version across:

- the Node API / CLI package in `apps/node`
- the Android operator APK in `apps/android/app`

One git tag represents one coherent product release.

## Release Trigger

Push a semver tag with a `v` prefix:

- `v0.1.0-alpha.2`
- `v0.1.0-beta.1`
- `v1.0.0`

That tag triggers:

- `.github/workflows/release-apk.yml`
- `.github/workflows/publish-npm.yml`

Both workflows validate that the tag version exactly matches `apps/node/package.json`.

## Release Outputs

For every tagged release, GitHub Actions should:

1. Build the Android release APK from `:app:assembleRelease`
2. Sign the APK with the configured Android release keystore
3. Create a GitHub Release and upload the APK plus checksum
4. Upload the same APK and checksum to Cloudflare R2
5. Update the appropriate metadata pointer:
   - stable releases update `latest.json`
   - prereleases update `latest-beta.json`
6. Publish the Node package to npm:
   - alpha tags -> `alpha`
   - beta and rc tags -> `beta`
   - stable tags -> `latest`

## Required Secrets

### npm

- `NPM_TOKEN`

### Android signing

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### Cloudflare R2

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_DOWNLOADS_BASE_URL`

## Versioning Rules

- `apps/node/package.json` is the default version source for local Android builds.
- Tagged releases must use the exact same version for Node and Android.
- Do not cut a tag until `apps/node/package.json` is already set to that version.
- Do not introduce an independent Android release version unless there is a deliberate compatibility plan to support it.

## Cloudflare Layout

Expected public structure:

- `https://downloads.clawperator.com/operator/latest.json`
- `https://downloads.clawperator.com/operator/latest-beta.json`
- `https://downloads.clawperator.com/operator/vX.Y.Z/operator-vX.Y.Z.apk`
- `https://downloads.clawperator.com/operator/vX.Y.Z/operator-vX.Y.Z.apk.sha256`

Expected stable UX:

- `https://clawperator.com/operator.apk` redirects to the current stable immutable APK
- `https://clawperator.com/operator-beta.apk` redirects to the current beta immutable APK

## Release Checklist

1. Confirm `apps/node/package.json` has the intended release version.
2. Confirm changelog and release notes are ready.
3. Confirm signing and Cloudflare secrets are present in GitHub.
4. Confirm the branch is ready to release.
5. Create and push the tag.
6. Verify GitHub Actions completed successfully.
7. Verify GitHub Release assets exist.
8. Verify Cloudflare metadata and artifact uploads exist.
9. Verify npm publish succeeded.
10. Verify installation on a real device.

## Tag Commands

Example prerelease:

```bash
git tag v0.1.0-alpha.2
git push origin v0.1.0-alpha.2
```

Example stable release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Verification

After the workflows finish, verify:

- GitHub Release exists at `https://github.com/clawpilled/clawperator/releases`
- npm package version exists at `https://www.npmjs.com/package/clawperator`
- metadata file exists at `https://downloads.clawperator.com/operator/latest.json` or `latest-beta.json`
- APK URL in metadata resolves
- checksum file matches the APK

## Rollback

Rollback should never replace or delete a versioned APK object.

Rollback means:

1. Point `latest.json` back to the last known good stable release
2. Purge metadata cache if required
3. Re-verify `https://clawperator.com/operator.apk`

## Notes

- Stable releases should use the production Android signing key.
- Prereleases should also use the production key unless there is a conscious exception.
- Worker deployment for `/operator.apk` can be managed separately from the artifact upload workflow if needed.
