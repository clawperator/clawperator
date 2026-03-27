#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

git -C "$repo_root" config core.hooksPath .githooks
chmod +x "$repo_root/.githooks/commit-msg"

echo "Configured git hooks for this repository."
echo "core.hooksPath=$(git -C "$repo_root" config --get core.hooksPath)"
