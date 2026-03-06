#!/usr/bin/env python3

from __future__ import annotations

import argparse
import difflib
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize churn between current and generated docs trees.")
    parser.add_argument("current_dir", help="Path to the current docs directory")
    parser.add_argument("proposed_dir", help="Path to the proposed docs directory")
    parser.add_argument("--json", action="store_true", dest="json_output", help="Emit JSON")
    parser.add_argument("--max-files", type=int, default=12, help="Maximum changed files before exit 2")
    parser.add_argument("--max-line-churn", type=int, default=400, help="Maximum added+removed lines before exit 2")
    parser.add_argument(
        "--max-percent-churn",
        type=float,
        default=20.0,
        help="Maximum percent churn vs current tree before exit 2",
    )
    return parser.parse_args()


def read_file(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    try:
        return {"binary": False, "text": raw.decode("utf-8")}
    except UnicodeDecodeError:
        return {"binary": True, "text": None}


def walk_files(root: Path) -> dict[str, dict[str, Any]]:
    files: dict[str, dict[str, Any]] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            files[path.relative_to(root).as_posix()] = read_file(path)
    return files


def normalize_tokens(text: str) -> str:
    return " ".join(text.split())


def line_counts(before: str, after: str) -> tuple[int, int]:
    added = 0
    removed = 0
    for line in difflib.unified_diff(before.splitlines(), after.splitlines(), lineterm=""):
        if line.startswith(("+++", "---", "@@")):
            continue
        if line.startswith("+"):
            added += 1
        elif line.startswith("-"):
            removed += 1
    return added, removed


def build_report(current_dir: Path, proposed_dir: Path) -> dict[str, object]:
    current_files = walk_files(current_dir)
    proposed_files = walk_files(proposed_dir)
    all_paths = sorted(set(current_files) | set(proposed_files))

    changed_files: list[dict[str, object]] = []
    total_added = 0
    total_removed = 0
    total_current_lines = sum(
        len(item["text"].splitlines()) for item in current_files.values() if not item["binary"] and item["text"] is not None
    )

    for rel_path in all_paths:
        before = current_files.get(rel_path)
        after = proposed_files.get(rel_path)
        if before == after:
            continue

        status = "changed"
        if before is None:
            status = "added"
            added = len(after["text"].splitlines()) if after is not None and not after["binary"] and after["text"] else 0
            removed = 0
        elif after is None:
            status = "removed"
            added = 0
            removed = len(before["text"].splitlines()) if not before["binary"] and before["text"] else 0
        else:
            if before["binary"] or after["binary"]:
                added = 0
                removed = 0
            else:
                added, removed = line_counts(before["text"], after["text"])

        whitespace_only = (
            before is not None
            and after is not None
            and not before["binary"]
            and not after["binary"]
            and normalize_tokens(before["text"]) == normalize_tokens(after["text"])
        )
        total_added += added
        total_removed += removed
        changed_files.append(
            {
                "path": rel_path,
                "status": status,
                "linesAdded": added,
                "linesRemoved": removed,
                "whitespaceOnly": whitespace_only,
            }
        )

    total_churn = total_added + total_removed
    percent = 0.0 if total_current_lines == 0 else round((total_churn / total_current_lines) * 100, 2)
    return {
        "changedFiles": changed_files,
        "filesChanged": len(changed_files),
        "linesAdded": total_added,
        "linesRemoved": total_removed,
        "lineChurn": total_churn,
        "percentChurn": percent,
        "whitespaceOnlyFiles": [item["path"] for item in changed_files if item["whitespaceOnly"]],
    }


def main() -> int:
    args = parse_args()
    report = build_report(Path(args.current_dir), Path(args.proposed_dir))

    if args.json_output:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"Files changed: {report['filesChanged']}")
        print(f"Lines added: {report['linesAdded']}")
        print(f"Lines removed: {report['linesRemoved']}")
        print(f"Percent churn: {report['percentChurn']}%")
        whitespace_only = report["whitespaceOnlyFiles"]
        if whitespace_only:
            print("Whitespace-only files:")
            for path in whitespace_only:
                print(f"  - {path}")

    if (
        report["filesChanged"] > args.max_files
        or report["lineChurn"] > args.max_line_churn
        or report["percentChurn"] > args.max_percent_churn
    ):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
