# Releasing

## Scope

Clawperator currently ships one product version across:

- the Node API / CLI package in `apps/node`
- the Android operator APK in `apps/android/app`

One git tag represents one coherent product release.

## Release Trigger

Push a semver tag with a `v` prefix:

- `v0.1.0`
- `v0.1.1`
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
   - all releases update `latest.json`
6. Publish the Node package to npm:
   - all published releases use npm dist-tag `latest`

## Required Secrets

### npm

- `NPM_TOKEN`

### Android signing

- `CLAWPERATOR_ANDROID_KEYSTORE_BASE64`
- `CLAWPERATOR_ANDROID_KEYSTORE_PASSWORD`
- `CLAWPERATOR_ANDROID_KEY_ALIAS`
- `CLAWPERATOR_ANDROID_KEY_PASSWORD`

### Cloudflare R2

- `CLAWPERATOR_CLOUDFLARE_ACCOUNT_ID`
- `CLAWPERATOR_CLOUDFLARE_ACCESS_KEY_ID`
- `CLAWPERATOR_CLOUDFLARE_SECRET_ACCESS_KEY`
- `CLAWPERATOR_CLOUDFLARE_R2_BUCKET`
- `CLAWPERATOR_CLOUDFLARE_DOWNLOADS_BASE_URL`

## Versioning Rules

- `apps/node/package.json` is the default version source for local Android builds.
- Tagged releases must use the exact same version for Node and Android.
- Do not cut a tag until `apps/node/package.json` is already set to that version.
- Do not introduce an independent Android release version unless there is a deliberate compatibility plan to support it.

## Cloudflare Layout

Expected public structure:

- `https://downloads.clawperator.com/operator/latest.json`
- `https://downloads.clawperator.com/operator/vX.Y.Z/operator-vX.Y.Z.apk`
- `https://downloads.clawperator.com/operator/vX.Y.Z/operator-vX.Y.Z.apk.sha256`

Expected stable UX:

- `https://clawperator.com/operator.apk` redirects to the current stable immutable APK

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

Example release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Verification

After the workflows finish, verify:

- GitHub Release exists at `https://github.com/clawpilled/clawperator/releases`
- npm package version exists at `https://www.npmjs.com/package/clawperator`
- stable metadata file exists at `https://downloads.clawperator.com/operator/latest.json`
- APK URL in metadata resolves
- checksum file matches the APK

## Rollback

Rollback should never replace or delete a versioned APK object.

Rollback means:

1. Point `latest.json` back to the last known good stable release
2. Purge metadata cache if required
3. Re-verify `https://clawperator.com/operator.apk`

## Notes

- Releases should use the production Android signing key.
- Worker deployment for `/operator.apk` can be managed separately from the artifact upload workflow if needed.
