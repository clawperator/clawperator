#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
INSTALL_SCRIPT="$REPO_ROOT/sites/landing/public/install.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

STUB_BIN="$TMP_DIR/bin"
mkdir -p "$STUB_BIN" "$TMP_DIR/java-home"

VERSION_FILE="$TMP_DIR/java-version.txt"
printf '%s\n' 'openjdk version "11.0.20" 2023-07-18' > "$VERSION_FILE"

cat > "$STUB_BIN/java" <<EOF
#!/usr/bin/env bash
cat "$VERSION_FILE" >&2
EOF

cat > "$STUB_BIN/brew" <<EOF
#!/usr/bin/env bash
printf '%s\n' 'brew install --cask temurin@17' >&2
printf '%s\n' 'openjdk version "17.0.9" 2023-10-17' > "$VERSION_FILE"
exit 0
EOF

cat > "$STUB_BIN/hash" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

chmod +x "$STUB_BIN/java" "$STUB_BIN/brew" "$STUB_BIN/hash"

export PATH="$STUB_BIN:$PATH"
export OS=Darwin
export JAVA_HOME="$TMP_DIR/java-home/old-jdk"
export CLAWPERATOR_TEMURIN_17_HOME="$TMP_DIR/java-home/temurin-17"

mkdir -p "$CLAWPERATOR_TEMURIN_17_HOME"

# shellcheck disable=SC1090
source "$INSTALL_SCRIPT"

check_java > "$TMP_DIR/output.txt"

if [ "$JAVA_HOME" != "$CLAWPERATOR_TEMURIN_17_HOME" ]; then
    echo "Expected JAVA_HOME to be reset to the installed Temurin JDK."
    echo "Got: $JAVA_HOME"
    exit 1
fi

if ! grep -q "Set JAVA_HOME to $CLAWPERATOR_TEMURIN_17_HOME" "$TMP_DIR/output.txt"; then
    echo "Expected the installer to report the updated JAVA_HOME."
    cat "$TMP_DIR/output.txt"
    exit 1
fi

if ! grep -q "Java 17 installed successfully." "$TMP_DIR/output.txt"; then
    echo "Expected the installer to verify the Java 17 install."
    cat "$TMP_DIR/output.txt"
    exit 1
fi

echo "validation/test_install_java.sh: pass"
