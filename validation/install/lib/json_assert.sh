# Shared JSON assertion helpers for install.sh harnesses.
#
# Source this file from a harness that has already defined assert_equals,
# because assert_json_field_equals delegates to it. Extract-only; the logic
# here is identical to the per-harness copies it replaces.

json_field_value() {
    local file="$1"
    local field_path="$2"

    node -e '
const fs = require("fs");
const filePath = process.argv[1];
const fieldPath = process.argv[2];
const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
const segments = fieldPath.split(".").filter(Boolean);
let value = json;
for (const segment of segments) {
  if (value === undefined || value === null) {
    value = undefined;
    break;
  }
  if (/^\d+$/.test(segment)) {
    value = value[Number(segment)];
  } else {
    value = value[segment];
  }
}
if (value === undefined) {
  process.stdout.write("__undefined__");
} else if (value === null) {
  process.stdout.write("null");
} else {
  process.stdout.write(String(value));
}
' "$file" "$field_path"
}

assert_json_field_equals() {
    local file="$1"
    local field="$2"
    local expected="$3"
    local label="$4"
    local actual
    actual="$(json_field_value "$file" "$field")"
    assert_equals "$expected" "$actual" "$label"
}

assert_json_field_null() {
    local file="$1"
    local field="$2"
    local label="$3"
    assert_json_field_equals "$file" "$field" "null" "$label"
}

assert_json_field_is_iso_timestamp() {
    local file="$1"
    local field="$2"
    local label="$3"
    if ! node -e '
const fs = require("fs");
const filePath = process.argv[1];
const field = process.argv[2];
const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
const value = json[field];
const isoTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

if (typeof value !== "string") {
  process.exit(1);
}

const match = value.match(isoTimestampPattern);
if (!match) {
  process.exit(1);
}

const year = Number(match[1]);
const month = Number(match[2]);
const day = Number(match[3]);
const hour = Number(match[4]);
const minute = Number(match[5]);
const second = Number(match[6]);
const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

if (
  Number.isNaN(parsed.getTime()) ||
  parsed.getUTCFullYear() !== year ||
  parsed.getUTCMonth() !== month - 1 ||
  parsed.getUTCDate() !== day ||
  parsed.getUTCHours() !== hour ||
  parsed.getUTCMinutes() !== minute ||
  parsed.getUTCSeconds() !== second
) {
  process.exit(1);
}
' "$file" "$field"; then
        echo "ERROR: $label expected ISO timestamp in YYYY-MM-DDTHH:MM:SSZ format in $field" >&2
        cat "$file" >&2
        return 1
    fi
}
