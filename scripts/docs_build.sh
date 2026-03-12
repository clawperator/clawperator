#!/usr/bin/env bash

# docs_build.sh
# Build the Clawperator documentation site (MkDocs).
# Works from any directory.

set -euo pipefail

# Get absolute path of script and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$REPO_ROOT/sites/docs"
VENV_DIR="$DOCS_DIR/.venv"
REQUIREMENTS_FILE="$DOCS_DIR/requirements.txt"

echo "--- Building Clawperator Documentation Site ---"
echo "Repository Root: $REPO_ROOT"
echo "Docs Directory: $DOCS_DIR"

if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: Docs directory not found at $DOCS_DIR"
    exit 1
fi

cd "$DOCS_DIR"

# Setup Python environment
if [ -z "${CI:-}" ]; then
    # Local: use venv
    if [ ! -d "$VENV_DIR" ]; then
        echo "Setting up Python virtual environment..."
        python3 -m venv "$VENV_DIR"
    fi
    source "$VENV_DIR/bin/activate"
    echo "Installing MkDocs dependencies..."
    pip install -r "$REQUIREMENTS_FILE"
    PYTHON_EXEC="$VENV_DIR/bin/python"
else
    # CI: skip venv, assume environment is set up via requirements.txt or build preset
    echo "CI environment detected, skipping venv creation."
    # Cloudflare Pages might have requirements already installed via requirements.txt
    # but we'll try to ensure they are available just in case.
    pip install -r "$REQUIREMENTS_FILE" || echo "Warning: pip install failed, continuing..."
    PYTHON_EXEC="python3"
fi

# Run the build
echo "Running MkDocs build..."
mkdocs build

echo "Patching docs sitemap metadata..."
"$PYTHON_EXEC" "$REPO_ROOT/.agents/skills/sitemaps-generate/scripts/generate_sitemap_metadata.py" docs \
  --repo-root "$REPO_ROOT" \
  --sitemap-path "$DOCS_DIR/site/sitemap.xml" \
  --source-map-path "$DOCS_DIR/source-map.yaml"

echo "Generating llms-full.txt..."
"$PYTHON_EXEC" "$REPO_ROOT/.agents/skills/docs-generate/scripts/generate_llms_full.py"

STATIC_DIR="$DOCS_DIR/static"
if [ -d "$STATIC_DIR" ]; then
    echo "Copying static root files..."
    cp -R "$STATIC_DIR"/. "$DOCS_DIR/site/"
fi

# Verify build output
if [ -d "site" ] && [ -f "site/index.html" ]; then
    echo "--- Successfully built documentation site to $DOCS_DIR/site ---"
    echo "Artifacts ready for deployment."
else
    echo "Error: Build output (site/ or site/index.html) missing."
    exit 1
fi
