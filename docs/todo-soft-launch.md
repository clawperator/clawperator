# Clawperator Release Implementation Roadmap

## Overview

This roadmap covers 9 phases (0-8) to prepare Clawperator for public release. The project is functionally complete (Android app + Node API/CLI + skills infrastructure). Work is mostly packaging, documentation, web presence, and UX polish. Implementation proceeds phase by phase; phases 0-2 are prerequisites for everything else.

**Key constraint:** Android APK source code stays private for now. Only built APKs are distributed via GitHub Releases. Everything else (npm package, install script, docs site, landing page) can be released immediately.

**Starting state:**
- `/apps/node/package.json` has name, bin, engines, keywords, license - but is missing `repository`, `homepage`, `files`, `publishConfig`
- `skills sync` command exists but is a stub
- `skills install` subcommand does not exist
- No `/sites/` directory
- No `/scripts/install.sh`
- No release GitHub Actions workflows
- Doctor hard-fails on APK not installed (should warn)
- `DoctorCheckResult` contract already has `"warn"` status but most checks use `"fail"`
- Version error code `VERSION_INCOMPATIBLE` exists; phase 8 adds more granular ones

---

## Phase 0: Documentation Tightening

### Objective

Make docs agent-first and approachable. A new user should understand Clawperator in 30 seconds from the README. An agent should be able to find the API contract without reading design docs.

### Tasks

- [ ] **Rewrite `README.md`**
  - File: `README.md` (root)
  - Action: Trim to under 100 lines. Target structure:
    ```
    # Clawperator
    [logo]
    [one-line tagline]

    ## Install
    curl -fsSL https://clawperator.com/install.sh | bash

    ## Quick Start
    clawperator doctor
    clawperator devices
    clawperator observe snapshot --device-id <id>

    ## Requirements
    - Node.js >= 22
    - Android device with USB debugging enabled
    - Clawperator APK from GitHub Releases

    ## Documentation
    https://docs.clawperator.com

    ## License
    Apache 2.0
    ```
  - Notes: Current README is 169 lines with install instructions that reference the wrong package name (`@clawperator/cli`) and potentially incorrect repo URL (`github.com/clawpilled/clawperator`). Both need to be corrected before public release. The "Working Backwards" section is internal framing - move to design docs or remove. The compatibility matrix table in the current README can stay or move to `docs/compatibility.md` (Phase 8)
  - **Flag:** Confirm the public GitHub repo URL before updating links in README

- [ ] **Simplify `AGENTS.md`**
  - File: `AGENTS.md` (root, also symlinked as `CLAUDE.md` and `GEMINI.md`)
  - Action: Trim to under 200 lines. Focus on "what agents need to know NOW": required iteration loop, validation commands, package IDs, runtime contracts. Move near-term engineering priorities section to a separate internal doc
  - Notes: `CLAUDE.md` and `GEMINI.md` are symlinks - editing `AGENTS.md` updates all three

- [ ] **Audit `docs/node-api-for-agents.md`**
  - File: `docs/node-api-for-agents.md`
  - Action: Remove "working backwards" meta-commentary and internal framing. Restructure to focus on: what the API does, how to call it, what it returns, error codes, examples
  - Notes: The phrase "working backwards" appears as a section header - this is internal product language, not agent guidance

- [ ] **Create `docs/first-time-setup.md`**
  - File: `docs/first-time-setup.md` (new)
  - Action: Write a step-by-step post-install guide covering: device prep (enable USB debugging, developer options), APK download and install from GitHub Releases, running `clawperator doctor`, running first smoke test
  - Notes: This is distinct from the README quickstart - it's the detailed "Day 1" guide. Should reference the APK download URL from GitHub Releases once that workflow exists (Phase 6)

- [ ] **Move design docs to `docs/design/`**
  - Files: `docs/node-api-design.md`, `docs/node-doctor-design.md`, `docs/skill-design.md`, `docs/operator-llm-playbook.md`, `docs/node-api-alpha-release-checklist.md` (moved to `docs/design/`)
  - Action: Create `docs/design/` subdirectory and move these files. Update any cross-references in remaining docs
  - Notes: Keep in `docs/` root: `architecture.md`, `troubleshooting.md`, `conformance-apk.md`, `known-issues.md`, `crash-logs.md`, `first-time-setup.md` (new), `project-overview.md`

### Implementation Notes

- Symlink structure (`CLAUDE.md` -> `AGENTS.md`) must be preserved when editing
- Current `docs/img/` with `clawperator-logo.png` stays in place - referenced by landing page later
- The README currently references `docs/wip-plan.md` and `docs/v1-todo.md` - those references should be removed or updated after the design doc move

### Dependencies

None. This phase is a prerequisite for everything else.

### Concerns

- ~~Package name decision~~ - Resolved: `clawperator` (confirmed)
- ~~Repo URL~~ - Resolved: `github.com/clawpilled/clawperator` (confirmed)

### Files to Audit (no changes expected, just verify current)

- `docs/design/operator-llm-playbook.md` - verify content reflects current skills model before docs site migration
- `docs/design/node-api-design.md` - verify against actual implementation before migrating to docs site
- `docs/design/skill-design.md` - verify content is accurate for skills authoring guide in docs site

