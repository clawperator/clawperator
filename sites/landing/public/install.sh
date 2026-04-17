#!/usr/bin/env bash

# install.sh (v0.6.2)
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
AUTHORING_SKILLS_SETUP_STATUS="not-run"
AUTHORING_SKILLS_INSTALL_DIR=""
AUTHORING_SKILLS_CLAUDE_DIR=""
AUTHORING_SKILLS_CODEX_DIR=""
AUTHORING_SKILLS_AGENTS_DIR=""
CLAWPERATOR_BIN_PATH=""
LAST_DEVICE_SERIAL=""

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

parse_authoring_skills_install_result() {
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

setup_authoring_skills_via_cli() {
    local DEFAULT_AUTHORING_SKILLS_INSTALL_DIR="$HOME/.clawperator/authoring-skills/"
    local DEFAULT_AUTHORING_SKILLS_CLAUDE_DIR="$HOME/.claude/skills/"
    local DEFAULT_AUTHORING_SKILLS_CODEX_DIR="${CODEX_HOME:-$HOME/.codex}/skills/"
    local DEFAULT_AUTHORING_SKILLS_AGENTS_DIR="$HOME/.agents/skills/"
    local AUTHORING_SKILLS_OUTPUT=""

    AUTHORING_SKILLS_INSTALL_DIR="$DEFAULT_AUTHORING_SKILLS_INSTALL_DIR"
    AUTHORING_SKILLS_CLAUDE_DIR="$DEFAULT_AUTHORING_SKILLS_CLAUDE_DIR"
    AUTHORING_SKILLS_CODEX_DIR="$DEFAULT_AUTHORING_SKILLS_CODEX_DIR"
    AUTHORING_SKILLS_AGENTS_DIR="$DEFAULT_AUTHORING_SKILLS_AGENTS_DIR"

    if [ "${CLAWPERATOR_INSTALL_SKIP_SKILLS:-0}" = "1" ]; then
        AUTHORING_SKILLS_SETUP_STATUS="skipped"
        echo -e "${YELLOW}⚠️  Skipping authoring skills setup because CLAWPERATOR_INSTALL_SKIP_SKILLS=1.${NC}"
        return 0
    fi

    echo -e "${BLUE}Setting up authoring skills...${NC}"
    if AUTHORING_SKILLS_OUTPUT="$("$CLAWPERATOR_BIN_PATH" authoring-skills install --output json)"; then
        local PARSED_AUTHORING_LINE=""
        while IFS= read -r PARSED_AUTHORING_LINE; do
            case "$PARSED_AUTHORING_LINE" in
                installedDir=*)
                    AUTHORING_SKILLS_INSTALL_DIR="${PARSED_AUTHORING_LINE#installedDir=}"
                    ;;
                # agentDiscoveryDir:<label>=<path> entries - matched by label so new agents
                # (e.g. gemini) can be added to the CLI without breaking this script.
                agentDiscoveryDir:claude=*)
                    AUTHORING_SKILLS_CLAUDE_DIR="${PARSED_AUTHORING_LINE#agentDiscoveryDir:claude=}"
                    ;;
                agentDiscoveryDir:codex=*)
                    AUTHORING_SKILLS_CODEX_DIR="${PARSED_AUTHORING_LINE#agentDiscoveryDir:codex=}"
                    ;;
                agentDiscoveryDir:agents=*)
                    AUTHORING_SKILLS_AGENTS_DIR="${PARSED_AUTHORING_LINE#agentDiscoveryDir:agents=}"
                    ;;
            esac
        done < <(printf '%s' "$AUTHORING_SKILLS_OUTPUT" | parse_authoring_skills_install_result)

        AUTHORING_SKILLS_SETUP_STATUS="configured"
        echo -e "${GREEN}✅ Authoring skills setup complete.${NC}"
        echo -e "${GREEN}   Installed at: ${AUTHORING_SKILLS_INSTALL_DIR}${NC}"
        echo -e "${GREEN}   Claude skills dir: ${AUTHORING_SKILLS_CLAUDE_DIR}${NC}"
        echo -e "${GREEN}   Codex skills dir: ${AUTHORING_SKILLS_CODEX_DIR}${NC}"
        echo -e "${GREEN}   Agents skills dir: ${AUTHORING_SKILLS_AGENTS_DIR}${NC}"
        return 0
    fi

    AUTHORING_SKILLS_SETUP_STATUS="failed"
    echo -e "${YELLOW}⚠️  Authoring skills setup failed via CLI. Resolve the issue below, then re-run 'clawperator authoring-skills install'.${NC}"
    echo -e "${YELLOW}   Re-running after resolving the conflict is safe.${NC}"
    if [ -n "$AUTHORING_SKILLS_OUTPUT" ]; then
        echo "$AUTHORING_SKILLS_OUTPUT"
    fi
    return 0
}

