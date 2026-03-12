#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write deterministic docs build metadata.")
    parser.add_argument("--repo-root", required=True, help="Path to the clawperator repo root")
    parser.add_argument("--skills-root", required=True, help="Path to the clawperator-skills repo root")
    parser.add_argument("--output", required=True, help="Path to write docs_build.json")
    parser.add_argument(
        "--source-map",
        default="sites/docs/source-map.yaml",
        help="Path to the source-map relative to the repo root",
    )
    return parser.parse_args()


def git_short_sha(root: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--short=12", "HEAD"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def sha1_text(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    skills_root = Path(args.skills_root).resolve()
    output_path = Path(args.output).resolve()
    source_map_path = (repo_root / args.source_map).resolve()
    source_map_text = source_map_path.read_text(encoding="utf-8") if source_map_path.exists() else ""

    metadata = {
        "docsBuildId": sha1_text(
            "|".join(
                [
                    git_short_sha(repo_root),
                    git_short_sha(skills_root),
                    sha1_text(source_map_text),
                ]
            )
        ),
        "repoCommit": git_short_sha(repo_root),
        "skillsRepoCommit": git_short_sha(skills_root),
        "sourceMapSha": sha1_text(source_map_text),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote docs build metadata to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