---

## Phase 1: NPM Package Publishing

### Objective

Publish the `clawperator` CLI to npm so it can be installed with `npm install -g clawperator`.

### Tasks

- [ ] **Verify npm package name availability**
  - Action: Run `npm view clawperator` to confirm the name is unclaimed
  - Notes: Release plan states this was verified; re-confirm before publishing

- [ ] **Update `/apps/node/package.json`**
  - File: `apps/node/package.json`
  - Action: Add missing fields:
    ```json
    "version": "0.1.0-alpha.1",
    "repository": {
      "type": "git",
      "url": "https://github.com/clawpilled/clawperator.git",
      "directory": "apps/node"
    },
    "homepage": "https://clawperator.com",
    "bugs": "https://github.com/clawpilled/clawperator/issues",
    "publishConfig": {
      "access": "public",
      "tag": "alpha"
    },
    "files": [
      "dist/",
      "README.md",
      "LICENSE"
    ]
    ```
  - Notes: Current `package.json` already has `name`, `bin`, `engines`, `keywords`, `license`. The `files` field is critical to avoid publishing `src/`, `test/`, and config files. The `dist/` directory is generated by `tsc` (build step). Version should be bumped from `0.1.0` to `0.1.0-alpha.1` for the initial alpha release

- [ ] **Verify `/apps/node/LICENSE` exists**
  - File: `apps/node/LICENSE`
  - Action: Confirm the file exists. The root `LICENSE` exists (Apache 2.0); a copy or symlink is needed at the package level since `files` in `package.json` will include it
  - Notes: Run `ls apps/node/LICENSE` to check - the explore step noted it exists

- [ ] **Create `/apps/node/.npmignore`**
  - File: `apps/node/.npmignore` (new)
  - Action: Create with entries to exclude development artifacts:
    ```
    src/
    tsconfig.json
    .eslintrc*
    *.test.ts
    examples/
    ```
  - Notes: The `files` field in `package.json` is the primary control; `.npmignore` is a belt-and-suspenders safety measure. `dist/` is what gets published

- [ ] **Update `/apps/node/README.md`**
  - File: `apps/node/README.md`
  - Action: Add/update install section at the top: `npm install -g clawperator`. Include a brief what-it-is paragraph, requirements (Node >= 22, adb), and a pointer to docs.clawperator.com
  - Notes: This is the README displayed on npmjs.com, separate from the root `README.md`

- [ ] **Test local pack and install**
  - Action: Run from `apps/node/`: `npm run build && npm pack` then inspect the tarball contents with `tar -tzf clawperator-*.tgz`. Verify only `dist/`, `README.md`, `LICENSE` are included. Then test global install: `npm install -g ./clawperator-*.tgz && clawperator --version`
  - Notes: This must be done on a clean machine or in a separate directory to catch PATH issues

- [ ] **[HUMAN] Publish to npm**
  - Action: `npm login` then `npm publish --access public --tag alpha` from `apps/node/`
  - Notes: Human must own/create the npm account. The `--tag alpha` ensures it does not become the default `latest` tag. After publish, verify with `npm view clawperator@alpha`

### Implementation Notes

- The `dist/` directory is gitignored but must exist before packing. Build must run first: `npm --prefix apps/node run build`
- The `bin` field in `package.json` already points to `./dist/cli/index.js` - this is correct
- The compiled `dist/cli/index.js` must have a shebang (`#!/usr/bin/env node`) for global CLI install to work. Verify this is present in the compiled output or add it to the source

### Dependencies

- Phase 0 (documentation) should be complete so the npm README reflects current state
- Build must succeed: `npm --prefix apps/node run build`

### Concerns

- The shebang line in `dist/cli/index.js` needs verification - TypeScript compilation may strip or not add it. Check `src/cli/index.ts` line 1
- No `exports` field in `package.json` - if this package is ever used as a library (not just CLI), this would be needed. Not blocking for alpha CLI release
- `eslint` is referenced in `scripts.lint` but not listed in devDependencies - verify `npm run lint` works or remove the script

---

## Phase 2: Install Script

### Objective

One-command installation that sets up everything a user needs: Node.js, adb, the CLI, and skills.

### Tasks

- [ ] **Create `/scripts/install.sh`**
  - File: `scripts/install.sh` (new)
  - Action: Create a POSIX-compatible bash script with the following flow:
    1. Detect OS: `uname -s` for Linux/macOS; detect distro via `/etc/os-release` for apt vs pacman vs other
    2. Check Node.js >= 22: `node --version`, install via nvm if missing or too old
    3. Check `adb`: `which adb`, install via Homebrew on macOS, apt on Debian/Ubuntu, or `pacman -S android-tools` on Arch. Fallback: point to manual install docs
    4. Install CLI: `npm install -g clawperator@alpha`
    5. Clone skills: `git clone https://github.com/clawpilled/clawperator-skills ~/.clawperator/skills/`
    6. Set env var: append `export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills-registry.json"` to `~/.zshrc` and `~/.bashrc`
    7. Print next steps: download APK URL, `clawperator doctor`, link to first-time-setup doc
  - Notes: Script will be served at `https://clawperator.com/install.sh` via the landing page. Must be safe to run repeatedly (idempotent). Reference existing `scripts/clawperator_grant_android_permissions.sh` for bash style conventions