append_runtime_skills_guide() {
    local AGENT_GUIDE_PATH="$1"
    local RUNTIME_SKILLS_REGISTRY_PATH="$HOME/.clawperator/skills/skills/skills-registry.json"
    local RUNTIME_GUIDE_TMP=""

    if [ "${SKILLS_SETUP_STATUS:-}" = "configured" ] && [ -n "${SKILLS_REGISTRY_PATH:-}" ]; then
        RUNTIME_SKILLS_REGISTRY_PATH="$SKILLS_REGISTRY_PATH"
    fi

    cat >> "$AGENT_GUIDE_PATH" <<'EOF'

## Runtime Skills

Use the installed runtime-skill registry to discover and run app workflows:
- `clawperator skills list`
- `clawperator skills search --keyword "<term>"`
- `clawperator skills get <id>`
- `clawperator skills run <id>`
EOF

    if [ ! -r "$RUNTIME_SKILLS_REGISTRY_PATH" ]; then
        cat >> "$AGENT_GUIDE_PATH" <<EOF

Runtime skills not available on this host right now.
Expected registry path:
\`${RUNTIME_SKILLS_REGISTRY_PATH}\`

Repair or manual bootstrap:
- run \`clawperator skills install\`
EOF
        return 0
    fi

    RUNTIME_GUIDE_TMP="$(mktemp "${TMPDIR:-/tmp}/clawperator-runtime-skills.XXXXXX")"

    if node - "$RUNTIME_SKILLS_REGISTRY_PATH" > "$RUNTIME_GUIDE_TMP" 2>/dev/null <<'EOF'
const fs = require("fs");

const registryPath = process.argv[2];
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
if (!registry || !Array.isArray(registry.skills)) {
  throw new Error("skills array required");
}

const byApplication = new Map();
for (const skill of registry.skills) {
  if (!skill || typeof skill !== "object") {
    continue;
  }

  const applicationId = typeof skill.applicationId === "string" && skill.applicationId.length > 0
    ? skill.applicationId
    : "unknown.application";
  const skillList = byApplication.get(applicationId) || [];
  skillList.push(skill);
  byApplication.set(applicationId, skillList);
}

const applicationIds = Array.from(byApplication.keys()).sort((a, b) => a.localeCompare(b));

function toCliFlagName(inputName) {
  return inputName.replace(/_/g, "-");
}

function normalizeGuideValue(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

function printLiteralBlock(value, indent = "") {
  const normalized = normalizeGuideValue(value);
  console.log(indent + "```text");
  for (const line of normalized.split("\n")) {
    console.log(indent + line);
  }
  console.log(indent + "```");
}

function buildSkillRunExample(skill) {
  const id = typeof skill.id === "string" && skill.id.length > 0 ? skill.id : "unknown-skill";
  const contract = skill && typeof skill.contract === "object" && skill.contract !== null ? skill.contract : null;
  const inputs = contract && typeof contract.inputs === "object" && contract.inputs !== null
    ? Object.keys(contract.inputs).sort((left, right) => left.localeCompare(right))
    : [];
  const args = inputs.map((inputName) => `--${toCliFlagName(inputName)} <${inputName}>`);
  return ["clawperator", "skills", "run", id, ...args].join(" ");
}

console.log("");
console.log("Registry path:");
printLiteralBlock(registryPath);
console.log("");
console.log("Inspect required inputs before running with `clawperator skills get <id>`.");

if (applicationIds.length === 0) {
  console.log("");
  console.log("Runtime skills registry is present, but it does not contain any installed skills.");
  process.exit(0);
}

