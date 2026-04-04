# Eval Phase 3 Findings

## Published Runtime Setup

Running the live installer from `https://clawperator.com/install.sh` succeeded on this machine.

Observed flow:

1. Detected macOS (`Darwin`).
2. Confirmed Node.js 22.22.0, `curl`, `adb`, and `git` were already present.
3. Installed the published Clawperator CLI with `npm install -g clawperator@latest`.
4. Wrote a local agent guide to `~/.clawperator/AGENTS.md`.
5. Ran `clawperator doctor --json`.
6. Downloaded operator metadata from `https://downloads.clawperator.com/operator/latest.json`.
7. Downloaded `operator.apk` version `0.5.2`.
8. Verified the APK checksum.
9. Installed the release Operator APK on the connected device.
10. Set up Clawperator Skills and updated `CLAWPERATOR_SKILLS_REGISTRY` in `~/.zshrc`.
11. Finished with a healthy doctor report.

Installed runtime details:

- `which clawperator` -> `/opt/homebrew/bin/clawperator`
- `clawperator version` -> `{"cliVersion":"0.5.2"}`
- `clawperator doctor --json` -> `ok: true`, `criticalOk: true`
- Connected device: `<device_serial>`
- Installed Operator package: `com.clawperator.operator`

Notes:

- The installer uses the release Operator APK by default, not `.dev`.
- The script prints a post-install reminder to source `~/.zshrc` in the current shell.
- The live URL install path is the one to trust for Phase 3 published-runtime validation.
