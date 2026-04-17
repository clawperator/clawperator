#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

REPO_ROOT="$(pwd)"
INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_contains() {
    local file="$1"
    local needle="$2"
    local label="$3"
    if ! grep -Fq "$needle" "$file"; then
        echo "ERROR: $label missing expected output: $needle" >&2
        echo "--- $file ---" >&2
        cat "$file" >&2
        echo "-------------" >&2
        return 1
    fi
}

assert_not_contains() {
    local file="$1"
    local needle="$2"
    local label="$3"
    if grep -Fq "$needle" "$file"; then
        echo "ERROR: $label unexpectedly contained: $needle" >&2
        echo "--- $file ---" >&2
        cat "$file" >&2
        echo "-------------" >&2
        return 1
    fi
}

assert_equals() {
    local expected="$1"
    local actual="$2"
    local label="$3"
    if [ "$expected" != "$actual" ]; then
        echo "ERROR: $label expected '$expected' but got '$actual'" >&2
        return 1
    fi
}

assert_file_empty() {
    local file="$1"
    local label="$2"
    if [ -s "$file" ]; then
        echo "ERROR: $label expected empty file: $file" >&2
        cat "$file" >&2
        return 1
    fi
}

run_parser_case() {
    local label="$1"
    local input_json="$2"
    local output_file="$3"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        printf "%s" "$2" | parse_authoring_skills_install_result > "$3"
    ' _ "$INSTALL_SCRIPT" "$input_json" "$output_file"
}

run_operator_metadata_case() {
    local label="$1"
    local metadata_content="$2"
    local output_file="$3"
    local status_file="$4"
    local values_file="$5"
    local metadata_file="$TMP_DIR/$label-metadata.json"

    printf '%s' "$metadata_content" > "$metadata_file"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        set +e
        parse_operator_metadata "$2" > "$3" 2>&1
        status="$?"
        set -e
        printf "%s\n" "$status" > "$4"
        {
          printf "version=%s\n" "${OPERATOR_VERSION:-}"
          printf "apk=%s\n" "${OPERATOR_APK_URL:-}"
          printf "sha_url=%s\n" "${OPERATOR_SHA_URL:-}"
          printf "sha256=%s\n" "${OPERATOR_EXPECTED_SHA256:-}"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$metadata_file" "$output_file" "$status_file" "$values_file"
}

setup_mock_clawperator() {
    local mock_dir="$1"
    local mode="$2"
    local payload="${3:-}"
    local log_file="${4:-}"

    mkdir -p "$mock_dir"
    cat > "$mock_dir/clawperator" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ -n "${log_file}" ]; then
  printf '%s\n' "\$*" >> "${log_file}"
fi

case "${mode}" in
  success)
    if [ "\$1" = "authoring-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      cat <<'JSON'
${payload}
JSON
      exit 0
    fi
    ;;
  failure)
    if [ "\$1" = "authoring-skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      printf '%s\n' '${payload}'
      exit 1
    fi
    ;;
  skills-success)
    if [ "\$1" = "skills" ] && [ "\$2" = "install" ] && [ "\$3" = "--output" ] && [ "\$4" = "json" ]; then
      printf '%s\n' '{"registryPath":"/tmp/skills-registry.json"}'
      exit 0
    fi
    ;;
esac

exit 99
EOF
    chmod +x "$mock_dir/clawperator"
}

