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

RELEASE_OPERATOR_PACKAGE="com.clawperator.operator"
trim_whitespace() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

resolve_operator_package() {
    local candidate="${CLAWPERATOR_OPERATOR_PACKAGE:-}"
    candidate="$(trim_whitespace "$candidate")"
    if [ -n "$candidate" ]; then
        printf '%s' "$candidate"
    else
        printf '%s' "$RELEASE_OPERATOR_PACKAGE"
    fi
}

DEFAULT_OPERATOR_PACKAGE="$(resolve_operator_package)"
APK_FILE_BASENAME="operator.apk"
if [ "$DEFAULT_OPERATOR_PACKAGE" != "$RELEASE_OPERATOR_PACKAGE" ]; then
    APK_FILE_BASENAME="operator-debug.apk"
fi
APK_LOCAL_PATH="${HOME}/.clawperator/downloads/${APK_FILE_BASENAME}"
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
OPERATOR_APK_DOWNLOADED_THIS_RUN=0
OPERATOR_REMEDIATE_OK=""
OPERATOR_REMEDIATE_COMMAND_STATUS=0
OPERATOR_REMEDIATE_TOTAL_DEVICES=0
OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT=0
OPERATOR_REMEDIATE_READY_COUNT=0
OPERATOR_REMEDIATE_WARN_COUNT=0
OPERATOR_REMEDIATE_REMEDIATED_COUNT=0
OPERATOR_REMEDIATE_ADB_UNREADY_COUNT=0
OPERATOR_REMEDIATE_FAILED_COUNT=0
OPERATOR_REMEDIATE_MESSAGE=""
OPERATOR_REMEDIATE_DEVICE_IDS=()
OPERATOR_REMEDIATE_DEVICE_STATES=()
OPERATOR_REMEDIATE_DEVICE_STATUSES=()
OPERATOR_REMEDIATE_DEVICE_MESSAGES=()

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

    echo -e "${RED}❌ curl is required for the Clawperator installer bootstrap and recovery download hints.${NC}"
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

        # Discover the freshly installed binary path for immediate use. Prefer
        # the npm prefix over any older clawperator that may still appear
        # earlier on PATH in the current shell.
        local NPM_PREFIX
        local NPM_CLAWPERATOR_BIN=""
        NPM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
        if [ -n "$NPM_PREFIX" ] && [ -x "$NPM_PREFIX/bin/clawperator" ]; then
            NPM_CLAWPERATOR_BIN="$NPM_PREFIX/bin/clawperator"
        fi
        if [ -n "$NPM_CLAWPERATOR_BIN" ]; then
            CLAWPERATOR_BIN_PATH="$NPM_CLAWPERATOR_BIN"
        else
            CLAWPERATOR_BIN_PATH="$(command -v clawperator || true)"
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
          process.stdout.write(`artifact:${key}:message=${artifact.message.replace(/[\r\n]+/g, " ")}\n`);
        }
      }
    }
  } catch {}
});
' 2>/dev/null || true
}

parse_operator_download_result() {
    node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const sanitize = (value) => value.replace(/[\r\n]+/g, " ");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.localPath === "string") {
      process.stdout.write(`localPath=${sanitize(parsed.localPath)}\n`);
    }
    if (parsed && typeof parsed.operatorVersion === "string") {
      process.stdout.write(`operatorVersion=${sanitize(parsed.operatorVersion)}\n`);
    }
    if (parsed && typeof parsed.sha256 === "string") {
      process.stdout.write(`sha256=${sanitize(parsed.sha256)}\n`);
    }
    if (parsed && typeof parsed.operatorPackage === "string") {
      process.stdout.write(`operatorPackage=${sanitize(parsed.operatorPackage)}\n`);
    }
    if (parsed && typeof parsed.code === "string") {
      process.stdout.write(`code=${sanitize(parsed.code)}\n`);
    }
    if (parsed && typeof parsed.message === "string") {
      process.stdout.write(`message=${sanitize(parsed.message)}\n`);
    }
  } catch {}
});
' 2>/dev/null || true
}

