#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def source_path() -> Path:
    return repo_root() / "apps" / "node" / "src" / "cli" / "selectorFlags.ts"


def parse_flags(text: str) -> list[str]:
    flags: list[str] = []
    for const_name in ("ELEMENT_SELECTOR_VALUE_FLAGS", "CONTAINER_SELECTOR_VALUE_FLAGS"):
        match = re.search(rf"{const_name}\s*=\s*\[((?:.|\n)*?)\]\s*as const", text)
        if not match:
            raise ValueError(f"Could not find {const_name}")
        flags.extend(re.findall(r'"([^"]+)"', match.group(1)))
    return flags


def flag_description(flag: str) -> str:
    if flag == "--selector":
        return "Raw NodeMatcher JSON for an element."
    if flag == "--container-selector":
        return "Raw NodeMatcher JSON for a container."
    if flag.startswith("--container-"):
        return "Container selector flag."
    return "Element selector flag."


def notes(flag: str) -> str:
    if flag.startswith("--container-"):
        return "Mutually exclusive with raw selector JSON on the same matcher."
    if flag == "--selector":
        return "Mutually exclusive with shorthand element selector flags."
    return "May be combined with other shorthand selector flags."


def main() -> int:
    path = source_path()
    if not path.exists():
        raise FileNotFoundError(f"Missing source file: {path}")
    flags = parse_flags(path.read_text(encoding="utf-8"))
    lines = [
        "| Flag | Description | Notes |",
        "| --- | --- | --- |",
    ]
    for flag in flags:
        lines.append(f"| `{flag}` | {flag_description(flag)} | {notes(flag)} |")
    sys.stdout.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