for (const applicationId of applicationIds) {
  const skills = byApplication.get(applicationId).slice().sort((left, right) => {
    const leftIntent = typeof left.intent === "string" ? left.intent : "";
    const rightIntent = typeof right.intent === "string" ? right.intent : "";
    if (leftIntent !== rightIntent) {
      return leftIntent.localeCompare(rightIntent);
    }
    const leftId = typeof left.id === "string" ? left.id : "";
    const rightId = typeof right.id === "string" ? right.id : "";
    return leftId.localeCompare(rightId);
  });

  console.log("");
  console.log("### Application");
  console.log("");
  console.log("App ID:");
  printLiteralBlock(applicationId);
  console.log("");

  for (const skill of skills) {
    const id = typeof skill.id === "string" && skill.id.length > 0 ? skill.id : "unknown-skill";
    const intent = typeof skill.intent === "string" && skill.intent.length > 0 ? skill.intent : "unknown";
    const summary = typeof skill.summary === "string" && skill.summary.length > 0
      ? skill.summary
      : "No summary provided.";
    console.log("- Skill");
    console.log("  id:");
    printLiteralBlock(id, "  ");
    console.log("  intent:");
    printLiteralBlock(intent, "  ");
    console.log("  summary:");
    printLiteralBlock(summary, "  ");
    console.log("  example:");
    printLiteralBlock(buildSkillRunExample(skill), "  ");
  }
}
EOF
    then
        cat "$RUNTIME_GUIDE_TMP" >> "$AGENT_GUIDE_PATH"
        rm -f "$RUNTIME_GUIDE_TMP"
        return 0
    fi

    rm -f "$RUNTIME_GUIDE_TMP"

    cat >> "$AGENT_GUIDE_PATH" <<EOF

Runtime skills not available on this host right now.
Expected registry path:
\`${RUNTIME_SKILLS_REGISTRY_PATH}\`

The registry exists but could not be read.
Repair or manual bootstrap:
- run \`clawperator skills install\`
EOF
}

resolve_cli_version() {
    local CLI_VERSION_OUTPUT=""

    if [ -n "${CLAWPERATOR_BIN_PATH:-}" ] && CLI_VERSION_OUTPUT="$("$CLAWPERATOR_BIN_PATH" --version 2>/dev/null | head -n 1 | tr -d '\r')"; then
        if [ -n "$CLI_VERSION_OUTPUT" ]; then
            printf '%s\n' "$CLI_VERSION_OUTPUT"
            return 0
        fi
    fi

    printf '%s\n' ""
}

write_install_state() {
    local INSTALL_STATE_PATH="$HOME/.clawperator/install-state.json"
    local INSTALLED_AT
    local CLI_VERSION
    local REGISTRY_PATH_VALUE=""
    local APK_VERSION_VALUE="${OPERATOR_VERSION:-}"
    local LAST_DEVICE_SERIAL_VALUE="${LAST_DEVICE_SERIAL:-}"

    mkdir -p "$HOME/.clawperator"

    INSTALLED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    CLI_VERSION="$(resolve_cli_version)"

    if [ "${SKILLS_SETUP_STATUS:-}" = "configured" ] && [ -n "${SKILLS_REGISTRY_PATH:-}" ]; then
        REGISTRY_PATH_VALUE="$SKILLS_REGISTRY_PATH"
    fi

    INSTALL_STATE_INSTALLED_AT="$INSTALLED_AT" \
    INSTALL_STATE_CLI_VERSION="$CLI_VERSION" \
    INSTALL_STATE_REGISTRY_PATH="$REGISTRY_PATH_VALUE" \
    INSTALL_STATE_APK_VERSION="$APK_VERSION_VALUE" \
    INSTALL_STATE_LAST_DEVICE_SERIAL="$LAST_DEVICE_SERIAL_VALUE" \
    node - "$INSTALL_STATE_PATH" <<'EOF'
const fs = require("fs");

const [installStatePath] = process.argv.slice(2);

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required install-state field: ${name}`);
  }
  return value;
}

function nullableEnv(name) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

const installState = {
  schemaVersion: 1,
  installedAt: requiredEnv("INSTALL_STATE_INSTALLED_AT"),
  cliVersion: nullableEnv("INSTALL_STATE_CLI_VERSION"),
  registryPath: nullableEnv("INSTALL_STATE_REGISTRY_PATH"),
  apkVersion: nullableEnv("INSTALL_STATE_APK_VERSION"),
  lastDeviceSerial: nullableEnv("INSTALL_STATE_LAST_DEVICE_SERIAL"),
};

fs.writeFileSync(installStatePath, JSON.stringify(installState, null, 2) + "\n");
EOF

    echo -e "${GREEN}✅ Wrote install state to ${INSTALL_STATE_PATH}.${NC}"
}

