#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:
    raise ImportError(
        "PyYAML is required to run generate_llms_full.py. "
        "Please install it (e.g. via sites/docs/requirements.txt)."
    ) from exc


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def docs_site_dir() -> Path:
    return repo_root() / "sites" / "docs"


def authored_docs_dir() -> Path:
    return repo_root() / "docs"


def load_nav_entries(mkdocs_path: Path) -> list[tuple[str, list[tuple[str, str]]]]:
    if not mkdocs_path.exists():
        raise FileNotFoundError(f"Missing MkDocs config: {mkdocs_path}")
    data = yaml.safe_load(mkdocs_path.read_text(encoding="utf-8"))
    nav = data.get("nav")
    if not isinstance(nav, list):
        raise ValueError(f"{mkdocs_path} does not contain a list nav")

    top_level: list[tuple[str, str]] = []
    sections: list[tuple[str, list[tuple[str, str]]]] = []

    def walk(node: object, section_name: str | None = None) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item, section_name)
            return
        if not isinstance(node, dict):
            raise ValueError(f"Unexpected nav entry type: {type(node)!r}")
        for title, value in node.items():
            if isinstance(value, str):
                if value.startswith(("http://", "https://")):
                    continue
                if section_name is None:
                    top_level.append((title, value))
                else:
                    for section_title, pages in sections:
                        if section_title == section_name:
                            pages.append((title, value))
                            break
                    else:
                        raise ValueError(f"Internal nav error for section {section_name!r}")
            elif isinstance(value, list):
                sections.append((title, []))
                walk(value, title)
            else:
                raise ValueError(f"Unsupported nav value for {title!r}: {type(value)!r}")

    walk(nav, None)
    ordered: list[tuple[str, list[tuple[str, str]]]] = []
    if top_level:
        ordered.append(("__top_level__", top_level))
    ordered.extend(sections)
    return ordered


def collect_nav_page_paths(nav_entries: list[tuple[str, list[tuple[str, str]]]]) -> set[str]:
    paths: set[str] = set()
    for _, pages in nav_entries:
        for _, page_path in pages:
            paths.add(page_path)
    return paths


def collect_extra_authored_docs(docs_dir: Path, nav_page_paths: set[str]) -> list[Path]:
    extra_docs: list[Path] = []
    for md_file in sorted(docs_dir.rglob("*.md")):
        relative_path = md_file.relative_to(docs_dir).as_posix()
        if relative_path in nav_page_paths:
            continue
        if any(part in {"site", ".build"} for part in md_file.relative_to(docs_dir).parts):
            continue
        extra_docs.append(md_file)
    return extra_docs


def read_page(build_dir: Path, page_path: str) -> str:
    resolved = (build_dir / page_path).resolve()
    if build_dir.resolve() not in resolved.parents and resolved != build_dir.resolve():
        raise ValueError(f"Page path escapes build directory: {page_path}")
    if not resolved.exists():
        raise FileNotFoundError(f"Missing built page: {resolved}")
    return resolved.read_text(encoding="utf-8").rstrip("\n")


def render_llms_full(
    build_dir: Path,
    nav_entries: list[tuple[str, list[tuple[str, str]]]],
    extra_docs: list[Path],
) -> str:
    lines: list[str] = [
        "# Clawperator Documentation",
        "",
        "Compiled from the MkDocs navigation tree, assembled docs staging directory, and authored docs corpus.",
        "",
    ]

    for section_title, pages in nav_entries:
        if section_title != "__top_level__":
            lines.append(f"# {section_title}")
            lines.append("")
        for page_title, page_path in pages:
            page_content = read_page(build_dir, page_path)
            if not page_content.lstrip().startswith("#"):
                lines.append(f"## {page_title}")
            lines.append(page_content)
            lines.append("")
            lines.append("---")
            lines.append("")

    if extra_docs:
        lines.append("# Additional Authored Docs")
        lines.append("")
        for doc_path in extra_docs:
            relative_path = doc_path.relative_to(authored_docs_dir()).as_posix()
            doc_content = doc_path.read_text(encoding="utf-8").rstrip("\n")
            lines.append(f"## `{relative_path}`")
            lines.append("")
            lines.append(doc_content)
            lines.append("")
            lines.append("---")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    root = repo_root()
    docs_dir = docs_site_dir()
    authored_docs = authored_docs_dir()
    build_dir = docs_dir / ".build"
    mkdocs_path = docs_dir / "mkdocs.yml"
    output_paths = [
        docs_dir / "site" / "llms-full.txt",
        docs_dir / "static" / "llms-full.txt",
        root / "sites" / "landing" / "public" / "llms-full.txt",
    ]

    nav_entries = load_nav_entries(mkdocs_path)
    extra_docs = collect_extra_authored_docs(authored_docs, collect_nav_page_paths(nav_entries))
    rendered = render_llms_full(build_dir, nav_entries, extra_docs)

    for output_path in output_paths:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
        print(f"Successfully generated {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