- [ ] **Add error handling and cleanup**
  - File: `scripts/install.sh`
  - Action: Add `set -euo pipefail` at top, `trap` for cleanup on failure, clear user-facing error messages for each possible failure point

- [ ] **Check for `git` as a dependency**
  - File: `scripts/install.sh`
  - Action: Before the skills clone step, check `command -v git`. If missing, install via Homebrew (`brew install git`) on macOS or apt (`sudo apt-get install -y git`) on Linux. `git` is required for both the direct clone step and `clawperator skills install`

- [ ] **Handle shell RC files for both zsh and bash**
  - File: `scripts/install.sh`
  - Action: Append the `CLAWPERATOR_SKILLS_REGISTRY` export to both `~/.zshrc` (if it exists) and `~/.bashrc` (if it exists), guarded by a `grep` check so the line is only added once. On macOS, `~/.zshrc` is the default shell since Catalina; on Linux, `~/.bashrc` is typical. Targeting both covers mixed environments
  - Notes: Do NOT append unconditionally to shell RC files that don't exist - check first with `[ -f ~/.zshrc ]` etc.

- [ ] **Verify `CLAWPERATOR_SKILLS_REGISTRY` path against skills repo structure**
  - Action: Before finalizing the install script, check the actual layout of the `clawperator-skills` repo to determine where `skills-registry.json` lives relative to the repo root. The path set in the env var must match exactly. If the clone target is `~/.clawperator/skills/` and the registry file is at repo root, the path is `~/.clawperator/skills/skills-registry.json`. If the registry is in a subdirectory, adjust accordingly
  - **Flag:** Do not hardcode this path without confirming the skills repo structure first

- [ ] **Make script available via landing page**
  - Action: Covered in Phase 3 (symlink/copy to `sites/landing/public/install.sh`). Note the dependency here

- [ ] **[HUMAN] Test on clean Ubuntu 24.04 VM**
  - Action: Spin up a fresh Ubuntu 24.04 VM, run the script end to end, verify all components installed and `clawperator doctor` runs

- [ ] **[HUMAN] Test on clean macOS VM or machine**
  - Action: Test on a machine without Node.js or adb pre-installed

### Implementation Notes

- Existing scripts in `/scripts/` use `#!/usr/bin/env bash` and `set -e` - follow the same pattern
- The exact env var name used by `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` must be confirmed and used verbatim in the install script
- Skills repo URL: `github.com/clawpilled/clawperator-skills` (confirmed)
- nvm install approach is preferred over system Node.js to avoid `sudo` requirements

### Dependencies

- Phase 1 must be complete (npm package must be published before install script can reference it)
- Skills repo must be public (or at least accessible) before the clone step works
- `git` must be available or installed by the script before the skills clone

### Concerns

- `CLAWPERATOR_SKILLS_REGISTRY` env var name: verify the exact name used in `localSkillsRegistry.ts` before hardcoding it in the install script
- `CLAWPERATOR_SKILLS_REGISTRY` path: the skills repo structure determines where `skills-registry.json` lives. Confirm before writing the export line
- The skills repo clone location (`~/.clawperator/skills/`) must match what Phase 5 expects
- Windows support is explicitly out of scope per the release plan (Linux/macOS only)

---

## Phase 3: Landing Page

### Objective

Professional landing page at clawperator.com that communicates what Clawperator is and provides the one-line install command.

### Tasks

- [ ] **Scaffold `/sites/landing/` from Peekaboo template**
  - File: `sites/landing/` (new directory)
  - Action: Copy the Peekaboo Next.js template into `sites/landing/`. The template is already available locally at `/Users/chrislacy/clawpilled/eval/Peekaboo/docs/site` - no need to clone from GitHub. Remove template-specific content and branding
  - Notes: The `sites/` directory does not currently exist. Create it. Follow existing monorepo conventions

- [ ] **Update hero section content**
  - File: `sites/landing/` (various component files)
  - Action: Set headline, subheadline, and description copy. Key message: "Deterministic Android Automation for AI Agents" with one-line install command prominently displayed

- [ ] **Add features section**
  - File: `sites/landing/` (component files)
  - Action: Add three feature blocks: Deterministic (no hidden retries, strict contracts), Observable (structured UI snapshots, canonical result envelopes), Reliable (machine-readable error codes, agent-friendly diagnostics)

- [ ] **Add quick start code block**
  - File: `sites/landing/` (component files)
  - Action: Show the install command: `curl -fsSL https://clawperator.com/install.sh | bash`

- [ ] **Add Clawperator logo**
  - File: `docs/img/clawperator-logo.png` -> `sites/landing/public/`
  - Action: Copy (or reference) the logo from `docs/img/clawperator-logo.png`

- [ ] **Configure static export**
  - File: `sites/landing/next.config.js`
  - Action: Set `output: 'export'` for Cloudflare Pages static deployment

