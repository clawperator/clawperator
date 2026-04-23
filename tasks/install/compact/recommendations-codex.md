# install.sh Compacting - Recommendations

## Recommendation Summary

The next refinement round should focus on one concrete outcome:

**turn `sites/landing/public/install.sh` from a shell-side middleware layer
into a minimal bootstrap-and-delegate wrapper.**

The first cleanup wave already moved major product behavior into the CLI. The
remaining opportunity is to remove the shell-side parsing, state assembly,
and summary formatting that still sit between the installer and those CLI
surfaces.

The work below is not a phased plan. It is a set of concrete recommendations
for what should be built or tightened to achieve the compacting goal.

## What Should Be Done

### 1. Eliminate shell-side JSON parsing helpers

`install.sh` still contains multiple `node -e` parser helpers that decode JSON
from CLI commands and turn it back into shell variables:

- `parse_skills_registry_path`
- `parse_bundled_skills_install_result`
- `parse_host_setup_result`
- `parse_operator_download_result`
- `parse_operator_remediate_result`

Recommendation:

- stop treating shell as the place where structured CLI output is interpreted
- either:
  - add CLI commands that already emit the exact human-readable installer
    summary the shell needs, or
  - add a single higher-level CLI install/post-install surface that owns the
    sequencing and summary contract itself

The installer should not need five parser helpers just to consume its own CLI.

## 2. Collapse post-bootstrap orchestration into a smaller number of CLI entrypoints

Today the shell still orchestrates several CLI steps directly:

- `skills install`
- `bundled-skills install`
- `host setup`
- `operator download`
- `operator remediate`
- final `doctor`

Recommendation:

- introduce a higher-level CLI-owned post-bootstrap installer surface that
  executes the post-bootstrap flow end to end
- make that surface responsible for:
  - running the post-bootstrap install steps in the correct order
  - returning a stable structured result
  - printing a truthful human-readable summary for installer use
  - carrying recovery guidance for partial failures

This can be a new command or a small number of tightly related commands, but it
should remove most of the sequencing logic from `install.sh`.

The key principle is: after `npm install -g clawperator@latest`, the shell
should ideally call one primary CLI-owned install flow, not assemble a workflow
step-by-step itself.

## 3. Move installer summary formatting into the CLI

Even where the shell now delegates behavior, it still formats a lot of the
final user-facing state:

- device remediation summaries
- host artifact summaries
- success/failure messaging for skills and bundled-skills
- end-of-run “what to do next” guidance

Recommendation:

- move installer-facing summaries into the CLI result contract
- let the CLI own the user-facing semantics of:
  - ready vs warn vs partial-failure
  - which next-step commands to show
  - which artifacts or devices to mention

The shell should mostly pass through CLI output, not rebuild the same meaning
in bash.

## 4. Remove installer-owned state machines and arrays where the CLI can own state

The current shell still keeps a fair amount of installer state:

- remediation counts
- per-device arrays for id/state/status/message
- status flags for skills, bundled-skills, and artifacts
- shell-local logic for deciding which summary branch to print

Recommendation:

- move that state model into Node
- return one explicit installer-state object from the CLI
- derive both machine-readable and human-readable outcomes from that single
  Node-owned state model

This should allow deletion of many shell variables, arrays, and branch-heavy
summary functions.

## 5. Tighten the command contracts for install-adjacent CLI surfaces

The existing CLI surfaces are useful, but the current shell still needs to know
too much about their output shapes and follow-up semantics.

Recommendation:

- audit the install-adjacent command contracts for:
  - `skills install`
  - `bundled-skills install`
  - `host setup`
  - `operator download`
  - `operator remediate`
- tighten their output so installer callers do not need custom parsing logic
- prefer explicit top-level fields over ad hoc nested structures that force
  shell-side interpretation
- make exit-code behavior and partial-failure behavior consistent across these
  surfaces

The installer should be able to trust these commands directly rather than
normalizing them in bash.

## 6. Consider a dedicated installer-facing CLI summary contract

A likely gap is that current commands return good product-level JSON, but not a
single installer-oriented contract that answers:

- did post-bootstrap install succeed?
- if not, was it a hard failure or a recoverable warning?
- what should the user run next?
- which artifact, device, or skill step needs attention?

Recommendation:

- add a dedicated installer-facing result contract owned by the CLI
- ensure it can drive both:
  - JSON output for automation and tests
  - pretty output for the shell installer without extra shell logic

This can be implemented as a new command, a wrapper command, or a dedicated
installer mode on an existing namespace, but the contract should live in Node.

## 7. Reduce shell validation by moving behavioral proof into Node tests

The validation harness is still large because many tests prove shell glue that
exists only to interpret CLI output.

Recommendation:

- move parser and branch-heavy behavior proof into Node unit or integration
  tests wherever the real logic is now CLI-owned
- keep shell tests focused on the irreducible shell responsibilities:
  - bootstrap checks and failure paths
  - command delegation
  - environment propagation when truly needed
  - top-level exit propagation
- stop keeping shell harnesses as the primary proof for behavior that now lives
  in Node

The result should be a much smaller `validation/install/test*` surface with a
clearer ownership boundary.

## 8. Treat shell RC and environment wiring as exceptions, not a central path

Phase 5 already removed the default shell RC mutation for
`CLAWPERATOR_SKILLS_REGISTRY`, but shell still retains some environment
plumbing and related fallback behavior.

Recommendation:

- keep default shell environment mutation out of the install flow
- prefer CLI-owned fallback discovery wherever practical
- keep any remaining shell environment handling minimal and explicitly justified

This helps prevent `install.sh` from growing back into a configuration manager.

## 9. Preserve the irreducible shell core, and aggressively cut everything else

Not everything should move. The shell still rightly owns:

- OS validation
- Java / Node / adb / git / curl checks or provisioning
- global CLI install via `npm install -g clawperator@latest`
- the minimal wrapper logic needed to invoke the post-bootstrap CLI flow

Recommendation:

- treat these bootstrap concerns as the permanent shell budget
- treat almost everything after the CLI install as suspect unless there is a
  strong reason it cannot move into Node

This is the standard to use when deciding whether a remaining shell function is
legitimate or just historical residue.

## Suggested End State

The desired steady state is roughly:

1. shell performs prerequisite checks and installs the CLI
2. shell invokes one primary CLI-owned post-bootstrap install flow
3. shell relays the resulting success, warning, or failure output
4. shell exits

That end state would make:

- `install.sh` much shorter
- installer behavior easier to reason about
- validation clearer and cheaper to maintain
- future installer changes safer because the CLI, not bash, remains the
  canonical owner

## Bottom Line

The highest-value work now is **not** another round of moving isolated helper
functions one-by-one. It is to remove the shell’s remaining role as an
orchestrator and JSON interpreter.

If the next refinement round succeeds, `install.sh` should stop being a second
application and become what it was always supposed to be: a small bootstrap
entrypoint into the real Node-owned installer behavior.
