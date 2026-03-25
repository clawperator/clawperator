#!/usr/bin/env bash

# install.sh (v0.5.0)
# One-command installation for Clawperator CLI and environment.
# Target: macOS and Linux (Ubuntu/Debian/Arch).

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APK_METADATA_URL="${CLAWPERATOR_APK_METADATA_URL:-https://downloads.clawperator.com/operator/latest.json}"
APK_DOWNLOAD_DIR="${HOME}/.clawperator/downloads"
APK_LOCAL_PATH="${APK_DOWNLOAD_DIR}/operator.apk"
APK_SHA_PATH="${APK_DOWNLOAD_DIR}/operator.apk.sha256"
DEFAULT_OPERATOR_PACKAGE="${CLAWPERATOR_OPERATOR_PACKAGE:-com.clawperator.operator}"
INSTALL_COMMAND="curl -fsSL https://clawperator.com/install.sh | bash"
SKILLS_SETUP_STATUS="not-run"
SKILLS_REGISTRY_PATH=""
CLAWPERATOR_BIN_PATH=""

TEMP_FILES=()

register_temp_file() {
    TEMP_FILES+=("$1")
}

cleanup_temp_files() {
    for file in "${TEMP_FILES[@]:-}"; do
        if [ -n "$file" ] && [ -f "$file" ]; then
            rm -f "$file"
        fi
    done
}

on_error() {
    local line_number="$1"
    echo -e "${RED}❌ Installation failed (line ${line_number}).${NC}"
    echo -e "${YELLOW}Review the error above, fix prerequisites, then re-run:${NC}"
    echo -e "${YELLOW}${INSTALL_COMMAND}${NC}"
}

trap cleanup_temp_files EXIT
trap 'on_error $LINENO' ERR

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Clawperator Installation Script${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

# 1. OS Detection
OS="$(uname -s)"
echo -e "${BLUE}OS detected: $OS${NC}"

validate_os() {
    case "$OS" in
        Darwin|Linux) return 0 ;;
        *)
            echo -e "${RED}❌ Unsupported OS: $OS${NC}"
            echo -e "${YELLOW}This installer supports macOS and Linux only.${NC}"
            return 1
            ;;
    esac
}

# 2. Check Node.js >= 22
load_nvm() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck disable=SC1090
        . "$NVM_DIR/nvm.sh"
        return 0
    fi
    return 1
}

install_or_upgrade_node_with_nvm() {
    echo -e "${BLUE}Installing/upgrading Node.js via nvm...${NC}"

    if ! load_nvm; then
        if ! command -v curl &> /dev/null; then
            echo -e "${RED}❌ curl is required to install nvm automatically.${NC}"
            return 1
        fi

        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        if ! load_nvm; then
            echo -e "${RED}❌ nvm installation completed but nvm could not be loaded.${NC}"
            return 1
        fi
    fi

    nvm install 22
    nvm alias default 22
    nvm use 22 > /dev/null
    hash -r

    local NODE_VERSION
    NODE_VERSION="$(node -v | cut -d'v' -f2)"
    echo -e "${GREEN}✅ Node.js $NODE_VERSION installed via nvm.${NC}"
    return 0
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠️  Node.js not found. Installing Node.js >= 22 via nvm...${NC}"
        install_or_upgrade_node_with_nvm
        return $?
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2)
    MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)

    if [ "$MAJOR_VERSION" -lt 22 ]; then
        echo -e "${YELLOW}⚠️  Node.js version $NODE_VERSION detected. Upgrading to Node.js >= 22 via nvm...${NC}"
        install_or_upgrade_node_with_nvm
        return $?
    fi

    echo -e "${GREEN}✅ Node.js $NODE_VERSION detected.${NC}"
    return 0
}

