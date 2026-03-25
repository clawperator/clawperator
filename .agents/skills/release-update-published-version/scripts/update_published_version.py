#!/usr/bin/env python3
import re
import subprocess
import sys
from pathlib import Path


def die(message: str) -> None:
    print(f"release-update-published-version: {message}", file=sys.stderr)
    sys.exit(1)


def run(cmd: list[str], cwd: Path | None = None) -> str:
    try:
        result = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            check=True,
            text=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        details = stderr or stdout or str(exc)
        die(details)
    return result.stdout


def replace_required(path: Path, pattern: str, replacement: str) -> None:
    content = path.read_text(encoding="utf-8")
    new_content, replacements = re.subn(pattern, replacement, content, flags=re.MULTILINE)
    if replacements == 0:
        die(f"expected pattern not found in {path}")
    path.write_text(new_content, encoding="utf-8")


def parse_version(version: str) -> tuple[int, int, int]:
    match = re.match(r"^([0-9]+)\.([0-9]+)\.([0-9]+)", version)
    if not match:
        die(f"could not parse version {version}")
    return tuple(int(part) for part in match.groups())


def normalize_compatibility_examples(path: Path, version: str) -> None:
    content = path.read_text(encoding="utf-8")
    matches = list(
        re.finditer(
            r"^- CLI `0\.1\.4` and app `([0-9]+\.[0-9]+\.[0-9]+)` - not compatible$",
            content,
            flags=re.MULTILINE,
        )
    )
    if not matches:
        die(f"could not find compatibility example block in {path}")

    target_tuple = parse_version(version)
    kept_versions: list[str] = []
    for match in matches:
        matched_version = match.group(1)
        if parse_version(matched_version) <= target_tuple and matched_version not in kept_versions:
            kept_versions.append(matched_version)

    if version not in kept_versions:
        kept_versions.append(version)

    replacement_block = "\n".join(
        f"- CLI `0.1.4` and app `{matched_version}` - not compatible" for matched_version in kept_versions
    )

    start = matches[0].start()
    end = matches[-1].end()
    updated = content[:start] + replacement_block + content[end:]
    path.write_text(updated, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        die("usage: .agents/skills/release-update-published-version/scripts/update_published_version.py <version>")

    version = sys.argv[1]
    if not re.match(r"^[0-9]+\.[0-9]+\.[0-9]+$", version):
        die("version must be a plain release version like X.Y.Z")

    repo_root = Path(run(["git", "rev-parse", "--show-toplevel"]).strip())
    tracked_status = run(["git", "status", "--porcelain"], cwd=repo_root).strip()
    if tracked_status:
        die("working tree has uncommitted or untracked changes")

    current_branch = run(["git", "branch", "--show-current"], cwd=repo_root).strip()
    if not current_branch:
        die("HEAD is detached; cannot create the published-version follow-up commit")

    repo_slug = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], cwd=repo_root).strip()
    published_tag = run(
        ["gh", "release", "view", f"v{version}", "--repo", repo_slug, "--json", "tagName", "--jq", ".tagName"],
        cwd=repo_root,
    ).strip()
    if published_tag != f"v{version}":
        die(f"GitHub Release v{version} was not found")

    npm_version = run(["npm", "view", f"clawperator@{version}", "version"], cwd=repo_root).strip()
    if npm_version != version:
        die(f"npm does not report clawperator@{version}")

    latest_npm_version = run(["npm", "view", "clawperator", "version"], cwd=repo_root).strip()
    if latest_npm_version != version:
        die(f"{version} is not the current npm release (latest is {latest_npm_version})")

    replace_required(
        repo_root / "docs" / "android-operator-apk.md",
        r"Example for v[0-9]+\.[0-9]+\.[0-9]+:\n- \[https://downloads\.clawperator\.com/operator/v[0-9]+\.[0-9]+\.[0-9]+/operator-v[0-9]+\.[0-9]+\.[0-9]+\.apk\]\(https://downloads\.clawperator\.com/operator/v[0-9]+\.[0-9]+\.[0-9]+/operator-v[0-9]+\.[0-9]+\.[0-9]+\.apk\)",
        f"Example for v{version}:\n- [https://downloads.clawperator.com/operator/v{version}/operator-v{version}.apk](https://downloads.clawperator.com/operator/v{version}/operator-v{version}.apk)",
    )
    normalize_compatibility_examples(repo_root / "docs" / "compatibility.md", version)
    replace_required(
        repo_root / "docs" / "release-procedure.md",
        r"\.agents/skills/release-create/scripts/create_release\.sh [0-9]+\.[0-9]+\.[0-9]+ \[commit_sha\]",
        f".agents/skills/release-create/scripts/create_release.sh {version} [commit_sha]",
    )
    replace_required(
        repo_root / "docs" / "release-procedure.md",
        r"\.agents/skills/release-verify/scripts/release_verify\.sh [0-9]+\.[0-9]+\.[0-9]+",
        f".agents/skills/release-verify/scripts/release_verify.sh {version}",
    )
    replace_required(
        repo_root / "sites" / "landing" / "public" / "install.sh",
        r"# install\.sh \(v[0-9]+\.[0-9]+\.[0-9]+\)",
        f"# install.sh (v{version})",
    )

    subprocess.run(["./scripts/docs_build.sh"], cwd=repo_root, check=True)

    commit_message = f"docs(release): update published version to {version}"
    subprocess.run(
        [
            "git",
            "add",
            "docs/android-operator-apk.md",
            "docs/compatibility.md",
            "docs/release-procedure.md",
            "sites/docs/static/llms-full.txt",
            "sites/landing/public/install.sh",
            "sites/landing/public/llms-full.txt",
        ],
        cwd=repo_root,
        check=True,
    )
    staged_status = run(["git", "diff", "--cached", "--name-only"], cwd=repo_root).strip()
    if not staged_status:
        print(f"published version already current at {version}")
        return
    subprocess.run(["git", "commit", "-m", commit_message], cwd=repo_root, check=True)
    print(commit_message)


if __name__ == "__main__":
    main()
