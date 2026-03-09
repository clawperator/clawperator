#!/usr/bin/env bash

# bundle_skills.sh
# Regenerates the git bundle for the skills repo and places it in
# sites/landing/public/install/ so it is served at:
#   https://clawperator.com/install/clawperator-skills.bundle
#
# Usage:
#   ./scripts/bundle_skills.sh [<path-to-clawperator-skills>]
#
# Defaults to the sibling repo at ../clawperator-skills if no path is given.
# After running, commit the updated bundle file to publish it.
#
# Note: HTTP-served git bundles are static files. Clients re-download the entire
# bundle on every fetch - there is no incremental delta like a live git server.
# Keep the bundle small by avoiding unnecessary large binary assets in the skills repo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RAW_SKILLS_REPO="${1:-$REPO_ROOT/../clawperator-skills}"
if command -v realpath >/dev/null 2>&1; then
    SKILLS_REPO="$(realpath "$RAW_SKILLS_REPO" 2>/dev/null || echo "$RAW_SKILLS_REPO")"
else
    SKILLS_REPO="$(cd "$RAW_SKILLS_REPO" 2>/dev/null && pwd || echo "$RAW_SKILLS_REPO")"
fi
OUTPUT_DIR="$REPO_ROOT/sites/landing/public/install"
BUNDLE_FILE="$OUTPUT_DIR/clawperator-skills.bundle"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -d "$SKILLS_REPO" ]; then
    echo -e "${RED}❌ Skills repo not found at: $SKILLS_REPO${NC}"
    echo "Pass the path as an argument: $0 <path-to-clawperator-skills>"
    exit 1
fi

if ! command -v git &>/dev/null; then
    echo -e "${RED}❌ git is required but not found on PATH.${NC}"
    exit 1
fi

echo -e "${BLUE}Generating skills bundle from: $SKILLS_REPO${NC}"

mkdir -p "$OUTPUT_DIR"

git -C "$SKILLS_REPO" bundle create "$BUNDLE_FILE" HEAD main

git -C "$SKILLS_REPO" bundle verify "$BUNDLE_FILE"

SIZE="$(du -sh "$BUNDLE_FILE" | cut -f1)"
echo -e "${GREEN}✅ Bundle written to: $BUNDLE_FILE (${SIZE})${NC}"
echo ""
echo "Commit the updated bundle to publish it:"
echo "  git add sites/landing/public/install/clawperator-skills.bundle"
echo "  git commit -m 'chore: update skills bundle'"
