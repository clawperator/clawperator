#!/usr/bin/env bash

# install.sh (v0.7.3)
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
RELEASE_OPERATOR_PACKAGE="com.clawperator.operator"
DEFAULT_OPERATOR_PACKAGE="${CLAWPERATOR_OPERATOR_PACKAGE:-$RELEASE_OPERATOR_PACKAGE}"
APK_FILE_BASENAME="operator.apk"
if [ "$DEFAULT_OPERATOR_PACKAGE" != "$RELEASE_OPERATOR_PACKAGE" ]; then
    APK_FILE_BASENAME="operator-debug.apk"
fi
APK_LOCAL_PATH="${APK_DOWNLOAD_DIR}/${APK_FILE_BASENAME}"
APK_SHA_PATH="${APK_LOCAL_PATH}.sha256"
INSTALL_COMMAND="curl -fsSL https://clawperator.com/install.sh | bash"
SKILLS_SETUP_STATUS="not-run"
SKILLS_REGISTRY_PATH=""
BUNDLED_SKILLS_SETUP_STATUS="not-run"
BUNDLED_SKILLS_INSTALL_DIR=""
BUNDLED_SKILLS_CLAUDE_DIR=""
BUNDLED_SKILLS_CODEX_DIR=""
BUNDLED_SKILLS_AGENTS_DIR=""
CLAWPERATOR_BIN_PATH=""
LAST_DEVICE_SERIAL=""
BLANK_RUNTIME_SKILLS_REGISTRY_WARNED=0
DOCTOR_PENDING_SETUP_DEVICES=()
DOCTOR_CONNECTED_DEVICE_COUNT=0
DOCTOR_READY_DEVICE_COUNT=0
DOCTOR_CRITICAL_DEVICE_COUNT=0
DOCTOR_ADB_UNREADY_DEVICE_COUNT=0
DOCTOR_SETUP_REQUIRED_COUNT=0
DOCTOR_PROBE_FAILURE_COUNT=0
MULTI_DEVICE_APK_TARGET_DEVICES=()
MULTI_DEVICE_APK_PROBE_FAILURE_COUNT=0
MULTI_DEVICE_APK_PROBE_FAILED_DEVICES=()
MULTI_DEVICE_APK_ADB_RECOVERY_DEVICES=()
MULTI_DEVICE_APK_CLEAN_DEVICES=()
MULTI_DEVICE_APK_WARN_DEVICES=()
MULTI_DEVICE_APK_INSTALL_FAILURES=0
OPERATOR_APK_DOWNLOADED_THIS_RUN=0

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

shell_quote() {
    printf '%q' "$1"
}

on_error() {
    local line_number="$1"
    echo -e "${RED}❌ Installation failed (line ${line_number}).${NC}"
    echo -e "${YELLOW}Review the error above, fix prerequisites, then re-run:${NC}"
    echo -e "${YELLOW}${INSTALL_COMMAND}${NC}"
}

trap cleanup_temp_files EXIT
trap 'on_error $LINENO' ERR

# 1. OS Detection
# Allow tests to inject OS via an exported variable; detect automatically otherwise.
# Assigned at top level so all functions can reference $OS when sourced.
OS="${OS:-$(uname -s)}"

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

java_output_is_supported() {
    local output_lower
    output_lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    case "$output_lower" in
        *'version "17'*|*'version "21'*|*'openjdk 17'*|*'openjdk 21'*)
            return 0
            ;;
    esac
    return 1
}

java_output_indicates_missing_runtime() {
    local output_lower
    output_lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    case "$output_lower" in
        *"no java runtime present"*|*"unable to locate a java runtime"*)
            return 0
            ;;
    esac
    return 1
}

java_version_first_line() {
    printf '%s\n' "$1" | head -n 1
}

java_install_conflict_detected() {
    local output_lower
    output_lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
    case "$output_lower" in
        *conflict*|*"held broken packages"*|*"conflicting files"*|*"failed to commit transaction"*|*"would remove"*)
            return 0
            ;;
    esac
    return 1
}

# 2. Check Java (Java 17 or 21 required for Android builds)
# Returns: 0 if valid Java is available, 1 on failure
# Three-state detection: valid (skip), missing (install), incompatible (warn+install)
check_java() {
    local java_version_output=""
    local java_check_status="missing"
    local java_home_output=""
    local java_version_status=0

    # Prefer a valid JAVA_HOME before touching the system install.
    if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
        java_home_output="$("${JAVA_HOME}/bin/java" -version 2>&1 || true)"
        if java_output_is_supported "$java_home_output"; then
            java_version_output="$java_home_output"
            export PATH="${JAVA_HOME}/bin:${PATH}"
            hash -r
            echo -e "${GREEN}✅ Java detected via JAVA_HOME: $(java_version_first_line "$java_version_output")${NC}"
            return 0
        fi
    fi

    # Check if java is on PATH
    if command -v java &> /dev/null; then
        if java_version_output="$(java -version 2>&1)"; then
            java_version_status=0
        else
            java_version_status=$?
        fi

        if [ "$java_version_status" -eq 0 ] && java_output_is_supported "$java_version_output"; then
            java_check_status="valid"
        elif java_output_indicates_missing_runtime "$java_version_output"; then
            java_check_status="missing"
        else
            java_check_status="incompatible"
        fi
    fi

    case "$java_check_status" in
        valid)
            echo -e "${GREEN}✅ Java detected: $(java_version_first_line "$java_version_output")${NC}"
            return 0
            ;;
        incompatible)
            echo -e "${YELLOW}⚠️  Incompatible Java version detected:${NC}"
            echo -e "${YELLOW}   $(java_version_first_line "$java_version_output")${NC}"
            echo -e "${YELLOW}   Java 17 or 21 is required for Android builds. Installing Java 17...${NC}"
            ;;
        missing)
            echo -e "${YELLOW}⚠️  Java not found. Installing Java 17...${NC}"
            ;;
    esac

    # Provisioning based on platform
    if [ "$OS" == "Darwin" ]; then
        if command -v brew &> /dev/null; then
            echo "Installing Temurin JDK 17 via Homebrew..."
            if ! brew install --cask temurin@17; then
                echo -e "${RED}❌ Failed to install Java via Homebrew.${NC}"
                echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
                return 1
            fi
            local temurin_home="${CLAWPERATOR_TEMURIN_17_HOME:-/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home}"
            if [ -d "$temurin_home" ]; then
                export JAVA_HOME="$temurin_home"
                echo -e "${BLUE}Set JAVA_HOME to $temurin_home${NC}"
                export PATH="${temurin_home}/bin:${PATH}"
                hash -r
            fi
        else
            echo -e "${RED}❌ Homebrew not found. Please install Java 17 manually:${NC}"
            echo -e "${YELLOW}https://adoptium.net/temurin/releases/${NC}"
            return 1
        fi
    elif [ "$OS" == "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            echo "Installing OpenJDK 17 via apt..."
            if ! sudo apt-get update; then
                echo -e "${RED}❌ Failed to update apt package lists.${NC}"
                echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
                return 1
            fi
            local apt_install_output
            if ! apt_install_output="$(sudo apt-get install -y openjdk-17-jdk 2>&1)"; then
                if java_install_conflict_detected "$apt_install_output"; then
                    echo -e "${RED}❌ The package manager reported a conflict that may require removing the existing JDK.${NC}"
                    echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
                    printf '%s%s%s\n' "$YELLOW" "$apt_install_output" "$NC"
                    return 1
                fi
                echo -e "${RED}❌ Failed to install Java via apt.${NC}"
                printf '%s%s%s\n' "$YELLOW" "$apt_install_output" "$NC"
                echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
                return 1
            fi
        elif command -v pacman &> /dev/null; then
            echo "Installing OpenJDK 17 via pacman..."
            local pacman_install_output
            if ! pacman_install_output="$(sudo pacman -S --noconfirm jdk17-openjdk 2>&1)"; then
                if java_install_conflict_detected "$pacman_install_output"; then
                    echo -e "${RED}❌ The package manager reported a conflict that may require removing the existing JDK.${NC}"
                    echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
                    printf '%s%s%s\n' "$YELLOW" "$pacman_install_output" "$NC"
                    return 1
                fi
                echo -e "${RED}❌ Failed to install Java via pacman.${NC}"
                printf '%s%s%s\n' "$YELLOW" "$pacman_install_output" "$NC"
                echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Unsupported Linux distribution. Please install Java 17 manually:${NC}"
            echo -e "${YELLOW}https://adoptium.net/temurin/releases/${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Unsupported OS for automatic Java installation.${NC}"
        echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
        return 1
    fi

    # Verify installation
    hash -r
    if command -v java &> /dev/null; then
        local new_version_output
        if new_version_output="$(java -version 2>&1)"; then
            if java_output_is_supported "$new_version_output"; then
                echo -e "${GREEN}✅ Java detected successfully: $(java_version_first_line "$new_version_output")${NC}"
                return 0
            fi
        fi
        echo -e "${YELLOW}Current shell still resolves: $(java_version_first_line "$new_version_output")${NC}"
    fi

    echo -e "${RED}❌ Java installation verification failed.${NC}"
    echo -e "${YELLOW}Please install Java 17 manually from: https://adoptium.net/temurin/releases/${NC}"
    return 1
}

