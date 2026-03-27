---
name: repo-setup
description: Configure local repository defaults that should be applied once per clone, including enabling tracked git hooks for commit message sanitization.
---

# Repo Setup

Apply one-time local git configuration for this repository clone.

## Goal

Enable tracked git hooks so commit messages are sanitized before they are written.

## Required Commands

Run these commands from the repository root:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/commit-msg
```

## Verification

Confirm hooks path is configured:

```bash
git config --get core.hooksPath
```

Expected output:

```text
.githooks
```

## Notes

- This setup is local per clone and only needs to be run once.
- This is a convenience layer, not the primary enforcement layer.
- CI commit-message validation is the repo-wide required guard that blocks forbidden commit-message attribution lines from merging to `main`.
