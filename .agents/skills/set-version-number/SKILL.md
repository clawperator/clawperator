---
name: set-version-number
description: Updates the version number across the entire Clawperator project, running necessary builds and tests to verify the change.
---

Use this skill to increase or set the project version number everywhere in the repository (package.json, docs, scripts, tests, etc.). 

It takes the old version and the new version as arguments.

Run:

```bash
cd "$(git rev-parse --show-toplevel)"
~/.agents/skills/set-version-number/scripts/set_version.py <old_version> <new_version>
```

Example:

```bash
~/.agents/skills/set-version-number/scripts/set_version.py 0.2.0 0.2.1
```

The script will:
1. Search all git-tracked text files for occurrences of `<old_version>` and replace them with `<new_version>`.
2. Run the Node API build and unit tests to ensure nothing was broken.
3. Rebuild the MkDocs documentation site.

Prerequisites:
- Must be run from within the `clawperator` git repository.
- Node.js, Python, and Git must be available.