# 3. Check Node.js >= 24
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

    nvm install 24
    nvm alias default 24
    nvm use 24 > /dev/null
    hash -r

    local NODE_VERSION
    NODE_VERSION="$(node -v | cut -d'v' -f2)"
    echo -e "${GREEN}✅ Node.js $NODE_VERSION installed via nvm.${NC}"
    return 0
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠️  Node.js not found. Installing Node.js >= 24 via nvm...${NC}"
        install_or_upgrade_node_with_nvm
        return $?
    fi

    local NODE_VERSION
    local MAJOR_VERSION
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)

    if [ "$MAJOR_VERSION" -lt 24 ]; then
        echo -e "${YELLOW}⚠️  Node.js version $NODE_VERSION detected. Upgrading to Node.js >= 24 via nvm...${NC}"
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

parse_bundled_skills_install_result() {
    node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.installedDir === "string") {
      process.stdout.write(`installedDir=${parsed.installedDir}\n`);
    }
    if (parsed && Array.isArray(parsed.agentDiscoveryDirs)) {
      for (const entry of parsed.agentDiscoveryDirs) {
        if (typeof entry.label === "string" && typeof entry.dir === "string") {
          process.stdout.write(`agentDiscoveryDir:${entry.label}=${entry.dir}\n`);
        }
      }
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

setup_bundled_skills_via_cli() {
    local DEFAULT_BUNDLED_SKILLS_INSTALL_DIR="$HOME/.clawperator/bundled-skills/"
    local DEFAULT_BUNDLED_SKILLS_CLAUDE_DIR="$HOME/.claude/skills/"
    local DEFAULT_BUNDLED_SKILLS_CODEX_DIR="${CODEX_HOME:-$HOME/.codex}/skills/"
    local DEFAULT_BUNDLED_SKILLS_AGENTS_DIR="$HOME/.agents/skills/"
    local BUNDLED_SKILLS_OUTPUT=""

    BUNDLED_SKILLS_INSTALL_DIR="$DEFAULT_BUNDLED_SKILLS_INSTALL_DIR"
    BUNDLED_SKILLS_CLAUDE_DIR="$DEFAULT_BUNDLED_SKILLS_CLAUDE_DIR"
    BUNDLED_SKILLS_CODEX_DIR="$DEFAULT_BUNDLED_SKILLS_CODEX_DIR"
    BUNDLED_SKILLS_AGENTS_DIR="$DEFAULT_BUNDLED_SKILLS_AGENTS_DIR"

    if [ "${CLAWPERATOR_INSTALL_SKIP_SKILLS:-0}" = "1" ]; then
        BUNDLED_SKILLS_SETUP_STATUS="skipped"
        echo -e "${YELLOW}⚠️  Skipping bundled-skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1.${NC}"
        return 0
    fi

    echo -e "${BLUE}Setting up bundled-skills...${NC}"
    if BUNDLED_SKILLS_OUTPUT="$("$CLAWPERATOR_BIN_PATH" bundled-skills install --output json)"; then
        local PARSED_BUNDLED_SKILLS_LINE=""
        while IFS= read -r PARSED_BUNDLED_SKILLS_LINE; do
            case "$PARSED_BUNDLED_SKILLS_LINE" in
                installedDir=*)
                    BUNDLED_SKILLS_INSTALL_DIR="${PARSED_BUNDLED_SKILLS_LINE#installedDir=}"
                    ;;
                # agentDiscoveryDir:<label>=<path> entries - matched by label so new agents
                # (e.g. gemini) can be added to the CLI without breaking this script.
                agentDiscoveryDir:claude=*)
                    BUNDLED_SKILLS_CLAUDE_DIR="${PARSED_BUNDLED_SKILLS_LINE#agentDiscoveryDir:claude=}"
                    ;;
                agentDiscoveryDir:codex=*)
                    BUNDLED_SKILLS_CODEX_DIR="${PARSED_BUNDLED_SKILLS_LINE#agentDiscoveryDir:codex=}"
                    ;;
                agentDiscoveryDir:agents=*)
                    BUNDLED_SKILLS_AGENTS_DIR="${PARSED_BUNDLED_SKILLS_LINE#agentDiscoveryDir:agents=}"
                    ;;
            esac
        done < <(printf '%s' "$BUNDLED_SKILLS_OUTPUT" | parse_bundled_skills_install_result)

        BUNDLED_SKILLS_SETUP_STATUS="configured"
        echo -e "${GREEN}✅ Bundled-skills setup complete.${NC}"
        echo -e "${GREEN}   Installed at: ${BUNDLED_SKILLS_INSTALL_DIR}${NC}"
        echo -e "${GREEN}   Claude skills dir: ${BUNDLED_SKILLS_CLAUDE_DIR}${NC}"
        echo -e "${GREEN}   Codex skills dir: ${BUNDLED_SKILLS_CODEX_DIR}${NC}"
        echo -e "${GREEN}   Agents skills dir: ${BUNDLED_SKILLS_AGENTS_DIR}${NC}"
        return 0
    fi

    BUNDLED_SKILLS_SETUP_STATUS="failed"
    echo -e "${YELLOW}⚠️  Bundled-skills setup failed via CLI. Resolve the issue below, then re-run 'clawperator bundled-skills install'.${NC}"
    echo -e "${YELLOW}   Re-running after resolving the conflict is safe.${NC}"
    if [ -n "$BUNDLED_SKILLS_OUTPUT" ]; then
        echo "$BUNDLED_SKILLS_OUTPUT"
    fi
    return 0
}