parse_operator_remediate_result() {
    node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const sanitize = (value) => value.replace(/[\r\n]+/g, " ");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ok === "boolean") {
      process.stdout.write(`ok=${parsed.ok ? "true" : "false"}\n`);
    }
    if (parsed && typeof parsed.message === "string") {
      process.stdout.write(`message=${sanitize(parsed.message)}\n`);
    }
    if (parsed && parsed.summary && typeof parsed.summary === "object") {
      for (const key of ["totalDevices", "connectedDevices", "ready", "warn", "remediated", "adbUnready", "failed"]) {
        const value = parsed.summary[key];
        if (typeof value === "number") {
          process.stdout.write(`summary.${key}=${value}\n`);
        }
      }
    }
    if (parsed && Array.isArray(parsed.devices)) {
      parsed.devices.forEach((device, index) => {
        if (!device || typeof device !== "object") {
          return;
        }
        if (typeof device.deviceId === "string") {
          process.stdout.write(`device:${index}:id=${sanitize(device.deviceId)}\n`);
        }
        if (typeof device.adbState === "string") {
          process.stdout.write(`device:${index}:state=${sanitize(device.adbState)}\n`);
        }
        if (typeof device.status === "string") {
          process.stdout.write(`device:${index}:status=${sanitize(device.status)}\n`);
        }
        if (typeof device.message === "string") {
          process.stdout.write(`device:${index}:message=${sanitize(device.message)}\n`);
        }
      });
    }
  } catch {}
});
' 2>/dev/null || true
}

is_valid_sha256_hex() {
    local VALUE="$1"
    [[ "$VALUE" =~ ^[a-fA-F0-9]{64}$ ]]
}

