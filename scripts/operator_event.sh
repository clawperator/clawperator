#!/bin/bash

# operator_event.sh
# Script to send various events to the ActionTask Operator service
# This script handles different operator actions like running tasks or logging UI

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default package names
DEFAULT_DEBUG_PKG="app.actiontask.operator.development"
DEFAULT_RELEASE_PKG="app.actiontask.operator.playstore"

# Action constants (matching Kotlin constants)
ACTION_RUN_TASK="app.actiontask.operator.ACTION_RUN_TASK"
ACTION_LOG_UI="app.actiontask.operator.ACTION_LOG_UI"

print_usage() {
    echo "Usage: $0 [OPTIONS] ACTION"
    echo ""
    echo "Send events to ActionTask Operator service"
    echo ""
    echo "Actions:"
    echo "  -runtask, --run-task    Run the default task (get air conditioner status)"
    echo "  -logui, --log-ui        Log the current UI tree"
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
    echo "  $0 -runtask                      # Auto-detect package and run task"
    echo "  $0 -logui -d                     # Log UI for debug build"
    echo "  $0 -runtask -p com.custom.pkg    # Run task for custom package"
    echo "  $0 -logui -s <device_serial>         # Log UI on specific device"
}

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ActionTask Operator Event Sender${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
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

    # Try to find ActionTask packages
    local packages
    packages=$($adb_cmd shell pm list packages | sed 's/package://' | grep -E "^app\.actiontask\.operator" || echo "")

    if echo "$packages" | grep -q "$DEFAULT_DEBUG_PKG"; then
        echo "$DEFAULT_DEBUG_PKG"
    elif echo "$packages" | grep -q "$DEFAULT_RELEASE_PKG"; then
        echo "$DEFAULT_RELEASE_PKG"
    else
        echo -e "${RED}❌ Error: No ActionTask packages found on device${NC}"
        echo "Available packages starting with 'app.actiontask.operator':"
        echo "$packages"
        exit 1
    fi
}

send_operator_event() {
    local package=$1
    local action=$2
    local action_name=$3
    local adb_cmd
    adb_cmd=$(get_adb_prefix)

    echo -e "${BLUE}📡 Sending $action_name event to $package...${NC}"

    # Check if accessibility service is enabled
    echo -e "${BLUE}🔍 Checking accessibility service status...${NC}"
    local accessibility_status
    accessibility_status=$($adb_cmd shell settings get secure enabled_accessibility_services 2>/dev/null || echo "")
    if [[ "$accessibility_status" != *"$package"* ]]; then
        echo -e "${YELLOW}⚠️  Warning: Accessibility service may not be enabled for $package${NC}"
        echo -e "${YELLOW}   Current enabled services: $accessibility_status${NC}"
        echo -e "${YELLOW}   Make sure ActionTask accessibility service is enabled in Settings${NC}"
    else
        echo -e "${GREEN}✅ Accessibility service appears to be enabled${NC}"
    fi

    # Send the broadcast with the specific action
    echo -e "${BLUE}⚙️  Broadcasting $action to $package${NC}"
    echo -e "${BLUE}   Command: adb shell am broadcast -p \"$package\" -a \"$action\" --receiver-foreground${NC}"

    # Try explicit broadcast first (Android 8.0+ compatible)
    if ! $adb_cmd shell am broadcast -p "$package" -a "$action" --receiver-foreground; then
        echo -e "${YELLOW}⚠️  Explicit broadcast failed, trying implicit broadcast...${NC}"
        $adb_cmd shell am broadcast -a "$action" --receiver-foreground
    fi

    echo -e "${GREEN}✅ $action_name event sent successfully${NC}"

    echo ""
    echo -e "${BLUE}🔍 Debugging Tips:${NC}"
    echo -e "${BLUE}1. Check if the broadcast was received:${NC}"
    echo "   adb logcat -s BroadcastQueue"
    echo ""
    echo -e "${BLUE}2. Check for Operator logs:${NC}"
    echo "   adb logcat | grep -E '(Operator|ActionTask|Broadcast.*$action_name)'"
    echo ""
    echo -e "${BLUE}3. Check if accessibility service is running:${NC}"
    echo "   adb shell dumpsys accessibility | grep -A 5 -B 5 actiontask"
    echo ""
    echo -e "${BLUE}4. Verify receiver is registered:${NC}"
    echo "   adb shell dumpsys package $package | grep -A 5 -B 5 OperatorCommandReceiver"
}

show_event_instructions() {
    local package=$1
    local action_name=$2

    echo ""
    echo -e "${BLUE}🔍 Quick Setup Check:${NC}"
    echo "• Ensure ActionTask accessibility service is enabled in Settings > Accessibility"
    echo "• Make sure the app is running (notification should show 'Service is running')"
    echo "• Use the debugging commands above to verify everything is working"
    echo ""
    echo -e "${GREEN}🎉 $action_name event sent to package: $package${NC}"
}

# Parse command line arguments
PACKAGE=""
USE_DEBUG=false
USE_RELEASE=false
DEVICE_SERIAL=""
ACTION=""
ACTION_NAME=""

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
        -runtask|--run-task)
            ACTION="$ACTION_RUN_TASK"
            ACTION_NAME="Run Task"
            shift
            ;;
        -logui|--log-ui)
            ACTION="$ACTION_LOG_UI"
            ACTION_NAME="Log UI"
            shift
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

# Validate that an action was specified
if [ -z "$ACTION" ]; then
    echo -e "${RED}❌ Error: No action specified${NC}"
    echo "Please specify an action: -runtask or -logui"
    echo ""
    print_usage
    exit 1
fi

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
        echo -e "${BLUE}🔍 Auto-detecting ActionTask package...${NC}"
        TARGET_PACKAGE=$(detect_package)
    fi

    echo -e "${BLUE}📱 Target package: $TARGET_PACKAGE${NC}"
    echo -e "${BLUE}🎯 Action: $ACTION_NAME${NC}"
    echo ""

    # Send the operator event
    send_operator_event "$TARGET_PACKAGE" "$ACTION" "$ACTION_NAME"
    echo ""

    show_event_instructions "$TARGET_PACKAGE" "$ACTION_NAME"
}

# Run main function
main "$@"
