#!/usr/bin/env python3

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_MAP_PATH = REPO_ROOT / "sites" / "docs" / "source-map.yaml"
GENERATED_DOCS_DIR = Path("sites/docs/docs")
SOURCE_MAP_RELATIVE = Path("sites/docs/source-map.yaml")
SKILL_DIR_RELATIVE = Path(".agents/skills/docs-generate")
IGNORED_GENERATED_FILES = {
    Path("sites/docs/docs/AGENTS.md"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fail when generated docs change without a corresponding canonical source change."
    )
    parser.add_argument(
        "--repo-root",
        default=str(REPO_ROOT),
        help="Path to the clawperator repo root",
    )
    parser.add_argument(
        "--skills-root",
        default=str(REPO_ROOT.parent / "clawperator-skills"),
        help="Path to the sibling clawperator-skills repo",
    )
    return parser.parse_args()


def git_changed_paths(repo_root: Path) -> set[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True,
    )
    changed: set[str] = set()
    for line in result.stdout.splitlines():
        if not line:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        changed.add(Path(path).as_posix())
    return changed


def load_source_map(source_map_path: Path) -> dict[str, dict[str, object]]:
    with source_map_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    pages: dict[str, dict[str, object]] = {}
    for section in data.get("sections", []):
        for page in section.get("pages", []):
            output = page.get("output")
            if isinstance(output, str):
                pages[output] = {
                    "sources": [Path(source).as_posix() for source in page.get("sources", [])],
                    "mode": page.get("mode"),
                }
    return pages


def path_matches_source(changed_path: str, source_path: str) -> bool:
    changed = Path(changed_path)
    source = Path(source_path)
    if changed == source:
      return True
    try:
        changed.relative_to(source)
        return True
    except ValueError:
        return False


def has_related_source_change(
    output_path: str,
    source_map: dict[str, dict[str, object]],
    repo_changes: set[str],
    skills_changes: set[str],
) -> bool:
    if SOURCE_MAP_RELATIVE.as_posix() in repo_changes:
        return True

    if any(path_matches_source(path, SKILL_DIR_RELATIVE.as_posix()) for path in repo_changes):
        return True

    page = source_map.get(output_path)
    if page is None:
        return False

    for source in page["sources"]:
        if source.startswith("../clawperator-skills/"):
            if any(path_matches_source(path, source) for path in skills_changes):
                return True
            continue
        if any(path_matches_source(path, source) for path in repo_changes):
            return True
    return False


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    skills_root = Path(args.skills_root).resolve()
    source_map = load_source_map(repo_root / SOURCE_MAP_PATH.relative_to(REPO_ROOT))

    repo_changes = git_changed_paths(repo_root)
    skills_changes: set[str] = set()
    if skills_root.exists() and (skills_root / ".git").exists():
        try:
            sibling_changes = git_changed_paths(skills_root)
            skills_changes = {Path("../clawperator-skills", path).as_posix() for path in sibling_changes}
        except subprocess.CalledProcessError:
            pass

    generated_changes = sorted(
        path for path in repo_changes
        if path.startswith(GENERATED_DOCS_DIR.as_posix() + "/")
        and path.endswith(".md")
        and Path(path) not in IGNORED_GENERATED_FILES
    )

    failures: list[str] = []
    for changed_path in generated_changes:
        output_path = Path(changed_path).relative_to(GENERATED_DOCS_DIR).as_posix()
        if not has_related_source_change(output_path, source_map, repo_changes, skills_changes):
            page = source_map.get(output_path)
            if page is None:
                failures.append(
                    f"{changed_path}: no source-map entry found. Generated docs must map back to a canonical source."
                )
                continue
            failures.append(
                f"{changed_path}: changed without a corresponding source change in {', '.join(page['sources'])}"
            )

    if failures:
        print("Docs source-of-truth validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        print(
            "Update the canonical docs source first, then regenerate sites/docs/docs from source-map.yaml.",
            file=sys.stderr,
        )
        return 1

    print("Docs source-of-truth validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