is_valid_operator_download_path() {
    local VALUE="$1"
    [ "$VALUE" = "$APK_LOCAL_PATH" ]
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

    if [ -z "$HOST_INSTALL_STATE_STATUS" ] || \
       [ -z "$HOST_MCP_STATUS" ] || \
       [ -z "$HOST_AGENT_GUIDE_STATUS" ] || \
       [ -z "$HOST_SHARED_BRIDGE_STATUS" ]; then
        echo -e "${RED}❌ Host setup via CLI returned incomplete artifact results.${NC}"
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

download_operator_apk_via_cli() {
    if ! operator_package_uses_public_release_apk; then
        echo -e "${YELLOW}Automatic APK download is only available for the stable release package.${NC}"
        print_operator_apk_redownload_hint
        return 1
    fi

    if [ -z "${CLAWPERATOR_BIN_PATH:-}" ]; then
        echo -e "${RED}❌ Clawperator CLI is required before operator download can run.${NC}"
        return 1
    fi

    local OPERATOR_DOWNLOAD_OUTPUT=""
    local OPERATOR_DOWNLOAD_STATUS=0
    local PARSED_DOWNLOAD_OUTPUT=""
    local DOWNLOADED_LOCAL_PATH=""
    local DOWNLOADED_OPERATOR_VERSION=""
    local DOWNLOADED_SHA256=""
    local DOWNLOADED_OPERATOR_PACKAGE=""
    local DOWNLOAD_ERROR_CODE=""
    local DOWNLOAD_ERROR_MESSAGE=""
    local PARSED_LINE=""

    echo -e "${BLUE}Downloading the verified Operator APK via the CLI...${NC}"
    if OPERATOR_DOWNLOAD_OUTPUT="$("$CLAWPERATOR_BIN_PATH" operator download --output json --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>&1)"; then
        OPERATOR_DOWNLOAD_STATUS=0
    else
        OPERATOR_DOWNLOAD_STATUS=$?
    fi

    PARSED_DOWNLOAD_OUTPUT="$(printf '%s' "$OPERATOR_DOWNLOAD_OUTPUT" | parse_operator_download_result)"
    while IFS= read -r PARSED_LINE; do
        [ -n "$PARSED_LINE" ] || continue
        case "$PARSED_LINE" in
            localPath=*)
                DOWNLOADED_LOCAL_PATH="${PARSED_LINE#localPath=}"
                ;;
            operatorVersion=*)
                DOWNLOADED_OPERATOR_VERSION="${PARSED_LINE#operatorVersion=}"
                ;;
            sha256=*)
                DOWNLOADED_SHA256="${PARSED_LINE#sha256=}"
                ;;
            operatorPackage=*)
                DOWNLOADED_OPERATOR_PACKAGE="${PARSED_LINE#operatorPackage=}"
                ;;
            code=*)
                DOWNLOAD_ERROR_CODE="${PARSED_LINE#code=}"
                ;;
            message=*)
                DOWNLOAD_ERROR_MESSAGE="${PARSED_LINE#message=}"
                ;;
        esac
    done <<< "$PARSED_DOWNLOAD_OUTPUT"

    if [ "$OPERATOR_DOWNLOAD_STATUS" -eq 0 ] && \
       [ -n "$DOWNLOADED_LOCAL_PATH" ] && \
       [ -n "$DOWNLOADED_OPERATOR_VERSION" ] && \
       [ -n "$DOWNLOADED_SHA256" ] && \
       [ -n "$DOWNLOADED_OPERATOR_PACKAGE" ]; then
        if [ "$DOWNLOADED_OPERATOR_PACKAGE" != "$DEFAULT_OPERATOR_PACKAGE" ]; then
            DOWNLOAD_ERROR_CODE="OPERATOR_DOWNLOAD_INVALID_RESULT"
            DOWNLOAD_ERROR_MESSAGE="CLI returned operatorPackage $DOWNLOADED_OPERATOR_PACKAGE but installer expected $DEFAULT_OPERATOR_PACKAGE."
        elif ! is_valid_sha256_hex "$DOWNLOADED_SHA256"; then
            DOWNLOAD_ERROR_CODE="OPERATOR_DOWNLOAD_INVALID_RESULT"
            DOWNLOAD_ERROR_MESSAGE="CLI returned an invalid SHA-256 for the downloaded Operator APK."
        elif ! is_valid_operator_download_path "$DOWNLOADED_LOCAL_PATH"; then
            DOWNLOAD_ERROR_CODE="OPERATOR_DOWNLOAD_INVALID_RESULT"
            DOWNLOAD_ERROR_MESSAGE="CLI returned localPath $DOWNLOADED_LOCAL_PATH but installer expected $APK_LOCAL_PATH."
        elif [ ! -f "$DOWNLOADED_LOCAL_PATH" ]; then
            DOWNLOAD_ERROR_CODE="OPERATOR_DOWNLOAD_INVALID_RESULT"
            DOWNLOAD_ERROR_MESSAGE="CLI did not create a regular file at $DOWNLOADED_LOCAL_PATH."
        elif [ ! -r "$DOWNLOADED_LOCAL_PATH" ]; then
            DOWNLOAD_ERROR_CODE="OPERATOR_DOWNLOAD_INVALID_RESULT"
            DOWNLOAD_ERROR_MESSAGE="CLI created Operator APK at $DOWNLOADED_LOCAL_PATH but it is not readable."
        else
            APK_LOCAL_PATH="$DOWNLOADED_LOCAL_PATH"
            OPERATOR_VERSION="$DOWNLOADED_OPERATOR_VERSION"
            OPERATOR_APK_DOWNLOADED_THIS_RUN=1
            echo -e "${GREEN}✅ Downloaded and verified Operator APK ${OPERATOR_VERSION}.${NC}"
            echo -e "   ${BLUE}${APK_LOCAL_PATH}${NC}"
            return 0
        fi
    fi

    echo -e "${RED}❌ Operator download failed via the CLI.${NC}"
    if [ -n "$DOWNLOAD_ERROR_CODE" ]; then
        echo -e "${YELLOW}${DOWNLOAD_ERROR_CODE}: ${DOWNLOAD_ERROR_MESSAGE:-unknown error}${NC}"
    elif [ -n "$OPERATOR_DOWNLOAD_OUTPUT" ]; then
        echo "$OPERATOR_DOWNLOAD_OUTPUT"
    fi
    echo -e "${YELLOW}Manual recovery:${NC}"
    print_operator_apk_redownload_hint
    return 1
}

