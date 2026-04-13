#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <device_serial> [percent]" >&2
  exit 1
fi

device_serial="$1"
percent="${2:-40}"

repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
skills_root="$(cd "${repo_root}/.." && pwd)/clawperator-skills"

cd "${repo_root}"

env \
  CLAWPERATOR_SKILLS_REGISTRY="${skills_root}/skills/skills-registry.json" \
  CLAWPERATOR_SKILL_RETAIN_LOGS=1 \
  CLAWPERATOR_SKILL_LOG_DIR=/tmp/solax-orchestrated-debug \
  CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS=120000 \
  node "${repo_root}/apps/node/dist/cli/index.js" skills run \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
  --device "${device_serial}" \
  --operator-package com.clawperator.operator.dev \
  --output json \
  -- "${percent}"
