#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a docs inventory for Clawperator docs sources.")
    parser.add_argument("--repo-root", required=True, help="Path to the clawperator repo root")
    parser.add_argument("--skills-root", required=True, help="Path to the clawperator-skills repo root")
    parser.add_argument("--output", required=True, help="Path to write docs_inventory.json")
    return parser.parse_args()


def iso_mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}

    frontmatter: dict[str, str] = {}
    lines = text.splitlines()
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip().strip("'\"")
    return frontmatter


def extract_heading(text: str) -> str | None:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def classify(path: Path, repo_root: Path, skills_root: Path) -> str:
    try:
        path.relative_to(repo_root / "docs")
        return "core"
    except ValueError:
        pass

    try:
        path.relative_to(repo_root / "apps" / "node")
        return "node-api"
    except ValueError:
        pass

    try:
        path.relative_to(skills_root / "docs")
        return "skills"
    except ValueError:
        pass

    return "unknown"


def kind_for_path(path: Path) -> str:
    if path.suffix == ".md":
        return "markdown"
    if path.suffix == ".ts":
        return "typescript"
    if path.suffix == ".json":
        return "json"
    return path.suffix.lstrip(".") or "file"


def doc_id(path: Path, repo_root: Path, skills_root: Path) -> str:
    if str(path).startswith(str(skills_root)):
        stable = f"clawperator-skills/{path.relative_to(skills_root).as_posix()}"
    elif str(path).startswith(str(repo_root)):
        stable = path.relative_to(repo_root).as_posix()
    else:
        stable = path.as_posix()
    return hashlib.sha1(stable.encode("utf-8")).hexdigest()[:12]


def iter_sources(repo_root: Path, skills_root: Path) -> list[Path]:
    paths: list[Path] = []

    paths.extend(sorted((repo_root / "docs").rglob("*.md")))

    node_root = repo_root / "apps" / "node"
    paths.extend(sorted((node_root / "src").rglob("*.ts")))
    for extra in (node_root / "package.json", node_root / "README.md"):
        if extra.exists():
            paths.append(extra)

    paths.extend(sorted((skills_root / "docs").rglob("*.md")))
    return paths


def build_entry(path: Path, repo_root: Path, skills_root: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if str(path).startswith(str(skills_root)):
        relative_path = f"../clawperator-skills/{path.relative_to(skills_root).as_posix()}"
    else:
        relative_path = path.relative_to(repo_root).as_posix()

    frontmatter = parse_frontmatter(text) if path.suffix == ".md" else {}
    return {
        "docArea": classify(path, repo_root, skills_root),
        "docId": doc_id(path, repo_root, skills_root),
        "frontmatter": frontmatter,
        "kind": kind_for_path(path),
        "lastModifiedUtc": iso_mtime(path),
        "path": relative_path,
        "title": extract_heading(text) if path.suffix == ".md" else None,
    }


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    skills_root = Path(args.skills_root).resolve()
    output_path = Path(args.output).resolve()

    entries = [build_entry(path, repo_root, skills_root) for path in iter_sources(repo_root, skills_root)]
    entries.sort(key=lambda item: item["path"])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"documents": entries}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote inventory with {len(entries)} documents to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