reset_operator_remediation_summary() {
    OPERATOR_REMEDIATE_OK=""
    OPERATOR_REMEDIATE_COMMAND_STATUS=0
    OPERATOR_REMEDIATE_TOTAL_DEVICES=0
    OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT=0
    OPERATOR_REMEDIATE_READY_COUNT=0
    OPERATOR_REMEDIATE_WARN_COUNT=0
    OPERATOR_REMEDIATE_REMEDIATED_COUNT=0
    OPERATOR_REMEDIATE_ADB_UNREADY_COUNT=0
    OPERATOR_REMEDIATE_FAILED_COUNT=0
    OPERATOR_REMEDIATE_MESSAGE=""
    OPERATOR_REMEDIATE_DEVICE_IDS=()
    OPERATOR_REMEDIATE_DEVICE_STATES=()
    OPERATOR_REMEDIATE_DEVICE_STATUSES=()
    OPERATOR_REMEDIATE_DEVICE_MESSAGES=()
}

parsed_operator_remediation_device_index() {
    local parsed_line="$1"
    local current_index="${parsed_line#device:}"
    current_index="${current_index%%:*}"
    case "$current_index" in
        ''|*[!0-9]*)
            return 1
            ;;
    esac
    printf '%s\n' "$current_index"
}

print_operator_remediation_result() {
    local index=0
    local device_id=""
    local device_state=""
    local device_status=""
    local device_message=""

    echo -e "${BLUE}Device remediation summary from the CLI:${NC}"
    for index in "${!OPERATOR_REMEDIATE_DEVICE_IDS[@]}"; do
        device_id="${OPERATOR_REMEDIATE_DEVICE_IDS[$index]}"
        device_state="${OPERATOR_REMEDIATE_DEVICE_STATES[$index]:-unknown}"
        device_status="${OPERATOR_REMEDIATE_DEVICE_STATUSES[$index]:-unknown}"
        device_message="${OPERATOR_REMEDIATE_DEVICE_MESSAGES[$index]:-}"
        case "$device_status" in
            ready)
                echo -e "${GREEN}  ✅ ${device_id} - ready${NC}"
                ;;
            remediated)
                echo -e "${GREEN}  ✅ ${device_id} - remediated${NC}"
                ;;
            warn)
                echo -e "${YELLOW}  ⚠  ${device_id} - ${device_message:-warnings remain}${NC}"
                ;;
            adb-unready)
                echo -e "${YELLOW}  ⚠  ${device_id} - ${device_message:-ADB state: ${device_state}}${NC}"
                ;;
            failed)
                echo -e "${RED}  ❌ ${device_id} - ${device_message:-remediation failed}${NC}"
                ;;
            *)
                echo -e "${YELLOW}  ⚠  ${device_id} - ${device_message:-status ${device_status}}${NC}"
                ;;
        esac
    done

    if [ -n "$OPERATOR_REMEDIATE_MESSAGE" ]; then
        echo -e "${BLUE}${OPERATOR_REMEDIATE_MESSAGE}${NC}"
    fi
}

