#!/usr/bin/env python3

import json
import re
import subprocess
import sys


USER_AGENT = "Mozilla/5.0 (compatible; ClawperatorGeoVerifier/1.0; +https://clawperator.com/)"


URL_CHECKS = [
    {"kind": "url", "url": "https://clawperator.com/robots.txt", "content_type": r"text/plain"},
    {"kind": "url", "url": "https://clawperator.com/llms.txt", "content_type": r"text/plain"},
    {"kind": "url", "url": "https://clawperator.com/llms-full.txt", "content_type": r"text/plain"},
    {"kind": "url", "url": "https://clawperator.com/index.md", "content_type": r"text/markdown|text/plain"},
    {"kind": "url", "url": "https://clawperator.com/agents", "content_type": r"text/html"},
    {"kind": "url", "url": "https://clawperator.com/sitemap.xml", "content_type": r"application/xml|text/xml"},
    {"kind": "redirect", "url": "https://clawperator.com/agent.md", "location": r"/index.md"},
    {"kind": "redirect", "url": "https://clawperator.com/agents.md", "location": r"/index.md"},
    {"kind": "redirect", "url": "https://clawperator.com/for-agents", "location": r"/agents"},
    {"kind": "url", "url": "https://docs.clawperator.com/robots.txt", "content_type": r"text/plain"},
    {"kind": "url", "url": "https://docs.clawperator.com/llms.txt", "content_type": r"text/plain"},
    {"kind": "url", "url": "https://docs.clawperator.com/llms-full.txt", "content_type": r"text/plain"},
    {"kind": "url", "url": "https://docs.clawperator.com/sitemap.xml", "content_type": r"application/xml|text/xml"},
    {"kind": "url", "url": "https://docs.clawperator.com/", "content_type": r"text/html"},
    {"kind": "url", "url": "https://docs.clawperator.com/ai-agents/node-api-for-agents/", "content_type": r"text/html"},
    {"kind": "url", "url": "https://docs.clawperator.com/reference/cli-reference/", "content_type": r"text/html"},
]


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


def verify_url(check):
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
    if re.search(r"\bnoindex\b", x_robots, re.IGNORECASE):
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
    results = []
    for check in URL_CHECKS:
        if check["kind"] == "url":
            result = verify_url(check)
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
