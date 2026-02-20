# v1 TODO

## 0.1 Public Release (PoC)

These are the critical "next steps" required to ship a stable 0.1 proof-of-concept.

- [x] **CLI Action Command Refactor:** Rename the `act` subcommand to `action` as the primary/canonical entry point. (Done: removed 'act' in favor of 'action')
- [x] **Node CLI Refactor:** Implement the `expectedFormat` validation logic as a mandatory pre-flight check.
- [x] **Conformance Test APK:** Create a tiny Android app with stable Compose nodes, known resource-ids, and scroll lists for reliable smoke testing in CI/CD. (Done: added 'app-conformance' module)
- [x] **Skill Migration (Bash to Node):** Migrate existing bash-based skills (e.g., Life360, Google Home) to use the Node SDK/API.
    - *Goal:* Replace raw `adb` calls and complex shell-script parsing with typed Node.js implementations for better reliability and JSON handling.

## v1 Release Candidate (Post-0.1)

- [x] **Local Node Server Implementation (`serve`):** Implement a robust HTTP server (Express/Fastify) to allow remote agents to interact with Clawperator without requiring direct CLI access.
    - *Requirements:*
        - **REST Endpoints:** Map CLI commands (`/execute`, `/devices`, `/observe`) to HTTP POST/GET routes.
        - **Event Streaming (SSE):** Support Server-Sent Events to stream `[Clawperator-Result]` and `[Clawperator-Event]` envelopes in real-time to the caller.
        - **Device Management:** Implement a basic locking/concurrency mechanism to prevent multiple remote agents from sending conflicting commands to the same device simultaneously.
- [ ] **Error Code Mapping:** Ensure the Node SDK correctly maps raw ADB/logcat failures to the 0.1.0 Error Taxonomy (see `node-api-design.md`).

- [ ] **Error Code Mapping:** Ensure the Node SDK correctly maps raw ADB/logcat failures to the 0.1.0 Error Taxonomy (see `node-api-design.md`).
- [ ] **`--safe-logs` Flag:** Implement a minimal regex-based redaction path for common PII patterns in logcat.
- [ ] **Distribution and install:** Publish a canonical terminal install command for Node API (npm package or install script) and document exactly one blessed command in README.
- [ ] **Versioned releases:** Add release notes/changelog path for Node API + Android runtime releases.

## Core Doctrine: What Stays Forever

To prevent regression and "logic drift," these principles are immutable:

1. **The Brain/Hand Split:** Reasoning stays in the Agent; deterministic execution stays in Clawperator.
2. **Canonical Envelope:** `[Clawperator-Result]` is the single source of truth for command outcome.
3. **No Hidden Retries:** If a tap fails, the error is returned immediately. The Hand does not "try again" without the Brain's instruction.
4. **Validation Before Side-Effects:** Every command must be valid and the device reachable before a single byte is sent to Android.

## Release Hardening

- [ ] Run pre-release blocked-term scan across current refs before each public tag.
- [ ] Ensure CI gate covers canonical envelope regression and smoke script sanity checks.