resolve_adb_path_for_mcp() {
    if command -v adb > /dev/null 2>&1; then
        command -v adb
        return 0
    fi

    printf '%s\n' ""
}

# Resolves the absolute path of the installed Clawperator CLI JS entrypoint
# (e.g. <npm_global_root>/clawperator/dist/cli/index.js). MCP clients like
# Claude Desktop work best with "node <js>" rather than the npm shell wrapper,
# per docs/api/mcp.md. Prints an empty string when resolution is not possible.
# Tests may override by exporting CLAWPERATOR_CLI_JS_PATH before the call.
resolve_cli_entrypoint_js() {
    # When CLAWPERATOR_CLI_JS_PATH is explicitly set (even to empty), treat it
    # as authoritative. Validation harnesses use this to force either the node
    # form (non-empty path) or the wrapper-fallback path (empty string).
    if [ -n "${CLAWPERATOR_CLI_JS_PATH+x}" ]; then
        printf '%s\n' "${CLAWPERATOR_CLI_JS_PATH}"
        return 0
    fi

    local NPM_GLOBAL_ROOT=""
    if command -v npm > /dev/null 2>&1; then
        NPM_GLOBAL_ROOT="$(npm root -g 2>/dev/null || true)"
    fi

    local RESOLVED=""
    RESOLVED="$(NODE_PATH="$NPM_GLOBAL_ROOT" node -e '
try {
  console.log(require.resolve("clawperator/dist/cli/index.js"));
} catch (error) {
  process.exit(1);
}
' 2>/dev/null || true)"

    printf '%s\n' "$RESOLVED"
}

write_mcp_config_snippet() {
    local MCP_CONFIG_SNIPPET_PATH="$HOME/.clawperator/mcp-config-snippet.json"
    local CLI_WRAPPER_PATH="${CLAWPERATOR_BIN_PATH:-clawperator}"
    local CLI_JS_PATH
    local ADB_PATH_VALUE
    local LOG_DIR="$HOME/.clawperator/logs"
    local CODEX_CONFIG_PATH="${CODEX_HOME:-$HOME/.codex}/config.toml"
    local CLAUDE_CONFIG_PATH_MAC="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    local CLAUDE_CONFIG_PATH_LINUX="$HOME/.config/Claude/claude_desktop_config.json"

    mkdir -p "$HOME/.clawperator"

    CLI_JS_PATH="$(resolve_cli_entrypoint_js)"
    ADB_PATH_VALUE="$(resolve_adb_path_for_mcp)"

    node - "$MCP_CONFIG_SNIPPET_PATH" "$CLI_WRAPPER_PATH" "$CLI_JS_PATH" "$ADB_PATH_VALUE" "$DEFAULT_OPERATOR_PACKAGE" "$LOG_DIR" "$CODEX_CONFIG_PATH" "$CLAUDE_CONFIG_PATH_MAC" "$CLAUDE_CONFIG_PATH_LINUX" <<'EOF'
const fs = require("fs");

const [
  snippetPath,
  cliWrapperPath,
  cliJsPath,
  adbPath,
  operatorPackage,
  logDir,
  codexConfigPath,
  claudeMacPath,
  claudeLinuxPath,
] = process.argv.slice(2);

const ADB_PLACEHOLDER = "<set ADB_PATH to your adb binary>";
const adbResolved = adbPath.length > 0;
const adbValue = adbResolved ? adbPath : ADB_PLACEHOLDER;
const nodeCommand = process.execPath;

// Prefer "node <js>" per docs/api/mcp.md: MCP desktop clients usually do not
// inherit the interactive shell PATH and "node <js>" avoids relying on the npm
// shell wrapper. Fall back to the wrapper only when the JS entrypoint could not
// be resolved.
const useNodeForm = cliJsPath.length > 0;
const command = useNodeForm ? nodeCommand : cliWrapperPath;
const args = useNodeForm
  ? [cliJsPath, "mcp", "serve"]
  : ["mcp", "serve"];

const serverConfig = {
  command,
  args,
  env: {
    ADB_PATH: adbValue,
    CLAWPERATOR_OPERATOR_PACKAGE: operatorPackage,
    CLAWPERATOR_LOG_DIR: logDir,
    CLAWPERATOR_LOG_LEVEL: "info",
  },
};

const notes = [
  "This snippet is generated for the current host.",
  "Regenerate it with install.sh if the clawperator binary path or adb path changes.",
];
if (!useNodeForm) {
  notes.push(
    "Could not resolve the Clawperator CLI JS entrypoint, so this snippet uses the npm shell wrapper. Claude Desktop and other GUI MCP clients usually do not inherit your shell PATH; if launch fails, replace \"command\" with \"node\" and \"args\" with [\"<installed_clawperator_path>/dist/cli/index.js\", \"mcp\", \"serve\"]."
  );
}
if (!adbResolved) {
  notes.push(
    `adb was not found on PATH at install time. Replace ADB_PATH (${ADB_PLACEHOLDER}) with the absolute path to your adb binary before using this snippet.`
  );
}

const tomlArgs = args.map((value) => JSON.stringify(value)).join(", ");
const snippet = {
  notes,
  claudeDesktop: {
    configPathHints: [claudeMacPath, claudeLinuxPath],
    mergeKey: "mcpServers",
    entry: {
      clawperator: serverConfig,
    },
  },
  codex: {
    configPath: codexConfigPath,
    entryToml: [
      "[mcp_servers.clawperator]",
      `command = ${JSON.stringify(command)}`,
      `args = [${tomlArgs}]`,
      "[mcp_servers.clawperator.env]",
      `ADB_PATH = ${JSON.stringify(adbValue)}`,
      `CLAWPERATOR_OPERATOR_PACKAGE = ${JSON.stringify(operatorPackage)}`,
      `CLAWPERATOR_LOG_DIR = ${JSON.stringify(logDir)}`,
      "CLAWPERATOR_LOG_LEVEL = \"info\"",
      "",
    ].join("\n"),
  },
  genericStdioConsumer: {
    serverName: "clawperator",
    server: serverConfig,
  },
};

fs.writeFileSync(snippetPath, JSON.stringify(snippet, null, 2) + "\n");
EOF

    echo -e "${GREEN}✅ Wrote MCP config snippet to ${MCP_CONFIG_SNIPPET_PATH}.${NC}"
}

