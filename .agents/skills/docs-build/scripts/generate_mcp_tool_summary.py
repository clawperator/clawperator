#!/usr/bin/env python3

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
TOOLS_DIR = ROOT / "apps/node/src/mcp/tools"
TOOL_FILE_ORDER = ["core.ts", "named.ts"]
PATTERN = re.compile(
    r'name:\s*"(?P<name>[^"]+)"\s*,\s*description:\s*"(?P<description>[^"]+)"',
    re.MULTILINE,
)


def iter_tools() -> list[tuple[str, str]]:
    tools: list[tuple[str, str]] = []
    for filename in TOOL_FILE_ORDER:
        text = (TOOLS_DIR / filename).read_text(encoding="utf-8")
        for match in PATTERN.finditer(text):
            tools.append((match.group("name"), match.group("description")))
    return tools


def main() -> int:
    rows = [
        "| Tool | Purpose |",
        "| --- | --- |",
    ]
    for name, description in iter_tools():
        rows.append(f"| `{name}` | {description} |")
    print("\n".join(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
