#!/usr/bin/env python3

import argparse
import re
import sys
from pathlib import Path
from posixpath import normpath
from urllib.parse import urlparse


DOCS_HOST = "docs.clawperator.com"
REQUIRED_SITE_FILES = [
    "index.html",
    "404.html",
    "robots.txt",
    "llms.txt",
    "llms-full.txt",
    "sitemap.xml",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate that expected docs routes and machine-facing files exist in the built docs site."
    )
    parser.add_argument("--site-dir", required=True, help="Built docs site directory, usually sites/docs/site")
    parser.add_argument("--source-map", required=True, help="Path to sites/docs/source-map.yaml")
    parser.add_argument(
        "--generated-docs-dir",
        required=True,
        help="Path to generated markdown docs, usually sites/docs/docs",
    )
    parser.add_argument("--llms-txt", required=True, help="Path to sites/docs/static/llms.txt")
    return parser.parse_args()


def parse_source_map_outputs(source_map_path: Path) -> list[str]:
    outputs: list[str] = []
    for raw_line in source_map_path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("- output:"):
            outputs.append(stripped.split(":", 1)[1].strip())
    return outputs


def markdown_output_to_site_path(output: str) -> str:
    if output == "index.md":
        return "index.html"
    if output.endswith(".md"):
        return output[:-3].rstrip("/") + "/index.html"
    return output


def docs_url_to_site_path(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != DOCS_HOST:
        return None
    path = parsed.path or "/"
    if path == "/":
        return "index.html"
    if path.endswith("/"):
        return path.lstrip("/") + "index.html"
    return path.lstrip("/")


def parse_markdown_links(markdown_path: Path) -> list[str]:
    pattern = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
    links: list[str] = []
    for match in pattern.finditer(markdown_path.read_text(encoding="utf-8")):
        href = match.group(1).strip()
        if (
            not href
            or href.startswith("#")
            or "://" in href
            or href.startswith("mailto:")
            or href.startswith("tel:")
        ):
            continue
        links.append(href)
    return links


def generated_doc_link_to_site_path(page_path: Path, generated_docs_dir: Path, href: str) -> str | None:
    clean_href = href.split("#", 1)[0].split("?", 1)[0].strip()
    if not clean_href:
        return None

    if clean_href.startswith("/"):
        return clean_href.lstrip("/")

    if clean_href.endswith(".md"):
        relative_page = page_path.relative_to(generated_docs_dir)
        resolved_doc = normpath(str(relative_page.parent / clean_href))
        return markdown_output_to_site_path(resolved_doc)
    return None


def validate_existing_paths(site_dir: Path, relative_paths: list[str], label: str) -> list[str]:
    missing: list[str] = []
    for relative_path in relative_paths:
        if not (site_dir / relative_path).exists():
            missing.append(f"{label}: missing {relative_path}")
    return missing


def main() -> int:
    args = parse_args()
    site_dir = Path(args.site_dir).resolve()
    source_map_path = Path(args.source_map).resolve()
    generated_docs_dir = Path(args.generated_docs_dir).resolve()
    llms_txt_path = Path(args.llms_txt).resolve()

    failures: list[str] = []

    failures.extend(validate_existing_paths(site_dir, REQUIRED_SITE_FILES, "required site file"))

    source_map_outputs = parse_source_map_outputs(source_map_path)
    expected_page_paths = [markdown_output_to_site_path(output) for output in source_map_outputs]
    failures.extend(validate_existing_paths(site_dir, expected_page_paths, "source-map page"))

    generated_doc_targets: list[str] = []
    for markdown_path in sorted(generated_docs_dir.rglob("*.md")):
        for href in parse_markdown_links(markdown_path):
            target = generated_doc_link_to_site_path(markdown_path, generated_docs_dir, href)
            if target is not None:
                generated_doc_targets.append(target)
    failures.extend(validate_existing_paths(site_dir, generated_doc_targets, "generated docs link"))

    llms_urls = re.findall(r"https://[^\s)]+", llms_txt_path.read_text(encoding="utf-8"))
    llms_targets = [
        target for url in llms_urls
        if (target := docs_url_to_site_path(url)) is not None
    ]
    failures.extend(validate_existing_paths(site_dir, llms_targets, "llms.txt route"))

    if failures:
        print("Docs route validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        f"Docs route validation passed: {len(expected_page_paths)} source-map pages, "
        f"{len(generated_doc_targets)} generated-doc links, {len(llms_targets)} llms.txt routes."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