# 3. Check/Install adb
check_adb() {
    if command -v adb &> /dev/null; then
        echo -e "${GREEN}✅ adb detected: $(which adb)${NC}"
        return 0
    fi

    echo -e "${YELLOW}⚠️  adb not found. Attempting to install...${NC}"

    if [ "$OS" == "Darwin" ]; then
        if command -v brew &> /dev/null; then
            echo "Installing android-platform-tools via Homebrew..."
            brew install --cask android-platform-tools
        else
            echo -e "${RED}❌ Homebrew not found. Please install adb manually: https://developer.android.com/tools/releases/platform-tools${NC}"
            return 1
        fi
    elif [ "$OS" == "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            echo "Installing android-tools-adb via apt..."
            sudo apt-get update && sudo apt-get install -y android-tools-adb android-tools-fastboot
        elif command -v pacman &> /dev/null; then
            echo "Installing android-tools via pacman..."
            sudo pacman -S --noconfirm android-tools
        else
            echo -e "${RED}❌ Unsupported Linux distribution. Please install adb manually.${NC}"
            return 1
        fi
    fi

    if command -v adb &> /dev/null; then
        echo -e "${GREEN}✅ adb installed successfully.${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to install adb automatically.${NC}"
        return 1
    fi
}

# 4. Check/Install git
check_git() {
    if command -v git &> /dev/null; then
        echo -e "${GREEN}✅ git detected.${NC}"
        return 0
    fi

    echo -e "${YELLOW}⚠️  git not found. Attempting to install...${NC}"

    if [ "$OS" == "Darwin" ]; then
        if command -v brew &> /dev/null; then
            echo "Installing git via Homebrew..."
            brew install git
        else
            echo -e "${RED}❌ Homebrew not found. Please install git manually (or install Xcode Command Line Tools).${NC}"
            return 1
        fi
    elif [ "$OS" == "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y git
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm git
        fi
    fi

    if command -v git &> /dev/null; then
        echo -e "${GREEN}✅ git installed successfully.${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to install git automatically.${NC}"
        return 1
    fi
}

# 5. Check download tool
check_curl() {
    if command -v curl &> /dev/null; then
        echo -e "${GREEN}✅ curl detected.${NC}"
        return 0
    fi

    echo -e "${RED}❌ curl is required to download the Clawperator operator metadata, APK, and checksum files.${NC}"
    return 1
}

# 6. Install Clawperator CLI
install_cli() {
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found on PATH. Ensure Node.js is correctly installed.${NC}"
        return 1
    fi

    echo -e "${BLUE}Installing Clawperator CLI (@latest)...${NC}"
    if npm install -g clawperator@latest; then
        echo -e "${GREEN}✅ Clawperator CLI installed.${NC}"

        hash -r

        # Discover the binary path for immediate use
        CLAWPERATOR_BIN_PATH="$(command -v clawperator || true)"
        if [ -z "$CLAWPERATOR_BIN_PATH" ]; then
            local NPM_PREFIX
            NPM_PREFIX="$(npm config get prefix)"
            if [ -f "$NPM_PREFIX/bin/clawperator" ]; then
                CLAWPERATOR_BIN_PATH="$NPM_PREFIX/bin/clawperator"
            fi
        fi
        if [ -z "$CLAWPERATOR_BIN_PATH" ]; then
            echo -e "${RED}❌ Clawperator CLI installed but the binary could not be found on PATH.${NC}"
            echo -e "${YELLOW}Refresh your shell PATH and re-run:${NC}"
            echo -e "${YELLOW}${INSTALL_COMMAND}${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Failed to install Clawperator CLI. Try running 'sudo npm install -g clawperator@latest' if permissions failed.${NC}"
        return 1
    fi
}

# 7. Setup Skills (via CLI)
parse_skills_registry_path() {
    node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.registryPath === "string") {
      process.stdout.write(parsed.registryPath);
    }
  } catch {}
});
' 2>/dev/null || true
}

