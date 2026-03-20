# Agent Usage Issues

This file tracks issues and improvements related to agent/LLM usage of the Clawperator API.

## Open Issues

### Missing Operator APK Not Detected Early

**Problem:**
When the Clawperator Operator APK is not installed on the device, API calls (like `execute`, `skills run`, `observe screenshot`) timeout with `RESULT_ENVELOPE_TIMEOUT` instead of failing fast with a clear error.

**Current Behavior:**
1. `clawperator doctor` detects `RECEIVER_NOT_INSTALLED` but reports it as a **warning** (not critical)
2. `clawperator execute` sends broadcasts without checking if the APK is installed
3. Commands timeout after 30-120 seconds with `RESULT_ENVELOPE_TIMEOUT`
4. Skills inherit this timeout behavior since they use `execute` internally

**Expected Behavior:**
- Doctor should mark `RECEIVER_NOT_INSTALLED` as **critical** (blocks execution)
- Execute should check APK presence before sending broadcasts and fail fast with `OPERATOR_NOT_INSTALLED`
- Skills should run a verification phase as step 0 (check APK installed and version compatible)

**Impact:**
- Poor UX for agents/LLMs using the API — timeouts are confusing and slow
- Wasted time waiting for commands that can never succeed
- Difficult to diagnose without running `doctor` separately

**Suggested Fix:**
1. Change `RECEIVER_NOT_INSTALLED` from `warn` to `fail` in Doctor checks
2. Add APK presence check at the start of `execute` command
3. Add `--validate` flag to skills run that checks prerequisites before execution
4. Consider auto-running doctor checks before execute/skills commands

**Related:**
- Similar issue with `RECEIVER_VARIANT_MISMATCH` (debug vs release APK)
- Version compatibility checks exist but only warn, don't block

---

*Last updated: 2026-03-20*
