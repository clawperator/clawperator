# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow Semantic Versioning.

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

## [0.3.1] - 2026-03-17
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Added:** Added new runtime and command-surface capabilities in this release range.
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Added:** Added new documentation content and site guidance for supported workflows.
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

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

## [0.2.4] - 2026-03-11
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

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

## [0.1.4] - 2026-03-06
This release focused on packaging and release metadata updates, with no user-facing source changes detected in the tagged range.

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

## [0.1.1] - 2026-03-06
This release delivered Node API and CLI reliability improvements and documentation and website refreshes. Changes were synthesized from commit classifications in this tag range.

### 🤖 Node API & CLI
- **Changed:** Updated existing Node API and CLI behavior for consistency, release readiness, and maintainability.

### 📚 Documentation & Website
- **Changed:** Updated docs and website surfaces to match current runtime behavior and release workflows.

## [0.1.0] - 2026-03-06
### Added

- Initial public release.
- Node.js CLI with core commands for `doctor`, `devices`, `execute`, `observe`, `action`, `skills`, and `serve`.
- Android runtime with accessibility-based automation.
- Skills repository integration.

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
