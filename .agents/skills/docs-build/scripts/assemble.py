#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise ImportError(
        "PyYAML is required to run assemble.py. Please install docs requirements first."
    ) from exc


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def docs_root() -> Path:
    return repo_root() / "docs"


def docs_site_root() -> Path:
    return repo_root() / "sites" / "docs"


def load_yaml(path: Path) -> object:
    if not path.exists():
        raise FileNotFoundError(f"Missing YAML file: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def nav_page_entries(nav: object) -> list[tuple[str, str | None]]:
    entries: list[tuple[str, str | None]] = []

    def walk(node: object) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            raise ValueError(f"Unexpected nav entry type: {type(node)!r}")
        for title, value in node.items():
            if isinstance(value, str):
                if value.startswith(("http://", "https://")):
                    continue
                entries.append((value, title))
            elif isinstance(value, list):
                walk(value)
            else:
                raise ValueError(f"Unsupported nav value for {title!r}: {type(value)!r}")

    walk(nav)
    return entries


def source_map_entries(source_map: object) -> tuple[dict[str, dict], list[dict]]:
    if not isinstance(source_map, dict):
        raise ValueError("source-map.yaml must load as a mapping")
    if not set(source_map.keys()).issubset({"code_derived", "markers"}):
        unexpected = sorted(set(source_map.keys()) - {"code_derived", "markers"})
        raise ValueError(f"source-map.yaml contains unsupported top-level keys: {unexpected}")

    code_derived = source_map.get("code_derived", [])
    markers = source_map.get("markers", [])
    if not isinstance(code_derived, list) or not isinstance(markers, list):
        raise ValueError("source-map.yaml code_derived and markers must be lists")

    code_outputs: dict[str, dict] = {}
    for entry in code_derived:
        if not isinstance(entry, dict):
            raise ValueError("code_derived entries must be mappings")
        output = entry.get("output")
        generator = entry.get("generator")
        if not output or not generator:
            raise ValueError(f"code_derived entry missing output or generator: {entry!r}")
        if output in code_outputs:
            raise ValueError(f"Duplicate code-derived output: {output}")
        code_outputs[output] = entry

    marker_entries: list[dict] = []
    for entry in markers:
        if not isinstance(entry, dict):
            raise ValueError("marker entries must be mappings")
        page = entry.get("page")
        marker = entry.get("marker")
        generator = entry.get("generator")
        if not page or not marker or not generator:
            raise ValueError(f"marker entry missing page, marker, or generator: {entry!r}")
        marker_entries.append(entry)

    return code_outputs, marker_entries


def validate_source_list(entries: list[dict], kind: str) -> None:
    root = repo_root().resolve()
    for entry in entries:
        sources = entry.get("sources")
        if not isinstance(sources, list) or not sources:
            raise ValueError(f"{kind} entry must include a non-empty sources list: {entry!r}")
        for raw_source in sources:
            if not isinstance(raw_source, str) or not raw_source.strip():
                raise ValueError(f"{kind} entry has an invalid source path: {entry!r}")
            source_path = Path(raw_source)
            if source_path.is_absolute():
                raise ValueError(f"{kind} entry source must be relative to repo root: {raw_source}")
            resolved = (root / source_path).resolve()
            if not resolved.is_relative_to(root):
                raise ValueError(f"{kind} entry source must stay within the repo root: {raw_source}")
            if not resolved.exists():
                raise FileNotFoundError(f"{kind} entry source not found: {resolved}")


def generator_path(generator: str) -> Path:
    path = Path(generator)
    if not path.is_absolute():
        path = skill_root() / path
    return path


def run_generator(generator: str) -> str:
    script = generator_path(generator)
    if not script.exists():
        raise FileNotFoundError(f"Generator script not found: {script}")
    result = subprocess.run(
        [sys.executable, str(script)],
        check=True,
        capture_output=True,
        text=True,
    )
    if result.stderr:
        sys.stderr.write(result.stderr)
    return result.stdout


def copy_authored_page(source_path: Path, target_path: Path, verbose: bool) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, target_path)
    if verbose:
        print(f"copy authored: {source_path.relative_to(repo_root())} -> {target_path.relative_to(repo_root())}")


