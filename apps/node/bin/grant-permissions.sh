#!/usr/bin/env bash
# grant-permissions.sh
# Thin wrapper - delegates to the Node CLI.
# Use: clawperator grant-device-permissions [--device-id <id>] [--operator-package <pkg>]
exec clawperator grant-device-permissions "$@"