write_agent_guide() {
    local AGENT_GUIDE_PATH="$HOME/.clawperator/AGENTS.md"
    local AUTHORING_SKILLS_GUIDE_DIR="${AUTHORING_SKILLS_INSTALL_DIR:-$HOME/.clawperator/authoring-skills}"
    local SKILL_DIR=""
    local HAS_SKILLS=0

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

    append_runtime_skills_guide "$AGENT_GUIDE_PATH"

    # Treat any install tree with at least one SKILL.md as configured, even if
    # version metadata is missing and the install should be refreshed.
    if [ -d "$AUTHORING_SKILLS_GUIDE_DIR" ]; then
        for SKILL_DIR in "$AUTHORING_SKILLS_GUIDE_DIR"/*/; do
            if [ -f "${SKILL_DIR}SKILL.md" ]; then
                HAS_SKILLS=1
                break
            fi
        done
    fi

    if [ "$HAS_SKILLS" -eq 1 ]; then
        cat >> "$AGENT_GUIDE_PATH" <<EOF

## Authoring Skills

First-party Clawperator authoring skills are installed at:
${AUTHORING_SKILLS_GUIDE_DIR}

Available skills:
EOF
        for SKILL_DIR in "$AUTHORING_SKILLS_GUIDE_DIR"/*/; do
            if [ -f "${SKILL_DIR}SKILL.md" ]; then
                printf -- '- %s\n' "$(basename "$SKILL_DIR")" >> "$AGENT_GUIDE_PATH"
            fi
        done
        if [ ! -f "$AUTHORING_SKILLS_GUIDE_DIR/version.txt" ]; then
            cat >> "$AGENT_GUIDE_PATH" <<'EOF'

Version metadata is missing for this install.
Refresh it with:
- run `clawperator authoring-skills update`
EOF
        fi
    else
        cat >> "$AGENT_GUIDE_PATH" <<'EOF'

## Authoring Skills

First-party Clawperator authoring skills are not currently configured on this host.

Repair or manual bootstrap:
- run `clawperator authoring-skills install`
EOF
    fi

    echo -e "${GREEN}✅ Wrote agent guide to ${AGENT_GUIDE_PATH}.${NC}"
}

