# install.sh Compacting - Central Recommendations

## Goal

The next refinement round should make `sites/landing/public/install.sh` and the
shell-heavy install validation harness as small, linear, and easy to maintain
as possible by moving the remaining post-bootstrap install behavior into the
Node CLI.

This is the central recommendations document to use as the canonical input for
the next task pack.

## What The First Wave Already Achieved

The initial installer-cleanup work that landed on `main` successfully moved the
largest ownership domains into the CLI:

- `clawperator host setup` now owns durable host artifact generation
- `clawperator operator download` now owns APK metadata fetch, checksum
  verification, and canonical placement
- `clawperator operator remediate` now owns multi-device remediation policy
- `clawperator-upgrade` now uses a CLI-first upgrade path, with `install.sh`
  retained as a recovery entrypoint

That work was real and valuable. The current issue is not that the CLI
migration failed. It is that `install.sh` is still too large because it remains
a shell-side middleware layer after the CLI migration.

## Current Problem

Even after the initial five phases landed, the residual shell surface is still
large:

- `sites/landing/public/install.sh`: about `1431` lines
- `validation/install/test_agent_skills.sh`: about `1054` lines
- `validation/install/test_main.sh`: about `942` lines
- `validation/install/test_multidevice.sh`: about `301` lines

The remaining size is no longer dominated by the old artifact writers or the
old doctor policy engine. It is now concentrated in shell-side parsing,
state-threading, orchestration glue, and installer summary formatting.

## Key Findings

### 1. `install.sh` still contains five inline JSON parsers

The installer still uses `node -e` helpers to parse JSON returned by the CLI:

- `parse_skills_registry_path`
- `parse_bundled_skills_install_result`
- `parse_host_setup_result`
- `parse_operator_download_result`
- `parse_operator_remediate_result`

This is the clearest signal that shell is still doing work the CLI should own.
The installer should not need five parser helpers to consume the product’s own
CLI.

### 2. `setup_host_artifacts_via_cli` is still a substantial orchestration layer

The host-setup shell wrapper still:

- builds arguments for `clawperator host setup`
- passes through `CLAWPERATOR_SKILLS_REGISTRY`
- parses per-artifact results
- hardcodes artifact names in bash
- decides whether a shared-agent-bridge failure is non-fatal

That means the shell still owns part of the host-artifact policy even though
host setup itself moved into Node.

### 3. `run_operator_remediation_via_cli` still builds a shell-side state model

The remediation wrapper still:

- parses CLI JSON into shell arrays and counters
- stores per-device ids, states, statuses, and messages
- reinterprets that state later when printing installer summaries
- forwards derived state such as `LAST_DEVICE_SERIAL` into later steps

This is effectively a second installer-state model in bash.

### 4. `download_operator_apk_via_cli` is dead install-flow code

There is still shell code for `download_operator_apk_via_cli` and its parser,
but that function is no longer called by `main()`. The actual install flow now
downloads through `operator remediate`.

This is high-confidence cleanup work because it removes dead code and dead test
coverage without changing the real install path.

### 5. The final installer summary is still a large bash decision tree

The installer still interprets many status counters to decide which success,
warning, or follow-up guidance to show. This is product presentation logic that
should live in the CLI, not in bash.

### 6. Some shell output extraction is only used for printing

Examples:

- bundled-skills install result parsing is mainly used to re-print directory
  paths
- some installer summaries exist only because the shell wants to restate
  already structured CLI results in a custom format

This is low-value shell complexity.

### 7. The shell validation harness still proves parser and glue behavior

Large parts of `validation/install/test*` still test:

- parser helpers
- shell-side translation logic
- shell-owned summary branching

That means the validation surface is still paying for shell behavior that the
architecture no longer wants to keep.

## Recommendations

## 1. Delete dead installer code first

The safest compaction step is to remove:

- `download_operator_apk_via_cli`
- `parse_operator_download_result`
- any shell tests that only exist to cover that dead path

This should be done before deeper refactors because it reduces noise and lowers
the amount of shell surface under consideration with no behavior change to the
real install flow.

## 2. Move non-fatal host-artifact policy fully into Node

The host setup domain already knows what counts as a non-fatal host-artifact
failure. The shell should not be the layer that converts that knowledge into
"continue anyway" behavior.

Specifically:

- make `host setup` own the shared-agent-bridge non-fatal policy completely
- let the CLI return the correct `ok` / exit behavior for that case
- stop requiring bash to count failed artifacts and implement the exception

Once this is done, `setup_host_artifacts_via_cli` can shrink materially.

## 3. Add a higher-level post-bootstrap installer CLI surface

This is the most important recommendation.

