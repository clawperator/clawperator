---
name: set-version-number
description: Compatibility alias for release-set-code-version-number. Use the new skill name for code-version bumps.
---

This skill name is kept only as a compatibility alias.

Use `.agents/skills/release-set-code-version-number/` instead.

The version workflow is now split:
- `.agents/skills/release-set-code-version-number/` updates the next unreleased code version.
- `.agents/skills/release-update-published-version/` updates public docs and website content after a release is live.

Run:

```bash
.agents/skills/release-set-code-version-number/scripts/set_code_version.py <old_version> <new_version>
```