write_shared_agent_bridge() {
    local SHARED_AGENTS_PATH="$HOME/.agents/AGENTS.md"
    local LOCAL_AGENT_GUIDE_PATH="$HOME/.clawperator/AGENTS.md"

    if [ ! -f "$SHARED_AGENTS_PATH" ]; then
        echo -e "${BLUE}Shared agent guide not found at ${SHARED_AGENTS_PATH}; skipping Clawperator bridge.${NC}"
        return 0
    fi

    # Content between the START/END markers is installer-owned. Any hand edits
    # inside that block will be overwritten on the next install.sh run. Edits
    # elsewhere in ~/.agents/AGENTS.md are preserved.
    node - "$SHARED_AGENTS_PATH" "$LOCAL_AGENT_GUIDE_PATH" <<'EOF'
const fs = require("fs");

// Content between startMarker and endMarker is installer-owned and is
// overwritten in place on every rerun. See the shell caller's comment.
const [sharedAgentsPath, localAgentGuidePath] = process.argv.slice(2);
const startMarker = "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:START -->";
const endMarker = "<!-- CLAWPERATOR_SHARED_AGENT_BRIDGE:END -->";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const bridgeBlock = [
  startMarker,
  "## Clawperator",
  "",
  "Clawperator runtime skills stay in the `clawperator` CLI surface.",
  "Do not mirror them into shared agent skill directories.",
  "",
  "Start here:",
  `- \`${localAgentGuidePath}\``,
  "- `clawperator skills list`",
  "- `clawperator skills for-app <package_id>`",
  "- `clawperator skills search --keyword \"<term>\"`",
  "- `clawperator skills get <skill_id>`",
  "",
  "Use `clawperator skills run <skill_id>` after you have identified the right runtime skill.",
  endMarker,
].join("\n");

let content = fs.readFileSync(sharedAgentsPath, "utf8");
const bridgePattern = new RegExp(
  `(?:\\r?\\n)?${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}(?:\\r?\\n)?`,
  "g"
);

content = content.replace(bridgePattern, "\n").replace(/\s*$/, "");

const nextContent = content.length === 0
  ? bridgeBlock
  : `${content}\n\n${bridgeBlock}`;

fs.writeFileSync(sharedAgentsPath, `${nextContent}\n`);
EOF

    echo -e "${GREEN}✅ Updated shared agent guide bridge at ${SHARED_AGENTS_PATH}.${NC}"
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

record_selected_device_serial() {
    local device_serial="$1"
    LAST_DEVICE_SERIAL="$device_serial"
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
            record_selected_device_serial "$DEVICE_ID"
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

print_manual_operator_setup_commands() {
    echo -e "${YELLOW}Complete Android setup on one target device with one of:${NC}"
    while IFS= read -r device_id; do
        [ -n "$device_id" ] || continue
        echo -e "${YELLOW}  clawperator operator setup --apk ${APK_LOCAL_PATH} --device ${device_id}${NC}"
    done < <(list_connected_devices)
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
        local DETECTED_DEVICE_COUNT
        DEVICE_COUNT="$(count_connected_devices)"
        DETECTED_DEVICE_COUNT="$(count_detected_android_devices)"
        if [ "$DEVICE_COUNT" -eq 1 ] && [ "$DETECTED_DEVICE_COUNT" -eq 1 ]; then
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
    setup_authoring_skills_via_cli
    write_agent_guide
    write_shared_agent_bridge
    write_install_state
    write_mcp_config_snippet

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
        print_durable_artifact_summary
        return 0
    fi
    if ! doctor_report_ok "$FINAL_DOCTOR_JSON"; then
        echo -e "${RED}❌ Final doctor check failed.${NC}"
        "$CLAWPERATOR_BIN_PATH" doctor --output pretty || true
        print_durable_artifact_summary
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
    if [ "$AUTHORING_SKILLS_SETUP_STATUS" = "configured" ]; then
        echo -e "6. Authoring skills installed at:"
        echo -e "   ${BLUE}${AUTHORING_SKILLS_INSTALL_DIR}${NC}"
    else
        echo -e "6. ${YELLOW}Authoring skills were not configured during install.${NC}"
        echo -e "   To repair this later, run:"
        echo -e "   ${YELLOW}clawperator authoring-skills install${NC}"
    fi
    echo ""
    print_durable_artifact_summary
    echo ""
    echo -e "For more info, visit: ${BLUE}https://docs.clawperator.com${NC}"
    echo -e "Docs index: ${BLUE}https://docs.clawperator.com/llms.txt${NC}"
    echo ""

    show_star_hint
}

if [[ "${BASH_SOURCE[0]-}" == "$0" || -z "${BASH_SOURCE[0]-}" ]]; then main "$@"; fi