The remaining shell complexity is mostly caused by shell-to-CLI data threading:

- skills install returns a registry path that the shell forwards to host setup
- operator remediate returns device information that the shell forwards and
  later reinterprets
- multiple CLI calls are sequenced in bash, with bash responsible for the
  overall installer meaning

The best next step is to add a higher-level CLI-owned post-bootstrap installer
surface that:

- runs the post-bootstrap steps in the correct order
- threads state internally in Node
- owns partial-failure semantics
- owns final installer summary semantics
- returns one stable installer-facing result contract

Whether this surface is named `clawperator install`, `clawperator host install`,
or another equivalent is less important than the ownership boundary:

**after `npm install -g clawperator@latest`, the shell should ideally call one
primary CLI-owned install flow rather than assemble the workflow itself.**

## 4. Remove shell-side JSON parsing entirely where practical

The target should be to delete all or nearly all inline `node -e` parser
helpers from `install.sh`.

There are two valid ways to achieve that:

- have the CLI return installer-facing pretty output that the shell can relay
  directly, plus JSON for automation when needed
- have the new higher-level install surface return the one structured contract
  the shell needs, instead of many small contracts that bash must stitch
  together

Either approach is acceptable. The important thing is that shell stops being a
JSON interpreter.

## 5. Move installer summary formatting into the CLI

The CLI should own:

- ready vs warn vs failure semantics
- device remediation summaries
- host-artifact outcome summaries
- follow-up commands and recovery guidance

The shell should not need to decide which message to print based on multiple
arrays and counters. It should mostly pass through CLI output and propagate exit
status.

## 6. Simplify command contracts for install-adjacent CLI surfaces

Audit and tighten the install-adjacent command contracts for:

- `skills install`
- `bundled-skills install`
- `host setup`
- `operator remediate`

The current contracts are useful, but they still require shell normalization.
The next refinement round should prefer output shapes and exit behavior that are
directly consumable by an installer caller without custom parsing logic.

This includes:

- explicit top-level fields for installer-relevant outcomes
- consistent exit behavior
- consistent treatment of warnings vs hard failures
- reduced need for bash to infer meaning from nested result details

## 7. Let `host setup` and installer-side registry discovery own more of the default path

The shell still extracts the skills registry path from `skills install` output
and re-injects it into `host setup`. For the default install path, that round
trip is unnecessary complexity.

Recommendation:

- make the default registry discovery path fully CLI-owned
- only require shell involvement for genuinely non-default or explicit override
  cases

This helps remove another data-threading seam from the installer.

## 8. Reduce shell validation by moving behavioral proof into Node tests

The follow-on effort should explicitly shrink `validation/install/test*`.

Move proof of these behaviors into Node tests wherever possible:

- parser behavior
- result-shape interpretation
- host-artifact non-fatal policy
- remediation summary assembly
- post-bootstrap sequencing logic

Keep shell tests focused on the irreducible shell responsibilities:

- bootstrap checks and failure paths
- CLI delegation
- environment propagation when truly required
- top-level exit-code propagation

The shell harness should validate "the bootstrap wrapper calls the right CLI
surface and handles its result sanely," not re-prove Node-owned business logic.

## 9. Preserve the irreducible shell core and cut everything else aggressively

The shell should continue to own:

- OS validation
- Java / Node / adb / git / curl checks or provisioning
- global CLI installation via `npm install -g clawperator@latest`
- minimal wrapper logic needed to invoke the CLI-owned post-bootstrap flow
- shell-specific advice like the final `source ~/.zshrc` hint

Almost everything after the CLI install should now be treated as suspect unless
there is a strong reason it cannot move to Node.

## Recommended End State

The desired steady state is:

1. shell performs prerequisite checks and installs the CLI
2. shell invokes one primary CLI-owned post-bootstrap install flow
3. shell relays a CLI-owned success, warning, or failure summary
4. shell exits

In that state:

- `install.sh` becomes much shorter
- the installer becomes easier to reason about
- `validation/install/test*` becomes much smaller
- future install behavior changes happen in typed Node code, not in bash glue

## Bottom Line

The next refinement round should not be framed as “move a few more helpers.”
It should be framed as **removing the shell’s remaining role as an orchestrator
and JSON interpreter**.

The most valuable concrete moves are:

1. delete the dead operator-download shell path
2. move shared-bridge non-fatal policy fully into `host setup`
3. add a higher-level CLI-owned post-bootstrap installer surface
4. delete the remaining shell JSON parsers
5. shrink shell validation to bootstrap-only concerns

If that work is done well, `install.sh` will stop behaving like a second
application and become the small bootstrap entrypoint it was always supposed to
be.
