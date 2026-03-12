#!/usr/bin/env bash

# clawperator_uninstall_all.sh
# Fully removes Clawperator from this machine and connected Android devices.
# Run this before test runs of install.sh to start from a clean slate.
#
# What this removes:
#   - Clawperator CLI (npm global package)
#   - Operator APK from all connected devices (release and debug variants)
#   - Any running Android emulators named `clawperator-*` (stopped via adb)
#   - Any configured Android AVDs named `clawperator-*` (deleted via avdmanager)
#   - ~/.clawperator/ (downloads, skills repo, all local state)
#   - CLAWPERATOR_SKILLS_REGISTRY export from shell RC files
#   - Any running `clawperator serve` processes
#
# What this does NOT remove (not owned by Clawperator):
#   - Node.js / nvm
#   - adb / git
#   - ~/.clawperator/ (user-managed config)

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RELEASE_PKG="com.clawperator.operator"
DEBUG_PKG="com.clawperator.operator.dev"
CLAWPERATOR_DIR="$HOME/.clawperator"
SHELL_RCS=("$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile")
DEFAULT_AVDMANAGER_PATH="$HOME/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager"
DEFAULT_EMULATOR_PATH="$HOME/Library/Android/sdk/emulator/emulator"

DRY_RUN=false
DEVICE_SERIAL=""
WARNINGS=0

# ---------------------------------------------------------------------------

usage() {
    echo "Usage: $0 [--dry-run] [-s <device_serial>] [-h]"
    echo ""
    echo "  --dry-run        Show what would be removed without making changes"
    echo "  -s <serial>      Target a specific ADB device (default: all connected)"
    echo "  -h, --help       Show this help"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run) DRY_RUN=true; shift ;;
            -s|--serial)
                if [[ $# -lt 2 || -z "${2:-}" ]]; then
                    echo -e "${RED}❌ Missing value for $1${NC}"
                    usage
                    exit 1
                fi
                DEVICE_SERIAL="$2"
                shift 2
                ;;
            -h|--help) usage; exit 0 ;;
            *)
                echo -e "${RED}❌ Unknown option: $1${NC}"
                usage
                exit 1
                ;;
        esac
    done
}

warn() {
    echo -e "${YELLOW}⚠️  $*${NC}"
    WARNINGS=$((WARNINGS + 1))
}

run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[dry-run] $*${NC}"
    else
        "$@"
    fi
}

find_sdk_tool() {
    local tool_name="$1"
    local default_path="$2"
    if command -v "$tool_name" > /dev/null 2>&1; then
        command -v "$tool_name"
        return 0
    fi
    if [ -x "$default_path" ]; then
        echo "$default_path"
        return 0
    fi
    return 1
}

# ---------------------------------------------------------------------------
# 1. Kill running clawperator processes

stop_processes() {
    echo -e "${BLUE}Stopping running Clawperator processes...${NC}"
    local process_ids=""
    process_ids="$(pgrep -f "clawperator serve" 2>/dev/null || true)"
    process_ids="$(printf '%s\n' "$process_ids" | awk -v self="$$" 'NF && $1 != self { print $1 }')"

    if [ -n "$process_ids" ]; then
        if [ "$DRY_RUN" = true ]; then
            while IFS= read -r pid; do
                [ -n "$pid" ] || continue
                echo -e "${YELLOW}[dry-run] kill ${pid}${NC}"
            done <<< "$process_ids"
        else
            while IFS= read -r pid; do
                [ -n "$pid" ] || continue
                kill "$pid" || true
            done <<< "$process_ids"
        fi
        echo -e "${GREEN}✅ Sent TERM to clawperator serve processes.${NC}"
    else
        echo "   No running clawperator serve processes found."
    fi
}

# ---------------------------------------------------------------------------
# 2. Stop running clawperator emulators