- [ ] **Make install script available at `/install.sh`**
  - File: `sites/landing/public/install.sh`
  - Action: Copy or symlink `/scripts/install.sh` to `sites/landing/public/install.sh` so it is served at `https://clawperator.com/install.sh`
  - Notes: Symlinks may not work with Next.js static export depending on the build tool. A build script or CI step that copies the file before `next build` may be more reliable

- [ ] **Add footer links**
  - File: `sites/landing/` (footer component)
  - Action: Links to: docs.clawperator.com, GitHub repo, npm package

- [ ] **Add `sites/landing/.gitignore`**
  - File: `sites/landing/.gitignore` (new)
  - Action: Exclude build artifacts: `node_modules/`, `.next/`, `out/`

- [ ] **Test local build**
  - Action: `cd sites/landing && npm install && npm run build` - verify `out/` directory is generated and `out/install.sh` exists

- [ ] **[HUMAN] Deploy to Cloudflare Pages**
  - Action: Create Pages project, configure build command (`cd sites/landing && npm install && npm run build`), output directory (`sites/landing/out`), configure custom domains `clawperator.com` and `www.clawperator.com`

### Implementation Notes

- The monorepo does not currently have a `sites/` directory. Create it along with a `.gitignore` for `node_modules/` and `.next/` inside the subdirectory
- Next.js static export generates a fully static site in `out/` - no server-side rendering
- Cloudflare Pages auto-detects Next.js but may need manual build config for subdirectory builds

### Dependencies

- Phase 2 (install script) must be complete before the landing page can serve it
- DNS propagation can take up to 24 hours after Cloudflare configuration

### Concerns

- Symlinks in `public/` may not survive `next build`. Prefer a pre-build copy step or a build script
- The Peekaboo template license must be reviewed before use

---

## Phase 4: Documentation Site (docs.clawperator.com)

### Objective

Comprehensive documentation site using MkDocs Material, deployed at docs.clawperator.com.

### Tasks

- [ ] **Initialize MkDocs project in `/sites/docs/`**
  - File: `sites/docs/` (new directory)
  - Action: Create directory structure:
    ```
    sites/docs/
    ├── mkdocs.yml
    ├── requirements.txt
    └── docs/
        └── (migrated content)
    ```
  - Action: `requirements.txt` contents: `mkdocs-material>=9.0`, `mkdocs>=1.5`

- [ ] **Create `mkdocs.yml`**
  - File: `sites/docs/mkdocs.yml` (new)
  - Action: Configure with:
    - `site_name: Clawperator Docs`
    - `site_url: https://docs.clawperator.com`
    - Material theme with navigation, search, code highlighting
    - Navigation structure:
      - Getting Started (first-time-setup.md, architecture.md)
      - For AI Agents (node-api-for-agents.md)
      - Skills (skill-design.md, operator-llm-playbook.md)
      - CLI Reference (derived from `clawperator --help`)
      - Troubleshooting (troubleshooting.md, known-issues.md, crash-logs.md)
      - Architecture / Design (design/ subdirectory)

- [ ] **Migrate content from `/docs/`**
  - Action: Copy (not move) the following to `sites/docs/docs/`:
    - `docs/architecture.md`
    - `docs/troubleshooting.md`
    - `docs/known-issues.md`
    - `docs/crash-logs.md`
    - `docs/conformance-apk.md`
    - `docs/first-time-setup.md` (created in Phase 0)
    - `docs/node-api-for-agents.md`
    - `docs/design/` subdirectory (design docs moved in Phase 0)
  - Notes: Keep originals in `docs/` as the source of truth; the docs site mirrors them. Or decide on single source: maintain in `docs/` and reference from `mkdocs.yml` using `docs_dir` pointing at the repo root `docs/` directory - this would avoid duplication

- [ ] **Copy logo**
  - File: `sites/docs/docs/img/clawperator-logo.png`
  - Action: Copy from `docs/img/clawperator-logo.png`

- [ ] **Add `sites/docs/.gitignore`**
  - File: `sites/docs/.gitignore` (new)
  - Action: Exclude build output: `site/`, `.cache/`

- [ ] **Test locally**
  - Action: `cd sites/docs && pip install -r requirements.txt && mkdocs serve`

- [ ] **[HUMAN] Deploy to Cloudflare Pages**
  - Action: Create second Pages project, build command: `cd sites/docs && pip install -r requirements.txt && mkdocs build`, output: `sites/docs/site`, Python version env: `PYTHON_VERSION=3.11`, configure custom domain `docs.clawperator.com`

### Implementation Notes

- MkDocs `docs_dir` can point outside the `sites/docs/` directory. Setting `docs_dir: ../../docs` in `mkdocs.yml` would avoid duplicating markdown files. This is cleaner than copying files
- The Material theme search plugin is included by default with `mkdocs-material`
- Add `use_directory_urls: true` in `mkdocs.yml` for clean URLs

### Dependencies

- Phase 0 (documentation tightening) should be complete so migrated content is clean
- `docs/first-time-setup.md` (Phase 0) must exist before it can be included in the nav

### Concerns

- MkDocs Material vs MkDocs base: the release plan specifies `mkdocs-material`. Ensure the theme is installed from `requirements.txt`, not assumed to be global
- The `docs_dir` pointing outside the MkDocs project root may cause issues with some MkDocs plugins - test before deploying