resolve_cli_version() {
    local CLI_VERSION_OUTPUT=""
    local CLI_VERSION_LINE=""

    if [ -n "${CLAWPERATOR_BIN_PATH:-}" ] && CLI_VERSION_OUTPUT="$("$CLAWPERATOR_BIN_PATH" --version 2>/dev/null | tr -d '\r')"; then
        CLI_VERSION_LINE="$(printf '%s\n' "$CLI_VERSION_OUTPUT" | awk 'NF { line = $0 } END { print line }')"
        if [ -n "$CLI_VERSION_LINE" ]; then
            printf '%s\n' "$CLI_VERSION_LINE"
            return 0
        fi
    fi

    printf '%s\n' ""
}

resolve_adb_path_for_host_artifacts() {
    if command -v adb > /dev/null 2>&1; then
        command -v adb
        return 0
    fi

    printf '%s\n' ""
}

parse_host_setup_result() {
    node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ok === "boolean") {
      process.stdout.write(`ok=${parsed.ok ? "true" : "false"}\n`);
    }
    if (parsed && parsed.summary && typeof parsed.summary === "object") {
      for (const key of ["written", "updated", "skipped", "failed"]) {
        const value = parsed.summary[key];
        if (typeof value === "number") {
          process.stdout.write(`summary.${key}=${value}\n`);
        }
      }
    }
    if (parsed && Array.isArray(parsed.artifacts)) {
      for (const artifact of parsed.artifacts) {
        if (!artifact || typeof artifact !== "object" || typeof artifact.artifact !== "string") {
          continue;
        }
        const key = artifact.artifact;
        if (typeof artifact.status === "string") {
          process.stdout.write(`artifact:${key}:status=${artifact.status}\n`);
        }
        if (typeof artifact.path === "string") {
          process.stdout.write(`artifact:${key}:path=${artifact.path}\n`);
        }
        if (typeof artifact.message === "string") {
          process.stdout.write(`artifact:${key}:message=${artifact.message.replace(/\r\n?/g, " ")}\n`);
        }
      }
    }
  } catch {}
});
' 2>/dev/null || true
}

print_host_artifact_outcome() {
    local ARTIFACT_LABEL="$1"
    local ARTIFACT_STATUS="$2"
    local ARTIFACT_PATH="$3"
    local ARTIFACT_MESSAGE="${4:-}"
    local COLOR="$BLUE"
    local ICON="•"

    case "$ARTIFACT_STATUS" in
        written)
            COLOR="$GREEN"
            ICON="✅"
            ;;
        updated)
            COLOR="$GREEN"
            ICON="✅"
            ;;
        skipped)
            COLOR="$BLUE"
            ICON="•"
            ;;
        failed)
            COLOR="$YELLOW"
            ICON="⚠️ "
            ;;
    esac

    echo -e "${COLOR}${ICON} ${ARTIFACT_LABEL}: ${ARTIFACT_STATUS}${NC}"
    if [ -n "$ARTIFACT_PATH" ]; then
        echo -e "   ${BLUE}${ARTIFACT_PATH}${NC}"
    fi
    if [ -n "$ARTIFACT_MESSAGE" ]; then
        echo -e "   ${YELLOW}${ARTIFACT_MESSAGE}${NC}"
    fi
}

