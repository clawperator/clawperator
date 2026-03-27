#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def die(message: str) -> None:
    print(f"release-set-code-version-number: {message}", file=sys.stderr)
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


def run_no_capture(cmd: list[str], cwd: Path | None = None) -> None:
    try:
        subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            check=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        die(str(exc))


def replace_in_file(path: Path, pattern: str, replacement: str, *, count: int = 0) -> bool:
    content = path.read_text(encoding="utf-8")
    new_content, replacements = re.subn(pattern, replacement, content, count=count, flags=re.MULTILINE)
    if replacements == 0:
        return False
    path.write_text(new_content, encoding="utf-8")
    return True


def insert_incompatibility_case(path: Path, new_version: str) -> bool:
    content = path.read_text(encoding="utf-8")
    target_line = f'    assert.strictEqual(isVersionCompatible("0.1.4", "{new_version}"), false);'
    if target_line in content:
        return False

    matches = list(
        re.finditer(
            r'^(    assert\.strictEqual\(isVersionCompatible\("0\.1\.4", "[0-9]+\.[0-9]+\.[0-9]+"\), false\);\n)+',
            content,
            flags=re.MULTILINE,
        )
    )
    if not matches:
        die(f"could not find compatibility assertion block in {path}")

    block = matches[0].group(0)
    updated_block = block + target_line + "\n"
    path.write_text(content.replace(block, updated_block, 1), encoding="utf-8")
    return True


def main() -> None:
    if len(sys.argv) != 3:
        die("usage: .agents/skills/release-set-code-version-number/scripts/set_code_version.py <old_version> <new_version>")

    old_version = sys.argv[1]
    new_version = sys.argv[2]
    version_pattern = r"^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$"
    if not re.match(version_pattern, old_version) or not re.match(version_pattern, new_version):
        die("versions must look like semver")

    repo_root = Path(run(["git", "rev-parse", "--show-toplevel"]).strip())
    os.chdir(repo_root)

    tracked_status = run(["git", "status", "--porcelain"]).strip()
    if tracked_status:
        die("working tree has uncommitted or untracked changes")

    package_json_path = repo_root / "apps" / "node" / "package.json"
    package_data = json.loads(package_json_path.read_text(encoding="utf-8"))
    if package_data.get("version") != old_version:
        die(f"apps/node/package.json is {package_data.get('version')}, expected {old_version}")

    package_data["version"] = new_version
    package_json_path.write_text(json.dumps(package_data, indent=2) + "\n", encoding="utf-8")

    updated_files: list[str] = ["apps/node/package.json"]

    internal_replacements = {
        ".agents/skills/release-create/SKILL.md": (re.escape(old_version), new_version),
        "scripts/fake_adb.sh": (re.escape(f"{old_version}-d"), f"{new_version}-d"),
        "docs/index.md": (rf'(\[){re.escape(old_version)}(\]\(https://github\.com/clawperator/clawperator/blob/main/CHANGELOG\.md\))', rf'\g<1>{new_version}\g<2>'),
        "docs/troubleshooting/compatibility.md": (rf'(\[){re.escape(old_version)}(\]\(https://github\.com/clawperator/clawperator/blob/main/CHANGELOG\.md\))', rf'\g<1>{new_version}\g<2>'),
    }

    for relative_path, (pattern, replacement) in internal_replacements.items():
        path = repo_root / relative_path
        if replace_in_file(path, pattern, replacement):
            updated_files.append(relative_path)

    # Update versioned URLs in compatibility.md (e.g., downloads.clawperator.com/operator/v0.5.2/)
    compat_path = repo_root / "docs" / "troubleshooting" / "compatibility.md"
    if replace_in_file(compat_path, rf'v{re.escape(old_version)}', f'v{new_version}'):
        if "docs/troubleshooting/compatibility.md" not in updated_files:
            updated_files.append("docs/troubleshooting/compatibility.md")

    if insert_incompatibility_case(
        repo_root / "apps" / "node" / "src" / "test" / "unit" / "versionCompatibility.test.ts",
        new_version,
    ):
        updated_files.append("apps/node/src/test/unit/versionCompatibility.test.ts")

    run_no_capture(["npm", "install", "--package-lock-only"], cwd=repo_root / "apps" / "node")
    if "apps/node/package-lock.json" not in updated_files:
        updated_files.append("apps/node/package-lock.json")

    run_no_capture(["npm", "--prefix", "apps/node", "ci"], cwd=repo_root)
    run_no_capture(["npm", "--prefix", "apps/node", "run", "build"], cwd=repo_root)
    run_no_capture(["npm", "--prefix", "apps/node", "run", "test"], cwd=repo_root)

    run_no_capture(["git", "add", *updated_files], cwd=repo_root)
    commit_message = f"chore(build): set code version to {new_version}"
    run_no_capture(["git", "commit", "-m", commit_message], cwd=repo_root)

    print(f"Bumped code version from {old_version} to {new_version}")
    for path in updated_files:
        print(f"updated {path}")
    print("Validation passed: npm --prefix apps/node ci && npm --prefix apps/node run build && npm --prefix apps/node run test")
    print(f"Commit created: {commit_message}")


if __name__ == "__main__":
    main()
