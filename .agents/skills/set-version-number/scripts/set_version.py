#!/usr/bin/env python3
import os
import subprocess
import sys


def main() -> None:
    repo_root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
    target_script = os.path.join(
        repo_root,
        ".agents",
        "skills",
        "release-set-code-version-number",
        "scripts",
        "set_code_version.py",
    )
    os.execv(sys.executable, [sys.executable, target_script, *sys.argv[1:]])


if __name__ == "__main__":
    main()