setup_host_artifacts_via_cli() {
    local HOST_ARTIFACTS_OUTPUT=""
    local HOST_ARTIFACTS_STATUS=0
    local RESOLVED_ADB_PATH=""
    local RESOLVED_CLI_VERSION=""
    local PARSED_HOST_ARTIFACTS=""
    local PARSED_ARTIFACT_COUNT=0
    local HOST_EXIT_OK=""
    local HOST_FAILED_COUNT="0"
    local HOST_INSTALL_STATE_STATUS=""
    local HOST_INSTALL_STATE_PATH=""
    local HOST_INSTALL_STATE_MESSAGE=""
    local HOST_MCP_STATUS=""
    local HOST_MCP_PATH=""
    local HOST_MCP_MESSAGE=""
    local HOST_AGENT_GUIDE_STATUS=""
    local HOST_AGENT_GUIDE_PATH=""
    local HOST_AGENT_GUIDE_MESSAGE=""
    local HOST_SHARED_BRIDGE_STATUS=""
    local HOST_SHARED_BRIDGE_PATH=""
    local HOST_SHARED_BRIDGE_MESSAGE=""
    local CORE_FAILURE=0
    local ONLY_SHARED_BRIDGE_FAILURE=0
    local HOST_ARTIFACT_ARGS=()
    local HOST_ARTIFACT_ENV=()
    local PARSED_LINE=""

    echo -e "${BLUE}Setting up durable host artifacts via the CLI...${NC}"

    HOST_ARTIFACT_ARGS=(host setup --output json)

    if [ -n "${CLAWPERATOR_HOST_ARTIFACTS_INSTALLED_AT:-}" ]; then
        HOST_ARTIFACT_ARGS+=(--installed-at "$CLAWPERATOR_HOST_ARTIFACTS_INSTALLED_AT")
    fi

    RESOLVED_CLI_VERSION="$(resolve_cli_version)"
    if [ -n "$RESOLVED_CLI_VERSION" ]; then
        HOST_ARTIFACT_ARGS+=(--cli-version "$RESOLVED_CLI_VERSION")
    fi

    if [ -n "${OPERATOR_VERSION:-}" ]; then
        HOST_ARTIFACT_ARGS+=(--apk-version "$OPERATOR_VERSION")
    fi

    if [ -n "${LAST_DEVICE_SERIAL:-}" ]; then
        HOST_ARTIFACT_ARGS+=(--last-device-serial "$LAST_DEVICE_SERIAL")
    fi

    RESOLVED_ADB_PATH="$(resolve_adb_path_for_host_artifacts)"
    if [ -n "$RESOLVED_ADB_PATH" ] && [ -z "${ADB_PATH:-}" ]; then
        HOST_ARTIFACT_ENV+=(ADB_PATH="$RESOLVED_ADB_PATH")
    fi
    if [ -n "${SKILLS_REGISTRY_PATH:-}" ]; then
        HOST_ARTIFACT_ENV+=(CLAWPERATOR_SKILLS_REGISTRY="$SKILLS_REGISTRY_PATH")
    fi

    if HOST_ARTIFACTS_OUTPUT="$(env "${HOST_ARTIFACT_ENV[@]}" "$CLAWPERATOR_BIN_PATH" "${HOST_ARTIFACT_ARGS[@]}" 2>&1)"; then
        HOST_ARTIFACTS_STATUS=0
    else
        HOST_ARTIFACTS_STATUS=$?
    fi

    PARSED_HOST_ARTIFACTS="$(printf '%s' "$HOST_ARTIFACTS_OUTPUT" | parse_host_setup_result)"

    while IFS= read -r PARSED_LINE; do
        [ -n "$PARSED_LINE" ] || continue
        case "$PARSED_LINE" in
            ok=*)
                HOST_EXIT_OK="${PARSED_LINE#ok=}"
                ;;
            summary.failed=*)
                HOST_FAILED_COUNT="${PARSED_LINE#summary.failed=}"
                ;;
            artifact:installState:status=*)
                HOST_INSTALL_STATE_STATUS="${PARSED_LINE#artifact:installState:status=}"
                PARSED_ARTIFACT_COUNT=$((PARSED_ARTIFACT_COUNT + 1))
                ;;
            artifact:installState:path=*)
                HOST_INSTALL_STATE_PATH="${PARSED_LINE#artifact:installState:path=}"
                ;;
            artifact:installState:message=*)
                HOST_INSTALL_STATE_MESSAGE="${PARSED_LINE#artifact:installState:message=}"
                ;;
            artifact:mcpConfigSnippet:status=*)
                HOST_MCP_STATUS="${PARSED_LINE#artifact:mcpConfigSnippet:status=}"
                PARSED_ARTIFACT_COUNT=$((PARSED_ARTIFACT_COUNT + 1))
                ;;
            artifact:mcpConfigSnippet:path=*)
                HOST_MCP_PATH="${PARSED_LINE#artifact:mcpConfigSnippet:path=}"
                ;;
            artifact:mcpConfigSnippet:message=*)
                HOST_MCP_MESSAGE="${PARSED_LINE#artifact:mcpConfigSnippet:message=}"
                ;;
            artifact:agentGuide:status=*)
                HOST_AGENT_GUIDE_STATUS="${PARSED_LINE#artifact:agentGuide:status=}"
                PARSED_ARTIFACT_COUNT=$((PARSED_ARTIFACT_COUNT + 1))
                ;;
            artifact:agentGuide:path=*)
                HOST_AGENT_GUIDE_PATH="${PARSED_LINE#artifact:agentGuide:path=}"
                ;;
            artifact:agentGuide:message=*)
                HOST_AGENT_GUIDE_MESSAGE="${PARSED_LINE#artifact:agentGuide:message=}"
                ;;
            artifact:sharedAgentBridge:status=*)
                HOST_SHARED_BRIDGE_STATUS="${PARSED_LINE#artifact:sharedAgentBridge:status=}"
                PARSED_ARTIFACT_COUNT=$((PARSED_ARTIFACT_COUNT + 1))
                ;;
            artifact:sharedAgentBridge:path=*)
                HOST_SHARED_BRIDGE_PATH="${PARSED_LINE#artifact:sharedAgentBridge:path=}"
                ;;
            artifact:sharedAgentBridge:message=*)
                HOST_SHARED_BRIDGE_MESSAGE="${PARSED_LINE#artifact:sharedAgentBridge:message=}"
                ;;
        esac
    done <<< "$PARSED_HOST_ARTIFACTS"

    if [ "$PARSED_ARTIFACT_COUNT" -eq 0 ]; then
        echo -e "${RED}❌ Host setup via CLI returned no parseable artifact results.${NC}"
        if [ -n "$HOST_ARTIFACTS_OUTPUT" ]; then
            echo "$HOST_ARTIFACTS_OUTPUT"
        fi
        return 1
    fi

    print_host_artifact_outcome "Local AGENTS.md" "$HOST_AGENT_GUIDE_STATUS" "$HOST_AGENT_GUIDE_PATH" "$HOST_AGENT_GUIDE_MESSAGE"
    print_host_artifact_outcome "Install state" "$HOST_INSTALL_STATE_STATUS" "$HOST_INSTALL_STATE_PATH" "$HOST_INSTALL_STATE_MESSAGE"
    print_host_artifact_outcome "MCP config snippet" "$HOST_MCP_STATUS" "$HOST_MCP_PATH" "$HOST_MCP_MESSAGE"
    print_host_artifact_outcome "Shared agent bridge" "$HOST_SHARED_BRIDGE_STATUS" "$HOST_SHARED_BRIDGE_PATH" "$HOST_SHARED_BRIDGE_MESSAGE"

    if [ "$HOST_INSTALL_STATE_STATUS" = "failed" ] || \
       [ "$HOST_MCP_STATUS" = "failed" ] || \
       [ "$HOST_AGENT_GUIDE_STATUS" = "failed" ]; then
        CORE_FAILURE=1
    fi

    if [ "$CORE_FAILURE" -eq 0 ] && [ "$HOST_SHARED_BRIDGE_STATUS" = "failed" ] && [ "$HOST_FAILED_COUNT" = "1" ]; then
        ONLY_SHARED_BRIDGE_FAILURE=1
    fi

    if [ "$ONLY_SHARED_BRIDGE_FAILURE" -eq 1 ]; then
        echo -e "${YELLOW}⚠️  Host setup completed with a shared-agent bridge warning; continuing.${NC}"
        return 0
    fi

    if [ "$HOST_ARTIFACTS_STATUS" -eq 0 ] && [ "$HOST_EXIT_OK" = "true" ]; then
        echo -e "${GREEN}✅ Host setup complete.${NC}"
        return 0
    fi

    echo -e "${RED}❌ Host setup failed via the CLI.${NC}"
    if [ -n "$HOST_ARTIFACTS_OUTPUT" ]; then
        echo "$HOST_ARTIFACTS_OUTPUT"
    fi
    return 1
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
    if ! operator_package_uses_public_release_apk; then
        echo -e "${YELLOW}Automatic APK download is only available for the stable release package.${NC}"
        print_operator_apk_redownload_hint
        return 1
    fi

    local METADATA_PATH
    METADATA_PATH="$(mktemp)"
    register_temp_file "$METADATA_PATH"

    mkdir -p "$APK_DOWNLOAD_DIR"

    echo -e "${BLUE}Fetching latest operator metadata...${NC}"
    curl -fsSL "$APK_METADATA_URL" -o "$METADATA_PATH"
    parse_operator_metadata "$METADATA_PATH" || return 1

    echo -e "${BLUE}Downloading operator APK ${OPERATOR_VERSION}...${NC}"
    curl -fsSL "$OPERATOR_APK_URL" -o "$APK_LOCAL_PATH"
    OPERATOR_APK_DOWNLOADED_THIS_RUN=1

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

record_selected_device_serial() {
    local device_serial="$1"
    LAST_DEVICE_SERIAL="$device_serial"
}

maybe_record_unambiguous_connected_device_serial() {
    local device_count=""
    local device_id=""

    device_count="$(count_connected_devices)"
    if [ "$device_count" -ne 1 ]; then
        return 0
    fi

    device_id="$(list_connected_devices)"
    if [ -n "$device_id" ]; then
        record_selected_device_serial "$device_id"
    fi
}

resolve_install_apk_response() {
    local prompt="$1"
    local install_apk_response="${CLAWPERATOR_INSTALL_APK:-}"

    if [ -n "$install_apk_response" ]; then
        INSTALL_APK_RESPONSE="$install_apk_response"
        return 0
    fi

    if tty -s; then
        printf "%s [Y/n] " "$prompt" > /dev/tty
        read -r install_apk_response < /dev/tty
        install_apk_response="${install_apk_response:-Y}"
    else
        install_apk_response="Y"
        echo -e "${BLUE}Non-interactive install detected. Proceeding with APK install.${NC}"
    fi

    INSTALL_APK_RESPONSE="$install_apk_response"
}

install_apk_response_is_yes() {
    case "$1" in
        y|Y|yes|YES)
            return 0
            ;;
    esac
    return 1
}

operator_package_uses_public_release_apk() {
    [ "$DEFAULT_OPERATOR_PACKAGE" = "$RELEASE_OPERATOR_PACKAGE" ]
}

print_operator_apk_redownload_hint() {
    if operator_package_uses_public_release_apk; then
        echo -e "${YELLOW}Redownload the latest stable APK before manual setup:${NC}"
        echo -e "${YELLOW}  curl -fsSL https://clawperator.com/operator.apk -o $(shell_quote "$APK_LOCAL_PATH")${NC}"
        return 0
    fi

    echo -e "${YELLOW}Use a matching local debug APK before manual setup:${NC}"
    echo -e "${YELLOW}  $(shell_quote "$APK_LOCAL_PATH")${NC}"
    echo -e "${YELLOW}  If you do not already have one, rebuild the debug APK from the same checkout before rerunning setup.${NC}"
}

operator_apk_manual_setup_source_text() {
    if operator_package_uses_public_release_apk; then
        printf 'after redownloading https://clawperator.com/operator.apk'
    else
        printf 'with a matching local debug APK at %s' "$(shell_quote "$APK_LOCAL_PATH")"
    fi
}

