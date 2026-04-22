# `install.sh` Cleanup Findings

## Scope

This note evaluates whether portions of `sites/landing/public/install.sh` should move into the Clawperator CLI, with a focus on reducing shell-specific complexity without moving host-specific bootstrap concerns into the wrong layer.

## Short Answer

Yes. Parts of the current install flow should move into the CLI, but not all of them.

The best candidates are the flows that already depend on structured Clawperator concepts:

- operator APK acquisition and verification
- install orchestration around `doctor`
- host artifact generation that is already emitted from embedded Node snippets

The parts that should stay outside the CLI are the host bootstrap steps that exist specifically to get the CLI onto the machine in the first place:

- OS/package-manager detection
- Java / Node / adb / git provisioning
- initial `npm install -g clawperator@latest`

My recommendation is to keep a thin `install.sh` as the public entrypoint, but move most post-install logic into a new CLI-owned installer command.

## Why This Feels Unwieldy

The file is large even before counting test harnesses:

- `sites/landing/public/install.sh`: 2306 lines
- `validation/install/test_*.sh`: 3171 lines combined

That size alone is not automatically a problem, but the current script mixes four different responsibility types:

1. host prerequisite provisioning
2. Clawperator product logic
3. JSON parsing / file generation implemented via embedded Node snippets
4. multi-device remediation and summary policy

That mix is what makes it hard to reason about.

## What The Script Already Delegates Well

Some important parts are already in the right layer.

### CLI-owned behavior already exists

- Runtime skills install already goes through `clawperator skills install`, and the shell only parses the returned `registryPath` afterward (`sites/landing/public/install.sh:512-557`, `apps/node/src/cli/commands/skills.ts:359-360`).
- Bundled skills install already goes through `clawperator bundled-skills install`, and the shell only parses `installedDir` and `agentDiscoveryDirs` from the JSON result (`sites/landing/public/install.sh:568-620`, `apps/node/src/cli/commands/bundledSkills.ts:37-55`).
- Operator setup is already a CLI/domain concept. `clawperator operator setup` wraps a stable install -> grant -> verify flow (`apps/node/src/cli/commands/operatorSetup.ts:21-121`, `apps/node/src/domain/device/setupOperator.ts:32-119`).
- Doctor is already the canonical readiness engine and exposes structured checks and next actions (`apps/node/src/cli/commands/doctor.ts:12-42`, `apps/node/src/domain/doctor/DoctorService.ts:54-225`).

This means the current script is not purely "shell glue". It is partly re-implementing product logic next to CLI flows that already exist.

## Best Candidates To Move Into The CLI

### 1. Operator APK download and checksum verification

This logic currently lives entirely in shell:

- metadata fetch and parse (`sites/landing/public/install.sh:1421-1448`)
- checksum verification (`sites/landing/public/install.sh:1450-1475`)

Why this should move:

- It is product behavior, not shell bootstrap.
- It already uses embedded Node just to parse JSON metadata, which is a sign the shell is fighting the problem.
- The CLI already owns operator setup semantics, so "fetch the right APK artifact" belongs near that command family.

Suggested CLI surface:

- `clawperator operator download`
- or `clawperator operator fetch-apk`

Suggested result contract:

- local path
- operator version
- sha256
- package flavor / operator package compatibility

That would let `install.sh` become:

1. install CLI
2. call `clawperator operator download`
3. call `clawperator operator setup`

instead of owning metadata parsing and checksum logic itself.

### 2. Doctor-driven remediation planning

Today the shell uses `doctor --format json`, then re-parses specific checks and codes to decide whether to:

- install APKs
- re-grant permissions
- branch into special multi-device flows

Relevant sections:

- JSON probe helpers (`sites/landing/public/install.sh:1664-1727`, `1878-1942`)
- multi-device target collection (`sites/landing/public/install.sh:1729-1769`)
- remediation orchestration (`sites/landing/public/install.sh:2100-2153`)
- multi-device final-summary policy (`sites/landing/public/install.sh:2195-2235`)

Why this should move:

- The installer is depending on internal doctor check IDs like `readiness.apk.presence` and `readiness.version.compatibility`.
- That creates a fragile second policy engine outside the CLI.
- `DoctorService` already has an autofix concept through `check.fix.steps` and `autoFix` execution (`apps/node/src/domain/doctor/DoctorService.ts:194-211`), but `install.sh` bypasses that abstraction and hand-codes its own remediation logic.

Suggested CLI surface:

- `clawperator install doctor-remediate`
- or a top-level `clawperator install bootstrap`

Suggested behavior:

- run doctor
- decide if APK download/setup is required
- handle single-device and multi-device cases
- emit a single structured summary result for the installer to print

This would centralize policy around doctor check IDs instead of duplicating it in shell.

### 3. Host artifact generation implemented with embedded Node

The shell currently writes several durable artifacts using large inline Node blocks:

- install state: `~/.clawperator/install-state.json` (`sites/landing/public/install.sh:889-940`)
- MCP snippet: `~/.clawperator/mcp-config-snippet.json` (`sites/landing/public/install.sh:982-1089`)
- local agent guide: `~/.clawperator/AGENTS.md` (`sites/landing/public/install.sh:1091-1254`)
- shared-agent bridge in `~/.agents/AGENTS.md` (`sites/landing/public/install.sh:1256-1353`)

Why this should move:

- This is effectively Node application code embedded inside bash.
- It is harder to test, harder to type-check, and harder to share with docs/runtime code.
- The generated files are part of the Clawperator host integration surface, not generic shell behavior.

Suggested CLI surface:

- `clawperator host write-install-state`
- `clawperator host write-mcp-snippet`
- `clawperator host write-agent-guide`
- `clawperator host update-shared-agent-bridge`

Or, more realistically, one higher-level command:

- `clawperator host materialize-artifacts`

with flags for opt-in/opt-out behaviors.

This is the single highest leverage refactor after APK download, because it removes a large amount of inline script complexity without touching the initial bootstrap path.

### 4. Skills registry shell RC mutation should likely move or shrink

After `clawperator skills install`, the script rewrites `~/.zshrc`, `~/.bashrc`, and `~/.bash_profile` to export `CLAWPERATOR_SKILLS_REGISTRY` (`sites/landing/public/install.sh:530-556`).

That is less necessary than it used to be, because the CLI already falls back to the installed home registry at `~/.clawperator/skills/skills/skills-registry.json` when no env var is set (`apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:79-186`).

Recommendation:

- Do not prioritize moving shell RC editing into the CLI.
- Instead, consider deleting or minimizing this behavior.

A good near-term change would be:

- keep the fallback-based CLI behavior as canonical
- stop mutating shell RC files by default
- print the export command as optional advice only

That would remove a surprising host mutation and reduce installer complexity.

## What Should Stay In `install.sh`

### 1. Initial machine bootstrap

These sections are still appropriate for a shell entrypoint:

- OS validation (`sites/landing/public/install.sh:81-95`)
- Java detection and package-manager install (`sites/landing/public/install.sh:134-271`)
- Node installation via nvm / package-manager guidance (`sites/landing/public/install.sh:273-331`)
- adb / git / curl checks (`sites/landing/public/install.sh:333-417`)
- global CLI install (`sites/landing/public/install.sh:418-449`)

Reason:

- The CLI cannot reliably own the path that installs the CLI.
- Shell is still the right place for "make this machine capable of running Clawperator at all."

### 2. Public one-liner entrypoint

`curl -fsSL https://clawperator.com/install.sh | bash` is part of the product contract and docs. A thin wrapper script is still valuable as the stable public installation surface.

The target shape should be:

- thin shell bootstrapper
- thick CLI install command

not "replace install.sh entirely".

## What Should Probably Not Move As-Is

### Multi-device UX should move, but not as raw shell mirroring

The multi-device flows are some of the messiest parts of the current script, but the right answer is not to blindly port every branch into TypeScript.

Current behavior includes:

- device enumeration via raw `adb devices`
- per-device doctor probing
- conditional APK remediation
- special final summaries for mixed readiness states

Relevant areas:

- `sites/landing/public/install.sh:1478-1616`
- `sites/landing/public/install.sh:1729-2072`
- `sites/landing/public/install.sh:2195-2235`

Recommendation:

- Move the policy into the CLI.
- Simplify the state machine while moving it.
- Emit one structured install summary object instead of reproducing every current echo path.

The installer should consume a stable result like:

- host bootstrap status
- device summary by serial
- artifacts written
- next commands

## Recommended End State

### Phase 1

Add a new CLI command that owns post-bootstrap installation:

- proposed name: `clawperator install bootstrap`

Responsibilities:

- run doctor
- fetch / verify release APK when needed
- call `operator setup`
- handle permission re-grant recovery
- install runtime skills
- install bundled skills
- write host artifacts
- emit structured JSON summary

Then make `install.sh` call that command after the CLI is installed.

### Phase 2

Move host artifact writers out of shell into CLI TypeScript modules.

This should replace:

- `write_install_state`
- `write_mcp_config_snippet`
- `write_agent_guide`
- `write_shared_agent_bridge`

### Phase 3

Move APK download / checksum logic into `operator` subcommands.

This unlocks:

- reuse outside first install
- cleaner upgrade paths
- simpler docs for manual recovery

### Phase 4

Revisit whether shell RC mutation is still needed at all.

My recommendation is "probably no" because the CLI already has an installed-home fallback for the runtime skills registry.

## Risks And Tradeoffs

### Benefits

- less product logic hidden in bash
- fewer inline Node snippets inside shell
- clearer ownership boundaries
- easier TypeScript unit coverage than shell harness coverage
- better reuse for upgrade and repair flows

### Costs

- any new CLI installer command becomes part of the product contract and must be maintained carefully
- refactoring multi-device install behavior will require deliberate compatibility decisions
- installer validation will need to shift from shell harnesses toward CLI integration coverage

## Concrete Recommendation

Recommendation:

1. Keep `install.sh` as the public bootstrap entrypoint.
2. Introduce a CLI-owned post-bootstrap command, likely `clawperator install bootstrap`.
3. Move host artifact generation and APK download/verification into CLI modules first.
4. Fold the custom doctor-remediation policy into the CLI next.
5. Do not move OS/package-manager bootstrap into the CLI.
6. Strongly consider deleting default shell RC edits for `CLAWPERATOR_SKILLS_REGISTRY` once the CLI fallback remains the supported path.

## Bottom Line

The installer is unwieldy because it is no longer just a shell bootstrapper. It has become a second implementation of installer policy, device remediation, and host-artifact generation.

Clawperator should keep a shell installer, but it should stop using bash as the long-term home for product logic. The right move is to reduce `install.sh` to prerequisite bootstrap plus one CLI-owned installation orchestration command.
