#!/usr/bin/env bash

# site_run_local.sh
# Build (if needed) and run the Clawperator landing page locally on port 8080.
# Opens the browser automatically.

set -euo pipefail

# Get absolute path of script and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LANDING_DIR="$REPO_ROOT/sites/landing"
OUT_DIR="$LANDING_DIR/out"

# Build by default so local preview always reflects latest source.
# Set CLAWPERATOR_SKIP_BUILD=1 to skip rebuild and serve existing out/ as-is.
if [ "${CLAWPERATOR_SKIP_BUILD:-0}" != "1" ]; then
    echo "--- Building latest landing site before serving (set CLAWPERATOR_SKIP_BUILD=1 to skip) ---"
    "$SCRIPT_DIR/site_build.sh"
elif [ ! -d "$OUT_DIR" ]; then
    echo "--- Build output not found. Building now... ---"
    "$SCRIPT_DIR/site_build.sh"
fi

cd "$OUT_DIR"

# Open the browser in the background after a slight delay
# Using 'open' for macOS (Darwin), 'xdg-open' for Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1 && open "http://localhost:8080") &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    (sleep 1 && xdg-open "http://localhost:8080") &
else
    echo "Please open http://localhost:8080 in your browser."
fi

echo "--- Starting local server at http://localhost:8080 ---"
echo "Serving from: $OUT_DIR"
echo "Press Ctrl+C to stop the server."

python3 -m http.server 8080