operator_setup_command_text() {
    local device_id="${1:-}"
    local operator_package="${2:-$DEFAULT_OPERATOR_PACKAGE}"
    local operator_package_flag=""

    if [ "$operator_package" != "$RELEASE_OPERATOR_PACKAGE" ]; then
        operator_package_flag=" --operator-package $(shell_quote "$operator_package")"
    fi

    if [ -n "$device_id" ]; then
        printf 'clawperator operator setup --apk %s --device %s%s' "$(shell_quote "$APK_LOCAL_PATH")" "$(shell_quote "$device_id")" "$operator_package_flag"
    else
        printf 'clawperator operator setup --apk %s%s' "$(shell_quote "$APK_LOCAL_PATH")" "$operator_package_flag"
    fi
}

doctor_command_text() {
    local device_id="${1:-}"
    local operator_package="${2:-$DEFAULT_OPERATOR_PACKAGE}"

    printf 'clawperator doctor --device %s --output pretty --operator-package %s' "$(shell_quote "$device_id")" "$(shell_quote "$operator_package")"
}

print_operator_setup_command() {
    echo -e "${YELLOW}  $(operator_setup_command_text "${1:-}" "${2:-$DEFAULT_OPERATOR_PACKAGE}")${NC}"
}

print_manual_operator_setup_commands() {
    local device_id=""

    print_operator_apk_redownload_hint
    echo -e "${YELLOW}Complete Android setup on one target device with one of:${NC}"
    if [ "$#" -gt 0 ]; then
        for device_id in "$@"; do
            [ -n "$device_id" ] || continue
            print_operator_setup_command "$device_id" "$DEFAULT_OPERATOR_PACKAGE"
        done
        return 0
    fi

    while IFS= read -r device_id; do
        [ -n "$device_id" ] || continue
        print_operator_setup_command "$device_id" "$DEFAULT_OPERATOR_PACKAGE"
    done < <(list_connected_devices)
}

install_operator_apk_on_devices() {
    local install_target_count="$#"
    local prompt=""
    local device_id=""
    local failed_installs=0

    if [ "$install_target_count" -eq 0 ]; then
        return 0
    fi

    if ! operator_package_uses_public_release_apk; then
        echo -e "${YELLOW}Automatic APK installation is only available for the stable release package. Complete setup manually for ${DEFAULT_OPERATOR_PACKAGE}.${NC}"
        print_manual_operator_setup_commands "$@"
        return 0
    fi

    if [ "$install_target_count" -eq 1 ]; then
        prompt="Install operator APK ${OPERATOR_VERSION} on ${1} now?"
    else
        prompt="Install operator APK ${OPERATOR_VERSION} on ${install_target_count} connected devices now?"
    fi

    resolve_install_apk_response "$prompt"
    if ! install_apk_response_is_yes "${INSTALL_APK_RESPONSE:-}"; then
        echo -e "${YELLOW}⚠️  Skipped APK installation.${NC}"
        print_manual_operator_setup_commands "$@"
        return 0
    fi

    for device_id in "$@"; do
        echo -e "${BLUE}Installing operator APK on ${device_id}...${NC}"
        if "$CLAWPERATOR_BIN_PATH" operator setup --apk "$APK_LOCAL_PATH" --device "$device_id" --operator-package "$DEFAULT_OPERATOR_PACKAGE" > /dev/null 2>&1; then
            echo -e "${GREEN}  ✅ ${device_id} - operator APK installed and permissions granted.${NC}"
        else
            echo -e "${RED}  ❌ ${device_id} - operator setup failed. Retry $(operator_apk_manual_setup_source_text), then run: $(operator_setup_command_text "$device_id" "$DEFAULT_OPERATOR_PACKAGE")${NC}"
            failed_installs=$((failed_installs + 1))
        fi
    done

    if [ "$failed_installs" -gt 0 ]; then
        return 1
    fi

    return 0
}

doctor_device_json() {
    local device_id="$1"
    local operator_package="$2"
    local doctor_json=""

    set +e
    doctor_json="$("$CLAWPERATOR_BIN_PATH" doctor --device "$device_id" --format json --operator-package "$operator_package" 2>/dev/null)"
    set -e

    if [ -z "$doctor_json" ]; then
        return 1
    fi

    if ! printf '%s' "$doctor_json" | node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();
if (!input) process.exit(1);
let parsed;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(1);
}
if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.checks)) {
  process.exit(1);
}
'; then
        return 1
    fi

    printf '%s' "$doctor_json"
}

reset_multi_device_apk_target_scan() {
    MULTI_DEVICE_APK_TARGET_DEVICES=()
    MULTI_DEVICE_APK_PROBE_FAILURE_COUNT=0
    MULTI_DEVICE_APK_PROBE_FAILED_DEVICES=()
    MULTI_DEVICE_APK_ADB_RECOVERY_DEVICES=()
    MULTI_DEVICE_APK_CLEAN_DEVICES=()
    MULTI_DEVICE_APK_WARN_DEVICES=()
    MULTI_DEVICE_APK_INSTALL_FAILURES=0
}

doctor_device_needs_adb_recovery() {
    local json="$1"

    doctor_check_code "$json" "readiness.apk.presence" "DEVICE_SHELL_UNAVAILABLE"
}

doctor_device_requires_apk_setup() {
    local json="$1"

    if doctor_device_needs_adb_recovery "$json"; then
        return 1
    fi

    if doctor_check_status "$json" "readiness.apk.presence" "fail" || \
       doctor_check_status "$json" "readiness.apk.presence" "warn" || \
       doctor_check_status "$json" "readiness.version.compatibility" "fail"; then
        return 0
    fi

    return 1
}