run_operator_remediation_via_cli() {
    local OPERATOR_REMEDIATE_OUTPUT=""
    local PARSED_REMEDIATION_OUTPUT=""
    local PARSED_LINE=""
    local CURRENT_DEVICE_INDEX=""
    local CURRENT_DEVICE_ID=""
    local CURRENT_DEVICE_STATE=""
    local CURRENT_DEVICE_STATUS=""
    local CURRENT_DEVICE_MESSAGE=""

    reset_operator_remediation_summary

    if [ -z "${CLAWPERATOR_BIN_PATH:-}" ]; then
        echo -e "${RED}❌ Clawperator CLI is required before device remediation can run.${NC}"
        return 1
    fi

    echo -e "${BLUE}Running CLI-owned device remediation...${NC}"
    if OPERATOR_REMEDIATE_OUTPUT="$("$CLAWPERATOR_BIN_PATH" operator remediate --output json --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>&1)"; then
        OPERATOR_REMEDIATE_COMMAND_STATUS=0
    else
        OPERATOR_REMEDIATE_COMMAND_STATUS=$?
    fi

    PARSED_REMEDIATION_OUTPUT="$(printf '%s' "$OPERATOR_REMEDIATE_OUTPUT" | parse_operator_remediate_result)"
    while IFS= read -r PARSED_LINE; do
        [ -n "$PARSED_LINE" ] || continue
        case "$PARSED_LINE" in
            ok=*)
                OPERATOR_REMEDIATE_OK="${PARSED_LINE#ok=}"
                ;;
            message=*)
                OPERATOR_REMEDIATE_MESSAGE="${PARSED_LINE#message=}"
                ;;
            summary.totalDevices=*)
                OPERATOR_REMEDIATE_TOTAL_DEVICES="${PARSED_LINE#summary.totalDevices=}"
                ;;
            summary.connectedDevices=*)
                OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT="${PARSED_LINE#summary.connectedDevices=}"
                ;;
            summary.ready=*)
                OPERATOR_REMEDIATE_READY_COUNT="${PARSED_LINE#summary.ready=}"
                ;;
            summary.warn=*)
                OPERATOR_REMEDIATE_WARN_COUNT="${PARSED_LINE#summary.warn=}"
                ;;
            summary.remediated=*)
                OPERATOR_REMEDIATE_REMEDIATED_COUNT="${PARSED_LINE#summary.remediated=}"
                ;;
            summary.adbUnready=*)
                OPERATOR_REMEDIATE_ADB_UNREADY_COUNT="${PARSED_LINE#summary.adbUnready=}"
                ;;
            summary.failed=*)
                OPERATOR_REMEDIATE_FAILED_COUNT="${PARSED_LINE#summary.failed=}"
                ;;
            device:*:id=*)
                CURRENT_DEVICE_INDEX="$(parsed_operator_remediation_device_index "$PARSED_LINE")" || continue
                CURRENT_DEVICE_ID="${PARSED_LINE#*=}"
                OPERATOR_REMEDIATE_DEVICE_IDS[$CURRENT_DEVICE_INDEX]="$CURRENT_DEVICE_ID"
                : "${OPERATOR_REMEDIATE_DEVICE_STATES[$CURRENT_DEVICE_INDEX]:=""}"
                : "${OPERATOR_REMEDIATE_DEVICE_STATUSES[$CURRENT_DEVICE_INDEX]:=""}"
                : "${OPERATOR_REMEDIATE_DEVICE_MESSAGES[$CURRENT_DEVICE_INDEX]:=""}"
                ;;
            device:*:state=*)
                CURRENT_DEVICE_INDEX="$(parsed_operator_remediation_device_index "$PARSED_LINE")" || continue
                CURRENT_DEVICE_STATE="${PARSED_LINE#*=}"
                OPERATOR_REMEDIATE_DEVICE_STATES[$CURRENT_DEVICE_INDEX]="$CURRENT_DEVICE_STATE"
                ;;
            device:*:status=*)
                CURRENT_DEVICE_INDEX="$(parsed_operator_remediation_device_index "$PARSED_LINE")" || continue
                CURRENT_DEVICE_STATUS="${PARSED_LINE#*=}"
                OPERATOR_REMEDIATE_DEVICE_STATUSES[$CURRENT_DEVICE_INDEX]="$CURRENT_DEVICE_STATUS"
                ;;
            device:*:message=*)
                CURRENT_DEVICE_INDEX="$(parsed_operator_remediation_device_index "$PARSED_LINE")" || continue
                CURRENT_DEVICE_MESSAGE="${PARSED_LINE#*=}"
                OPERATOR_REMEDIATE_DEVICE_MESSAGES[$CURRENT_DEVICE_INDEX]="$CURRENT_DEVICE_MESSAGE"
                ;;
        esac
    done <<< "$PARSED_REMEDIATION_OUTPUT"

    if [ -z "$OPERATOR_REMEDIATE_OK" ]; then
        echo -e "${RED}❌ operator remediate returned no parseable result.${NC}"
        if [ -n "$OPERATOR_REMEDIATE_OUTPUT" ]; then
            echo "$OPERATOR_REMEDIATE_OUTPUT"
        fi
        return 1
    fi

    if [ "$OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT" -eq 1 ]; then
        local INDEX=0
        for INDEX in "${!OPERATOR_REMEDIATE_DEVICE_IDS[@]}"; do
            if [ "${OPERATOR_REMEDIATE_DEVICE_STATES[$INDEX]:-}" = "device" ]; then
                record_selected_device_serial "${OPERATOR_REMEDIATE_DEVICE_IDS[$INDEX]}"
                break
            fi
        done
    fi

    print_operator_remediation_result
    return 0
}