---

## Phase 5: Skills Installation (CLI Integration)

### Objective

Make `clawperator skills install` and `clawperator skills update` work by cloning the `clawperator-skills` repo to `~/.clawperator/skills/`.

### Tasks

- [ ] **Implement `syncSkills` domain service**
  - File: `apps/node/src/domain/skills/syncSkills.ts`
  - Action: Replace the stub implementation with real git clone/pull logic:
    - On first run (directory does not exist): `git clone <skills-repo-url> ~/.clawperator/skills/`
    - On subsequent runs (directory exists): `git -C ~/.clawperator/skills/ pull`
    - Support optional `ref` param to checkout a specific git ref after clone
  - Notes: `syncSkills` does not receive `RuntimeConfig` (it currently takes only a `ref: string`). Use `child_process.execFile` (or `execa` if already a dep) directly for the git commands - this is a setup utility, not an execution path, so using `ProcessRunner` would require threading unnecessary context through. Current stub at `apps/node/src/domain/skills/syncSkills.ts:16` returns `ok: true, synced: false` - replace the body. Expand the return type interfaces to cover failure cases

- [ ] **Add `skills install` and `skills update` subcommands to CLI**
  - File: `apps/node/src/cli/index.ts`
  - Action: Wire up two new subcommand branches in the `skills` command handler:
    - `skills install` - calls `syncSkills` with default ref, prints the `CLAWPERATOR_SKILLS_REGISTRY` env var instruction
    - `skills update` - calls `syncSkills` with `--ref` if provided, pulls latest
  - Notes: The CLI index currently handles `skills list`, `skills get`, `skills compile-artifact`, and `skills sync`. The new `install` and `update` subcommands should be added alongside. `skills install` is the user-facing "first time setup" command; `skills update` is for keeping skills current

- [ ] **Add `cmdSkillsInstall` and `cmdSkillsUpdate` to `skills.ts` command module**
  - File: `apps/node/src/cli/commands/skills.ts`
  - Action: Add two exported functions following the existing pattern (`cmdSkillsList`, `cmdSkillsGet`, etc.). Both delegate to `syncSkills` from `domain/skills/syncSkills.ts`

- [ ] **Update CLI help text**
  - File: `apps/node/src/cli/index.ts`
  - Action: Add `skills install` and `skills update` to the `HELP` constant

- [ ] **Update install script to run `clawperator skills install`**
  - File: `scripts/install.sh`
  - Action: After `npm install -g clawperator@alpha`, add `clawperator skills install` call. This replaces the manual `git clone` step for skills

- [ ] **Validate skills-registry.json after clone**
  - File: `apps/node/src/domain/skills/syncSkills.ts`
  - Action: After a successful clone, verify that `skills-registry.json` exists at the expected path and contains valid JSON before returning `ok: true`. If the file is missing or malformed, return an error - this catches partial clones or wrong repo URL early

- [ ] **Build and test**
  - Action: `npm --prefix apps/node run build && npm --prefix apps/node run test`
  - Action: Manually test: `clawperator skills install`, `clawperator skills list`, `clawperator skills update`

### Implementation Notes

- **The CLI does NOT use Commander or any arg-parsing library.** It uses a custom parser in `src/cli/index.ts`. All new subcommands (`skills install`, `skills update`) must follow the existing pattern: add a branch in the `skills` dispatcher block in `index.ts` and add an exported `cmdSkills*` function in `commands/skills.ts`. Do not introduce Commander or another framework
- The `syncSkills` function signature already takes a `ref: string` parameter - this can stay as-is with a default of `"main"` or `"latest"`
- The skills repo URL should be a constant, probably in `localSkillsRegistry.ts` or a new `skillsConfig.ts` - avoid hardcoding in multiple places
- The `CLAWPERATOR_SKILLS_REGISTRY` path after install is `~/.clawperator/skills/skills-registry.json` (assuming registry is at repo root) - `cmdSkillsInstall` should print the exact export command the user needs to add to their shell
- The `SyncSkillsResult` / `SyncSkillsError` return types in `syncSkills.ts` need to be expanded to cover real failure modes: git not found on host, network/auth failure during clone, pull conflict. Add appropriate error codes or use existing ones (e.g., `HOST_DEPENDENCY_MISSING` for git not found)

### Dependencies

- Phase 1 (npm publish) should be complete so `npm install -g clawperator@alpha` works in the install script
- The `clawperator-skills` repo must be accessible (public or via token)
- `git` must be on the host PATH

### Concerns

- `ProcessRunner` is designed around the `RuntimeConfig` / adb context. For host-level git commands, `syncSkills` can use `child_process.execFile` directly (or import a minimal helper) rather than trying to thread `RuntimeConfig` through the domain layer. This is an acceptable exception since skills sync is a setup utility, not an execution path
- If the skills repo is private at time of install, the clone step will fail for unauthenticated users. Coordinate with skills repo access

---

## Phase 6: GitHub Release Workflow

### Objective

Automated APK and npm publishing on version tags via GitHub Actions.

