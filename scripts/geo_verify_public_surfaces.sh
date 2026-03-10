#!/usr/bin/env bash

set -euo pipefail

USER_AGENT="${GEO_USER_AGENT:-Mozilla/5.0 (compatible; ClawperatorGeoVerifier/1.0; +https://clawperator.com/)}"

fetch_headers() {
    local url="$1"
    curl -fsSIL -A "$USER_AGENT" "$url"
}

assert_header_contains() {
    local headers="$1"
    local pattern="$2"
    local label="$3"
    if ! grep -Eiq "$pattern" <<<"$headers"; then
        echo "FAIL: $label"
        return 1
    fi
}

assert_header_absent() {
    local headers="$1"
    local pattern="$2"
    local label="$3"
    if grep -Eiq "$pattern" <<<"$headers"; then
        echo "FAIL: $label"
        return 1
    fi
}

check_url() {
    local url="$1"
    local content_type_pattern="$2"
    local expect_noindex="${3:-yes}"
    local expect_noai="${4:-yes}"

    echo
    echo "==> $url"
    local headers
    headers="$(fetch_headers "$url")"
    printf '%s\n' "$headers"

    assert_header_contains "$headers" '^HTTP/[0-9.]+ 200' "expected final 200 for $url"
    assert_header_contains "$headers" "content-type: ${content_type_pattern}" "unexpected content-type for $url"

    if [ "$expect_noindex" = "yes" ]; then
        assert_header_absent "$headers" 'x-robots-tag: .*noindex|<meta[^>]+name=["'"'"']robots["'"'"'][^>]+content=["'"'"'][^"'"'"']*noindex' "unexpected noindex for $url"
    fi

    if [ "$expect_noai" = "yes" ]; then
        assert_header_absent "$headers" 'x-robots-tag: .*(noai|noimageai)' "unexpected AI blocking header for $url"
    fi
}

check_redirect() {
    local url="$1"
    local expected_location="$2"

    echo
    echo "==> $url"
    local headers
    headers="$(curl -fsSI -A "$USER_AGENT" "$url")"
    printf '%s\n' "$headers"

    assert_header_contains "$headers" '^HTTP/[0-9.]+ 30[178]' "expected redirect for $url"
    assert_header_contains "$headers" "location: (${expected_location}|https?://[^[:space:]]*${expected_location})" "unexpected redirect target for $url"
}

check_url "https://clawperator.com/robots.txt" 'text/plain'
check_url "https://clawperator.com/llms.txt" 'text/plain'
check_url "https://clawperator.com/llms-full.txt" 'text/plain'
check_url "https://clawperator.com/index.md" 'text/markdown|text/plain'
check_url "https://clawperator.com/agents" 'text/html'
check_url "https://clawperator.com/sitemap.xml" 'application/xml|text/xml'

check_redirect "https://clawperator.com/agent.md" '/index.md'
check_redirect "https://clawperator.com/agents.md" '/index.md'
check_redirect "https://clawperator.com/for-agents" '/agents'

check_url "https://docs.clawperator.com/robots.txt" 'text/plain'
check_url "https://docs.clawperator.com/llms.txt" 'text/plain'
check_url "https://docs.clawperator.com/sitemap.xml" 'application/xml|text/xml'
check_url "https://docs.clawperator.com/" 'text/html'
check_url "https://docs.clawperator.com/ai-agents/node-api-for-agents/" 'text/html'
check_url "https://docs.clawperator.com/reference/cli-reference/" 'text/html'

echo
echo "GEO verification passed."
