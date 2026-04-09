#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
_LIST_SCRIPT = Path(__file__).resolve().parent / "list_mcp_tools.mjs"


def iter_tools() -> list[tuple[str, str]]:
    result = subprocess.run(
        ["node", str(_LIST_SCRIPT)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    parsed = json.loads(result.stdout)
    if not parsed:
        raise ValueError("list_mcp_tools.mjs returned no tools - check that apps/node is built")
    return [(name, description) for name, description in parsed]


def main() -> int:
    tools = iter_tools()
    if not tools:
        raise ValueError("Failed to detect any MCP tools while generating the summary")

    rows = [
        "| Tool | Purpose |",
        "| --- | --- |",
    ]
    for name, description in tools:
        rows.append(f"| `{name}` | {description} |")
    print("\n".join(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
