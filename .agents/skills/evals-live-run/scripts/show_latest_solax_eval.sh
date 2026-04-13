#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
latest_dir="$(ls -1dt "${repo_root}"/evals/artifacts/solax-orchestrated-cold-start-* 2>/dev/null | head -n 1)"

if [[ -z "${latest_dir}" ]]; then
  echo "No Solax orchestrated eval batches found under ${repo_root}/evals/artifacts" >&2
  exit 1
fi

echo "${latest_dir}"
echo
cat "${latest_dir}/summary.json"