collect_multi_device_apk_setup_targets() {
    local device_id=""
    local device_state=""
    local doctor_json=""

    reset_multi_device_apk_target_scan

    if [ -z "${CLAWPERATOR_BIN_PATH:-}" ]; then
        return 0
    fi

    while IFS=$'\t' read -r device_id device_state; do
        [ -n "$device_id" ] || continue
        if [ "$device_state" != "device" ]; then
            continue
        fi

        if ! doctor_json="$(doctor_device_json "$device_id" "$DEFAULT_OPERATOR_PACKAGE")"; then
            echo -e "${RED}  ❌ ${device_id} - could not inspect this device with Clawperator Doctor. Skipping automatic APK remediation for this device until the probe succeeds.${NC}"
            MULTI_DEVICE_APK_PROBE_FAILURE_COUNT=$((MULTI_DEVICE_APK_PROBE_FAILURE_COUNT + 1))
            MULTI_DEVICE_APK_PROBE_FAILED_DEVICES+=("$device_id")
            continue
        fi
        if doctor_device_requires_apk_setup "$doctor_json"; then
            MULTI_DEVICE_APK_TARGET_DEVICES+=("$device_id")
        elif doctor_device_needs_adb_recovery "$doctor_json"; then
            echo -e "${YELLOW}  ⚠  ${device_id} - ADB shell is inaccessible. Resolve ADB connectivity before setup.${NC}"
            MULTI_DEVICE_APK_ADB_RECOVERY_DEVICES+=("$device_id")
        elif doctor_report_all_checks_pass "$doctor_json"; then
            MULTI_DEVICE_APK_CLEAN_DEVICES+=("$device_id")
        elif doctor_report_ok "$doctor_json"; then
            MULTI_DEVICE_APK_WARN_DEVICES+=("$device_id")
        fi
    done < <(list_detected_android_devices)

    if [ "$MULTI_DEVICE_APK_PROBE_FAILURE_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some ready devices could not be inspected with Clawperator Doctor. Automatic APK remediation will continue only for the devices that were inspected successfully.${NC}"
    fi

    return 0
}

maybe_install_operator_apk() {
    local READY_DEVICE_COUNT
    local DETECTED_DEVICE_COUNT
    local install_target_devices=("$@")
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
        local device_id=""
        local device_state=""
        local adb_attention_count=0
        while IFS=$'\t' read -r device_id device_state; do
            [ -n "$device_id" ] || continue
            if [ "$device_state" != "device" ]; then
                echo -e "${YELLOW}  ⚠  ${device_id} - ADB state: ${device_state}. Unlock the device or restart ADB before setup.${NC}"
                adb_attention_count=$((adb_attention_count + 1))
            fi
        done < <(list_detected_android_devices)

        if [ "${#install_target_devices[@]}" -eq 0 ]; then
            collect_multi_device_apk_setup_targets
            install_target_devices=()
            if [ "${#MULTI_DEVICE_APK_TARGET_DEVICES[@]}" -gt 0 ]; then
                install_target_devices=("${MULTI_DEVICE_APK_TARGET_DEVICES[@]}")
            fi
        fi
        if [ "${#install_target_devices[@]}" -eq 0 ]; then
            if [ "$MULTI_DEVICE_APK_PROBE_FAILURE_COUNT" -gt 0 ]; then
                echo -e "${YELLOW}Some ready devices could not be inspected with Clawperator Doctor. Skipping automatic APK install for those devices until the probe succeeds.${NC}"
            elif [ "${#MULTI_DEVICE_APK_ADB_RECOVERY_DEVICES[@]}" -gt 0 ]; then
                echo -e "${YELLOW}Some ready devices need ADB recovery before setup. Skipping automatic APK install for those devices until ADB shell works.${NC}"
            elif [ "$READY_DEVICE_COUNT" -eq 0 ] && [ "$adb_attention_count" -gt 0 ]; then
                echo -e "${YELLOW}No connected device is ready for ADB yet. Skipping APK install until one device is ready.${NC}"
            elif [ "$adb_attention_count" -gt 0 ]; then
                echo -e "${GREEN}All ready devices already have the required APK.${NC}"
            else
                echo -e "${GREEN}All connected devices already have the required APK.${NC}"
            fi
            return 0
        fi

        if install_operator_apk_on_devices "${install_target_devices[@]}"; then
            if [ "$adb_attention_count" -gt 0 ]; then
                echo -e "${YELLOW}Other detected devices were skipped until they are ready for ADB.${NC}"
            fi
            return 0
        fi
        return 1
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

    local DEVICE_ID
    DEVICE_ID="$(list_connected_devices)"
    record_selected_device_serial "$DEVICE_ID"
    if [ -n "$CLAWPERATOR_BIN_PATH" ]; then
        install_operator_apk_on_devices "$DEVICE_ID" || return 1
    else
        resolve_install_apk_response "Install operator APK ${OPERATOR_VERSION} on the connected device now?"
        if install_apk_response_is_yes "${INSTALL_APK_RESPONSE:-}"; then
            echo -e "${BLUE}Installing operator APK on connected device...${NC}"
            # CLI not available - fall back to direct adb install (no auto-grant).
            if adb install -r "$APK_LOCAL_PATH"; then
                echo -e "${GREEN}✅ Operator APK installed.${NC}"
                echo -e "${YELLOW}⚠️  CLI not available for permission grant. When the CLI is ready, redownload the latest stable APK and run:${NC}"
                print_operator_apk_redownload_hint
                print_operator_setup_command "" "$DEFAULT_OPERATOR_PACKAGE"
            else
                echo -e "${RED}❌ Failed to install operator APK via adb.${NC}"
                return 1
            fi
        else
            echo -e "${YELLOW}⚠️  Skipped APK installation.${NC}"
            print_operator_apk_redownload_hint
            echo -e "${YELLOW}Then run:${NC}"
            print_operator_setup_command "" "$DEFAULT_OPERATOR_PACKAGE"
        fi
    fi
}

# Helper: check if a specific doctor check has a given status.
# Uses node (guaranteed installed) to properly parse the pretty-printed JSON.
# Usage: doctor_check_status <json_var> <check_id> <status>
# Returns 0 if the check exists and has the given status, 1 otherwise.
doctor_check_status() {
    local json="$1"
    local check_id="$2"
    local expected_status="$3"
    printf '%s' "$json" | CHECK_ID="$check_id" EXPECTED_STATUS="$expected_status" node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  try {
    const r = JSON.parse(d);
    const c = (r.checks || []).find(x => x.id === process.env.CHECK_ID);
    process.exitCode = (c && c.status === process.env.EXPECTED_STATUS) ? 0 : 1;
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

doctor_report_all_checks_pass() {
    local json="$1"
    printf '%s' "$json" | node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  try {
    const r = JSON.parse(d);
    const reportOk = !!(r.criticalOk ?? r.ok);
    const checks = Array.isArray(r.checks) ? r.checks : [];
    const allPass = checks.every((c) => c && c.status === 'pass');
    process.exitCode = (reportOk && allPass) ? 0 : 1;
  } catch { process.exitCode = 1; }
});
" 2>/dev/null
}

doctor_check_code() {
    local json="$1"
    local check_id="$2"
    local expected_code="$3"
    printf '%s' "$json" | CHECK_ID="$check_id" EXPECTED_CODE="$expected_code" node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  try {
    const r = JSON.parse(d);
    const c = (r.checks || []).find(x => x.id === process.env.CHECK_ID);
    process.exitCode = (c && c.code === process.env.EXPECTED_CODE) ? 0 : 1;
  } catch { process.exitCode = 1; }
});
" 2>/dev/null
}

doctor_report_connected_device() {
    local device_id="$1"
    local operator_package="$2"
    local doctor_json

    if ! doctor_json="$(doctor_device_json "$device_id" "$operator_package")"; then
        DOCTOR_DEVICE_STATUS="probe-failure"
        echo -e "${RED}  ❌ ${device_id} - Clawperator Doctor could not inspect this device. Resolve the probe failure, then rerun: $(doctor_command_text "$device_id" "$operator_package")${NC}"
        return 1
    fi
    if doctor_report_all_checks_pass "$doctor_json"; then
        DOCTOR_DEVICE_STATUS="pass"
        echo -e "${GREEN}  ✅ ${device_id} - ready${NC}"
        return 0
    fi

    if doctor_report_ok "$doctor_json"; then
        DOCTOR_DEVICE_STATUS="critical"
        echo -e "${YELLOW}  ⚠  ${device_id} - critical checks passed; warnings remain.${NC}"
        return 0
    fi

    if doctor_device_needs_adb_recovery "$doctor_json"; then
        DOCTOR_DEVICE_STATUS="adb-recovery"
        echo -e "${YELLOW}  ⚠  ${device_id} - ADB shell is inaccessible. Resolve ADB connectivity, then rerun: $(doctor_command_text "$device_id" "$operator_package")${NC}"
        return 1
    fi

    DOCTOR_DEVICE_STATUS="fail"
    echo -e "${YELLOW}  ⚠  ${device_id} - setup required $(operator_apk_manual_setup_source_text): $(operator_setup_command_text "$device_id" "$operator_package")${NC}"
    return 1
}