copy_file_mode() {
    local SOURCE_PATH=$1
    local TARGET_PATH=$2
    local FILE_MODE=""

    if FILE_MODE="$(stat -f '%Lp' "$SOURCE_PATH" 2>/dev/null)"; then
        chmod "$FILE_MODE" "$TARGET_PATH"
        return 0
    fi

    if FILE_MODE="$(stat -c '%a' "$SOURCE_PATH" 2>/dev/null)"; then
        chmod "$FILE_MODE" "$TARGET_PATH"
        return 0
    fi

    return 0
}
setup_skills_via_cli() {
    if [ "${CLAWPERATOR_INSTALL_SKIP_SKILLS:-0}" = "1" ]; then
        SKILLS_SETUP_STATUS="skipped"
        echo -e "${YELLOW}⚠️  Skipping skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1.${NC}"
        return 0
    fi

    echo -e "${BLUE}Setting up Clawperator Skills...${NC}"
    local SKILLS_OUTPUT=""
    local DEFAULT_SKILLS_REGISTRY_PATH="$HOME/.clawperator/skills/skills/skills-registry.json"
    if SKILLS_OUTPUT="$("$CLAWPERATOR_BIN_PATH" skills install --output json 2>&1)"; then
        echo -e "${GREEN}✅ Skills setup complete.${NC}"
        SKILLS_SETUP_STATUS="configured"
        SKILLS_REGISTRY_PATH="$(printf '%s' "$SKILLS_OUTPUT" | parse_skills_registry_path)"
        if [ -z "$SKILLS_REGISTRY_PATH" ]; then
            SKILLS_REGISTRY_PATH="$DEFAULT_SKILLS_REGISTRY_PATH"
        fi

        # Set Env Var in Shell RCs
        local EXPORT_LINE="export CLAWPERATOR_SKILLS_REGISTRY=\"$SKILLS_REGISTRY_PATH\""

        update_rc() {
            local RC_FILE=$1
            if [ -f "$RC_FILE" ]; then
                if grep -q "CLAWPERATOR_SKILLS_REGISTRY" "$RC_FILE"; then
                    local TMP_FILE
                    TMP_FILE="$(mktemp "${RC_FILE}.XXXXXX")"
                    register_temp_file "$TMP_FILE"
                    grep -v "CLAWPERATOR_SKILLS_REGISTRY" "$RC_FILE" > "$TMP_FILE" || true
                    printf "\n# Clawperator Skills Registry\n%s\n" "$EXPORT_LINE" >> "$TMP_FILE"
                    copy_file_mode "$RC_FILE" "$TMP_FILE"
                    mv "$TMP_FILE" "$RC_FILE"
                    echo -e "${BLUE}Updated CLAWPERATOR_SKILLS_REGISTRY in $RC_FILE${NC}"
                else
                    echo -e "${BLUE}Adding CLAWPERATOR_SKILLS_REGISTRY to $RC_FILE${NC}"
                    echo "" >> "$RC_FILE"
                    echo "# Clawperator Skills Registry" >> "$RC_FILE"
                    echo "$EXPORT_LINE" >> "$RC_FILE"
                fi
            fi
        }

        update_rc "$HOME/.zshrc"
        update_rc "$HOME/.bashrc"
        update_rc "$HOME/.bash_profile"
        return 0
    else
        SKILLS_SETUP_STATUS="failed"
        echo -e "${YELLOW}⚠️  Skills setup failed via CLI. You can set them up later with 'clawperator skills install'.${NC}"
        if [ -n "$SKILLS_OUTPUT" ]; then
            echo "$SKILLS_OUTPUT"
        fi
        return 0
    fi
}

write_agent_guide() {
    local AGENT_GUIDE_PATH="$HOME/.clawperator/AGENTS.md"

    mkdir -p "$HOME/.clawperator"

    cat > "$AGENT_GUIDE_PATH" <<'EOF'
# Clawperator

Deterministic Android automation runtime for AI agents.

## Quick start

clawperator doctor --json    # verify readiness
clawperator snapshot --json  # capture device state
clawperator click --text "Settings" --json  # tap an element

## Documentation

- Docs index: https://docs.clawperator.com/llms.txt
- Full docs: https://docs.clawperator.com/llms-full.txt
- Setup guide: https://docs.clawperator.com/setup/
EOF

    echo -e "${GREEN}✅ Wrote agent guide to ${AGENT_GUIDE_PATH}.${NC}"
}

sha256_file() {
    local FILE_PATH=$1

    if command -v sha256sum &> /dev/null; then
        sha256sum "$FILE_PATH" | awk '{ print $1 }'
        return 0
    fi

    if command -v shasum &> /dev/null; then
        shasum -a 256 "$FILE_PATH" | awk '{ print $1 }'
        return 0
    fi

    return 1
}

