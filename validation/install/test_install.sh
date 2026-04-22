#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

run_node_install_validation() {
    env \
        -u CLAWPERATOR_SKILLS_REGISTRY \
        -u CLAWPERATOR_DEFAULT_ANDROID_DEVICE_ID \
        -u CLAWPERATOR_OPERATOR_PACKAGE \
        -u CLAWPERATOR_BUNDLED_SKILLS \
        -u CLAWPERATOR_BIN \
        -u CLAWPERATOR_SKILL_AGENT_CLI \
        -u CLAWPERATOR_LOG_DIR \
        "$@"
}

ensure_node_build() {
    if [ ! -f "apps/node/dist/cli/index.js" ]; then
        echo "=== Building Node package for validation harnesses ==="
        run_node_install_validation npm --prefix apps/node run build
    fi
}

if [ "${CLAWPERATOR_INSTALL_SKIP_NODE_TESTS:-0}" != "1" ]; then
    if [ ! -d "apps/node/node_modules" ]; then
        echo "ERROR: apps/node dependencies are not installed." >&2
        echo "Run: npm --prefix apps/node ci" >&2
        exit 1
    fi

    echo "=== Building Node package for install-related tests ==="
    run_node_install_validation npm --prefix apps/node run build

    echo "=== Running Node test suite for installer-facing CLI contracts ==="
    run_node_install_validation npm --prefix apps/node run test
else
    echo "=== Skipping Node build/tests (CLAWPERATOR_INSTALL_SKIP_NODE_TESTS=1) ==="
    ensure_node_build
fi

echo "=== Running install-related validation harnesses (including shared agent bridge coverage) ==="
bash validation/test_doctor.sh
bash validation/install/test_multidevice.sh
bash validation/install/test_java.sh
bash validation/install/test_agent_skills.sh
bash validation/install/test_main.sh

echo "=== install-related test suite passed ==="
