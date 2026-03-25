#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def source_path() -> Path:
    return repo_root() / "apps" / "node" / "src" / "contracts" / "errors.ts"


def humanize(code: str) -> str:
    return code.lower().replace("_", " ").capitalize()


def parse_entries(text: str) -> list[tuple[str, str]]:
    body_match = re.search(r"ERROR_CODES\s*=\s*{(.*?)}\s*as const", text, re.S)
    if not body_match:
        raise ValueError("Could not find ERROR_CODES object")
    body = body_match.group(1)
    entries: list[tuple[str, str]] = []
    pending_comment: list[str] = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            pending_comment = []
            continue
        if stripped.startswith("/**") or stripped.startswith("/*") or stripped.startswith("//"):
            comment = stripped
            if comment.startswith("/**") and comment.endswith("*/"):
                pending_comment = [comment[3:-2].strip(" *")]
            else:
                pending_comment.append(comment.lstrip("/* ").rstrip("*/ ").strip())
            continue
        match = re.match(r"([A-Z0-9_]+):\s*\"([A-Z0-9_]+)\"", stripped)
        if match:
            code = match.group(1)
            note = " ".join(item for item in pending_comment if item).strip()
            entries.append((code, note))
        pending_comment = []
    return entries


def main() -> int:
    path = source_path()
    if not path.exists():
        raise FileNotFoundError(f"Missing source file: {path}")
    entries = parse_entries(path.read_text(encoding="utf-8"))
    lines = [
        "| Code | Meaning | Notes |",
        "| --- | --- | --- |",
    ]
    for code, note in entries:
        lines.append(f"| `{code}` | {humanize(code)} | {note or '-'} |")
    sys.stdout.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
