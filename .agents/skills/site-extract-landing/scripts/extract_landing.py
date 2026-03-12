#!/usr/bin/env python3

import json
import os
import sys
import urllib.request
import argparse

def main():
    parser = argparse.ArgumentParser(description='Extract clawperator.com landing page as markdown.')
    parser.add_argument('--output', default='index.md', help='Output file path (default: index.md)')
    parser.add_argument('--url', default='https://clawperator.com', help='URL to extract (default: https://clawperator.com)')
    args = parser.parse_args()

    account_id = os.environ.get('CLAWPERATOR_CLOUDFLARE_ACCOUNT_ID')
    token = os.environ.get('CLAWPERATOR_CLOUDFLARE_DOCS_WRANGLER_API_TOKEN')

    if not account_id or not token:
        print("Error: Missing required environment variables:")
        if not account_id:
            print("- CLAWPERATOR_CLOUDFLARE_ACCOUNT_ID")
        if not token:
            print("- CLAWPERATOR_CLOUDFLARE_DOCS_WRANGLER_API_TOKEN")
        sys.exit(1)

    api_url = f'https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/markdown'
    payload = json.dumps({'url': args.url}).encode()
    
    req = urllib.request.Request(
        api_url, 
        data=payload, 
        method='POST', 
        headers={
            'Authorization': f'Bearer {token}', 
            'Content-Type': 'application/json'
        }
    )

    try:
        print(f"Requesting markdown for {args.url} from Cloudflare...")
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
            if body.get('success'):
                markdown = body.get('result')
                if markdown:
                    with open(args.output, 'w', encoding='utf-8') as f:
                        f.write(markdown)
                    print(f"SUCCESS: Saved {args.output}")
                else:
                    print("ERROR: No markdown in result")
                    sys.exit(1)
            else:
                print(f"ERROR: API failed: {body}")
                sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
