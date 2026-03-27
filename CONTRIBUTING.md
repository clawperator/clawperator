# Contributing

We welcome issues and pull requests.

By submitting a contribution, you agree to the project's Contributor License Agreement (CLA). Details coming soon.

Maintainers may request changes before merging.

## Commit Message Attribution Guard

Policy target: AI attribution trailers must not land in `main`.

- Primary enforcement (required): CI checks every commit in the PR range and fails when forbidden attribution lines are present. This blocks merge to `main`, including squash-merge workflows, because the PR commit range is validated before merge.
- Local convenience (optional, per clone): `.githooks/commit-msg` strips forbidden lines from the commit message during local commit creation when hooks are enabled.
  - enable once per clone: `git config core.hooksPath .githooks && chmod +x .githooks/commit-msg`
  - agent setup path: `.agents/skills/repo-setup/SKILL.md`
- Matched forbidden lines (case-insensitive):
  - `Co-Authored-By: Claude ` (prefix match for model/version variants)
  - `Co-Authored-By: Cursor ...`
  - `Made With: Cursor` and `Made with Cursor`
  - `Generated with Cursor`

Prefix matching is used for Claude because model names and versions change over time (`Claude Sonnet`, `Claude Opus 4.7`, future variants).