parse_operator_metadata() {
    local METADATA_PATH=$1
    local metadata_version=""
    local metadata_apk_url=""
    local metadata_sha_url=""
    local metadata_sha256=""

    while IFS= read -r metadata_line; do
        if [ -z "$metadata_version" ]; then
            metadata_version="$metadata_line"
        elif [ -z "$metadata_apk_url" ]; then
            metadata_apk_url="$metadata_line"
        elif [ -z "$metadata_sha_url" ]; then
            metadata_sha_url="$metadata_line"
        elif [ -z "$metadata_sha256" ]; then
            metadata_sha256="$metadata_line"
        else
            echo -e "${RED}❌ APK metadata contained unexpected extra lines.${NC}"
            return 1
        fi
    done < <(node - "$METADATA_PATH" <<'EOF'
const fs = require("fs");

const metadataPath = process.argv[2];
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

for (const key of ["version", "apk_url", "sha256_url"]) {
  if (!metadata[key] || typeof metadata[key] !== "string") {
    throw new Error(`Missing ${key} in ${metadataPath}`);
  }
}

console.log(metadata.version);
console.log(metadata.apk_url);
console.log(metadata.sha256_url);
console.log(metadata.sha256 || "");
EOF
    )

    if [ -z "$metadata_version" ] || [ -z "$metadata_apk_url" ] || [ -z "$metadata_sha_url" ]; then
        echo -e "${RED}❌ Failed to parse APK metadata from ${METADATA_PATH}.${NC}"
        return 1
    fi

    OPERATOR_VERSION="$metadata_version"
    OPERATOR_APK_URL="$metadata_apk_url"
    OPERATOR_SHA_URL="$metadata_sha_url"
    OPERATOR_EXPECTED_SHA256="$metadata_sha256"
}

download_operator_apk() {
    local METADATA_PATH
    METADATA_PATH="$(mktemp)"
    register_temp_file "$METADATA_PATH"

    mkdir -p "$APK_DOWNLOAD_DIR"

    echo -e "${BLUE}Fetching latest operator metadata...${NC}"
    curl -fsSL "$APK_METADATA_URL" -o "$METADATA_PATH"
    parse_operator_metadata "$METADATA_PATH" || return 1

    echo -e "${BLUE}Downloading operator APK ${OPERATOR_VERSION}...${NC}"
    curl -fsSL "$OPERATOR_APK_URL" -o "$APK_LOCAL_PATH"

    if [ -n "$OPERATOR_EXPECTED_SHA256" ]; then
        echo "$OPERATOR_EXPECTED_SHA256" > "$APK_SHA_PATH"
    else
        echo -e "${YELLOW}⚠️  Metadata did not contain inline checksum. Downloading separate file...${NC}"
        curl -fsSL "$OPERATOR_SHA_URL" -o "$APK_SHA_PATH"
    fi
}

