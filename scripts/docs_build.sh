#!/usr/bin/env bash

# docs_build.sh
# Build the Clawperator documentation site (MkDocs).
# Works from any directory.

set -euo pipefail

# Get absolute path of script and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$REPO_ROOT/sites/docs"

echo "--- Building Clawperator Documentation Site ---"
echo "Repository Root: $REPO_ROOT"
echo "Docs Directory: $DOCS_DIR"

if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: Docs directory not found at $DOCS_DIR"
    exit 1
fi

cd "$DOCS_DIR"

# Install dependencies if not already installed
if ! command -v mkdocs &> /dev/null || [ ! -d "$DOCS_DIR/.venv" ]; then
    echo "Setting up Python virtual environment..."
    python3 -m venv "$DOCS_DIR/.venv"
    source "$DOCS_DIR/.venv/bin/activate"
    echo "Installing MkDocs dependencies..."
    pip install -r requirements.txt
else
    source "$DOCS_DIR/.venv/bin/activate"
fi

# Run the build
echo "Running MkDocs build..."
mkdocs build

# Verify build output
if [ -d "site" ] && [ -f "site/index.html" ]; then
    echo "--- Successfully built documentation site to $DOCS_DIR/site ---"
    echo "Artifacts ready for deployment."
else
    echo "Error: Build output (site/ or site/index.html) missing."
    exit 1
fi