stop_clawperator_emulators() {
    echo -e "${BLUE}Stopping running clawperator emulators...${NC}"
    if ! command -v adb &> /dev/null; then
        echo "   adb not found. Skipping emulator shutdown."
        return
    fi

    local found=false
    while IFS= read -r emulator_serial; do
        [ -n "$emulator_serial" ] || continue
        local avd_name
        avd_name="$(adb -s "$emulator_serial" emu avd name 2>/dev/null | sed -n '2p' | tr -d '\r')"
        if [[ "$avd_name" == clawperator-* ]]; then
            found=true
            echo -e "${BLUE}Stopping emulator ${avd_name} (${emulator_serial})...${NC}"
            if [ "$DRY_RUN" = true ]; then
                echo -e "${YELLOW}[dry-run] adb -s ${emulator_serial} emu kill${NC}"
            else
                adb -s "$emulator_serial" emu kill > /dev/null 2>&1 || warn "Failed to stop emulator ${avd_name}."
                sleep 2
            fi
        fi
    done < <(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { print $1 }')

    if [ "$found" = false ]; then
        echo "   No running clawperator emulators found."
    fi
}

# ---------------------------------------------------------------------------
# 3. Uninstall the npm global package

uninstall_cli() {
    echo -e "${BLUE}Uninstalling Clawperator CLI...${NC}"
    if command -v npm &> /dev/null; then
        if npm list -g --depth=0 clawperator 2>/dev/null | grep -q "clawperator@"; then
            if run_cmd npm uninstall -g clawperator; then
                echo -e "${GREEN}✅ Clawperator CLI uninstalled.${NC}"
            else
                warn "npm uninstall failed."
            fi
        else
            echo "   clawperator not found in npm globals."
        fi
    else
        echo "   npm not found. Skipping CLI uninstall."
    fi
}

# ---------------------------------------------------------------------------
# 4. Uninstall APKs from connected Android devices

uninstall_apk_from_device() {
    local SERIAL="$1"
    local LABEL
    if [ -n "$SERIAL" ]; then
        LABEL="$SERIAL"
    else
        LABEL="default device"
    fi

    for PKG in "$RELEASE_PKG" "$DEBUG_PKG"; do
        if [ -n "$SERIAL" ]; then
            if ! adb -s "$SERIAL" shell pm list packages 2>/dev/null | grep -q "package:${PKG}$"; then
                echo "   ${PKG} not installed on ${LABEL}."
                continue
            fi
        elif ! adb shell pm list packages 2>/dev/null | grep -q "package:${PKG}$"; then
            echo "   ${PKG} not installed on ${LABEL}."
            continue
        fi

            echo -e "${BLUE}Uninstalling ${PKG} from ${LABEL}...${NC}"
            if [ "$DRY_RUN" = true ]; then
                if [ -n "$SERIAL" ]; then
                    echo -e "${YELLOW}[dry-run] adb -s ${SERIAL} uninstall ${PKG}${NC}"
                else
                    echo -e "${YELLOW}[dry-run] adb uninstall ${PKG}${NC}"
                fi
            elif [ -n "$SERIAL" ] && adb -s "$SERIAL" uninstall "$PKG" > /dev/null 2>&1; then
                echo -e "${GREEN}✅ ${PKG} uninstalled from ${LABEL}.${NC}"
            elif [ -z "$SERIAL" ] && adb uninstall "$PKG" > /dev/null 2>&1; then
                echo -e "${GREEN}✅ ${PKG} uninstalled from ${LABEL}.${NC}"
            else
                warn "Failed to uninstall ${PKG} from ${LABEL}."
            fi
    done
}

uninstall_apks() {
    echo -e "${BLUE}Uninstalling APKs from connected Android devices...${NC}"
    if ! command -v adb &> /dev/null; then
        echo "   adb not found. Skipping APK uninstall."
        return
    fi

    if [ -n "$DEVICE_SERIAL" ]; then
        uninstall_apk_from_device "$DEVICE_SERIAL"
        return
    fi

    local DEVICE_COUNT
    DEVICE_COUNT="$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"

    if [ "$DEVICE_COUNT" -eq 0 ]; then
        echo "   No connected Android devices found. Skipping APK uninstall."
        return
    fi

    while IFS= read -r serial; do
        [ -n "$serial" ] || continue
        uninstall_apk_from_device "$serial"
    done < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
}

# ---------------------------------------------------------------------------
# 5. Remove clawperator AVDs

remove_clawperator_emulators() {
    echo -e "${BLUE}Removing clawperator AVDs...${NC}"

    local emulator_bin=""
    local avdmanager_bin=""

    if ! emulator_bin="$(find_sdk_tool emulator "$DEFAULT_EMULATOR_PATH")"; then
        echo "   emulator not found. Skipping AVD cleanup."
        return
    fi
    if ! avdmanager_bin="$(find_sdk_tool avdmanager "$DEFAULT_AVDMANAGER_PATH")"; then
        echo "   avdmanager not found. Skipping AVD cleanup."
        return
    fi

    local avd_names
    avd_names="$("$emulator_bin" -list-avds 2>/dev/null | awk '/^clawperator-/ { print $1 }')"
    if [ -z "$avd_names" ]; then
        echo "   No clawperator AVDs found."
        return
    fi

    while IFS= read -r avd_name; do
        [ -n "$avd_name" ] || continue
        echo -e "${BLUE}Deleting AVD ${avd_name}...${NC}"
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}[dry-run] ${avdmanager_bin} delete avd --name ${avd_name}${NC}"
        elif "$avdmanager_bin" delete avd --name "$avd_name" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Deleted AVD ${avd_name}.${NC}"
        else
            warn "Failed to delete AVD ${avd_name}."
        fi
    done <<< "$avd_names"
}

