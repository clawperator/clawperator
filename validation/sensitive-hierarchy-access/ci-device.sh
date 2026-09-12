#!/usr/bin/env bash
set -euo pipefail
# Revision is deliberately pinned. A new Settings image requires renewed A/B proof.
python3 - "$ANDROID_HOME/system-images/android-35/google_apis/x86_64/source.properties" <<'PY'
from pathlib import Path
import sys
values = dict(line.split('=', 1) for line in Path(sys.argv[1]).read_text().splitlines() if '=' in line)
assert values['Pkg.Revision'].strip() == '9', values
assert values['AndroidVersion.ApiLevel'].strip() == '35', values
PY
serial="$(adb devices | awk '$2 == "device" {print $1}')"
[[ -n "$serial" && "$serial" != *$'\n'* ]]
for variant in debug release; do
  package=com.clawperator.operator
  if [[ "$variant" == debug ]]; then package=com.clawperator.operator.dev; fi
  timeout 120s adb -s "$serial" install -r "apps/android/app/build/outputs/apk/$variant/app-$variant.apk"
  adb -s "$serial" shell settings put secure enabled_accessibility_services "$package/clawperator.operator.accessibilityservice.OperatorAccessibilityService"
  node apps/node/dist/cli/index.js grant-device-permissions --device "$serial" --operator-package "$package"
  ready=false
  for attempt in 1 2 3 4 5; do
    if timeout 20s node apps/node/dist/cli/index.js doctor --device "$serial" --operator-package "$package"; then
      ready=true
      break
    fi
    sleep 1
  done
  [[ "$ready" == true ]]
  python3 validation/sensitive-hierarchy-access/run.py --device "$serial" --operator-package "$package" --out "artifacts/sensitive-hierarchy/$variant"
done
