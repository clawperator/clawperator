#!/usr/bin/env bash

# docs_run_local.sh
# Build (if needed) and run the Clawperator documentation site locally on port 8000.
# Uses MkDocs dev server for live reload.

set -euo pipefail

# Get absolute path of script and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$REPO_ROOT/sites/docs"

echo "--- Running Clawperator Documentation Site Locally ---"
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

echo "--- Starting MkDocs dev server at http://localhost:8000 ---"
echo "Press Ctrl+C to stop the server."

mkdocs serve