# ---------------------------------------------------------------------------
# 6. Remove ~/.clawperator/

remove_data_dir() {
    echo -e "${BLUE}Removing ${CLAWPERATOR_DIR}...${NC}"
    if [ -d "$CLAWPERATOR_DIR" ]; then
        run_cmd rm -rf "$CLAWPERATOR_DIR"
        echo -e "${GREEN}✅ Removed ${CLAWPERATOR_DIR}.${NC}"
    else
        echo "   ${CLAWPERATOR_DIR} does not exist."
    fi
}

# ---------------------------------------------------------------------------
# 7. Clean CLAWPERATOR_SKILLS_REGISTRY from shell RC files

clean_shell_rcs() {
    echo -e "${BLUE}Cleaning shell RC files...${NC}"
    local cleaned=false
    for RC_FILE in "${SHELL_RCS[@]}"; do
        if [ -f "$RC_FILE" ] && grep -q "CLAWPERATOR" "$RC_FILE" 2>/dev/null; then
            echo "   Removing Clawperator entries from ${RC_FILE}..."
            if [ "$DRY_RUN" = true ]; then
                echo -e "${YELLOW}[dry-run] Remove CLAWPERATOR lines from ${RC_FILE}${NC}"
            else
                local TMP
                TMP="$(mktemp)"
                grep -E -v "CLAWPERATOR|# Clawperator" "$RC_FILE" > "$TMP"
                mv "$TMP" "$RC_FILE"
                echo -e "${GREEN}✅ Cleaned ${RC_FILE}.${NC}"
            fi
            cleaned=true
        fi
    done
    if [ "$cleaned" = false ]; then
        echo "   No Clawperator entries found in shell RC files."
    fi
}

# ---------------------------------------------------------------------------

main() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Clawperator Uninstall${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  DRY RUN - no changes will be made${NC}"
    fi
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""

    stop_processes
    echo ""
    stop_clawperator_emulators
    echo ""
    uninstall_cli
    echo ""
    uninstall_apks
    echo ""
    remove_clawperator_emulators
    echo ""
    remove_data_dir
    echo ""
    clean_shell_rcs
    echo ""

    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}Uninstall completed with ${WARNINGS} warning(s). Some steps may need manual attention.${NC}"
    else
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  Uninstall complete. Ready for a fresh install run.${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    fi
}

parse_args "$@"
main
