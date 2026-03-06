#!/usr/bin/env bash

# install.sh
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
    echo -e "${YELLOW}Review the error above, fix prerequisites, then re-run ./scripts/install.sh.${NC}"
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

    echo -e "${RED}❌ curl is required to download the Clawperator APK metadata.${NC}"
    return 1
}

# 6. Install Clawperator CLI
install_cli() {
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found on PATH. Ensure Node.js is correctly installed.${NC}"
        return 1
    fi

    echo -e "${BLUE}Installing Clawperator CLI (@alpha)...${NC}"
    if npm install -g clawperator@alpha; then
        echo -e "${GREEN}✅ Clawperator CLI installed.${NC}"
    else
        echo -e "${RED}❌ Failed to install Clawperator CLI. Try running 'sudo npm install -g clawperator@alpha' if permissions failed.${NC}"
        return 1
    fi
}

# 7. Clone Skills
setup_skills() {
    local SKILLS_DIR="$HOME/.clawperator/skills"
    local SKILLS_REPO_URL="https://github.com/clawpilled/clawperator-skills"
    echo -e "${BLUE}Setting up Clawperator Skills in $SKILLS_DIR...${NC}"
    # NOTE:
    # The skills repo is currently private. On macOS, git-credential-osxkeychain may
    # prompt for keychain access during clone/pull. This is expected for authenticated
    # GitHub access until the repo is made public.

    if [ -d "$SKILLS_DIR" ]; then
        if [ ! -d "$SKILLS_DIR/.git" ]; then
            echo -e "${RED}❌ $SKILLS_DIR exists but is not a git repository.${NC}"
            echo -e "${YELLOW}Move or remove it, then re-run install.sh.${NC}"
            return 1
        fi
        echo -e "${YELLOW}⚠️  Skills directory already exists. Updating...${NC}"
        git -C "$SKILLS_DIR" pull --ff-only
    else
        mkdir -p "$(dirname "$SKILLS_DIR")"
        git clone "$SKILLS_REPO_URL" "$SKILLS_DIR"
    fi

    local REGISTRY_FILE=""
    local REGISTRY_CANDIDATES=(
        "$SKILLS_DIR/skills-registry.json"
        "$SKILLS_DIR/skills/skills-registry.json"
    )
    for candidate in "${REGISTRY_CANDIDATES[@]}"; do
        if [ -f "$candidate" ]; then
            REGISTRY_FILE="$candidate"
            break
        fi
    done
    if [ -z "$REGISTRY_FILE" ]; then
        echo -e "${RED}❌ Failed to find skills-registry.json in cloned repo.${NC}"
        echo -e "${RED}   Checked:${NC}"
        for candidate in "${REGISTRY_CANDIDATES[@]}"; do
            echo -e "${RED}   - $candidate${NC}"
        done
        return 1
    fi
    if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$REGISTRY_FILE" >/dev/null 2>&1; then
        echo -e "${RED}❌ skills-registry.json is not valid JSON: $REGISTRY_FILE${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ Skills setup complete.${NC}"

    # Set Env Var in Shell RCs
    local EXPORT_LINE="export CLAWPERATOR_SKILLS_REGISTRY=\"$REGISTRY_FILE\""

    update_rc() {
        local RC_FILE=$1
        if [ -f "$RC_FILE" ]; then
            if grep -q "CLAWPERATOR_SKILLS_REGISTRY" "$RC_FILE"; then
                local TMP_FILE
                TMP_FILE="$(mktemp)"
                register_temp_file "$TMP_FILE"
                grep -v "CLAWPERATOR_SKILLS_REGISTRY" "$RC_FILE" > "$TMP_FILE"
                printf "\n# Clawperator Skills Registry\n%s\n" "$EXPORT_LINE" >> "$TMP_FILE"
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
}

sha256_binary() {
    if command -v sha256sum &> /dev/null; then
        echo "sha256sum"
        return 0
    fi

    if command -v shasum &> /dev/null; then
        echo "shasum -a 256"
        return 0
    fi

    return 1
}

parse_operator_metadata() {
    local METADATA_PATH=$1

    mapfile -t METADATA_VALUES < <(node - "$METADATA_PATH" <<'EOF'
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
EOF
    )

    if [ "${#METADATA_VALUES[@]}" -ne 3 ]; then
        echo -e "${RED}❌ Failed to parse APK metadata from ${METADATA_PATH}.${NC}"
        return 1
    fi

    OPERATOR_VERSION="${METADATA_VALUES[0]}"
    OPERATOR_APK_URL="${METADATA_VALUES[1]}"
    OPERATOR_SHA_URL="${METADATA_VALUES[2]}"
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
    curl -fsSL "$OPERATOR_SHA_URL" -o "$APK_SHA_PATH"
}

verify_operator_apk() {
    local SHA_TOOL
    SHA_TOOL="$(sha256_binary)" || {
        echo -e "${RED}❌ No SHA-256 tool found. Install shasum or sha256sum.${NC}"
        return 1
    }

    local EXPECTED_HASH
    EXPECTED_HASH="$(awk '{ print $1 }' "$APK_SHA_PATH")"
    if [ -z "$EXPECTED_HASH" ]; then
        echo -e "${RED}❌ Checksum file did not contain a SHA-256 hash.${NC}"
        return 1
    fi

    local ACTUAL_HASH
    ACTUAL_HASH="$($SHA_TOOL "$APK_LOCAL_PATH" | awk '{ print $1 }')"

    if [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
        echo -e "${RED}❌ APK checksum mismatch.${NC}"
        echo -e "${RED}Expected: ${EXPECTED_HASH}${NC}"
        echo -e "${RED}Actual:   ${ACTUAL_HASH}${NC}"
        echo -e "${YELLOW}Delete ${APK_LOCAL_PATH} and ${APK_SHA_PATH}, then re-run install.sh.${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ Verified APK checksum.${NC}"
}

count_connected_devices() {
    adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

maybe_install_operator_apk() {
    local DEVICE_COUNT
    DEVICE_COUNT="$(count_connected_devices)"

    if [ "$DEVICE_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No connected Android device detected. Skipping APK install.${NC}"
        return 0
    fi

    if [ "$DEVICE_COUNT" -gt 1 ]; then
        echo -e "${YELLOW}⚠️  Multiple Android devices detected. Skipping APK install.${NC}"
        echo -e "${YELLOW}Install manually with: adb -s <device_id> install -r ${APK_LOCAL_PATH}${NC}"
        return 0
    fi

    if [ ! -t 0 ]; then
        echo -e "${YELLOW}⚠️  Non-interactive shell detected. Skipping APK install.${NC}"
        echo -e "${YELLOW}Install manually with: adb install -r ${APK_LOCAL_PATH}${NC}"
        return 0
    fi

    printf "Install operator APK %s on the connected device now? [Y/n] " "$OPERATOR_VERSION"
    read -r INSTALL_APK_RESPONSE
    INSTALL_APK_RESPONSE="${INSTALL_APK_RESPONSE:-Y}"

    case "$INSTALL_APK_RESPONSE" in
        y|Y|yes|YES)
            echo -e "${BLUE}Installing operator APK on connected device...${NC}"
            adb install -r "$APK_LOCAL_PATH"
            echo -e "${GREEN}✅ Operator APK installed.${NC}"
            ;;
        *)
            echo -e "${YELLOW}⚠️  Skipped APK installation. Manual command: adb install -r ${APK_LOCAL_PATH}${NC}"
            ;;
    esac
}

# Main
main() {
    validate_os || exit 1
    check_node || exit 1
    check_adb || exit 1
    check_git || exit 1
    check_curl || exit 1
    install_cli || exit 1
    setup_skills || exit 1
    download_operator_apk || exit 1
    verify_operator_apk || exit 1
    maybe_install_operator_apk || exit 1

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Installation Successful!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Next steps:"
    echo -e "1. ${YELLOW}Restart your terminal${NC} or run: source ~/.zshrc (or ~/.bashrc)"
    echo -e "2. The latest operator APK (${YELLOW}${OPERATOR_VERSION}${NC}) is saved at:"
    echo -e "   ${BLUE}${APK_LOCAL_PATH}${NC}"
    echo -e "3. Stable download URL:"
    echo -e "   ${BLUE}https://clawperator.com/operator.apk${NC}"
    echo -e "4. Historical release notes and artifacts remain at:"
    echo -e "   ${BLUE}https://github.com/clawpilled/clawperator/releases${NC}"
    echo -e "5. Run ${YELLOW}clawperator doctor${NC} to verify setup"
    echo ""
    echo -e "For more info, visit: ${BLUE}https://docs.clawperator.com${NC}"
    echo ""
}

main
