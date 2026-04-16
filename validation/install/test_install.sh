#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ "${CLAWPERATOR_INSTALL_SKIP_NODE_TESTS:-0}" != "1" ]; then
    if [ ! -d "apps/node/node_modules" ]; then
        echo "ERROR: apps/node dependencies are not installed." >&2
        echo "Run: npm --prefix apps/node ci" >&2
        exit 1
    fi

    echo "=== Building Node package for install-related tests ==="
    npm --prefix apps/node run build

    echo "=== Running Node test suite for installer-facing CLI contracts ==="
    npm --prefix apps/node run test
else
    echo "=== Skipping Node build/tests (CLAWPERATOR_INSTALL_SKIP_NODE_TESTS=1) ==="
fi

echo "=== Running install-related validation harnesses ==="
bash validation/test_doctor.sh
bash validation/install/test_multidevice.sh
bash validation/install/test_java.sh
bash validation/install/test_authoring_skills.sh
bash validation/install/test_main.sh

echo "=== install-related test suite passed ==="