run_setup_authoring_case() {
    local label="$1"
    local mode="$2"
    local payload="$3"
    local output_file="$4"
    local status_file="$5"
    local values_file="$6"
    local extra_env="${7:-}"
    local mock_dir="$TMP_DIR/mock-$label"

    setup_mock_clawperator "$mock_dir" "$mode" "$payload"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        '"$extra_env"'
        setup_authoring_skills_via_cli > "$3"
        printf "%s\n" "$AUTHORING_SKILLS_SETUP_STATUS" > "$4"
        {
          printf "install=%s\n" "$AUTHORING_SKILLS_INSTALL_DIR"
          printf "claude=%s\n" "$AUTHORING_SKILLS_CLAUDE_DIR"
          printf "codex=%s\n" "$AUTHORING_SKILLS_CODEX_DIR"
          printf "agents=%s\n" "$AUTHORING_SKILLS_AGENTS_DIR"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_file" "$status_file" "$values_file"
}

run_guide_case() {
    local label="$1"
    local version_mode="$2"
    local runtime_mode="$3"
    local output_file="$4"
    local guide_file="$5"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export AUTHORING_SKILLS_INSTALL_DIR="$HOME/.clawperator/authoring-skills"
        mkdir -p "$AUTHORING_SKILLS_INSTALL_DIR/skill-author-by-recording"
        mkdir -p "$AUTHORING_SKILLS_INSTALL_DIR/skill-audit"
        printf "# skill-author-by-recording\n" > "$AUTHORING_SKILLS_INSTALL_DIR/skill-author-by-recording/SKILL.md"
        printf "# skill-audit\n" > "$AUTHORING_SKILLS_INSTALL_DIR/skill-audit/SKILL.md"
        if [ "$2" = "with-version" ]; then
          printf "1.2.3\n" > "$AUTHORING_SKILLS_INSTALL_DIR/version.txt"
        fi
        if [ "$3" = "with-runtime-registry" ]; then
          mkdir -p "$HOME/.clawperator/skills/skills"
          cat > "$HOME/.clawperator/skills/skills/skills-registry.json" <<'\''JSON'\''
{"skills":[
  {"id":"com.google.android.apps.chromecast.app.get-climate-replay","applicationId":"com.google.android.apps.chromecast.app","intent":"get-climate","summary":"Read the current Google Home climate state.","path":"skills/com.google.android.apps.chromecast.app.get-climate-replay","skillFile":"skills/com.google.android.apps.chromecast.app.get-climate-replay/SKILL.md","scripts":[],"artifacts":[]},
  {"id":"com.spotify.music.play-playlist","applicationId":"com.spotify.music","intent":"play-playlist","summary":"Start a named playlist in Spotify.","path":"skills/com.spotify.music.play-playlist","skillFile":"skills/com.spotify.music.play-playlist/SKILL.md","scripts":[],"artifacts":[]}
]}
JSON
        elif [ "$3" = "with-invalid-runtime-registry" ]; then
          mkdir -p "$HOME/.clawperator/skills/skills"
          printf "{\\"skills\\":" > "$HOME/.clawperator/skills/skills/skills-registry.json"
        fi
        write_agent_guide > "$4"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$5"
    ' _ "$INSTALL_SCRIPT" "$version_mode" "$runtime_mode" "$output_file" "$guide_file"
}

run_missing_guide_case() {
    local label="$1"
    local output_file="$2"
    local guide_file="$3"

    HOME="$TMP_DIR/home-$label" \
    OS=Linux \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export AUTHORING_SKILLS_INSTALL_DIR="$HOME/.clawperator/nonexistent-authoring-skills"
        write_agent_guide > "$2"
        printf "%s\n" "$HOME/.clawperator/AGENTS.md" > "$3"
    ' _ "$INSTALL_SCRIPT" "$output_file" "$guide_file"
}

run_skip_case() {
    local output_skills="$1"
    local output_authoring="$2"
    local status_file="$3"
    local log_file="$4"
    local mock_dir="$TMP_DIR/mock-skip"

    setup_mock_clawperator "$mock_dir" "skills-success" "" "$log_file"

    HOME="$TMP_DIR/home-skip" \
    OS=Linux \
    PATH="$mock_dir:$PATH" \
    bash -c '
        source "$1" >/dev/null 2>&1
        trap - ERR
        export CLAWPERATOR_BIN_PATH="$2"
        export CLAWPERATOR_INSTALL_SKIP_SKILLS=1
        setup_skills_via_cli > "$3"
        setup_authoring_skills_via_cli > "$4"
        {
          printf "skills=%s\n" "$SKILLS_SETUP_STATUS"
          printf "authoring=%s\n" "$AUTHORING_SKILLS_SETUP_STATUS"
        } > "$5"
    ' _ "$INSTALL_SCRIPT" "$mock_dir/clawperator" "$output_skills" "$output_authoring" "$status_file"
}

echo "=== Scenario 1: parser extracts installed and discovery dirs ==="
PARSE_SUCCESS_OUT="$TMP_DIR/parse-success.out"
run_parser_case \
    parse-success \
    '{"installedDir":"/tmp/installed","agentDiscoveryDirs":[{"label":"claude","dir":"/tmp/claude"},{"label":"codex","dir":"/tmp/codex"},{"label":"agents","dir":"/tmp/agents"},{"label":"gemini","dir":"/tmp/gemini"}]}' \
    "$PARSE_SUCCESS_OUT"
assert_contains "$PARSE_SUCCESS_OUT" "installedDir=/tmp/installed" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:claude=/tmp/claude" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:codex=/tmp/codex" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:agents=/tmp/agents" "parse-success"
assert_contains "$PARSE_SUCCESS_OUT" "agentDiscoveryDir:gemini=/tmp/gemini" "parse-success"

echo "=== Scenario 2: parser ignores malformed JSON ==="
PARSE_BAD_OUT="$TMP_DIR/parse-bad.out"
run_parser_case parse-bad '{"installedDir":' "$PARSE_BAD_OUT"
if [ -s "$PARSE_BAD_OUT" ]; then
    echo "ERROR: parse-bad should not emit output for malformed JSON" >&2
    cat "$PARSE_BAD_OUT" >&2
    exit 1
fi

echo "=== Scenario 3: authoring skills setup succeeds with explicit discovery dirs ==="
AUTHORING_SUCCESS_OUT="$TMP_DIR/authoring-success.out"
AUTHORING_SUCCESS_STATUS="$TMP_DIR/authoring-success.status"
AUTHORING_SUCCESS_VALUES="$TMP_DIR/authoring-success.values"
run_setup_authoring_case \
    authoring-success \
    success \
    '{"installedDir":"/custom/install","agentDiscoveryDirs":[{"label":"claude","dir":"/custom/claude"},{"label":"codex","dir":"/custom/codex"},{"label":"agents","dir":"/custom/agents"},{"label":"gemini","dir":"/custom/gemini"}]}' \
    "$AUTHORING_SUCCESS_OUT" \
    "$AUTHORING_SUCCESS_STATUS" \
    "$AUTHORING_SUCCESS_VALUES"
assert_equals "configured" "$(cat "$AUTHORING_SUCCESS_STATUS")" "authoring-success status"
assert_contains "$AUTHORING_SUCCESS_OUT" "Authoring skills setup complete." "authoring-success"
assert_contains "$AUTHORING_SUCCESS_VALUES" "install=/custom/install" "authoring-success values"
assert_contains "$AUTHORING_SUCCESS_VALUES" "claude=/custom/claude" "authoring-success values"
assert_contains "$AUTHORING_SUCCESS_VALUES" "codex=/custom/codex" "authoring-success values"
assert_contains "$AUTHORING_SUCCESS_VALUES" "agents=/custom/agents" "authoring-success values"

echo "=== Scenario 4: partial authoring JSON falls back to defaults ==="
AUTHORING_PARTIAL_OUT="$TMP_DIR/authoring-partial.out"
AUTHORING_PARTIAL_STATUS="$TMP_DIR/authoring-partial.status"
AUTHORING_PARTIAL_VALUES="$TMP_DIR/authoring-partial.values"
run_setup_authoring_case \
    authoring-partial \
    success \
    '{"installedDir":"/partial/install","agentDiscoveryDirs":[{"label":"claude","dir":"/partial/claude"}]}' \
    "$AUTHORING_PARTIAL_OUT" \
    "$AUTHORING_PARTIAL_STATUS" \
    "$AUTHORING_PARTIAL_VALUES"
assert_equals "configured" "$(cat "$AUTHORING_PARTIAL_STATUS")" "authoring-partial status"
assert_contains "$AUTHORING_PARTIAL_VALUES" "install=/partial/install" "authoring-partial values"
assert_contains "$AUTHORING_PARTIAL_VALUES" "claude=/partial/claude" "authoring-partial values"
assert_contains "$AUTHORING_PARTIAL_VALUES" "codex=$TMP_DIR/home-authoring-partial/.codex/skills/" "authoring-partial values"
assert_contains "$AUTHORING_PARTIAL_VALUES" "agents=$TMP_DIR/home-authoring-partial/.agents/skills/" "authoring-partial values"

echo "=== Scenario 5: CODEX_HOME fallback is used when codex dir is omitted ==="
AUTHORING_CODEX_HOME_OUT="$TMP_DIR/authoring-codex-home.out"
AUTHORING_CODEX_HOME_STATUS="$TMP_DIR/authoring-codex-home.status"
AUTHORING_CODEX_HOME_VALUES="$TMP_DIR/authoring-codex-home.values"
EXPECTED_CODEX_HOME_DIR="$TMP_DIR/home-authoring-codex-home/custom-codex-home/skills/"
run_setup_authoring_case \
    authoring-codex-home \
    success \
    '{"installedDir":"/codex-home/install","agentDiscoveryDirs":[{"label":"claude","dir":"/codex-home/claude"}]}' \
    "$AUTHORING_CODEX_HOME_OUT" \
    "$AUTHORING_CODEX_HOME_STATUS" \
    "$AUTHORING_CODEX_HOME_VALUES" \
    'export CODEX_HOME="$HOME/custom-codex-home"'
assert_equals "configured" "$(cat "$AUTHORING_CODEX_HOME_STATUS")" "authoring-codex-home status"
assert_contains "$AUTHORING_CODEX_HOME_VALUES" "codex=$EXPECTED_CODEX_HOME_DIR" "authoring-codex-home values"
assert_contains "$AUTHORING_CODEX_HOME_VALUES" "agents=$TMP_DIR/home-authoring-codex-home/.agents/skills/" "authoring-codex-home values"

echo "=== Scenario 6: authoring skills setup failure is non-fatal ==="
AUTHORING_FAILURE_OUT="$TMP_DIR/authoring-failure.out"
AUTHORING_FAILURE_STATUS="$TMP_DIR/authoring-failure.status"
AUTHORING_FAILURE_VALUES="$TMP_DIR/authoring-failure.values"
run_setup_authoring_case \
    authoring-failure \
    failure \
    'authoring install conflict' \
    "$AUTHORING_FAILURE_OUT" \
    "$AUTHORING_FAILURE_STATUS" \
    "$AUTHORING_FAILURE_VALUES"
assert_equals "failed" "$(cat "$AUTHORING_FAILURE_STATUS")" "authoring-failure status"
assert_contains "$AUTHORING_FAILURE_OUT" "Authoring skills setup failed via CLI." "authoring-failure"
assert_contains "$AUTHORING_FAILURE_OUT" "authoring install conflict" "authoring-failure"
assert_contains "$AUTHORING_FAILURE_VALUES" "install=$TMP_DIR/home-authoring-failure/.clawperator/authoring-skills/" "authoring-failure values"

echo "=== Scenario 7: guide writer lists installed skills and refresh guidance ==="
GUIDE_OUT="$TMP_DIR/guide.out"
GUIDE_PATH_FILE="$TMP_DIR/guide.path"
run_guide_case guide-missing-version without-version with-runtime-registry "$GUIDE_OUT" "$GUIDE_PATH_FILE"
GUIDE_PATH="$(cat "$GUIDE_PATH_FILE")"
assert_contains "$GUIDE_OUT" "Wrote agent guide" "guide-missing-version"
assert_contains "$GUIDE_PATH" "## Runtime Skills" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "### com.google.android.apps.chromecast.app" "guide-missing-version file"
assert_contains "$GUIDE_PATH" 'intent `get-climate`' "guide-missing-version file"
assert_contains "$GUIDE_PATH" "Read the current Google Home climate state." "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator skills run com.google.android.apps.chromecast.app.get-climate-replay" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "### com.spotify.music" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "skill-author-by-recording" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "skill-audit" "guide-missing-version file"
assert_contains "$GUIDE_PATH" "Version metadata is missing for this install." "guide-missing-version file"
assert_contains "$GUIDE_PATH" "clawperator authoring-skills update" "guide-missing-version file"

echo "=== Scenario 8: guide writer with version omits refresh guidance ==="
GUIDE_WITH_VERSION_OUT="$TMP_DIR/guide-with-version.out"
GUIDE_WITH_VERSION_PATH_FILE="$TMP_DIR/guide-with-version.path"
run_guide_case guide-with-version with-version with-runtime-registry "$GUIDE_WITH_VERSION_OUT" "$GUIDE_WITH_VERSION_PATH_FILE"
GUIDE_WITH_VERSION_PATH="$(cat "$GUIDE_WITH_VERSION_PATH_FILE")"
assert_contains "$GUIDE_WITH_VERSION_OUT" "Wrote agent guide" "guide-with-version"
assert_not_contains "$GUIDE_WITH_VERSION_PATH" "Runtime skills not available on this host right now." "guide-with-version file"
assert_contains "$GUIDE_WITH_VERSION_PATH" "skill-author-by-recording" "guide-with-version file"
assert_not_contains "$GUIDE_WITH_VERSION_PATH" "Version metadata is missing for this install." "guide-with-version file"
assert_not_contains "$GUIDE_WITH_VERSION_PATH" "clawperator authoring-skills update" "guide-with-version file"

echo "=== Scenario 9: guide writer shows fallback when authoring skills are absent ==="
GUIDE_MISSING_OUT="$TMP_DIR/guide-missing.out"
GUIDE_MISSING_PATH_FILE="$TMP_DIR/guide-missing.path"
run_missing_guide_case guide-absent "$GUIDE_MISSING_OUT" "$GUIDE_MISSING_PATH_FILE"
GUIDE_MISSING_PATH="$(cat "$GUIDE_MISSING_PATH_FILE")"
assert_contains "$GUIDE_MISSING_PATH" "Runtime skills not available on this host right now." "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "First-party Clawperator authoring skills are not currently configured on this host." "guide-absent file"
assert_contains "$GUIDE_MISSING_PATH" "clawperator authoring-skills install" "guide-absent file"

echo "=== Scenario 10: guide writer degrades cleanly when runtime registry is unreadable ==="
GUIDE_INVALID_OUT="$TMP_DIR/guide-invalid.out"
GUIDE_INVALID_PATH_FILE="$TMP_DIR/guide-invalid.path"
run_guide_case guide-invalid-runtime without-version with-invalid-runtime-registry "$GUIDE_INVALID_OUT" "$GUIDE_INVALID_PATH_FILE"
GUIDE_INVALID_PATH="$(cat "$GUIDE_INVALID_PATH_FILE")"
assert_contains "$GUIDE_INVALID_OUT" "Wrote agent guide" "guide-invalid-runtime"
assert_contains "$GUIDE_INVALID_PATH" "Runtime skills not available on this host right now." "guide-invalid-runtime file"
assert_contains "$GUIDE_INVALID_PATH" "The registry exists but could not be read." "guide-invalid-runtime file"

echo "=== Scenario 11: skip flag suppresses both runtime and authoring skills setup ==="
SKIP_SKILLS_OUT="$TMP_DIR/skip-skills.out"
SKIP_AUTHORING_OUT="$TMP_DIR/skip-authoring.out"
SKIP_STATUS="$TMP_DIR/skip.status"
SKIP_LOG="$TMP_DIR/skip.log"
touch "$SKIP_LOG"
run_skip_case "$SKIP_SKILLS_OUT" "$SKIP_AUTHORING_OUT" "$SKIP_STATUS" "$SKIP_LOG"
assert_contains "$SKIP_SKILLS_OUT" "Skipping skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-skills"
assert_contains "$SKIP_AUTHORING_OUT" "Skipping authoring skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1." "skip-authoring"
assert_contains "$SKIP_STATUS" "skills=skipped" "skip-status"
assert_contains "$SKIP_STATUS" "authoring=skipped" "skip-status"
assert_equals "" "$(cat "$SKIP_LOG")" "skip command log"

echo "=== Scenario 12: operator metadata parser extracts all expected fields ==="
METADATA_SUCCESS_OUT="$TMP_DIR/metadata-success.out"
METADATA_SUCCESS_STATUS="$TMP_DIR/metadata-success.status"
METADATA_SUCCESS_VALUES="$TMP_DIR/metadata-success.values"
run_operator_metadata_case \
    metadata-success \
    '{"version":"0.6.1","apk_url":"https://example.com/operator.apk","sha256_url":"https://example.com/operator.apk.sha256","sha256":"deadbeef"}' \
    "$METADATA_SUCCESS_OUT" \
    "$METADATA_SUCCESS_STATUS" \
    "$METADATA_SUCCESS_VALUES"
assert_equals "0" "$(cat "$METADATA_SUCCESS_STATUS")" "metadata-success status"
assert_contains "$METADATA_SUCCESS_VALUES" "version=0.6.1" "metadata-success values"
assert_contains "$METADATA_SUCCESS_VALUES" "apk=https://example.com/operator.apk" "metadata-success values"
assert_contains "$METADATA_SUCCESS_VALUES" "sha_url=https://example.com/operator.apk.sha256" "metadata-success values"
assert_contains "$METADATA_SUCCESS_VALUES" "sha256=deadbeef" "metadata-success values"
assert_file_empty "$METADATA_SUCCESS_OUT" "metadata-success output"

echo "=== Scenario 13: operator metadata parser allows missing inline checksum ==="
METADATA_NO_SHA_OUT="$TMP_DIR/metadata-no-sha.out"
METADATA_NO_SHA_STATUS="$TMP_DIR/metadata-no-sha.status"
METADATA_NO_SHA_VALUES="$TMP_DIR/metadata-no-sha.values"
run_operator_metadata_case \
    metadata-no-sha \
    '{"version":"0.6.1","apk_url":"https://example.com/operator.apk","sha256_url":"https://example.com/operator.apk.sha256"}' \
    "$METADATA_NO_SHA_OUT" \
    "$METADATA_NO_SHA_STATUS" \
    "$METADATA_NO_SHA_VALUES"
assert_equals "0" "$(cat "$METADATA_NO_SHA_STATUS")" "metadata-no-sha status"
assert_contains "$METADATA_NO_SHA_VALUES" "sha256=" "metadata-no-sha values"
assert_file_empty "$METADATA_NO_SHA_OUT" "metadata-no-sha output"

echo "=== Scenario 14: operator metadata parser rejects missing required fields ==="
METADATA_MISSING_OUT="$TMP_DIR/metadata-missing.out"
METADATA_MISSING_STATUS="$TMP_DIR/metadata-missing.status"
METADATA_MISSING_VALUES="$TMP_DIR/metadata-missing.values"
run_operator_metadata_case \
    metadata-missing \
    '{"version":"0.6.1","apk_url":"https://example.com/operator.apk"}' \
    "$METADATA_MISSING_OUT" \
    "$METADATA_MISSING_STATUS" \
    "$METADATA_MISSING_VALUES"
assert_equals "1" "$(cat "$METADATA_MISSING_STATUS")" "metadata-missing status"
assert_contains "$METADATA_MISSING_OUT" "Failed to parse APK metadata" "metadata-missing output"

echo "=== Scenario 15: operator metadata parser rejects malformed JSON ==="
METADATA_BAD_OUT="$TMP_DIR/metadata-bad.out"
METADATA_BAD_STATUS="$TMP_DIR/metadata-bad.status"
METADATA_BAD_VALUES="$TMP_DIR/metadata-bad.values"
run_operator_metadata_case \
    metadata-bad \
    '{"version":' \
    "$METADATA_BAD_OUT" \
    "$METADATA_BAD_STATUS" \
    "$METADATA_BAD_VALUES"
assert_equals "1" "$(cat "$METADATA_BAD_STATUS")" "metadata-bad status"
assert_contains "$METADATA_BAD_OUT" "Failed to parse APK metadata" "metadata-bad output"

echo "=== install.sh authoring-skills harness passed ==="
