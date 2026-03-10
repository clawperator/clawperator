#!/usr/bin/env python3

import argparse
import json
import re
import subprocess
import sys


USER_AGENT = "Mozilla/5.0 (compatible; ClawperatorGeoVerifier/1.0; +https://clawperator.com/)"


def build_checks(landing_base_url, docs_base_url):
    return [
        {"kind": "url", "url": f"{landing_base_url}/robots.txt", "content_type": r"text/plain"},
        {"kind": "url", "url": f"{landing_base_url}/llms.txt", "content_type": r"text/plain"},
        {"kind": "url", "url": f"{landing_base_url}/llms-full.txt", "content_type": r"text/plain"},
        {"kind": "url", "url": f"{landing_base_url}/index.md", "content_type": r"text/markdown|text/plain"},
        {"kind": "url", "url": f"{landing_base_url}/agents", "content_type": r"text/html"},
        {"kind": "url", "url": f"{landing_base_url}/sitemap.xml", "content_type": r"application/xml|text/xml"},
        {"kind": "redirect", "url": f"{landing_base_url}/agent.md", "location": r"/index.md"},
        {"kind": "redirect", "url": f"{landing_base_url}/agents.md", "location": r"/index.md"},
        {"kind": "redirect", "url": f"{landing_base_url}/for-agents", "location": r"/agents"},
        {"kind": "url", "url": f"{docs_base_url}/robots.txt", "content_type": r"text/plain"},
        {"kind": "url", "url": f"{docs_base_url}/llms.txt", "content_type": r"text/plain"},
        {"kind": "url", "url": f"{docs_base_url}/llms-full.txt", "content_type": r"text/plain"},
        {"kind": "url", "url": f"{docs_base_url}/sitemap.xml", "content_type": r"application/xml|text/xml"},
        {"kind": "url", "url": f"{docs_base_url}/", "content_type": r"text/html"},
        {"kind": "url", "url": f"{docs_base_url}/ai-agents/node-api-for-agents/", "content_type": r"text/html"},
        {"kind": "url", "url": f"{docs_base_url}/reference/cli-reference/", "content_type": r"text/html"},
    ]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--landing-base-url", default="https://clawperator.com")
    parser.add_argument("--docs-base-url", default="https://docs.clawperator.com")
    parser.add_argument("--allow-noindex", action="store_true")
    return parser.parse_args()


def run_curl(args):
    proc = subprocess.run(
        ["curl", "-sSI", "-A", USER_AGENT, *args],
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout + proc.stderr


def parse_headers(raw):
    raw = raw.replace("\r\n", "\n")
    blocks = [block.strip() for block in raw.split("\n\n") if block.strip()]
    if not blocks:
        return None, {}
    final = blocks[-1].splitlines()
    status = final[0].strip() if final else ""
    headers = {}
    for line in final[1:]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        headers[key.strip().lower()] = value.strip()
    return status, headers


def fail(url, reasons, status="", headers=None, raw=""):
    return {
        "url": url,
        "ok": False,
        "reasons": reasons,
        "status": status,
        "headers": headers or {},
        "raw": raw,
    }


def verify_url(check, allow_noindex=False):
    code, raw = run_curl([check["url"]])
    if code != 0:
        return fail(check["url"], [f"curl failed with exit code {code}"], raw=raw)

    status, headers = parse_headers(raw)
    reasons = []

    if not re.search(r"^HTTP/[0-9.]+\s+200\b", status or "", re.IGNORECASE):
        reasons.append(f"expected final 200, got {status or 'no status line'}")

    content_type = headers.get("content-type", "")
    if not re.search(check["content_type"], content_type, re.IGNORECASE):
        reasons.append(f"unexpected content-type: {content_type or 'missing'}")

    x_robots = headers.get("x-robots-tag", "")
    if not allow_noindex and re.search(r"\bnoindex\b", x_robots, re.IGNORECASE):
        reasons.append(f"unexpected noindex header: {x_robots}")
    if re.search(r"\b(noai|noimageai)\b", x_robots, re.IGNORECASE):
        reasons.append(f"unexpected AI-blocking header: {x_robots}")

    if reasons:
        return fail(check["url"], reasons, status=status, headers=headers, raw=raw)

    return {
        "url": check["url"],
        "ok": True,
        "reasons": [],
        "status": status,
        "headers": headers,
    }


def verify_redirect(check):
    code, raw = run_curl([check["url"]])
    if code != 0:
        return fail(check["url"], [f"curl failed with exit code {code}"], raw=raw)

    status, headers = parse_headers(raw)
    reasons = []

    if not re.search(r"^HTTP/[0-9.]+\s+30[178]\b", status or "", re.IGNORECASE):
        reasons.append(f"expected redirect, got {status or 'no status line'}")

    location = headers.get("location", "")
    location_pattern = rf"({re.escape(check['location'])}|https?://\\S*{re.escape(check['location'])})"
    if not re.search(location_pattern, location, re.IGNORECASE):
        reasons.append(f"unexpected redirect target: {location or 'missing'}")

    if reasons:
        return fail(check["url"], reasons, status=status, headers=headers, raw=raw)

    return {
        "url": check["url"],
        "ok": True,
        "reasons": [],
        "status": status,
        "headers": headers,
    }


def main():
    args = parse_args()
    checks = build_checks(
        args.landing_base_url.rstrip("/"),
        args.docs_base_url.rstrip("/"),
    )

    results = []
    for check in checks:
        if check["kind"] == "url":
            result = verify_url(check, allow_noindex=args.allow_noindex)
        else:
            result = verify_redirect(check)
        results.append(result)

    passed = [r for r in results if r["ok"]]
    failed = [r for r in results if not r["ok"]]

    for result in results:
        status = "PASS" if result["ok"] else "FAIL"
        line = f"{status} {result['url']}"
        if result["reasons"]:
            line += " - " + "; ".join(result["reasons"])
        print(line)

    print()
    print("Summary")
    print(f"- passed: {len(passed)}")
    print(f"- failed: {len(failed)}")
    print(f"- overall: {'PASS' if not failed else 'FAIL'}")

    if failed:
        print("- failures:")
        for result in failed:
            print(f"  - {result['url']}: {'; '.join(result['reasons'])}")

    print()
    print(
        "RESULT_JSON:"
        + json.dumps(
            {
                "ok": len(failed) == 0,
                "passed": len(passed),
                "failed": len(failed),
                "landingBaseUrl": args.landing_base_url.rstrip("/"),
                "docsBaseUrl": args.docs_base_url.rstrip("/"),
                "allowNoindex": args.allow_noindex,
                "results": [
                    {
                        "url": result["url"],
                        "ok": result["ok"],
                        "status": result.get("status", ""),
                        "reasons": result["reasons"],
                        "location": result.get("headers", {}).get("location"),
                        "contentType": result.get("headers", {}).get("content-type"),
                        "xRobotsTag": result.get("headers", {}).get("x-robots-tag"),
                    }
                    for result in results
                ],
            }
        )
    )

    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
