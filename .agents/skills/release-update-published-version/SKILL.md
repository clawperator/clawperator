---
name: release-update-published-version
description: Updates public release-facing docs and website artifacts to the newly live Clawperator version, rebuilds outputs, and commits the follow-up change locally.
---

Use this skill only after a release is actually live on npm and GitHub Releases.

It will refuse to run for versions that are not already published on both surfaces.

Run:

```bash
cd "$(git rev-parse --show-toplevel)"
.agents/skills/release-update-published-version/scripts/update_published_version.py <version>
```

Example:

```bash
.agents/skills/release-update-published-version/scripts/update_published_version.py 0.2.4
```

This skill updates public release-facing surfaces such as:
- `docs/index.md` (the "Current release" badge on the docs home page)
- `docs/troubleshooting/compatibility.md` (versioned Operator APK remediation example)
- `docs/internal/release-procedure.md` (versioned release command examples)
- `sites/landing/public/install.sh`
- the generated docs staging/build outputs produced by `./scripts/docs_build.sh`
- generated `llms-full.txt` artifacts

It then rebuilds docs/site artifacts and creates a dedicated follow-up commit:

```bash
git commit -m "docs(release): update published version to <version>"
```

## Safety Rules

- Run this only after the version is verifiably live.
- The target version must already exist as both `clawperator@<version>` on npm and `v<version>` on GitHub Releases.
- This skill updates public-facing content. Do not use it for unreleased code versions.
- Do not fold unrelated changes into the published-version commit.

## Validation

The script runs:
- `./scripts/docs_build.sh`

If these steps fail, the published-version update is incomplete.
