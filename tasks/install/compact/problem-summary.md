# install.sh Compacting - Problem Summary

## Purpose

The first installer-cleanup wave has landed on `main`. It successfully moved
major post-bootstrap product behavior into the Node CLI, but it did **not**
finish the job of turning `sites/landing/public/install.sh` into a genuinely
small bootstrapper.

This follow-on task exists to summarize what shipped, describe the current
residual complexity, and frame the next refinement round around one explicit
goal:

**put as much install behavior as possible into the CLI, so `install.sh` and
its shell-based validation harness become minimal, linear, and easy to
maintain.**

## What Landed So Far

The initial task pack was shipped on `main` through these commits:

1. `0c3ce93b9cac5d48635677f77f50b431d4231eca`
   `refactor(install): move host setup ownership into the CLI (#224)`
   - moved durable host artifact generation into the CLI-owned
     `clawperator host setup` surface
   - delegated `install.sh` to the CLI for host artifact generation
   - removed the old shell-side artifact writer authority

2. `0672f93fdfea74ce060c7a266027dd813eadd79d`
   `feat(node): add canonical operator download CLI flow (#225)`
   - added `clawperator operator download`
   - moved APK metadata fetch, checksum verification, and download placement
     into the CLI
   - delegated installer APK acquisition to that CLI surface

3. `fa302b2c39583a01ee982b23496cbf0f05580a9f`
   `refactor(install): delegate remediation policy to the CLI (#226)`
   - added `clawperator operator remediate`
   - moved multi-device remediation policy and single-device APK-fix wiring
     into the CLI
   - removed the old shell-side doctor-policy engine

4. `2cb8e49c5b0c2a34654b1d9b3cfcf9c2508fbdec`
   `docs(install): update for cli-based installer (#227)`
   - removed default shell RC mutation for
     `CLAWPERATOR_SKILLS_REGISTRY`
   - updated install docs and validation guidance to reflect the CLI-owned
     post-bootstrap split
   - updated `clawperator-upgrade` to use the CLI-first upgrade sequence, with
     `install.sh` retained as recovery-only fallback

## What Improved

This work materially improved the architecture:

- durable host artifacts are now generated in typed Node code
- operator APK download is now a reusable CLI surface
- multi-device remediation policy is now owned by the CLI
- upgrade guidance now reflects the CLI-first model
- large portions of shell-owned product logic and validation branching were
  removed

In other words, the first wave succeeded at **ownership migration**.

## Current State

Even after the initial five phases landed, the installer is still large:

- `sites/landing/public/install.sh`: `1431` lines
- `validation/install/test_agent_skills.sh`: `1054` lines
- `validation/install/test_main.sh`: `942` lines
- `validation/install/test_multidevice.sh`: `301` lines
- total shell-heavy install validation surface remains large

The script is smaller than it was before the cleanup work, but it is still far
from a thin bootstrap stub.

## Why A Follow-On Compacting Round Is Needed

The residual complexity is no longer dominated by the original artifact writers
or doctor policy engine. The remaining bulk is now concentrated in shell-side
middleware behavior such as:

- parsing CLI JSON output with inline `node -e` helpers
- translating structured CLI results into installer-side summary state
- maintaining shell helper functions for `skills install`,
  `bundled-skills install`, `host setup`, `operator download`, and
  `operator remediate`
- keeping a large shell validation harness that still proves many installer
  branches rather than a minimal bootstrap-and-delegation path

Examples still present in `install.sh` today:

- `parse_skills_registry_path`
- `parse_bundled_skills_install_result`
- `parse_host_setup_result`
- `parse_operator_download_result`
- `parse_operator_remediate_result`

This means the shell is still acting as a significant orchestration and
translation layer even though the core product behaviors have moved into the
CLI.

## High-Level Goal For The Next Refinement Phase

The next round should target **final shell collapse**.

The desired end state is:

- `install.sh` keeps only the irreducible bootstrap work:
  - OS validation
  - Java / Node / adb / git / curl checks or provisioning
  - `npm install -g clawperator@latest`
- post-bootstrap install behavior is expressed as a very small number of
  high-level CLI commands
- the shell does little or no structured JSON parsing
- the shell does little or no product-state interpretation
- the shell prints minimal success/failure guidance rather than rebuilding
  installer state machines in bash
- shell-based install validation proves the thin bootstrap/delegation path,
  while detailed behavior coverage moves to Node unit and integration tests

## What We Want To Achieve

At a high level, the next refinement phase should:

1. move as much remaining post-bootstrap install logic as possible out of
   `install.sh` and into the Node CLI
2. remove shell-side JSON parsing and result-translation helpers wherever the
   CLI can return a more directly consumable contract
3. shrink the installer to a minimal, linear bootstrap-and-delegate script
4. shrink `validation/install/test*` accordingly, keeping shell coverage only
   where shell behavior is still the true source of logic
5. leave the CLI, not bash, as the canonical owner of install behavior

## Non-Goal

This follow-on effort does **not** need to begin by rewriting `install.sh` in a
different language. The immediate goal is simpler than that:

**make the current shell installer as small, boring, and maintainable as
possible by pushing the remaining logic into the CLI first.**

If that succeeds, any later rewrite of the bootstrap stub becomes far easier
and far lower risk.
