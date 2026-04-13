#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
shopt -s nullglob
solax_batches=("${repo_root}"/evals/artifacts/solax-orchestrated-cold-start-*)
shopt -u nullglob

latest_dir=""
if (( ${#solax_batches[@]} > 0 )); then
  latest_dir="$(ls -1dt "${solax_batches[@]}" | head -n 1)"
fi

if [[ -z "${latest_dir}" ]]; then
  echo "No Solax orchestrated eval batches found under ${repo_root}/evals/artifacts" >&2
  exit 1
fi

echo "${latest_dir}"
echo
cat "${latest_dir}/summary.json"
