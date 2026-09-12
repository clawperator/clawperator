#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
proof="$script_dir/run_overlay_mechanism_proof.sh"

bash -n "$proof"
help_output="$($proof --help)"
grep -Fq -- '--device <device_serial>' <<<"$help_output"
grep -Fq -- '--output-dir <absolute_path>' <<<"$help_output"
if grep -Fq 'set_on_screen_log' "$proof"; then
    echo "The overlay-mechanism proof must not introduce a raw action ingress." >&2
    exit 1
fi
