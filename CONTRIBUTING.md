# Contributing

We welcome issues and pull requests.

By submitting a contribution, you agree to the project's Contributor License Agreement (CLA). Details coming soon.

Maintainers may request changes before merging.

## Commit Message Attribution Guard

This repository strips AI attribution trailers that should not ship in history.

- Local hook path: `.githooks/commit-msg`
- Enable once per clone: `./scripts/setup_git_hooks.sh`
- What gets stripped locally:
  - lines beginning with `Co-Authored-By: Claude `
  - Cursor attribution lines like `Made With: Cursor`
- Why prefix matching is used: Claude model names and versions change over time (`Claude Sonnet`, `Claude Opus 4.7`, etc.), so matching the `Co-Authored-By: Claude ` prefix is stable across future variants.

CI also validates commit messages in pull requests and fails when forbidden lines are present, so the repo has shared enforcement even when local hooks are not enabled.
