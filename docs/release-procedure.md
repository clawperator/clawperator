# Release Procedure

This is the short, practical release flow for Clawperator.

For the full release reference, see `docs/release-reference.md`.

## Release Model

- One git tag represents one coherent Clawperator release.
- The release version must already be committed in both `apps/node/package.json` and `apps/node/package-lock.json`.
- Pushing `vX.Y.Z` triggers both release workflows:
  - `.github/workflows/publish-npm.yml`
  - `.github/workflows/release-apk.yml`

## Expected Sequence

1. Bump the repo's unreleased code version with `.agents/skills/release-set-code-version-number/`.
2. Manually audit the code-version bump for broken tests and internal examples.
3. Let the code-version skill create the version-bump commit automatically:
   - `chore(build): set code verstion to X.Y.Z`
4. Push the release branch or commit you want to tag.
5. Create the release tag with `.agents/skills/release-create/` against the exact commit to ship.
6. Verify the published release with `.agents/skills/release-verify/` if you want an explicit read-only confirmation pass.
7. Review the follow-up `docs(release): update published version to X.Y.Z` commit that `release-create` prepared locally, then push or merge it so the public docs and website catch up to the live release.
8. After release, bump `main` forward to the next unreleased code version in a separate commit.

## Important Rules

- Do not release from a dirty working tree.
- Do not reuse or force-move release tags.
- Do not try to repair a partially published npm version. Bump to a new version instead.
- The tag must point at the exact commit whose `package.json` and `package-lock.json` versions match the tag.
- Keep the release commit and post-release version bump as separate commits.

## Standard Commands

Release creation:

```bash
.agents/skills/release-create/scripts/create_release.sh 0.2.4 [commit_sha]
```

Release verification:

```bash
.agents/skills/release-verify/scripts/release_verify.sh 0.2.4
```

## What Success Looks Like

- npm contains `clawperator@X.Y.Z`
- GitHub Release `vX.Y.Z` exists with APK and checksum assets
- `latest.json` points at `X.Y.Z`
- `https://clawperator.com/operator.apk` redirects to the immutable `vX.Y.Z` APK URL
