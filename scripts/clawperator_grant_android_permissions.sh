#!/bin/bash

# clawperator_grant_android_permissions.sh
# Script to grant all necessary permissions for Clawperator Operator functionality
# This script handles manual permission granting when automatic setup isn't sufficient

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default package names
DEFAULT_DEBUG_PKG="com.clawperator.operator.dev"
DEFAULT_RELEASE_PKG="com.clawperator.operator"

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Grant necessary permissions for Clawperator Operator functionality"
    echo ""
    echo "Options:"
    echo "  -p, --package PACKAGE    Specify package name (default: auto-detect from installed apps)"
    echo "  -d, --debug             Use debug package name ($DEFAULT_DEBUG_PKG)"
    echo "  -r, --release           Use release package name ($DEFAULT_RELEASE_PKG)"
    echo "  -s, --serial SERIAL     Target specific device by serial number"
    echo ""
    echo "  -l, --list-devices      List connected devices"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Auto-detect package and grant permissions"
    echo "  $0 -d                   # Grant permissions for debug build"
    echo "  $0 -p com.custom.pkg    # Grant permissions for custom package"
    echo "  $0 -s <device_serial>       # Target specific device"
}

print_header() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Clawperator Operator Permission Granter${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_adb() {
    if ! command -v adb &> /dev/null; then
        echo -e "${RED}❌ Error: ADB not found in PATH${NC}"
        echo "Please install Android SDK platform-tools and add to PATH"
        exit 1
    fi
}

check_device() {
    local device_list
    device_list=$(adb devices 2>/dev/null | grep -E "device$" || echo "")
    local device_count
    device_count=$(echo "$device_list" | wc -l | tr -d ' ')

    # Handle empty device list
    if [ -z "$device_list" ] || [ "$device_count" -eq 0 ]; then
        echo -e "${RED}❌ Error: No Android devices connected${NC}"
        echo "Please connect a device or start an emulator"
        echo "Current ADB status:"
        adb devices
        exit 1
    elif [ "$device_count" -gt 1 ] && [ -z "${DEVICE_SERIAL:-}" ]; then
        echo -e "${YELLOW}⚠️  Warning: Multiple devices connected${NC}"
        echo "Use -s flag to specify target device:"
        adb devices
        exit 1
    fi
}

get_adb_prefix() {
    if [ -n "${DEVICE_SERIAL:-}" ]; then
        echo "adb -s $DEVICE_SERIAL"
    else
        echo "adb"
    fi
}

detect_package() {
    local adb_cmd
    adb_cmd=$(get_adb_prefix)

    # Try to find Clawperator packages
    local packages
    packages=$($adb_cmd shell pm list packages | sed 's/package://' | grep -E "^com\.clawperator\.operator" || echo "")

    if echo "$packages" | grep -q "$DEFAULT_DEBUG_PKG"; then
        echo "$DEFAULT_DEBUG_PKG"
    elif echo "$packages" | grep -q "$DEFAULT_RELEASE_PKG"; then
        echo "$DEFAULT_RELEASE_PKG"
    else
        echo -e "${RED}❌ Error: No Clawperator packages found on device${NC}"
        echo "Available packages starting with 'com.clawperator.operator':"
        echo "$packages"
        exit 1
    fi
}

grant_accessibility_permission() {
    local package=$1
    local adb_cmd
    adb_cmd=$(get_adb_prefix)
    local svc="$package/clawperator.operator.accessibilityservice.OperatorAccessibilityService"

    echo -e "${BLUE}🔧 Configuring Accessibility Service...${NC}"

    # Read current enabled accessibility services
    local current_services
    current_services=$($adb_cmd shell settings get secure enabled_accessibility_services 2>/dev/null || echo "")

    # Build new services list (append if missing)
    local new_services
    if [[ "$current_services" == *"$svc"* ]]; then
        new_services="$current_services"
        echo -e "${GREEN}✅ Accessibility service already enabled${NC}"
    else
        if [[ -z "$current_services" || "$current_services" == "null" ]]; then
            new_services="$svc"
        else
            new_services="$current_services:$svc"
        fi
        echo -e "${YELLOW}📝 Adding accessibility service to enabled list${NC}"
    fi

    # Enable accessibility and set services
    echo -e "${BLUE}⚙️  Setting accessibility_enabled=1...${NC}"
    $adb_cmd shell settings put secure accessibility_enabled 1

    echo -e "${BLUE}⚙️  Setting enabled_accessibility_services...${NC}"
    $adb_cmd shell settings put secure enabled_accessibility_services "$new_services"

    echo -e "${GREEN}✅ Accessibility service configured${NC}"
}

grant_notification_permission() {
    local package=$1
    local adb_cmd
    adb_cmd=$(get_adb_prefix)

    echo -e "${BLUE}🔔 Granting notification permission...${NC}"

    # Try to grant POST_NOTIFICATIONS permission (Android 13+)
    if $adb_cmd shell pm grant "$package" android.permission.POST_NOTIFICATIONS 2>/dev/null; then
        echo -e "${GREEN}✅ Notification permission granted${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not grant notification permission via ADB${NC}"
        echo -e "${YELLOW}   (may require manual grant in system settings)${NC}"
    fi
}



show_verification_steps() {
    local package=$1

    echo ""
    echo -e "${BLUE}🔍 Verification Steps:${NC}"
    echo "1. Open Android Settings > Accessibility"
    echo "2. Look for 'Clawperator Operator' service"
    echo "3. Ensure it's enabled and running"
    echo "4. Launch the app - services will start automatically"
    echo "5. Check app notification shows 'Service is running'"
    echo "6. Run: adb logcat | grep -E '(Operator|Clawperator)' to see logs"
    echo ""
    echo -e "${GREEN}🎉 Setup complete for package: $package${NC}"
}

# Parse command line arguments
PACKAGE=""
USE_DEBUG=false
USE_RELEASE=false
DEVICE_SERIAL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--package)
            PACKAGE="$2"
            shift 2
            ;;
        -d|--debug)
            USE_DEBUG=true
            shift
            ;;
        -r|--release)
            USE_RELEASE=true
            shift
            ;;
        -s|--serial)
            DEVICE_SERIAL="$2"
            shift 2
            ;;
        -l|--list-devices)
            echo "Connected devices:"
            adb devices
            exit 0
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header

    # Check prerequisites
    check_adb
    check_device

    # Determine package name
    if [ -n "$PACKAGE" ]; then
        TARGET_PACKAGE="$PACKAGE"
    elif [ "$USE_DEBUG" = true ]; then
        TARGET_PACKAGE="$DEFAULT_DEBUG_PKG"
    elif [ "$USE_RELEASE" = true ]; then
        TARGET_PACKAGE="$DEFAULT_RELEASE_PKG"
    else
        echo -e "${BLUE}🔍 Auto-detecting Clawperator package...${NC}"
        TARGET_PACKAGE=$(detect_package)
    fi

    echo -e "${BLUE}📱 Target package: $TARGET_PACKAGE${NC}"
    echo ""

    # Grant permissions and configure services
    grant_accessibility_permission "$TARGET_PACKAGE"
    echo ""

    grant_notification_permission "$TARGET_PACKAGE"
    echo ""

    show_verification_steps "$TARGET_PACKAGE"
}

# Run main function
main "$@"
