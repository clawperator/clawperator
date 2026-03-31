# Environment Variable Documentation Findings

## Discovery: docs/api/environment.md Already Exists

`docs/api/environment.md` exists and is comprehensive. It documents:

- `CLAWPERATOR_OPERATOR_PACKAGE` - override default Operator APK package
- `CLAWPERATOR_BIN` - override the CLI binary path (three-tier resolution: env > sibling build > global PATH)
- `CLAWPERATOR_LOG_DIR` - override log file directory
- `CLAWPERATOR_LOG_LEVEL` - set logging verbosity (error/warn/info/debug/verbose)
- `CLAWPERATOR_SKILLS_REGISTRY` - override the skills registry path
- `ADB_PATH` - override the adb binary path
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` - Android SDK root (for adb discovery)

The page is already linked from:
- `docs/index.md` as "Environment Variables: api/environment.md"
- `sites/docs/mkdocs.yml` nav: "Environment Variables: api/environment.md"

## Gap Found: setup.md Missing Cross-Reference

`docs/setup.md` "Related pages" section did not include a link to
`api/environment.md`. This was the only real gap in the envvars docs surface.

## Scope Change

The plan called for creating `docs/configuration.md` as a new page. This is
unnecessary - the content already exists at `docs/api/environment.md`. Creating
a duplicate page would fragment the documentation.

The actual work performed:
- Added `- [Environment Variables](api/environment.md)` to `docs/setup.md`
  "Related pages" section.
- No new page created. `docs/configuration.md` was not created.

## ANDROID_SERIAL Clarification

Verified via grep: `ANDROID_SERIAL` is NOT read by the Node CLI
(`apps/node/src/` has no references). The existing `environment.md` correctly
states: "There is no `ANDROID_SERIAL` equivalent. Device selection is always
explicit via `--device`." This is accurate and does not need changing.
