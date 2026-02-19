#!/bin/bash

# operator_event_run_task.sh
# Wrapper script to run the default task via ActionTask Operator service
# This script calls operator_event.sh with the -runtask argument

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_SCRIPT="$SCRIPT_DIR/operator_event.sh"

# Check if main script exists
if [ ! -f "$MAIN_SCRIPT" ]; then
    echo "❌ Error: Main script not found at $MAIN_SCRIPT"
    echo "Please ensure operator_event.sh exists in the same directory"
    exit 1
fi

# Pass all arguments to the main script with -runtask prepended
exec "$MAIN_SCRIPT" -runtask "$@"
