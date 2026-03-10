#!/usr/bin/env python3

import os
import sys

try:
    import yaml
except ImportError as exc:
    raise ImportError(
        "PyYAML is required to run generate_llms_full.py. "
        "Please install it (e.g., 'pip install PyYAML') or add it to sites/docs/requirements.txt."
    ) from exc

def main():
    # Locate the repository root (and sites/docs) relative to this script's path,
    # so the script can be run from any current working directory.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, "..", "..", "..", ".."))
    docs_site_dir = os.path.join(repo_root, "sites", "docs")
    
    docs_dir = os.path.join(docs_site_dir, "docs")
    source_map_path = os.path.join(docs_site_dir, "source-map.yaml")
    output_path = os.path.join(docs_site_dir, "site", "llms-full.txt")
    
    with open(source_map_path, "r", encoding="utf-8") as f:
        source_map = yaml.safe_load(f)
        
    if not isinstance(source_map, dict):
        raise ValueError(f"Failed to load a valid dictionary from {source_map_path}")
        
    compiled_content = []
    
    compiled_content.append("# Clawperator Full Documentation")
    compiled_content.append("This document contains all the technical documentation for Clawperator, compiled into a single file for easy digestion by AI agents.\n")
    
    missing_pages = []
    
    for section in source_map.get("sections", []):
        section_title = section.get("title")
        if section_title:
            compiled_content.append(f"\n# {section_title}\n")
            
        for page in section.get("pages", []):
            page_output = page.get("output")
            page_title = page.get("title")
            
            if not page_output:
                continue
                
            page_path = os.path.abspath(os.path.join(docs_dir, page_output))
            
            # Guard against path traversal
            if not page_path.startswith(os.path.abspath(docs_dir)):
                print(f"Error: Invalid page output path attempts traversal: {page_output}")
                missing_pages.append(page_output)
                continue
            
            if not os.path.exists(page_path):
                print(f"Error: File not found: {page_path}")
                missing_pages.append(page_path)
                continue
                
            with open(page_path, "r", encoding="utf-8") as pf:
                page_content = pf.read().rstrip("\n")
                
            # If the page doesn't start with a markdown header, add the title
            if not page_content.startswith("# "):
                compiled_content.append(f"\n## {page_title}\n")
            else:
                compiled_content.append("\n")
                
            compiled_content.append(page_content)
            compiled_content.append("\n---")
            
    if missing_pages:
        print(f"Error: Failed to generate llms-full.txt due to {len(missing_pages)} missing pages.")
        sys.exit(1)
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as out_f:
        out_f.write("\n".join(compiled_content))
        
    print(f"Successfully generated {output_path}")

if __name__ == "__main__":
    main()
