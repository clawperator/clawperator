# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow Semantic Versioning.

## [0.5.2] - 2026-03-28
This release unifies Node logging and strengthens skill-run diagnostics: shared output assertions, full NDJSON capture of skill child output, a new `logs` command, and expanded documentation. Release automation now attaches the changelog to GitHub Releases.

### 🤖 Node API & CLI
- **Fixed:** Routed skill output assertions through `runSkill` so CLI and HTTP skill runs share the same validation path and structured failure responses.
- **Changed:** Replaced ad hoc logging with a unified typed logger that emits NDJSON events for CLI, skills, execution, doctor, and serve, including skill child-process stdout and stderr in log files.
- **Added:** Added the `logs` command for streaming and filtering Clawperator log output.

### 📚 Documentation & Website
- **Changed:** Updated the install script, compatibility guidance, and generated llms bundles for the published 0.5.1 artifacts.
- **Added:** Added logging API reference material and cross-links from setup, skills runtime, and troubleshooting guides.

Pull requests:
- [task: plan release notes task](https://github.com/clawperator/clawperator/pull/128)
- [Update release-notes-author guidance](https://github.com/clawperator/clawperator/pull/129)
- [docs(changelog): update for all historical releases](https://github.com/clawperator/clawperator/pull/130)
- [feat(release): include CHANGELOG in GitHub Release body](https://github.com/clawperator/clawperator/pull/131)
- [feat(release): changelog includes PRs](https://github.com/clawperator/clawperator/pull/132)
- [Fix skill output assertions in the shared runSkill path](https://github.com/clawperator/clawperator/pull/133)
- [Add repo-local task-author skill for executable task packs](https://github.com/clawperator/clawperator/pull/134)
- [task: create unified logging plan](https://github.com/clawperator/clawperator/pull/135)
- [fix(ci): enforce commit attribution policy in PR workflows](https://github.com/clawperator/clawperator/pull/137)
- [feat(node): unify CLI, skill, doctor, and serve logging](https://github.com/clawperator/clawperator/pull/139)
- [feat(logging): complete unified logging migration and finalize docs](https://github.com/clawperator/clawperator/pull/140)

## [0.5.1] - 2026-03-26
Documentation led this release, with the public site and release guidance refreshed around the published 0.5.0 artifacts. Node also picked up timeout and doctor recovery guidance so version mismatches are easier to diagnose.

### 🤖 Node API & CLI
- **Changed:** Added docsUrl-based recovery guidance to doctor checks and CLI output.
- **Changed:** Refreshed the Node package README to match the docs cleanup pass.
- **Changed:** Added version-compatibility guidance to timeout failures in runtime execution and doctor checks.

### 📚 Documentation & Website
- **Changed:** Updated the install guidance and release procedure docs to match the published 0.5.0 artifacts.
- **Changed:** Moved the old recording-based skill out of the docs tree as part of the refactor cleanup.
- **Changed:** Replaced the docs publishing path with a deterministic build pipeline and regenerated the staged docs outputs.
- **Changed:** Replaced the core placeholder docs with code-verified reference content for setup, API, doctor, and serve.
- **Changed:** Expanded the refactored API, skills, and troubleshooting docs with the new reference content.
- **Changed:** Cleaned up the remaining docs surface and refreshed the published install artifacts.
- **Changed:** Added timeout version guidance to the API, setup, and troubleshooting docs.

Pull requests:
- [task: create docs refactor plan/tasks](https://github.com/clawperator/clawperator/pull/119)
- [docs: complete phase-2 docs surfaces and doctor links](https://github.com/clawperator/clawperator/pull/121)
- [Refactor phase 3 agent docs for API, skills, and troubleshooting coverage](https://github.com/clawperator/clawperator/pull/122)
- [chore(docs-refactor): finalize PR-4 cleanup](https://github.com/clawperator/clawperator/pull/123)
- [docs(tasks): update docs-build regeneration reference in agent-ui-loop plan](https://github.com/clawperator/clawperator/pull/124)
- [node: Add timeout version guidance](https://github.com/clawperator/clawperator/pull/125)
- [Add zero-shot Android exploration skill](https://github.com/clawperator/clawperator/pull/126)
- [chore(task): cleanup](https://github.com/clawperator/clawperator/pull/127)

## [0.5.0] - 2026-03-24
Breaking CLI changes led this release, centered on a flat, registry-driven Node command surface and a much broader command set. The docs and site were rewritten alongside the refactor so the public reference now matches the shipped API and terminology.

### 🤖 Node API & CLI
- **Breaking:** **Changed:** Flattened the CLI into top-level commands and registry-driven dispatch, replacing the nested command tree.
- **Breaking:** **Changed:** Required `--json` for `read --all` while adding `scroll-until`, `close`, `sleep`, `wait-for-nav`, `read-value`, `wait --timeout`, and aligned `exec` payload handling.
- **Changed:** Added selector and container flags for device queries and scroll/read commands.
- **Changed:** Renamed receiver-package terminology to `operatorPackage` across the CLI, runtime, docs, and scripts while keeping the legacy flag accepted as an alias.
- **Added:** Added live skills-run progress output and persistent NDJSON lifecycle logging.
- **Breaking:** **Changed:** Renamed the Google Home aircon skill to `get-climate` and updated the generated skill fixtures and docs to the new name.

### 📚 Documentation & Website
- **Changed:** Updated the 0.4.0 release guidance and install script to match the published artifacts.
- **Changed:** Refreshed the skill migration notes and added Node API design guidance for the API refactor.
- **Changed:** Rewrote the API reference and site docs around the flat command surface, selector flags, extended commands, `exec` payload alignment, and `operatorPackage` terminology.
- **Changed:** Documented live skills-run output and persistent logging behavior across the agent guides and troubleshooting pages.
- **Breaking:** **Changed:** Renamed the Google Home aircon skill to `get-climate` across docs and generated site artifacts.

Pull requests:
- [Release/v.0.4.0](https://github.com/clawperator/clawperator/pull/99)
- [docs: mark PRD-3.5 done](https://github.com/clawperator/clawperator/pull/100)
- [skills: progress visibility during skills run](https://github.com/clawperator/clawperator/pull/101)
- [docs(tasks): add PRD-5.5 for skill progress logging](https://github.com/clawperator/clawperator/pull/102)
- [feat(node): Persistent logging for lifecycle events](https://github.com/clawperator/clawperator/pull/103)
- [Add skill progress logging and regression coverage](https://github.com/clawperator/clawperator/pull/104)
- [chore(skills): rename google home aircon skill to climate](https://github.com/clawperator/clawperator/pull/105)
- [Reorganize API refactor tasks and add design guiding principles](https://github.com/clawperator/clawperator/pull/106)
- [refactor(cli): implement registry-driven command dispatch](https://github.com/clawperator/clawperator/pull/107)
- [refactor: rename receiverPackage to operatorPackage throughout codebase](https://github.com/clawperator/clawperator/pull/108)
- [refactor(node, docs)!: use flat command surface](https://github.com/clawperator/clawperator/pull/109)
- [feat: Phase 3 selector flags and container flags implementation](https://github.com/clawperator/clawperator/pull/110)
- [feat: Phase 5A extended CLI commands (scroll-until, close, sleep, --long/--focus, wait --timeout, read --all)](https://github.com/clawperator/clawperator/pull/111)
- [feat: Phase 5C API refactor - container-scoped read_text](https://github.com/clawperator/clawperator/pull/112)
- [feat(api): Phase 5B extended commands - wait-for-nav, read-value, exec alignment](https://github.com/clawperator/clawperator/pull/114)
- [Update the Node API for the final refactor phase](https://github.com/clawperator/clawperator/pull/117)

## [0.4.0] - 2026-03-22
This release improved pre-flight validation and debugging visibility for executions and skills runs, and refreshed documentation around Operator APK readiness, doctor checks, and error handling.

### 🤖 Node API & CLI
- **Added:** Added `skills validate --dry-run` and made `skills run` use it as a default preflight gate, with `--skip-validate` as an explicit escape hatch.
- **Added:** Added semantic action context to execution validation failures and timeout errors, including offending action identifiers/types, invalid keys, migration hints, and timeout correlation details.
- **Changed:** Clarified Node developer ownership and contribution guidance by updating LICENSE attribution and adding a `CONTRIBUTING.md` entry.
- **Fixed:** Fixed Operator readiness and version-check behavior so missing Operator APKs fail fast during `execute`, doctor reports missing APKs as blocking failures while keeping variant mismatches as warnings, and versioned remediation URLs are surfaced during setup.

### 📚 Documentation & Website
- **Changed:** Updated the Android Operator APK setup, compatibility, and release-procedure documentation to match the published 0.3.2 artifacts.
- **Changed:** Updated doctor and compatibility documentation to reflect the new shared APK presence pre-flight, normalized CLI/APK version matching rules, and the revised doctor remediation step order.
- **Changed:** Refreshed the Node API error-handling docs to match the enriched validation and timeout error details.
- **Changed:** Updated the Node API agent guide and skills workflow docs to document `skills validate --dry-run` and the default `skills run` gating behavior.
- **Fixed:** Fixed docs website meta tag fallbacks.

Pull requests:
- [chore(build): set code version to 0.3.2](https://github.com/clawperator/clawperator/pull/92)
- [fix(site): docs meta tag fallbacks](https://github.com/clawperator/clawperator/pull/93)
- [chore: update ownership to Action Launcher Pty Ltd](https://github.com/clawperator/clawperator/pull/94)
- [docs(tasks): add comprehensive agent usage documentation](https://github.com/clawperator/clawperator/pull/95)
- [Fix readiness gating and exact version compatibility for Operator APKs](https://github.com/clawperator/clawperator/pull/96)
- [node: enrich execution error context](https://github.com/clawperator/clawperator/pull/97)
- [feat(skills): add dry-run preflight gate](https://github.com/clawperator/clawperator/pull/98)

## [0.3.2] - 2026-03-20
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.
- **Fixed:** Fixed Android runtime issues affecting gesture, action, or observation reliability.

Pull requests:
- [fix(site): refine landing page mobile nav and footer](https://github.com/clawperator/clawperator/pull/69)
- [Use favicon for sites](https://github.com/clawperator/clawperator/pull/71)
- [docs: comprehensive documentation and skills framework updates](https://github.com/clawperator/clawperator/pull/70)
- [fix(android): implement screen dimension detection in UiTreeInspectorAndroid](https://github.com/clawperator/clawperator/pull/72)
- [fix(operator): resolve scroll_until + clickAfter miss on EDGE_REACHED](https://github.com/clawperator/clawperator/pull/73)
- [feat(operator+node): PR-2 action primitives - wait_for_navigation, read_key_value_pair, extended validators](https://github.com/clawperator/clawperator/pull/74)
- [Add docs source of truth guardrails](https://github.com/clawperator/clawperator/pull/75)
- [fix(node): improve first-run diagnostics and DX](https://github.com/clawperator/clawperator/pull/76)
- [docs: add multi-device troubleshooting; detect installed APK](https://github.com/clawperator/clawperator/pull/77)
- [feat(node): payload authoring ergonomics (--dry-run, matcher normalisation)](https://github.com/clawperator/clawperator/pull/78)
- [feat(skills): skills new scaffolding with --summary, run.sh shim, and skills run envelope docs](https://github.com/clawperator/clawperator/pull/79)
- [chore: final run checks — regenerate cli-reference and close out agent-first-run tasks](https://github.com/clawperator/clawperator/pull/81)
- [docs(tasks): add record and replay PRD and strategy](https://github.com/clawperator/clawperator/pull/82)
- [feat(record): add android runtime recording](https://github.com/clawperator/clawperator/pull/83)
- [feat(node, docs): recording retrieval, parsing and validation](https://github.com/clawperator/clawperator/pull/84)
- [docs(record): complete phase 3 recording-to-skill workflow](https://github.com/clawperator/clawperator/pull/85)
- [fix(skills): standardize skill env vars and local bin resolution](https://github.com/clawperator/clawperator/pull/86)
- [Remove the legacy install.sh copy step](https://github.com/clawperator/clawperator/pull/87)
- [Fix multi-device installer readiness handling](https://github.com/clawperator/clawperator/pull/89)
- [Update branch CI to run Android and Node tests](https://github.com/clawperator/clawperator/pull/88)
- [Update landing hero image and tighten its panel layout](https://github.com/clawperator/clawperator/pull/90)
- [Add share image metadata to landing and docs sites](https://github.com/clawperator/clawperator/pull/91)

## [0.3.1] - 2026-03-17
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

Pull requests:
- [fix: install flow, doctor URL, skills search UX, and Cloudflare 404 redirects](https://github.com/clawperator/clawperator/pull/68)

## [0.3.0] - 2026-03-16
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.
- **Fixed:** Fixed Android runtime issues affecting gesture, action, or observation reliability.

Pull requests:
- [refactor(skills): replace bundle install with direct GitHub clone](https://github.com/clawperator/clawperator/pull/67)

## [0.2.5] - 2026-03-11
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

Pull requests:
- [chore(version): set to 0.2.4](https://github.com/clawperator/clawperator/pull/49)
- [skills: Add release create/verify workflow](https://github.com/clawperator/clawperator/pull/50)
- [docs(task): Google Play skill exploration and findings](https://github.com/clawperator/clawperator/pull/51)
- [feat(release): split code and published version flows](https://github.com/clawperator/clawperator/pull/52)
- [fix(node): surface snapshot extraction failures as SNAPSHOT_EXTRACTION_FAILED](https://github.com/clawperator/clawperator/pull/53)
- [fix(tests): remove platform-specific SDK paths, fix runtimeConfig tests](https://github.com/clawperator/clawperator/pull/54)
- [docs(geo): improve agent-facing crawl surfaces](https://github.com/clawperator/clawperator/pull/48)
- [docs(node-api): fix all open docs-audit issues (ISSUE-02 through ISSUE-12)](https://github.com/clawperator/clawperator/pull/55)

## [0.2.4] - 2026-03-11
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

Pull requests:
None found

## [0.2.2] - 2026-03-11
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.
- **Fixed:** Fixed Android runtime issues affecting gesture, action, or observation reliability.

Pull requests:
- [fix(install): clarify post-install shell reload covers skills registry](https://github.com/clawperator/clawperator/pull/39)
- [docs: replace placeholder docs with current-state agent-facing docs](https://github.com/clawperator/clawperator/pull/40)
- [apps/node: add Android emulator provisioning support](https://github.com/clawperator/clawperator/pull/41)
- [Update docs for emulator](https://github.com/clawperator/clawperator/pull/42)
- [llms-full.txt generation](https://github.com/clawperator/clawperator/pull/43)
- [fix(node-api): canonicalize snapshot contract](https://github.com/clawperator/clawperator/pull/44)
- [feat(site): improve agent-facing crawl surfaces](https://github.com/clawperator/clawperator/pull/46)

## [0.2.1] - 2026-03-09
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.
- **Fixed:** Fixed Android runtime issues affecting gesture, action, or observation reliability.

Pull requests:
- [feat: serve skills as git bundle from clawperator.com](https://github.com/clawperator/clawperator/pull/33)
- [docs: remove GitHub skills refs, clean up interim docs, update bootstrap guide](https://github.com/clawperator/clawperator/pull/34)

## [0.2.0] - 2026-03-09
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

Pull requests:
- [sites: update](https://github.com/clawperator/clawperator/pull/12)
- [feat(installer): improve install.sh and align docs with live APK flow](https://github.com/clawperator/clawperator/pull/13)
- [feat(landing): refresh copy and design and align install script builds](https://github.com/clawperator/clawperator/pull/15)
- [feat(skills): add skills API integration layer for discovery, search, run, and install](https://github.com/clawperator/clawperator/pull/16)
- [docs(site): regenerate public docs for skills API integration](https://github.com/clawperator/clawperator/pull/17)
- [feat(landing): add Skills and Workflows sections to landing page](https://github.com/clawperator/clawperator/pull/18)
- [docs: point blocked terms policy to user config](https://github.com/clawperator/clawperator/pull/19)
- [node: refresh doctor severity flow](https://github.com/clawperator/clawperator/pull/20)
- [docs: clean up stale planning/docs and align remaining readiness tasks](https://github.com/clawperator/clawperator/pull/21)
- [feat(site): add system light mode to landing and docs](https://github.com/clawperator/clawperator/pull/23)
- [docs: restore mkdocs-terminal and keep system light mode](https://github.com/clawperator/clawperator/pull/24)
- [fix(node): compatibility version regex and get cli version](https://github.com/clawperator/clawperator/pull/22)
- [fix(landing): clawperator skills registry and git terminal prompt](https://github.com/clawperator/clawperator/pull/25)
- [chore(landing): update documentation and adjust developer tooling](https://github.com/clawperator/clawperator/pull/26)
- [feat(docs): update docs](https://github.com/clawperator/clawperator/pull/28)
- [fix(docs): disable npm provenance for private repo publish](https://github.com/clawperator/clawperator/pull/29)
- [fix(docs): restore id-token: write for npm trusted publishing auth and disable npm](https://github.com/clawperator/clawperator/pull/30)

## [0.1.4] - 2026-03-06
This release focused on packaging and release metadata updates, with no user-facing source changes detected in the tagged range.

Pull requests:
None found

## [0.1.3] - 2026-03-06
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.

Pull requests:
- [release: add Android APK GitHub and Cloudflare release pipeline](https://github.com/clawperator/clawperator/pull/9)

## [0.1.2] - 2026-03-06
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.

Pull requests:
None found

## [0.1.1] - 2026-03-06
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

Pull requests:
None found

## [0.1.0] - 2026-03-06
### Added

- Initial public release.
- Node.js CLI with core commands for `doctor`, `devices`, `execute`, `observe`, `action`, `skills`, and `serve`.
- Android runtime with accessibility-based automation.
- Skills repository integration.

Pull requests:
None found

## [0.1.0-alpha.2] - 2026-03-06
This release delivered Node API and CLI reliability improvements, documentation and website refreshes, and Android runtime updates. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.
- **Fixed:** Fixed reliability issues in execution, diagnostics, and command handling paths.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.
- **Fixed:** Fixed documentation and website issues that affected installation or discoverability.

### 📱 Android Operator APK
- **Added:** Added Android operator/runtime capabilities to support new automation flows.
- **Changed:** Updated Android runtime paths to align with the current Node and contract behavior.
- **Fixed:** Fixed Android runtime issues affecting gesture, action, or observation reliability.

Pull requests:
- [fix(test): Add missing DeveloperOptionsManager to UiActionEngineDefaultTest](https://github.com/clawperator/clawperator/pull/7)