reset_doctor_each_connected_device_summary() {
    DOCTOR_PENDING_SETUP_DEVICES=()
    DOCTOR_CONNECTED_DEVICE_COUNT=0
    DOCTOR_READY_DEVICE_COUNT=0
    DOCTOR_CRITICAL_DEVICE_COUNT=0
    DOCTOR_ADB_UNREADY_DEVICE_COUNT=0
    DOCTOR_SETUP_REQUIRED_COUNT=0
    DOCTOR_PROBE_FAILURE_COUNT=0
}

doctor_each_connected_device() {
    if [ -z "${CLAWPERATOR_BIN_PATH:-}" ]; then
        return 0
    fi

    local device_id=""
    local device_state=""
    local device_count=0
    local ready_count=0

    reset_doctor_each_connected_device_summary
    echo -e "${BLUE}Checking each connected device with Clawperator Doctor...${NC}"
    local critical_count=0
    local _f _collect_status
    while IFS=$'\t' read -r device_id device_state; do
        [ -n "$device_id" ] || continue
        device_count=$((device_count + 1))
        if [ "$device_state" = "device" ]; then
            # Reuse the status captured during the collect phase to avoid re-probing
            # devices whose state has not changed since the per-device scan.
            # Probe-failed devices are always re-probed here so transient failures
            # don't persist as stale errors in the final summary.
            _collect_status="unknown"
            if [ "$_collect_status" = "unknown" ] && [ "${#MULTI_DEVICE_APK_TARGET_DEVICES[@]}" -gt 0 ]; then
                for _f in "${MULTI_DEVICE_APK_TARGET_DEVICES[@]}"; do
                    [ "$_f" = "$device_id" ] && { _collect_status="target"; break; }
                done
            fi
            if [ "$_collect_status" = "unknown" ] && [ "${#MULTI_DEVICE_APK_CLEAN_DEVICES[@]}" -gt 0 ]; then
                for _f in "${MULTI_DEVICE_APK_CLEAN_DEVICES[@]}"; do
                    [ "$_f" = "$device_id" ] && { _collect_status="pass"; break; }
                done
            fi
            if [ "$_collect_status" = "unknown" ] && [ "${#MULTI_DEVICE_APK_WARN_DEVICES[@]}" -gt 0 ]; then
                for _f in "${MULTI_DEVICE_APK_WARN_DEVICES[@]}"; do
                    [ "$_f" = "$device_id" ] && { _collect_status="warn"; break; }
                done
            fi
            case "$_collect_status" in
                pass)
                    DOCTOR_DEVICE_STATUS="pass"
                    ready_count=$((ready_count + 1))
                    echo -e "${GREEN}  ✅ ${device_id} - ready${NC}"
                    ;;
                warn)
                    DOCTOR_DEVICE_STATUS="critical"
                    ready_count=$((ready_count + 1))
                    critical_count=$((critical_count + 1))
                    echo -e "${YELLOW}  ⚠  ${device_id} - critical checks passed; warnings remain.${NC}"
                    ;;
                *)
                    if doctor_report_connected_device "$device_id" "$DEFAULT_OPERATOR_PACKAGE"; then
                        ready_count=$((ready_count + 1))
                        if [ "${DOCTOR_DEVICE_STATUS:-}" = "critical" ]; then
                            critical_count=$((critical_count + 1))
                        fi
                    else
                        if [ "${DOCTOR_DEVICE_STATUS:-}" = "probe-failure" ]; then
                            DOCTOR_PROBE_FAILURE_COUNT=$((DOCTOR_PROBE_FAILURE_COUNT + 1))
                        elif [ "${DOCTOR_DEVICE_STATUS:-}" = "adb-recovery" ]; then
                            DOCTOR_ADB_UNREADY_DEVICE_COUNT=$((DOCTOR_ADB_UNREADY_DEVICE_COUNT + 1))
                        else
                            DOCTOR_SETUP_REQUIRED_COUNT=$((DOCTOR_SETUP_REQUIRED_COUNT + 1))
                            DOCTOR_PENDING_SETUP_DEVICES+=("$device_id")
                        fi
                    fi
                    ;;
            esac
        else
            echo -e "${YELLOW}  ⚠  ${device_id} - ADB state: ${device_state}. Unlock the device or restart ADB before setup.${NC}"
            DOCTOR_ADB_UNREADY_DEVICE_COUNT=$((DOCTOR_ADB_UNREADY_DEVICE_COUNT + 1))
        fi
    done < <(list_detected_android_devices)

    DOCTOR_CONNECTED_DEVICE_COUNT="$device_count"
    DOCTOR_READY_DEVICE_COUNT="$ready_count"
    DOCTOR_CRITICAL_DEVICE_COUNT="$critical_count"

    if [ "$DOCTOR_PROBE_FAILURE_COUNT" -eq 0 ] && [ "$device_count" -gt 0 ] && [ "$ready_count" -eq "$device_count" ]; then
        if [ "$critical_count" -gt 0 ]; then
            echo -e "${YELLOW}All connected devices passed critical checks.${NC}"
        else
            echo -e "${GREEN}All connected devices passed doctor checks.${NC}"
        fi
    elif [ "$DOCTOR_PROBE_FAILURE_COUNT" -eq 0 ] && [ "$ready_count" -gt 0 ] && [ "$DOCTOR_SETUP_REQUIRED_COUNT" -eq 0 ]; then
        echo -e "${GREEN}All ready devices passed doctor checks.${NC}"
    fi
}

print_durable_artifact_summary() {
    echo -e "Durable host-agent artifacts:"
    echo -e "   ${BLUE}$HOME/.clawperator/AGENTS.md${NC}"
    echo -e "   ${BLUE}$HOME/.clawperator/install-state.json${NC}"
    echo -e "   ${BLUE}$HOME/.clawperator/mcp-config-snippet.json${NC}"
    echo -e "   AI agents should start with the local guide, then use the install state and MCP snippet as needed."
}

show_star_hint() {
  # Skip if not a TTY
  [ -t 2 ] || return 0
  # Skip if suppressed via env var
  [ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ] && return 0
  cat >&2 <<'EOF'

Clawperator is open source. If it helped, consider starring the repo:
https://github.com/clawperator/clawperator

GitHub CLI:
gh api -X PUT /user/starred/clawperator/clawperator -H "X-GitHub-Api-Version: 2026-03-10"

Disable this hint with: CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1

EOF
}