record_selected_device_serial() {
    local device_serial="$1"
    LAST_DEVICE_SERIAL="$device_serial"
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
    
    # Use the CLI-owned remediation surface instead of shell-side doctor policy.
    run_operator_remediation_via_cli || exit 1
    
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
    if [ "$OPERATOR_REMEDIATE_TOTAL_DEVICES" -gt 1 ]; then
        if [ "$OPERATOR_REMEDIATE_FAILED_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Host install completed, but some connected devices still need remediation. Use the CLI-owned per-device results above, then rerun:${NC}"
            echo -e "${YELLOW}  clawperator operator remediate --operator-package ${DEFAULT_OPERATOR_PACKAGE}${NC}"
        elif [ "$OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT" -eq 0 ] && [ "$OPERATOR_REMEDIATE_ADB_UNREADY_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are visible, but no connected device is ready for ADB yet.${NC}"
        elif [ "$OPERATOR_REMEDIATE_ADB_UNREADY_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, but some devices still need ADB recovery before they can be targeted.${NC}"
        elif [ "$OPERATOR_REMEDIATE_WARN_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected, and each ready device passed the critical checks. Future commands must target one device explicitly with --device.${NC}"
        else
            echo -e "${YELLOW}⚠️  Host install completed. Multiple Android devices are connected. Future commands must target one device explicitly with --device.${NC}"
        fi
        echo ""
        echo -e "${YELLOW}After setup, verify one device explicitly with:${NC}"
        echo -e "${YELLOW}  clawperator doctor --device <device_id> --output pretty --operator-package ${DEFAULT_OPERATOR_PACKAGE}${NC}"
        echo ""
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  Installation Complete (Device Selection Required)${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        print_durable_artifact_summary
        if [ "$OPERATOR_REMEDIATE_OK" != "true" ]; then
            return 1
        fi
        return 0
    fi

    echo -e "${BLUE}Final Doctor Check...${NC}"
    "$CLAWPERATOR_BIN_PATH" doctor --output pretty --operator-package "$DEFAULT_OPERATOR_PACKAGE" 2>/dev/null || true

    if [ "$OPERATOR_REMEDIATE_TOTAL_DEVICES" -eq 0 ]; then
        echo -e "${RED}❌ Final setup check failed. No connected Android device was available for remediation.${NC}"
        print_durable_artifact_summary
        return 1
    fi

    if [ "$OPERATOR_REMEDIATE_CONNECTED_DEVICE_COUNT" -eq 0 ]; then
        echo -e "${RED}❌ Final setup check failed. The detected Android device is not ready for ADB yet.${NC}"
        print_durable_artifact_summary
        return 1
    fi

    if [ "$OPERATOR_REMEDIATE_FAILED_COUNT" -gt 0 ]; then
        echo -e "${RED}❌ Final setup check failed.${NC}"
        print_durable_artifact_summary
        return 1
    fi

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
        echo -e "2. Canonical local Operator APK path:"
        echo -e "   ${BLUE}${APK_LOCAL_PATH}${NC}"
        echo -e "3. Canonical stable APK URL (redownload this for later manual setup):"
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
