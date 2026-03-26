#!/usr/bin/env python3

from __future__ import annotations

import re
import warnings
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


KNOWN_FLAG_DOCS: dict[str, tuple[str, str]] = {
    "--selector": (
        "Raw NodeMatcher JSON for an element.",
        "Mutually exclusive with shorthand element selector flags.",
    ),
    "--text": (
        "Match an element by exact text.",
        "May be combined with other shorthand selector flags.",
    ),
    "--text-contains": (
        "Match an element by partial text.",
        "May be combined with other shorthand selector flags.",
    ),
    "--id": (
        "Match an element by resource id.",
        "May be combined with other shorthand selector flags.",
    ),
    "--desc": (
        "Match an element by exact content description.",
        "May be combined with other shorthand selector flags.",
    ),
    "--desc-contains": (
        "Match an element by partial content description.",
        "May be combined with other shorthand selector flags.",
    ),
    "--role": (
        "Match an element by accessibility role.",
        "May be combined with other shorthand selector flags.",
    ),
    "--container-selector": (
        "Raw NodeMatcher JSON for a container.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
    "--container-text": (
        "Match a container by exact text.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
    "--container-text-contains": (
        "Match a container by partial text.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
    "--container-id": (
        "Match a container by resource id.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
    "--container-desc": (
        "Match a container by exact content description.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
    "--container-desc-contains": (
        "Match a container by partial content description.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
    "--container-role": (
        "Match a container by accessibility role.",
        "Mutually exclusive with raw selector JSON on the same matcher.",
    ),
}


def describe_flag(flag: str) -> tuple[str, str]:
    docs = KNOWN_FLAG_DOCS.get(flag)
    if docs is not None:
        return docs

    warnings.warn(
        f"Unrecognized selector flag {flag}; using fallback documentation.",
        RuntimeWarning,
        stacklevel=2,
    )
    if flag.startswith("--container-"):
        return (
            "Container selector flag.",
            "Mutually exclusive with raw selector JSON on the same matcher.",
        )
    return (
        "Element selector flag.",
        "May be combined with other shorthand selector flags.",
    )


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
        description, note = describe_flag(flag)
        lines.append(f"| `{flag}` | {description} | {note} |")
    sys.stdout.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