verify_operator_apk() {
    if ! command -v sha256sum &> /dev/null && ! command -v shasum &> /dev/null; then
        echo -e "${RED}❌ No SHA-256 tool found. Install shasum or sha256sum.${NC}"
        return 1
    fi

    local EXPECTED_HASH
    EXPECTED_HASH="$(awk '{ print $1 }' "$APK_SHA_PATH")"
    if [ -z "$EXPECTED_HASH" ]; then
        echo -e "${RED}❌ Checksum file did not contain a SHA-256 hash.${NC}"
        return 1
    fi

    local ACTUAL_HASH
    ACTUAL_HASH="$(sha256_file "$APK_LOCAL_PATH")"

    if [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
        echo -e "${RED}❌ APK checksum mismatch.${NC}"
        echo -e "${RED}Expected: ${EXPECTED_HASH}${NC}"
        echo -e "${RED}Actual:   ${ACTUAL_HASH}${NC}"
        echo -e "${YELLOW}Delete ${APK_LOCAL_PATH} and ${APK_SHA_PATH}, then re-run:${NC}"
        echo -e "${YELLOW}${INSTALL_COMMAND}${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ Verified APK checksum.${NC}"
}

count_connected_devices() {
    adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

count_detected_android_devices() {
    adb devices | awk 'NR > 1 && $2 != "" { count++ } END { print count + 0 }'
}

has_unready_android_devices() {
    adb devices | awk 'NR > 1 && ($2 == "unauthorized" || $2 == "offline") { found=1 } END { if (found) print "yes"; else print "no"; }'
}

list_connected_devices() {
    adb devices | awk 'NR > 1 && $2 == "device" { print $1 }'
}

list_detected_android_devices() {
    adb devices | awk 'NR > 1 && $2 != "" { print $1 "\t" $2 }'
}

maybe_install_operator_apk() {
    local READY_DEVICE_COUNT
    local DETECTED_DEVICE_COUNT
    READY_DEVICE_COUNT="$(count_connected_devices)"
    DETECTED_DEVICE_COUNT="$(count_detected_android_devices)"

    if [ "$DETECTED_DEVICE_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No connected Android device detected. Skipping APK install.${NC}"
        return 0
    fi

    if [ "$DETECTED_DEVICE_COUNT" -gt 1 ]; then
        echo -e "${YELLOW}⚠️  Multiple Android devices detected. Checking per-device readiness...${NC}"
        if [ -z "${CLAWPERATOR_BIN_PATH:-}" ]; then
            # CLI not available - fall back to original behaviour.
            echo -e "${YELLOW}Connected devices:${NC}"
            while IFS=$'\t' read -r device_id device_state; do
                [ -n "$device_id" ] || continue
                echo -e "${YELLOW} - ${device_id} (${device_state})${NC}"
            done < <(list_detected_android_devices)
            print_manual_operator_setup_commands
            return 0
        fi
        local all_ready=true
        while IFS=$'\t' read -r device_id device_state; do
            [ -n "$device_id" ] || continue
            if [ "$device_state" = "device" ]; then
                if "$CLAWPERATOR_BIN_PATH" doctor --device "$device_id" --json > /dev/null 2>&1; then
                    echo -e "${GREEN}  ✅ ${device_id} - ready${NC}"
                else
                    echo -e "${YELLOW}  ⚠  ${device_id} - setup required: clawperator operator setup --apk ${APK_LOCAL_PATH} --device ${device_id}${NC}"
                    all_ready=false
                fi
            else
                echo -e "${YELLOW}  ⚠  ${device_id} - ADB state: ${device_state}. Unlock the device or restart ADB before setup.${NC}"
                all_ready=false
            fi
        done < <(list_detected_android_devices)
        if [ "$all_ready" = true ]; then
            echo -e "${GREEN}All devices ready. No setup required.${NC}"
            return 0
        fi

        echo -e "${YELLOW}Skipping APK install until every connected device is ready.${NC}"
        return 0
    fi

    if [ "$READY_DEVICE_COUNT" -eq 0 ]; then
        if [ "$(has_unready_android_devices)" = "yes" ]; then
            echo -e "${YELLOW}⚠️  Android device detected but not ready for ADB.${NC}"
            echo -e "${YELLOW}   - If the device shows as 'unauthorized', unlock it and accept the USB debugging prompt.${NC}"
            echo -e "${YELLOW}   - If it shows as 'offline', try reconnecting the USB cable or restarting ADB (adb kill-server && adb start-server).${NC}"
            echo -e "${YELLOW}Skipping APK install until the device is ready.${NC}"
        else
            echo -e "${YELLOW}⚠️  No connected Android device detected. Skipping APK install.${NC}"
        fi
        return 0
    fi

    local INSTALL_APK_RESPONSE="${CLAWPERATOR_INSTALL_APK:-}"
    if [ -z "$INSTALL_APK_RESPONSE" ]; then
        if tty -s; then
            printf "Install operator APK %s on the connected device now? [Y/n] " "$OPERATOR_VERSION" > /dev/tty
            read -r INSTALL_APK_RESPONSE < /dev/tty
            INSTALL_APK_RESPONSE="${INSTALL_APK_RESPONSE:-Y}"
        else
            INSTALL_APK_RESPONSE="Y"
            echo -e "${BLUE}Non-interactive install detected. Proceeding with APK install.${NC}"
        fi
    fi

    case "$INSTALL_APK_RESPONSE" in
        y|Y|yes|YES)
            local DEVICE_ID
            DEVICE_ID="$(list_connected_devices)"
            echo -e "${BLUE}Installing operator APK on connected device...${NC}"
            if [ -n "$CLAWPERATOR_BIN_PATH" ]; then
                # Use the canonical install command: installs APK and grants permissions in one step.
                if "$CLAWPERATOR_BIN_PATH" operator setup --apk "$APK_LOCAL_PATH" --device "$DEVICE_ID" --operator-package "$DEFAULT_OPERATOR_PACKAGE" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Operator APK installed and permissions granted.${NC}"
                else
                    echo -e "${RED}❌ operator setup failed. Run: clawperator operator setup --apk ${APK_LOCAL_PATH}${NC}"
                    return 1
                fi
            else
                # CLI not available - fall back to direct adb install (no auto-grant).
                if adb install -r "$APK_LOCAL_PATH"; then
                    echo -e "${GREEN}✅ Operator APK installed.${NC}"
                    echo -e "${YELLOW}⚠️  CLI not available for permission grant. Run once CLI is ready: clawperator operator setup --apk ${APK_LOCAL_PATH}${NC}"
                else
                    echo -e "${RED}❌ Failed to install operator APK via adb.${NC}"
                    return 1
                fi
            fi
            ;;
        *)
            echo -e "${YELLOW}⚠️  Skipped APK installation. Manual command: clawperator operator setup --apk ${APK_LOCAL_PATH}${NC}"
            ;;
    esac
}

# Helper: check if a specific doctor check has a given status.
# Uses node (guaranteed installed) to properly parse the pretty-printed JSON.
# Usage: doctor_check_status <json_var> <check_id> <status>
# Returns 0 if the check exists and has the given status, 1 otherwise.
doctor_check_status() {
    local json="$1"
    local check_id="$2"
    local expected_status="$3"
    printf '%s' "$json" | node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  try {
    const r = JSON.parse(d);
    const c = (r.checks || []).find(x => x.id === '$check_id');
    process.exitCode = (c && c.status === '$expected_status') ? 0 : 1;
  } catch { process.exitCode = 1; }
});
" 2>/dev/null
}

