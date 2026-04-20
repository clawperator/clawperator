# Install Validation

This directory contains the install-specific validation harnesses for
`sites/landing/public/install.sh`.

## Entry Point

Run the full installer regression suite from the repo root with:

```bash
./validation/install/test_install.sh
```

This is the expected validation command for changes to `install.sh`.

Prerequisite for local runs:

```bash
npm --prefix apps/node ci
```

The suite builds and tests `apps/node`, but it does not install Node
dependencies for you.

## Harnesses

- `test_install.sh`
  - suite runner for the install-specific tests
  - builds the Node package, runs the install-related Node tests, then runs the
    shell harnesses in this directory plus `validation/test_doctor.sh`
- `test_java.sh`
  - covers `check_java()` detection and provisioning branches
- `test_multidevice.sh`
  - covers `maybe_install_operator_apk()` behavior when multiple devices are
    connected
- `test_agent_skills.sh`
  - covers agent-skills shell glue including parser behavior,
    `setup_authoring_skills_via_cli()`, `write_agent_guide()`, skip behavior,
    `CODEX_HOME` fallback, and installer metadata parsing
- `test_main.sh`
  - covers hermetic `main()` smoke paths including success, final-doctor
    failure, and multi-device completion-with-guidance flow

## Maintenance Rule

When a change adds or changes behavior in `sites/landing/public/install.sh`,
update or add the matching coverage here in the same change. Do not rely on the
existing harnesses as generic coverage for new install branches.

Common examples:

- new parser or output-contract logic
  - add or extend a focused parser assertion
- new best-effort CLI setup step
  - add a shell harness case that proves success, fallback, and failure
- new `main()` branch or summary outcome
  - extend `test_main.sh`

Keep install-specific validation in `validation/install/` and wire any new
harness into `test_install.sh` so the suite remains the single obvious
entrypoint.