# 8. Run Doctor and Apply Fixes
run_doctor_and_fix() {
    echo -e "${BLUE}Running Clawperator Doctor to verify environment...${NC}"
    local DOCTOR_JSON
    DOCTOR_JSON="$("$CLAWPERATOR_BIN_PATH" doctor --format json --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>/dev/null || true)"

    # Check for ADB
    if doctor_check_status "$DOCTOR_JSON" "host.adb.presence" "fail"; then
        check_adb || return 1
    fi

    local DETECTED_DEVICE_COUNT
    DETECTED_DEVICE_COUNT="$(count_detected_android_devices)"

    # For multi-device installs, inspect each ready device directly. The aggregate
    # doctor result can halt at device discovery before surfacing per-device APK
    # presence or version problems.
    if [ "$DETECTED_DEVICE_COUNT" -gt 1 ] && [ -n "${CLAWPERATOR_BIN_PATH:-}" ]; then
        collect_multi_device_apk_setup_targets
        if [ "${#MULTI_DEVICE_APK_TARGET_DEVICES[@]}" -gt 0 ]; then
            if operator_package_uses_public_release_apk; then
                download_operator_apk || return 1
                verify_operator_apk || return 1
            fi
            maybe_install_operator_apk "${MULTI_DEVICE_APK_TARGET_DEVICES[@]}" || MULTI_DEVICE_APK_INSTALL_FAILURES=1
        fi
    elif doctor_check_status "$DOCTOR_JSON" "device.discovery" "fail" || \
         doctor_check_status "$DOCTOR_JSON" "readiness.apk.presence" "fail" || \
         doctor_check_status "$DOCTOR_JSON" "readiness.apk.presence" "warn" || \
         doctor_check_status "$DOCTOR_JSON" "readiness.version.compatibility" "fail"; then
        if operator_package_uses_public_release_apk; then
            download_operator_apk || return 1
            verify_operator_apk || return 1
        fi
        maybe_install_operator_apk || return 1
    fi

    # Check for Handshake (permissions)
    # Re-run doctor to see if APK install fixed handshake, or if we need to grant permissions
    DOCTOR_JSON="$("$CLAWPERATOR_BIN_PATH" doctor --format json --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>/dev/null || true)"
    maybe_record_unambiguous_connected_device_serial
    if doctor_check_status "$DOCTOR_JSON" "readiness.handshake" "fail"; then
        local DEVICE_COUNT
        DEVICE_COUNT="$(count_connected_devices)"
        if [ "$DEVICE_COUNT" -eq 1 ]; then
            local DEVICE_ID
            DEVICE_ID="$(list_connected_devices)"
            record_selected_device_serial "$DEVICE_ID"
            # Handshake failed after install - re-grant permissions as remediation (not initial setup).
            echo -e "${BLUE}Handshake failed. Re-granting device permissions for $DEVICE_ID as recovery...${NC}"
            "$CLAWPERATOR_BIN_PATH" grant-device-permissions --device "$DEVICE_ID" --operator-package "$DEFAULT_OPERATOR_PACKAGE" > /dev/null 2>&1 || true
        fi
    fi
}

# Main
main() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Clawperator Installation Script${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}OS detected: $OS${NC}"
    validate_os || exit 1
    check_java || exit 1
    check_node || exit 1
    check_curl || exit 1
    check_adb || exit 1
    check_git || exit 1
    
    install_cli || exit 1
    
    # Use doctor to drive the rest of the installation
    run_doctor_and_fix || exit 1
    
    # Setup skills via CLI (best-effort)
    setup_skills_via_cli
    setup_bundled_skills_via_cli
    setup_host_artifacts_via_cli || exit 1

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
    FINAL_DOCTOR_JSON="$("$CLAWPERATOR_BIN_PATH" doctor --format json --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>/dev/null || true)"
    if doctor_check_code "$FINAL_DOCTOR_JSON" "device.discovery" "MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"; then
        doctor_each_connected_device
        echo ""
        if [ "$DOCTOR_PROBE_FAILURE_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, but some devices could not be inspected with Clawperator Doctor. Resolve the probe failures above, then rerun a device-specific doctor command.${NC}"
        elif [ "$DOCTOR_SETUP_REQUIRED_COUNT" -eq 0 ] && [ "$DOCTOR_ADB_UNREADY_DEVICE_COUNT" -eq 0 ]; then
            if [ "$DOCTOR_CRITICAL_DEVICE_COUNT" -gt 0 ]; then
                echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, and each connected device passed the critical doctor checks. Future commands must target one device explicitly with --device.${NC}"
            else
                echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, and each connected device passed Clawperator Doctor. Future commands must target one device explicitly with --device.${NC}"
            fi
        elif [ "$DOCTOR_READY_DEVICE_COUNT" -eq 0 ] && [ "$DOCTOR_ADB_UNREADY_DEVICE_COUNT" -gt 0 ] && [ "$DOCTOR_SETUP_REQUIRED_COUNT" -eq 0 ]; then
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, but no connected device is ready for ADB yet. Resolve the ADB-state warnings above before setup or future commands.${NC}"
        elif [ "$DOCTOR_SETUP_REQUIRED_COUNT" -eq 0 ]; then
            if [ "$DOCTOR_CRITICAL_DEVICE_COUNT" -gt 0 ]; then
                echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, and each ready device passed the critical doctor checks. Future commands must target one device explicitly with --device.${NC}"
            else
                echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, and each ready device passed Clawperator Doctor. Future commands must target one device explicitly with --device.${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, and some devices still need setup. Use the per-device results above and future commands with --device.${NC}"
        fi
        if [ "${#DOCTOR_PENDING_SETUP_DEVICES[@]}" -gt 0 ]; then
            print_manual_operator_setup_commands "${DOCTOR_PENDING_SETUP_DEVICES[@]}"
            echo ""
        fi
        if [ "$DOCTOR_ADB_UNREADY_DEVICE_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}Resolve any ADB-state warnings above, then rerun install.sh or a device-specific doctor/setup command.${NC}"
            echo ""
        fi
        echo -e "${YELLOW}After setup, verify one device explicitly with:${NC}"
        echo -e "${YELLOW}  clawperator doctor --device <device_id> --output pretty --operator-package ${DEFAULT_OPERATOR_PACKAGE}${NC}"
        echo ""
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  Installation Complete (Device Selection Required)${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        print_durable_artifact_summary
        if [ "${MULTI_DEVICE_APK_INSTALL_FAILURES:-0}" -eq 1 ]; then
            return 1
        fi
        return 0
    fi
    if ! doctor_report_ok "$FINAL_DOCTOR_JSON"; then
        echo -e "${RED}❌ Final doctor check failed.${NC}"
        "$CLAWPERATOR_BIN_PATH" doctor --output pretty --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>/dev/null || true
        print_durable_artifact_summary
        return 1
    fi
    "$CLAWPERATOR_BIN_PATH" doctor --output pretty --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>/dev/null

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
    if operator_package_uses_public_release_apk; then
        if [ "${OPERATOR_APK_DOWNLOADED_THIS_RUN:-0}" -eq 1 ]; then
            echo -e "2. APK download path (downloaded this run) for operator version ${YELLOW}${OPERATOR_VERSION:-unknown}${NC}:"
            echo -e "   ${BLUE}${APK_LOCAL_PATH}${NC}"
            echo -e "3. Canonical stable APK URL (redownload this for later manual setup):"
        else
            echo -e "2. No verified local operator APK was downloaded during this run."
            echo -e "3. Canonical stable APK URL (download this for manual setup):"
        fi
        echo -e "   ${BLUE}https://clawperator.com/operator.apk${NC}"
    else
        echo -e "2. Expected local debug APK path for ${DEFAULT_OPERATOR_PACKAGE}:"
        echo -e "   ${BLUE}${APK_LOCAL_PATH}${NC}"
        echo -e "3. Automatic stable APK downloads are disabled for non-release operator packages."
    fi
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
    if [ "$BUNDLED_SKILLS_SETUP_STATUS" = "configured" ]; then
        echo -e "6. Bundled-skills installed at:"
        echo -e "   ${BLUE}${BUNDLED_SKILLS_INSTALL_DIR}${NC}"
    else
        echo -e "6. ${YELLOW}Bundled-skills were not configured during install.${NC}"
        echo -e "   To repair this later, run:"
        echo -e "   ${YELLOW}clawperator bundled-skills install${NC}"
    fi
    echo ""
    print_durable_artifact_summary
    echo ""
    echo -e "For more info, visit: ${BLUE}https://docs.clawperator.com${NC}"
    echo -e "LLM guide: ${BLUE}https://docs.clawperator.com/llms.txt${NC}"
    echo ""

    show_star_hint
}

if [[ "${BASH_SOURCE[0]-}" == "$0" || -z "${BASH_SOURCE[0]-}" ]]; then main "$@"; fi
