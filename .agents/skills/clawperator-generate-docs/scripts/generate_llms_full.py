#!/usr/bin/env python3

import os
import yaml

def main():
    import sys
    
    # We assume the script is run from within the sites/docs directory 
    # (or we find sites/docs from the script path)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, "..", "..", "..", ".."))
    docs_site_dir = os.path.join(repo_root, "sites", "docs")
    
    docs_dir = os.path.join(docs_site_dir, "docs")
    source_map_path = os.path.join(docs_site_dir, "source-map.yaml")
    output_path = os.path.join(docs_site_dir, "site", "llms-full.txt")
    
    with open(source_map_path, "r", encoding="utf-8") as f:
        source_map = yaml.safe_load(f)
        
    compiled_content = []
    
    compiled_content.append("# Clawperator Full Documentation")
    compiled_content.append("This document contains all the technical documentation for Clawperator, compiled into a single file for easy digestion by AI agents.\n")
    
    for section in source_map.get("sections", []):
        section_title = section.get("title")
        if section_title:
            compiled_content.append(f"\n# {section_title}\n")
            
        for page in section.get("pages", []):
            page_output = page.get("output")
            page_title = page.get("title")
            
            if not page_output:
                continue
                
            page_path = os.path.join(docs_dir, page_output)
            
            if not os.path.exists(page_path):
                print(f"Warning: File not found: {page_path}")
                continue
                
            with open(page_path, "r", encoding="utf-8") as pf:
                page_content = pf.read().strip()
                
            # If the page doesn't start with a markdown header, add the title
            if not page_content.startswith("# "):
                compiled_content.append(f"\n## {page_title}\n")
            else:
                compiled_content.append("\n")
                
            compiled_content.append(page_content)
            compiled_content.append("\n---")
            
    with open(output_path, "w", encoding="utf-8") as out_f:
        out_f.write("\n".join(compiled_content))
        
    print(f"Successfully generated {output_path}")

if __name__ == "__main__":
    main()
