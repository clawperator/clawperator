# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow Semantic Versioning.

## [0.9.1] - 2026-04-27

This release makes the framed `SkillResult` contract stricter at parse time by requiring a `result` field whenever framed output is validated.

### 🤖 Node API & CLI
- **Breaking:** **Changed:** Tightened framed `SkillResult` validation so `result` is required in TypeScript and Zod (use `null` when there is no truthful domain value); payloads that omit `result` are now rejected at parse time.

Pull requests:
- [feat(node): require SkillResult.result on framed output](https://github.com/clawperator/clawperator/pull/244)

## [0.9.0] - 2026-04-27

This release introduced the canonical SkillResult answer contract and updated the Node CLI and serve API to surface framed skill results directly.

### 🤖 Node API & CLI
- **Added:** Added the canonical `skillResult.result` evidence field and supporting validation so framed skills can emit a direct domain answer alongside checkpoints and terminal verification.
- **Changed:** Updated `skills run` and `POST /skills/:skillId/run` to prefer the framed `skillResult` payload in JSON output when available, while preserving the legacy wrapper fields for unframed runs.

### 📚 Documentation & Website
- **Changed:** Updated the public skills and API docs, bundled skill guidance, and generated agent-ingestion output to describe the canonical SkillResult contract and the new answer surface.

Pull requests:
- [feat(node, skills): add canonical SkillResult result contract](https://github.com/clawperator/clawperator/pull/243)

## [0.8.0] - 2026-04-26

This release introduced the new daemon execution path, which vastly improves operations by routing core Node actions through a transparent daemon and tightening the supporting contracts and docs.

### 🤖 Node API & CLI
- **Added:** Introduced daemon lifecycle commands, Unix socket transport, daemon ownership metadata, version and build identity checks, structured daemon error contracts, and a readiness cache.
- **Changed:** Proxied exec, observe, and flat action commands through the daemon while preserving CLI JSON output, exit-code behavior, operator package selection, and post-dispatch safety boundaries.

### 📚 Documentation & Website
- **Changed:** Added public daemon documentation, generated docs output, and updated skill guidance to reflect the daemon-backed execution flow and its closeout cleanup.

Pull requests:
- [docs(tasks): author daemon implementation task pack](https://github.com/clawperator/clawperator/pull/239)
- [feat(node): add transparent daemon execution proxy](https://github.com/clawperator/clawperator/pull/240)
- [feat(skills): add task implementation prompt skill](https://github.com/clawperator/clawperator/pull/241)
- [fix(node): finalize daemon impl](https://github.com/clawperator/clawperator/pull/242)

## [0.7.8] - 2026-04-26

This release tightens the upgrade guidance around PATH resolution and npm reachability while improving snapshot I/O performance and polishing the landing page example code.

### 🤖 Node API & CLI
- **Changed:** Tightened the `clawperator-upgrade` bundled skill so it resolves PATH explicitly, recovers Homebrew installs by absolute path, and requires npm reachability before using the CLI-first upgrade path.
- **Changed:** Optimized snapshot and logcat handling to stream hierarchy XML from the live logcat result stream, reduce recovery overhead, and keep the `[Clawperator-Result]` envelope contract intact.

### 📚 Documentation & Website
- **Changed:** Synced the `clawperator-upgrade` guidance across CLI help, public docs, generated agent surfaces, and the installed host AGENTS guide.
- **Changed:** Tightened the landing-page example code.

Pull requests:
- [fix(skills): tighten clawperator-upgrade host PATH handling](https://github.com/clawperator/clawperator/pull/236)
- [site: improve demo code on landing page](https://github.com/clawperator/clawperator/pull/237)
- [perf(node): optimize snapshot logcat I/O](https://github.com/clawperator/clawperator/pull/238)

## [0.7.7] - 2026-04-25

This release advances the code version to 0.7.7 and tightens release publishing checks so future releases fail closed when the changelog entry is missing.

Pull requests:
- [fix(release): gate npm publish on changelog entry](https://github.com/clawperator/clawperator/pull/235)

## [0.7.6] - 2026-04-25

This release hardens snapshot extraction so interleaved Android logcat noise no longer contaminates captured hierarchy XML.

### 🤖 Node API & CLI
- **Fixed:** Preserved the parsed logcat tag while assembling snapshot blocks so `snapshot_ui` output no longer absorbs unrelated system lines like `Updating configuration...` into `data.text`.

Pull requests:
- [fix(node): prevent snapshot XML contamination](https://github.com/clawperator/clawperator/pull/234)

## [0.7.5] - 2026-04-24

This release formalizes the JSON-by-default CLI contract across command help, docs, bundled skills, and read workflows so agent integrations can rely on structured output without extra selectors.

### 🤖 Node API & CLI
- **Added:** Allowed `read --all` and `read-value --all` to use the default JSON output mode without requiring `--json`, `--output json`, or `--format json`, while continuing to reject pretty output for multi-result machine-read paths.
- **Changed:** Aligned the main repo with the JSON-by-default CLI/API contract, keeping explicit JSON selectors available while treating `--output json` as the preferred documented selector.
- **Changed:** Updated bundled skill guidance and scaffolding so packaged agent flows assume default structured output and handle multi-device doctor requirements accurately.

### 📚 Documentation & Website
- **Changed:** Refreshed public API, setup, host-agent, troubleshooting, quickstart, skills, and landing-site guidance so examples and command references no longer require optional JSON flags for default structured output.

Pull requests:
- [docs(install): note install status and upgrade multi-device verification](https://github.com/clawperator/clawperator/pull/230)
- [feat(skills): add API agent UX skill for Node API reviews](https://github.com/clawperator/clawperator/pull/231)
- [feat(node, docs): formalize JSON-default CLI output argument](https://github.com/clawperator/clawperator/pull/232)
- [feat(node): all-read commands to use default JSON output](https://github.com/clawperator/clawperator/pull/233)

## [0.7.4] - 2026-04-24

This release centralizes installer and operator download handling in the Node CLI while aligning the public install guidance with the CLI-first bootstrap flow.

### 🤖 Node API & CLI
- **Changed:** Moved host setup ownership into the Node CLI, added the canonical operator download flow, delegated remediation policy to the CLI, added a compact `clawperator install` post-bootstrap sequence, and compacted the shell installer around `clawperator install`.

### 📚 Documentation & Website
- **Changed:** Updated the installer and host docs to match the CLI-based bootstrap, delegation, and recovery flow.

Pull requests:
- [refactor(install): move host setup ownership into the CLI](https://github.com/clawperator/clawperator/pull/224)
- [feat(node): add canonical operator download CLI flow](https://github.com/clawperator/clawperator/pull/225)
- [refactor(install): delegate remediation policy to the CLI](https://github.com/clawperator/clawperator/pull/226)
- [docs(install): update for cli-based installer](https://github.com/clawperator/clawperator/pull/227)
- [feat(install): add compact post-bootstrap install flow](https://github.com/clawperator/clawperator/pull/228)
- [refactor(install): compact shell installer around clawperator install](https://github.com/clawperator/clawperator/pull/229)

## [0.7.3] - 2026-04-22

This release improves the installer handoff for multi-device setups and standardizes the public APK recovery guidance.

### 📚 Documentation & Website
- **Changed:** Improved `install.sh` so multi-device installs inspect each ready device, remediate stale APKs, and keep the final handoff honest when some devices still need attention.
- **Changed:** Standardized the public guidance on the canonical stable APK URL and made the manual setup prompts package-aware, shell-safe, and clearer for `DEVICE_SHELL_UNAVAILABLE` cases.

Pull requests:
- [fix(install): multi-device installer remediation and APK guidance](https://github.com/clawperator/clawperator/pull/223)

## [0.7.2] - 2026-04-22

This release moves the shipped first-party skills into the bundled Node skill tree and tightens the installer and docs guidance for multi-device setups.

### 🤖 Node API & CLI
- **Changed:** Renamed the packaged `agent-skills` surface to `bundled-skills`, moved the shipped first-party skills into `apps/node/bundled-skills/`, and prefixed the bundled skill ids with `clawperator-`.

### 📚 Documentation & Website
- **Changed:** Updated the installer and discovery guidance so `install.sh` now checks each connected device during the final doctor pass and the public docs match the new bundled-skill layout.

Pull requests:
- [feat: install.sh doctor runs on each connected device](https://github.com/clawperator/clawperator/pull/219)
- [refactor: bundled skills into `apps/node/bundled-skills` and prefix skill ids](https://github.com/clawperator/clawperator/pull/220)
- [refactor(node): rename agent-skills surface to bundled-skills](https://github.com/clawperator/clawperator/pull/221)
- [feat(node, docs): improve docs discovery guidance](https://github.com/clawperator/clawperator/pull/222)

## [0.7.1] - 2026-04-22

This release keeps the Node runtime focused on deterministic timeout handling for `runExecution`.

### 🤖 Node API & CLI
- **Fixed:** Stabilized `runExecution` timeout handling by adding test-friendly overrides for the result-envelope timeout and logcat broadcast delay.

Pull requests:
- [fix(node): stabilize runExecution timeout tests](https://github.com/clawperator/clawperator/pull/217)

## [0.7.0] - 2026-04-21

This release expands the packaged skill surfaces, adds interactive-device doctor and wake handling in the Node runtime, and brings Android `enter_text` behavior up to the current API 33 contract.

### 🤖 Node API & CLI
- **Changed:** Renamed the packaged `authoring-skills` surface to `agent-skills`, including the CLI help, installer wiring, and the related runtime docs.
- **Added:** Shipped first-party `clawperator-agent-orientation` and `clawperator-upgrade` skills in the Node-distributed skill set.
- **Added:** Added device interactivity checks, readiness preflights, and bounded wake handling so doctor, skill wrappers, and `serve` can fail closed on locked devices.
- **Changed:** Tightened doctor and direct-execution handling around interactive-state diagnostics and status reporting.

### 📚 Documentation & Website
- **Changed:** Updated the host-agent, doctor, skills, API, and release docs to match the new `agent-skills` surface and interactive readiness behavior.
- **Changed:** Refreshed generated docs artifacts and install guidance for the new packaged skills and release outputs.

### 📱 Android Operator APK
- **Fixed:** Separated screen-off from device-locked state in the operator truth model and updated the `enter_text.clear` contract.
- **Added:** Upgraded the Android `enter_text` runtime for API 33 with the accessibility IME fallback path.

Pull requests:
- [refactor: rename authoring-skills surface to agent-skills](https://github.com/clawperator/clawperator/pull/204)
- [feat: add first-party clawperator agent orientation skill](https://github.com/clawperator/clawperator/pull/205)
- [feat(skill): add packaged clawperator-upgrade agent-skill](https://github.com/clawperator/clawperator/pull/207)
- [fix(android): `enter_text` clear contract](https://github.com/clawperator/clawperator/pull/209)
- [feat(android): upgrade enter_text runtime for API 33](https://github.com/clawperator/clawperator/pull/211)
- [feat: add device interactivity foundation](https://github.com/clawperator/clawperator/pull/213)
- [feat(node): add doctor enhancements](https://github.com/clawperator/clawperator/pull/214)
- [feat(node): add device interactivity checks and bounded wake preflight](https://github.com/clawperator/clawperator/pull/215)

## [0.6.5] - 2026-04-20

This release sharpens authoring discoverability and the skill-authoring workflow, while tightening validation and eval coverage around the new discovery-first path.

### 🤖 Node API & CLI
- **Changed:** Improved authoring discoverability so the CLI now routes hosts toward `authoring-skills list`, clarifies the runtime-skill versus authoring-skill boundary, and makes `skills new` explicit as the low-level scaffold path.
- **Fixed:** Hardened skill authoring validation and scaffolds by requiring runtime-skill frontmatter, making scaffolded `run.js` files self-contained, preserving quoted Windows `CLAWPERATOR_BIN` paths, preferring the branch-local Node CLI, and keeping single-skill validation usable for fresh scaffolds while enforcing generated-index freshness in repo-wide validation.
- **Added:** Added `skill-author-by-agent-discovery` as the discovery front door, kept `skill-author-by-recording` as the proving handoff, and hardened Pack A eval coverage so route evidence is required.

### 📚 Documentation & Website
- **Changed:** Added `docs/host-agents.md` as the canonical post-install route and repointed setup, quickstart, skills, MCP, index, and design guidance around that flow.
- **Changed:** Updated the authoring docs, CLI next-step messaging, generated docs artifacts, and install validation coverage to match the shipped discovery-first workflow.

Pull requests:
- [feat(cli): improve authoring discoverability](https://github.com/clawperator/clawperator/pull/200)
- [tasks(skills): create authoring discoverability and skill authorship task packs](https://github.com/clawperator/clawperator/pull/201)
- [fix(skills): harden skill authoring validation and scaffolds](https://github.com/clawperator/clawperator/pull/202)
- [feat(skills): add discovery-first authoring skills and eval hardening](https://github.com/clawperator/clawperator/pull/203)

## [0.6.4] - 2026-04-18

This release sharpens the post-install host orientation flow and updates the surrounding CLI and docs guidance to point users at the right entry points.

### 🤖 Node API & CLI
- **Changed:** Reworked the post-install discovery flow so the CLI now steers hosts through `skills for-app` or `skills search` first, while keeping `mcp serve` as the stdio MCP transport entry point.

### 📚 Documentation & Website
- **Changed:** Added `docs/host-agents.md` as the canonical post-install route and repointed setup, quickstart, skills, MCP, index, and design guidance around that flow.
- **Changed:** Clarified registry-read remediation to favor the installed home registry path and concrete next steps without changing `CLAWPERATOR_SKILLS_REGISTRY` precedence.

Pull requests:
- [docs: update docs and cli for agent host orientation](https://github.com/clawperator/clawperator/pull/197)

## [0.6.3] - 2026-04-17

This release expands skills discovery and ranking, while refreshing the install and onboarding guidance to match the current runtime-skill flow.

### 🤖 Node API & CLI
- **Added:** Added `clawperator skills for-app <package_id>` as app-oriented discovery sugar, along with optional `keywords` metadata and deterministic keyword ranking in `skills search`.
- **Fixed:** Covered the Google Home HVAC discovery regressions, including the `ac` mis-ranking case.

### 📚 Documentation & Website
- **Changed:** Documented the app-oriented skills discovery and keyword-ranking behavior in the public skills and environment references.
- **Changed:** Updated the install and onboarding guidance, plus the public installer script, to describe runtime-skill discovery, installed-registry fallback, and when to use `clawperator skills` versus MCP.

Pull requests:
- [feat(skills): add app discovery and keyword ranking](https://github.com/clawperator/clawperator/pull/195)
- [feat(install): add host onboarding artifacts](https://github.com/clawperator/clawperator/pull/196)

## [0.6.2] - 2026-04-17

This release fixes the `install.sh` stdin execution path so streamed installs complete cleanly.

### 📚 Documentation & Website
- **Fixed:** Corrected the `install.sh` stdin execution path so `curl -fsSL https://clawperator.com/install.sh | bash` completes without tripping the entrypoint guard.

Pull requests:
- [feat(skills): add task-cleanup skill](https://github.com/clawperator/clawperator/pull/191)
- [fix(install): fix stdin execution for install.sh](https://github.com/clawperator/clawperator/pull/192)

## [0.6.1] - 2026-04-16

This release centers on packaged authoring-skills support and the matching public guidance refresh, with installer validation tightened along the way.

### 🤖 Node API & CLI
- **Added:** Added packaged authoring-skills installation support, kept agent discovery path compatibility in CLI output, and expanded doctor coverage for stale, malformed, and partially broken authoring-skills installs.

### 📚 Documentation & Website
- **Changed:** Updated public examples to use the release operator package by default, while keeping debug-package guidance for local debug workflows.
- **Changed:** Refreshed release-facing docs and installer validation coverage for the published `0.6.0` release, including the consolidated `validation/install` smoke paths.

Pull requests:
- [feat(install,node): add authoring skills](https://github.com/clawperator/clawperator/pull/188)
- [docs: use release operator package in public examples](https://github.com/clawperator/clawperator/pull/189)
- [test(install): harden install.sh validation coverage](https://github.com/clawperator/clawperator/pull/190)

## [0.6.0] - 2026-04-16

This release adds the new authoring-skills install workflow, expands the Node skills runtime with framed SkillResult parsing and orchestrated execution support, and refreshes public docs and Android build tooling alongside the release follow-up for the previous version.

### 🤖 Node API & CLI
- **Added:** Added framed SkillResult parsing, trusted skill-result provenance handling, and orchestrated runtime support so `skills run` and `serve` can surface structured skill execution results.
- **Added:** Added the `authoring-skills` CLI workflow for packaged skill installs, updates, and listings, including filesystem wiring for the canonical authoring-skill store.
- **Changed:** Improved `skills run` argument forwarding and skill contract input handling so trailing arguments and named inputs are treated consistently.

### 📚 Documentation & Website
- **Added:** Documented the skill-result contract, orchestrated runtime behavior, authoring-skills install flow, and MCP references across the public docs and site surfaces.
- **Changed:** Refreshed the landing page theme and updated release-facing docs and website artifacts for the previously published `0.5.5` release.

### 📱 Android Operator APK
- **Changed:** Upgraded the Android build stack to AGP 9.1.0 and Gradle 9, plus the corresponding module and wrapper configuration.
- **Fixed:** Stabilized Android JSON extension unit tests by removing the Robolectric dependency from the pure JSON helper coverage.

Pull requests:
- [chore(android): upgrade AGP to 9.1.0](https://github.com/clawperator/clawperator/pull/166)
- [feat(site): lighter landing theme](https://github.com/clawperator/clawperator/pull/165)
- [fix(android): stabilize json extension unit tests](https://github.com/clawperator/clawperator/pull/168)
- [chore: fix banned claw shorthand usage](https://github.com/clawperator/clawperator/pull/167)
- [feat(skills): improve skills run argument handling](https://github.com/clawperator/clawperator/pull/171)
- [tasks(recording): create task packs](https://github.com/clawperator/clawperator/pull/170)
- [feat(recording): complete skill-checkpoints workstream](https://github.com/clawperator/clawperator/pull/172)
- [feat(skills): add SkillResult contract parsing for skills](https://github.com/clawperator/clawperator/pull/173)
- [feat(landing): mention MCP + improve demo code](https://github.com/clawperator/clawperator/pull/175)
- [docs: add MCP references and refresh indexes](https://github.com/clawperator/clawperator/pull/176)
- [skills: add agent-driven orchestrated runtime support](https://github.com/clawperator/clawperator/pull/177)
- [feat(evals): add durable Solax cold-start live proving](https://github.com/clawperator/clawperator/pull/178)
- [feat(skills): add skill contract declarations](https://github.com/clawperator/clawperator/pull/179)
- [feat(recording): harden compare closeout and fail-closed behavior](https://github.com/clawperator/clawperator/pull/180)
- [docs(recording): retire completed recording task packs after graduation](https://github.com/clawperator/clawperator/pull/181)
- [fix(node): trust named skill contract inputs](https://github.com/clawperator/clawperator/pull/182)
- [feat(skills): add skill-author-by-recording workflow](https://github.com/clawperator/clawperator/pull/183)
- [docs(recording): harden P2 skill-author-by-recording workflow](https://github.com/clawperator/clawperator/pull/184)
- [docs(skills): graduate recording authoring guidance](https://github.com/clawperator/clawperator/pull/185)
- [tasks: authoring skills install and discovery task pack](https://github.com/clawperator/clawperator/pull/186)
- [feat(node): add authoring-skills CLI support for packaged skill installs](https://github.com/clawperator/clawperator/pull/187)

## [0.5.5] - 2026-04-10
This release expands the MCP surface with a first-party server, session defaults, and snapshot truncation ergonomics, while also adding recording export and agent-friendly CLI aliases. Documentation was refreshed alongside the new runtime behavior and the already-published 0.5.4 release.

### 🤖 Node API & CLI
- **Added:** Added recording export for pulled NDJSON recordings, shared recording validation, and `skills new --recording-context` support for scaffolded skills.
- **Added:** Added a first-party stdio MCP server and documented its tool surface.
- **Added:** Added agent-friendly CLI and payload aliases to make command interactions more intuitive without changing canonical precedence.
- **Changed:** Updated MCP session defaults and snapshot truncation behavior to make the server easier to use.
- **Fixed:** Hardened MCP stdio parsing and added coverage for handshake, wait timeout padding, and source-aware selector retries.

### 📚 Documentation & Website
- **Added:** Documented recording export, skill recording-context workflows, the first-party MCP server, and alias/navigation references.
- **Changed:** Updated release-facing docs to match the published 0.5.4 artifacts.
- **Changed:** Refreshed MCP documentation and internal design notes for the new server behavior and ergonomics.

Pull requests:
- [fix(evals): harden evals](https://github.com/clawperator/clawperator/pull/155)
- [chore: define canonical worktree location](https://github.com/clawperator/clawperator/pull/156)
- [tasks/api: plan recording export agent-context workflow](https://github.com/clawperator/clawperator/pull/157)
- [feat(node): add recording export and scaffolded recording context support](https://github.com/clawperator/clawperator/pull/159)
- [docs: add transport-first MCP task pack](https://github.com/clawperator/clawperator/pull/158)
- [feat(node): add agent-friendly CLI and payload aliases](https://github.com/clawperator/clawperator/pull/160)
- [feat(node): add first-party MCP server](https://github.com/clawperator/clawperator/pull/161)
- [docs(tasks): tighten MCP follow-up implementation handoff](https://github.com/clawperator/clawperator/pull/162)
- [fix(node): harden MCP stdio parsing and coverage](https://github.com/clawperator/clawperator/pull/163)

## [0.5.4] - 2026-04-07
This release pins the release and CI toolchain to Node 24, removes the flaky npm self-upgrade path, and aligns the public setup guidance with the new runtime floor.

### 🤖 Node API & CLI
- **Changed:** Pinned the release and PR workflows to Node 24.14.1 and removed the global npm bootstrap step from npm publishing to avoid the trusted-publishing failure path.
- **Changed:** Raised the declared Node requirement to 24 in package metadata, doctor checks, installer scripts, and runtime guidance.

### 📚 Documentation & Website
- **Changed:** Regenerated machine-facing docs and updated setup/release guidance to match the Node 24 floor.

Pull requests:
- [chore: pin workflows and tooling to Node 24](https://github.com/clawperator/clawperator/pull/154)

## [0.5.3] - 2026-04-07
This release adds new user guidance around starring the project and improves Java setup reliability for Android builds, while expanding setup and snapshot documentation.

### 🤖 Node API & CLI
- **Added:** Added a star-hint system in the CLI with suppression controls for flags, environment variables, and non-interactive sessions.
- **Added:** Added Java runtime provisioning support in install and doctor flows so Android build prerequisites can be prepared and validated more reliably.

### 📚 Documentation & Website
- **Added:** Added a new snapshot API guide and quickstart documentation, plus version badges and quick-reference version checks in core docs pages.
- **Changed:** Updated release-facing docs and install artifacts for the published `0.5.2` release and refreshed site guidance related to version visibility and star messaging.

Pull requests:
- [docs: add version badges and improve version discoverability](https://github.com/clawperator/clawperator/pull/141)
- [Add comprehensive task plans and work breakdowns](https://github.com/clawperator/clawperator/pull/142)
- [docs: add snapshot guide and quickstart](https://github.com/clawperator/clawperator/pull/143)
- [feat(evals): phase 1 eval harness and android-version spec](https://github.com/clawperator/clawperator/pull/144)
- [feat(evals): add multi-agent adapters and turn budget enforcement](https://github.com/clawperator/clawperator/pull/145)
- [feat(evals): add runtime contracts and knowledge mode](https://github.com/clawperator/clawperator/pull/146)
- [feat(evals): add skill generation replay eval](https://github.com/clawperator/clawperator/pull/147)
- [feat(evals): add replay framework and comprehensive test coverage](https://github.com/clawperator/clawperator/pull/148)
- [feat: add star hint system with triggers and suppression](https://github.com/clawperator/clawperator/pull/149)
- [chore: update AGP to 8.13.2](https://github.com/clawperator/clawperator/pull/150)
- [tasks: Java provisioning and Android migration plans](https://github.com/clawperator/clawperator/pull/151)
- [chore(android): migrate build toolchain from Java 11 to Java 17](https://github.com/clawperator/clawperator/pull/152)
- [feat(install): add Java provisioning to installer](https://github.com/clawperator/clawperator/pull/153)

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