### Tasks

- [ ] **Verify Gradle APK task path**
  - Action: Before writing the workflow, confirm the correct Gradle task path for building the APK. The existing `pull-request.yml` uses `./gradlew unitTest` (a root-level alias). The `wip-plan.md` draft suggests `:apps:android:app:assembleRelease` - check `settings.gradle.kts` to confirm this is the correct full module path. The settings file is authoritative
  - Notes: Getting this wrong silently passes (the task is skipped) or fails with "Task not found"

- [ ] **Create `/.github/workflows/release-apk.yml`**
  - File: `.github/workflows/release-apk.yml` (new)
  - Action: Workflow triggered by `v*` tags. Steps:
    1. Checkout code
    2. Setup JDK 17 (Temurin) - matches existing `pull-request.yml`
    3. Run verified Gradle APK build task
    4. Create GitHub Release using `softprops/action-gh-release` action (simpler than `actions/create-release` which is deprecated)
    5. Attach APK from `apps/android/app/build/outputs/apk/`
    6. Include installation instructions in release body (link to `docs/first-time-setup.md`)
    7. Set `prerelease: true` when tag contains `alpha` or `beta`
  - Notes: The existing `pull-request.yml` uses `ubuntu-latest` and JDK 17 - follow the same runner config. `GITHUB_TOKEN` is automatically available in Actions workflows - no manual secret needed for creating the release itself

- [ ] **Create `/.github/workflows/publish-npm.yml`**
  - File: `.github/workflows/publish-npm.yml` (new)
  - Action: Workflow triggered by `v*` tags. Steps:
    1. Checkout code
    2. Setup Node.js 22 (using `actions/setup-node` with `registry-url: https://registry.npmjs.org`)
    3. `npm --prefix apps/node ci`
    4. `npm --prefix apps/node run build`
    5. `npm --prefix apps/node run test`
    6. Detect alpha/beta from tag name and set `--tag alpha` or `--tag latest` accordingly
    7. `npm publish --prefix apps/node --access public --tag <detected>`
  - Notes: Requires `NPM_TOKEN` secret. Set `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` in the environment block. For tags like `v0.1.0-alpha.1`, publish with `--tag alpha` so it doesn't become the default install target. For stable tags like `v1.0.0`, use `--tag latest`

- [ ] **[HUMAN] Add `NPM_TOKEN` to GitHub repository secrets**
  - Action: In GitHub repo settings -> Secrets -> Actions, add `NPM_TOKEN` with value from `npm token create --read-only=false`

- [ ] **Create `/CHANGELOG.md`**
  - File: `CHANGELOG.md` (root, new)
  - Action: Create following Keep a Changelog format. Minimum sections: `[Unreleased]` and `[0.1.0-alpha.1] - YYYY-MM-DD`. The `0.1.0-alpha.1` section should list: initial public alpha release, Node.js CLI with core commands (doctor, devices, execute, observe, action, skills, serve), Android runtime with accessibility-based automation, skills repository integration

- [ ] **Create `/docs/RELEASING.md`**
  - File: `docs/RELEASING.md` (new)
  - Action: Document the release process: how to create a version tag, what the workflows do, how to verify publish succeeded

- [ ] **Test with a test tag**
  - Action: Push a test tag (e.g., `v0.1.0-alpha.1-test`) and verify both workflows trigger and succeed. Delete the tag after verification

### Implementation Notes

- Tag format `v*` will match `v0.1.0-alpha.1`, `v0.2.0`, etc. - follow semver with `v` prefix
- `GITHUB_TOKEN` is automatically injected by Actions for creating releases - no manual secret needed for the APK release job
- `NPM_TOKEN` (manual secret) is only needed for the npm publish job
- APK signing for release builds requires a keystore. For alpha releases, a debug APK may be acceptable. Flag for human decision: release vs debug APK in initial release

### Dependencies

- Phase 1 (npm package metadata) must be complete before `publish-npm.yml` can work
- Gradle APK task path must be verified before writing the workflow
- GitHub repo must be created and accessible

### Concerns

- APK signing: release APKs require a signing keystore stored as GitHub secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, etc.). For alpha, debug APKs may be acceptable but should be clearly labeled in the release
- The `v*` tag pattern will match tags on any branch - consider adding a `branches: [main]` filter or using a `workflow_dispatch` gate for safety
- `npm publish --prefix` may not work as expected in some npm versions - test the command form before relying on it in CI; alternative: `cd apps/node && npm publish`

---

## Phase 7: Fix `clawperator doctor`

### Objective

Doctor should guide users through setup rather than failing immediately. Warnings for non-critical checks, clear next steps, actionable `--fix` behavior.

### Tasks

- [ ] **Introduce severity classification to `DoctorService`**
  - File: `apps/node/src/domain/doctor/DoctorService.ts`
  - Action: Refactor the early-return logic. Currently, `apkPresence.status === "fail"` causes immediate return. Change so that:
    - **Critical** (halt on fail): `checkNodeVersion`, `checkAdbPresence`, `checkAdbServer`
    - **Warning** (continue on fail): `checkApkPresence`, `checkSettings`, `checkDeviceCapabilities`
    - **Info** (always continue): scrcpy checks, skills registry checks
  - Notes: The `DoctorCheckResult.status` type already includes `"warn"` (`"pass" | "warn" | "fail"` in `contracts/doctor.ts:3`). The key change is that `DoctorService` no longer returns early when a warning-level check fails