doctor_report_ok() {
    local json="$1"
    printf '%s' "$json" | node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  try {
    const r = JSON.parse(d);
    process.exitCode = (r.criticalOk ?? r.ok) ? 0 : 1;
  } catch { process.exitCode = 1; }
});
" 2>/dev/null
}

doctor_check_code() {
    local json="$1"
    local check_id="$2"
    local expected_code="$3"
    printf '%s' "$json" | node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  try {
    const r = JSON.parse(d);
    const c = (r.checks || []).find(x => x.id === '$check_id');
    process.exitCode = (c && c.code === '$expected_code') ? 0 : 1;
  } catch { process.exitCode = 1; }
});
" 2>/dev/null
}

print_manual_operator_setup_commands() {
    echo -e "${YELLOW}Complete Android setup on one target device with one of:${NC}"
    while IFS= read -r device_id; do
        [ -n "$device_id" ] || continue
        echo -e "${YELLOW}  clawperator operator setup --apk ${APK_LOCAL_PATH} --device ${device_id}${NC}"
    done < <(list_connected_devices)
}

# 8. Run Doctor and Apply Fixes
run_doctor_and_fix() {
    echo -e "${BLUE}Running Clawperator Doctor to verify environment...${NC}"
    local DOCTOR_JSON
    DOCTOR_JSON="$("$CLAWPERATOR_BIN_PATH" doctor --format json || true)"

    # Check for ADB
    if doctor_check_status "$DOCTOR_JSON" "host.adb.presence" "fail"; then
        check_adb || return 1
    fi

    # Download and Verify APK if needed.
    # Reinstall when the APK is missing, the wrong variant is installed, or the installed APK is version-incompatible.
    if doctor_check_status "$DOCTOR_JSON" "device.discovery" "fail" || \
       doctor_check_status "$DOCTOR_JSON" "readiness.apk.presence" "fail" || \
       doctor_check_status "$DOCTOR_JSON" "readiness.apk.presence" "warn" || \
       doctor_check_status "$DOCTOR_JSON" "readiness.version.compatibility" "fail"; then
        download_operator_apk || return 1
        verify_operator_apk || return 1
        maybe_install_operator_apk || return 1
    fi

    # Check for Handshake (permissions)
    # Re-run doctor to see if APK install fixed handshake, or if we need to grant permissions
    DOCTOR_JSON="$("$CLAWPERATOR_BIN_PATH" doctor --format json || true)"
    if doctor_check_status "$DOCTOR_JSON" "readiness.handshake" "fail"; then
        local DEVICE_COUNT
        DEVICE_COUNT="$(count_connected_devices)"
        if [ "$DEVICE_COUNT" -eq 1 ]; then
            local DEVICE_ID
            DEVICE_ID="$(list_connected_devices)"
            # Handshake failed after install - re-grant permissions as remediation (not initial setup).
            echo -e "${BLUE}Handshake failed. Re-granting device permissions for $DEVICE_ID as recovery...${NC}"
            "$CLAWPERATOR_BIN_PATH" grant-device-permissions --device "$DEVICE_ID" --operator-package "$DEFAULT_OPERATOR_PACKAGE" > /dev/null 2>&1 || true
        fi
    fi
}

