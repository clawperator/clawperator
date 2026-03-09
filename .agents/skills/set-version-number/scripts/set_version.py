#!/usr/bin/env python3
import sys
import os
import subprocess

if len(sys.argv) != 3:
    print("Usage: ./set_version.py <old_version> <new_version>")
    sys.exit(1)

old_version = sys.argv[1]
new_version = sys.argv[2]

print(f"Bumping version from {old_version} to {new_version}...")

repo_root = subprocess.check_output(['git', 'rev-parse', '--show-toplevel']).decode('utf-8').strip()

# Find all text files tracked by git
files = subprocess.check_output(['git', 'ls-files']).decode('utf-8').splitlines()

modified_files = []
for file in files:
    filepath = os.path.join(repo_root, file)
    
    if not os.path.isfile(filepath):
        continue
    
    # Skip some binary/unrelated extensions just in case
    if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.zip', '.bundle', '.pack', '.apk', '.jar', '.class', '.dex')):
        continue
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if old_version in content:
            new_content = content.replace(old_version, new_version)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            modified_files.append(file)
            print(f"Updated {file}")
            
    except UnicodeDecodeError:
        # Ignore binary files that git thinks are text
        pass

print(f"\nSuccessfully updated {len(modified_files)} files.")

# Run builds and tests to verify everything is okay
print("\nRunning Node API build and tests...")
subprocess.check_call(['npm', 'install'], cwd=os.path.join(repo_root, 'apps', 'node'))
subprocess.check_call(['npm', 'run', 'build'], cwd=os.path.join(repo_root, 'apps', 'node'))
subprocess.check_call(['npm', 'run', 'test'], cwd=os.path.join(repo_root, 'apps', 'node'))

# Rebuild docs since versions changed in docs
print("\nRebuilding docs...")
subprocess.check_call(['./scripts/docs_build.sh'], cwd=repo_root)

print("\nAll checks passed. Version bump complete.")