def write_generated_page(target_path: Path, content: str, verbose: bool, label: str) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content.rstrip("\n") + "\n", encoding="utf-8")
    if verbose:
        print(f"{label}: {target_path.relative_to(repo_root())}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deterministically assemble the docs staging directory.")
    parser.add_argument("--verbose", action="store_true", help="Log source resolution and generation steps")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = repo_root()
    docs_dir = docs_root()
    site_dir = docs_site_root()
    build_dir = site_dir / ".build"
    mkdocs_path = site_dir / "mkdocs.yml"
    source_map_path = site_dir / "source-map.yaml"

    nav_data = load_yaml(mkdocs_path)
    source_map_data = load_yaml(source_map_path)
    nav_entries = nav_page_entries(nav_data.get("nav"))
    code_outputs, marker_entries = source_map_entries(source_map_data)
    validate_source_list(list(code_outputs.values()), "code_derived")
    validate_source_list(marker_entries, "marker")

    if args.verbose:
        print(f"resolve_pages: loaded {len(nav_entries)} nav pages")

    nav_paths = [path for path, _ in nav_entries]
    duplicate_nav_paths = sorted({path for path in nav_paths if nav_paths.count(path) > 1})
    if duplicate_nav_paths:
        raise ValueError(f"Duplicate nav outputs found: {duplicate_nav_paths}")

    for output in code_outputs:
        if output not in nav_paths:
            raise ValueError(f"source-map.yaml defines output not present in nav: {output}")

    for path in nav_paths:
        if path in code_outputs:
            if args.verbose:
                print(f"resolve_pages: {path} -> code-derived")
            continue
        source_path = docs_dir / path
        if not source_path.exists():
            raise FileNotFoundError(f"Nav page missing source file: {source_path}")
        if args.verbose:
            print(f"resolve_pages: {path} -> authored")

    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True, exist_ok=True)
    if args.verbose:
        print(f"clean_staging: {build_dir.relative_to(root)}")

    authored_pages = [path for path in nav_paths if path not in code_outputs]
    for path in authored_pages:
        source_path = docs_dir / path
        if path.startswith("internal/"):
            continue
        copy_authored_page(source_path, build_dir / path, args.verbose)

    for output, entry in code_outputs.items():
        generated = run_generator(entry["generator"])
        write_generated_page(build_dir / output, generated, args.verbose, "generate_code_derived")

    for entry in marker_entries:
        page = entry["page"]
        marker = entry["marker"]
        generator = entry["generator"]
        page_path = build_dir / page
        if not page_path.exists():
            raise FileNotFoundError(f"Marker page missing from build staging: {page_path}")
        generated = run_generator(generator).rstrip("\n")
        marker_comment = f"<!-- CODE-DERIVED: {marker} -->"
        current = page_path.read_text(encoding="utf-8")
        if marker_comment not in current:
            raise ValueError(f"Marker not found in staged page: {page} -> {marker}")
        current = current.replace(marker_comment, generated, 1)
        page_path.write_text(current.rstrip("\n") + "\n", encoding="utf-8")
        if args.verbose:
            print(f"apply_markers: {page} -> {marker}")

    failures: list[str] = []
    expected_paths = set(nav_paths)
    actual_paths = {
        str(path.relative_to(build_dir)).replace(os.sep, "/")
        for path in build_dir.rglob("*.md")
    }

    for expected in sorted(expected_paths):
        if expected not in actual_paths:
            failures.append(f"missing build page: {expected}")
    for actual in sorted(actual_paths):
        if actual not in expected_paths:
            failures.append(f"unexpected build page: {actual}")

    for md_path in sorted(build_dir.rglob("*.md")):
        text = md_path.read_text(encoding="utf-8")
        if "<!-- CODE-DERIVED:" in text:
            failures.append(f"unexpanded marker remains in {md_path.relative_to(build_dir)}")

    if failures:
        raise ValueError("Validation failed:\n- " + "\n- ".join(failures))

    if args.verbose:
        print(f"validate_build: {len(actual_paths)} pages assembled successfully")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
