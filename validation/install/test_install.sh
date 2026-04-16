#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "=== Building Node package for install-related tests ==="
npm --prefix apps/node run build

echo "=== Running install-related Node tests ==="
node --test \
    apps/node/dist/test/integration/installScript.test.js \
    apps/node/dist/test/unit/authoringSkills.test.js \
    apps/node/dist/test/unit/authoringSkillsPack.test.js \
    apps/node/dist/test/unit/doctor/DoctorService.test.js \
    apps/node/dist/test/unit/doctor/hostChecks.test.js

echo "=== Running install-related validation harnesses ==="
bash validation/test_doctor.sh
bash validation/install/test_multidevice.sh
bash validation/install/test_java.sh
bash validation/install/test_authoring_skills.sh
bash validation/install/test_main.sh

echo "=== install-related test suite passed ==="
