#!/usr/bin/env bash
# grant-permissions.sh
# Thin wrapper - delegates to the Node CLI.
# Use: clawperator setup-device [--device-id <id>] [--receiver-package <pkg>]
exec clawperator setup-device "$@"
