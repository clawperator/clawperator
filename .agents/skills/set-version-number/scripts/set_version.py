#!/usr/bin/env python3
import sys
import os
import subprocess
import re

if len(sys.argv) != 3:
    print("Usage: ./set_version.py <old_version> <new_version>")
    sys.exit(1)

old_version = sys.argv[1]
new_version = sys.argv[2]

print(f"Bumping version from {old_version} to {new_version}...")

repo_root = subprocess.check_output(['git', 'rev-parse', '--show-toplevel']).decode('utf-8').strip()

files = subprocess.check_output(['git', 'ls-files']).decode('utf-8').splitlines()

IGNORE_PATTERNS = [
    'package-lock.json',
    'Gemfile.lock',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Podfile.lock',
    '.DS_Store'
]

# Word boundary regex for general files
version_pattern = re.compile(r'(?<![\d.])' + re.escape(old_version) + r'(?![\d.])')

# Specific exact match for package.json
package_json_pattern = re.compile(r'"version"\s*:\s*"' + re.escape(old_version) + r'"')
package_json_replacement = f'"version": "{new_version}"'

modified_files = []
for file in files:
    if any(p in file for p in IGNORE_PATTERNS):
        continue

    filepath = os.path.join(repo_root, file)
    
    if not os.path.isfile(filepath):
        continue
    
    if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.zip', '.bundle', '.pack', '.apk', '.jar', '.class', '.dex', '.pyc')):
        continue
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        count = 0
        if file.endswith('package.json') and 'apps/node/package.json' in file:
            new_content, count = package_json_pattern.subn(package_json_replacement, content)
        elif old_version in content:
            new_content, count = version_pattern.subn(new_version, content)
            
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            modified_files.append(file)
            print(f"Updated {file} ({count} occurrences)")
            
    except UnicodeDecodeError:
        pass

print(f"\nSuccessfully updated {len(modified_files)} files.")

print("\nRunning Node API build and tests...")
subprocess.check_call(['npm', 'ci'], cwd=os.path.join(repo_root, 'apps', 'node'))
subprocess.check_call(['npm', 'run', 'build'], cwd=os.path.join(repo_root, 'apps', 'node'))
subprocess.check_call(['npm', 'run', 'test'], cwd=os.path.join(repo_root, 'apps', 'node'))

print("\nRebuilding docs...")
subprocess.check_call(['./scripts/docs_build.sh'], cwd=repo_root)

print("\nAll checks passed. Version bump complete.")