- [ ] **Update `checkApkPresence` to return `warn` instead of `fail`**
  - File: `apps/node/src/domain/doctor/checks/readinessChecks.ts`
  - Action: Change `status: "fail"` to `status: "warn"` for the `RECEIVER_NOT_INSTALLED` case. Update the `fix` steps to include a link to GitHub Releases for APK download instead of `./gradlew :apps:android:app:installDebug` (which won't work for end users)
  - Notes: Current fix step at `readinessChecks.ts:45` references the Gradle build command - this is only valid for developers with the source, not end users who installed via npm

- [ ] **Improve doctor output formatting**
  - File: `apps/node/src/cli/commands/doctor.ts`
  - Action: Group checks by severity in pretty-print output. Show icons: `[OK]` / `[WARN]` / `[FAIL]`. Ensure each non-pass check includes its `fix` steps in the output

- [ ] **Implement `--check-only` flag**
  - File: `apps/node/src/cli/index.ts` and `apps/node/src/cli/commands/doctor.ts`
  - Action: Add `--check-only` flag that runs all checks but always exits with code 0 regardless of outcome (for use in CI/automation that should not fail on warnings). Note: `--json` already exists as an alias for `--output json` in the CLI help text - it does not need to be added. `--check-only` is a distinct flag about exit code behavior, not output format

- [ ] **Add "what's next" guidance on full pass**
  - File: `apps/node/src/domain/doctor/DoctorService.ts`
  - Action: When all critical checks pass and APK is installed and handshake succeeds, set `nextActions` to point to first-time-setup doc and suggest running `clawperator observe snapshot`

- [ ] **Handle handshake gracefully when APK is not installed**
  - File: `apps/node/src/domain/doctor/DoctorService.ts`
  - Action: If APK presence check returned `warn` (not installed), skip the handshake check entirely rather than attempting it and timing out. The handshake requires the APK

- [ ] **Update error code for APK fix step URL**
  - File: `apps/node/src/domain/doctor/checks/readinessChecks.ts`
  - Action: The fix step should reference the GitHub Releases URL: `https://github.com/clawpilled/clawperator/releases/latest`

- [ ] **Build and test**
  - Action: `npm --prefix apps/node run build && npm --prefix apps/node run test`
  - Action: Run `./scripts/test_doctor.sh` to validate doctor behavior

### Implementation Notes

- The `DoctorReport.ok` field currently reflects "all checks passed." After this change, `ok: true` should mean "all critical checks passed" (not necessarily warnings). This is a semantic change that affects agent consumers - document it
- The `finalize` method in `DoctorService` currently collects `nextActions` from all failed checks. After the change, it should distinguish critical failures (halt guidance) from warnings (here's what to do next, but you can still continue)
- `--fix` flag is already wired in `DoctorService.run()` options and `finalize()`. The current implementation tries to run shell fix steps automatically. This is fine to keep as-is; just ensure it works for the new warning-level checks

### Dependencies

- Should be done before or alongside Phase 8 (version compatibility), since Phase 8 adds a new doctor check

### Concerns

- Changing `ok` semantics in `DoctorReport` is a breaking change for anything that consumes the JSON output. If agents are checking `report.ok`, they may need to be updated. Consider adding a `criticalOk` boolean alongside `ok` for backward compatibility, or document the semantic change clearly in CHANGELOG

---

## Phase 8: Version Compatibility & Handshaking

### Objective

Ensure Node API and Android APK versions are explicitly checked and mismatches caught early with clear remediation.

### Tasks

- [ ] **Create `docs/compatibility.md`**
  - File: `docs/compatibility.md` (new)
  - Action: Document the compatibility matrix. Rule: `major.minor` of Node CLI must match `major.minor` of APK; patch is flexible. Include a table matching the existing README compatibility matrix and expand it

- [ ] **Add version error codes**
  - File: `apps/node/src/contracts/errors.ts`
  - Action: Add to the `ERROR_CODES` const object (not an enum - the existing code uses `export const ERROR_CODES = { ... } as const` pattern, which must be preserved):
    ```typescript
    VERSION_MISMATCH: "VERSION_MISMATCH",
    APK_VERSION_UNKNOWN: "APK_VERSION_UNKNOWN",
    APK_TOO_OLD: "APK_TOO_OLD",
    ```
  - Notes: `VERSION_INCOMPATIBLE` and `NODE_TOO_OLD` already exist in the const. Add only the genuinely missing codes. Avoid renaming or converting to enum - the `ErrorCode` type is derived from the const via `typeof ERROR_CODES[keyof typeof ERROR_CODES]`

- [ ] **Implement APK version query**
  - File: `apps/node/src/domain/doctor/checks/deviceChecks.ts` or new `versionChecks.ts`
  - Action: Query APK version via `adb shell dumpsys package <receiverPackage>` and parse `versionName` from the output. Parse with a regex: `/versionName=([^\s]+)/`. Compare with Node CLI version from `package.json`
  - Notes: `apps/node/package.json` version is accessible at runtime via `createRequire(import.meta.url)('../package.json')` - this pattern is already used in `src/cli/index.ts` for `--version`. The `versionName` from Android may include pre-release suffixes like `0.1.0-alpha.1` - the comparison logic must strip pre-release suffixes before comparing major.minor, or use a semver library. Do NOT read version from the result envelope - the `ResultEnvelope` contract does not include a `runtimeVersion` field
  - **Important:** APK version comes from `adb shell dumpsys package` only, not from any handshake response payload

- [ ] **Add version check to `DoctorService`**
  - File: `apps/node/src/domain/doctor/DoctorService.ts`
  - Action: After APK presence check passes, add a version compatibility check. Return `warn` for minor mismatches, `fail` for major mismatches

- [ ] **Create `clawperator version --check-compat` command**
  - File: `apps/node/src/cli/index.ts`
  - Action: Add a `version` command branch to the CLI dispatcher (currently `--version` is a global flag, not a subcommand). The `version` subcommand with no args should print the current CLI version; `version --check-compat` should additionally query the APK version and report compatibility. Follow the same custom CLI dispatch pattern as all other commands - no Commander

- [ ] **Enhance handshake in `runExecution` to verify versions**
  - File: `apps/node/src/domain/executions/runExecution.ts`
  - Action: Before dispatching execution, optionally check APK version compatibility. This could be a lightweight check (just version query, no full doctor run). Respect a config flag to disable for performance

- [ ] **Update troubleshooting docs**
  - File: `docs/troubleshooting.md`
  - Action: Add a "Version Compatibility" section describing version mismatch symptoms, how to check versions, and remediation steps

- [ ] **Build and test**
  - Action: `npm --prefix apps/node run build && npm --prefix apps/node run test`
  - Action: Test mismatch scenario by temporarily altering the version comparison logic

### Implementation Notes

- `adb shell dumpsys package` output format: `versionName=0.1.0` or `versionName=0.1.0-alpha.1`. Parse with regex `/versionName=([^\s]+)/`
- Pre-release suffixes (`-alpha.1`, `-beta.2`) must be stripped or handled before semver comparison - compare only `major.minor.patch` components for the compatibility check
- The `--version` global flag in the CLI already uses `createRequire` to read `package.json` version - use the same pattern in the version check implementation. The new `version` subcommand should coexist with the existing `--version` flag (they can do the same thing when the subcommand has no other flags)
- The handshake pre-check for version compatibility in `runExecution` should be off by default or a lightweight path to avoid adding latency to every execution

### Dependencies

- Phase 7 (doctor improvements) should be done first so the version check integrates cleanly with the updated severity model
- APK must be installed on device to query its version

### Concerns

- `adb shell dumpsys package` is a relatively slow operation (~200-500ms) - consider caching the result per session if added to execution path
- The Android APK `versionName` must be kept in sync with the Node `package.json` version - this is a process discipline issue. The release workflow (Phase 6) should enforce this or at minimum document it
- `NODE_TOO_OLD` already exists in error codes - check if it conflicts with the new `APK_TOO_OLD` / `VERSION_MISMATCH` codes in terms of semantic meaning

---

## Cross-Phase Concerns & Blockers

### Human Decision Points

These items require explicit human decisions before implementation can proceed:

## Human Decisions (Confirmed)

1. npm package name: `clawperator` ✓
2. GitHub org: `github.com/clawpilled/clawperator` ✓
3. Skills repo: `github.com/clawpilled/clawperator-skills` ✓
4. APK signing: Debug APKs for alpha ✓
5. `DoctorReport.ok` change: Acceptable, document in CHANGELOG ✓

### Testing Gaps

- No automated test for `skills install` / `skills update` (Phase 5 adds stub replacement but no tests)
- No automated test for version compatibility check (Phase 8)
- Doctor behavior under various partial-setup states is not covered by unit tests - `test_doctor.sh` covers some scenarios but needs expansion for new warning-level flows
- Install script requires manual VM testing (no CI automation for this)

### Potential Breaking Changes

- Phase 7: `DoctorReport.ok` semantic change
- Phase 5: `syncSkills` return type changes from always-stubbed to real git operation - existing callers need to handle new failure modes (git not found, network errors, auth errors)
- Phase 8: Any `runExecution` version pre-check adds latency and a new failure mode

### Missing Dependencies

- `git` must be installed on the host for `skills install` to work (Phase 5). The install script should check for `git` and install if missing
- Python 3.11 required for MkDocs (Phase 4) - the Cloudflare Pages environment variable handles this, but local dev needs a Python install
- Cloudflare account and Pages setup is gated on human action (Phases 3, 4)

### Deferred Items (Not in This Roadmap)

Per release plan, these are explicitly post-release:
- `--safe-logs` flag (currently in `v1-todo.md` as pending)
- Animated GIF demos / video walkthrough
- Discord server, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- CI for skills repo validation
- Comprehensive integration tests
- `execute best-effort --goal` (listed as "NOT IMPLEMENTED Stage 1" in CLI help)
