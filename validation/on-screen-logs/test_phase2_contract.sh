#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
cli="$repo_root/apps/node/dist/cli/index.js"

if [[ ! -f "$cli" ]]; then
    echo "Build the branch-local Node package before running this check." >&2
    exit 1
fi

validate_fixture() {
    local fixture="$1"
    node "$cli" exec --validate-only --payload "$fixture" --output json
}

flow_output="$(validate_fixture "$script_dir/raw-flow-001.json")"
replacement_output="$(validate_fixture "$script_dir/raw-replacement-flow.json")"

grep -Fq '"validated":true' <<<"$flow_output"
grep -Fq '"validated":true' <<<"$replacement_output"
grep -Fq '"textColor":"#FFA1B2C3"' <<<"$replacement_output"
grep -Fq '"backgroundColor":"#7F0A0B0C"' <<<"$replacement_output"

if validate_fixture "$script_dir/invalid-value-alias.json" >/dev/null 2>&1; then
    echo "set_on_screen_log must reject generic parameter aliases." >&2
    exit 1
fi