# Main
main() {
    validate_os || exit 1
    check_node || exit 1
    check_curl || exit 1
    check_adb || exit 1
    check_git || exit 1
    
    install_cli || exit 1
    write_agent_guide
    
    # Use doctor to drive the rest of the installation
    run_doctor_and_fix || exit 1
    
    # Setup skills via CLI (best-effort)
    setup_skills_via_cli

    local ACTIVE_SHELL="${SHELL:-/bin/bash}"
    local DETECTED_SHELL
    DETECTED_SHELL="$(basename "$ACTIVE_SHELL")"
    local SOURCE_CMD=""
    case "$DETECTED_SHELL" in
        zsh) SOURCE_CMD="source ~/.zshrc" ;;
        bash) [ -f "$HOME/.bashrc" ] && SOURCE_CMD="source ~/.bashrc" || SOURCE_CMD="source ~/.bash_profile" ;;
        *) SOURCE_CMD="source ~/.$(basename "$ACTIVE_SHELL")rc" ;;
    esac

    echo ""
    echo -e "${BLUE}Final Doctor Check...${NC}"
    local FINAL_DOCTOR_JSON
    FINAL_DOCTOR_JSON="$("$CLAWPERATOR_BIN_PATH" doctor --format json || true)"
    if ! doctor_report_ok "$FINAL_DOCTOR_JSON"; then
        if doctor_check_code "$FINAL_DOCTOR_JSON" "device.discovery" "MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"; then
            echo -e "${YELLOW}⚠️  Host install completed, but Android setup is still pending because more than one device is connected.${NC}"
            print_manual_operator_setup_commands
            echo ""
            echo -e "${YELLOW}After setup, verify one device explicitly with:${NC}"
            echo -e "${YELLOW}  clawperator doctor --device <device_id> --output pretty${NC}"
            echo ""
            echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
            echo -e "${GREEN}  Installation Complete (Device Selection Required)${NC}"
            echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
            return 0
        fi
        echo -e "${RED}❌ Final doctor check failed.${NC}"
        "$CLAWPERATOR_BIN_PATH" doctor --output pretty || true
        return 1
    fi
    "$CLAWPERATOR_BIN_PATH" doctor --output pretty

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Installation Successful!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}⚠  Activate Clawperator in your current terminal — run now:${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
    echo -e "   ${SOURCE_CMD}"
    echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "Info:"
    echo -e "1. ${YELLOW}Clawperator binary installed at:${NC}"
    echo -e "   ${BLUE}${CLAWPERATOR_BIN_PATH:-clawperator}${NC}"
    echo -e "2. The latest operator APK (${YELLOW}${OPERATOR_VERSION:-unknown}${NC}) is saved at:"
    echo -e "   ${BLUE}${APK_LOCAL_PATH}${NC}"
    echo -e "3. Stable download URL:"
    echo -e "   ${BLUE}https://clawperator.com/operator.apk${NC}"
    echo -e "4. Historical releases and artifacts remain at:"
    echo -e "   ${BLUE}https://github.com/clawperator/clawperator/releases${NC}"
    echo ""

    if [ "$SKILLS_SETUP_STATUS" = "configured" ]; then
        echo -e "5. Skills registry configured at:"
        echo -e "   ${BLUE}${SKILLS_REGISTRY_PATH}${NC}"
    else
        echo -e "5. ${YELLOW}Skills were not configured during install.${NC}"
        echo -e "   To set up skills later, run:"
        echo -e "   ${YELLOW}clawperator skills install${NC}"
        echo -e "   Then add to your shell profile (~/.zshrc or ~/.bashrc):"
        echo -e "   ${YELLOW}export CLAWPERATOR_SKILLS_REGISTRY=\"\$HOME/.clawperator/skills/skills/skills-registry.json\"${NC}"
    fi
    echo ""
    echo -e "For more info, visit: ${BLUE}https://docs.clawperator.com${NC}"
    echo -e "Agent guide: ${BLUE}https://docs.clawperator.com/llms.txt${NC}"
    echo -e "If you are an AI agent, read the agent guide before running any commands.${NC}"
    echo ""
}

main
