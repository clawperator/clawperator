# Next Agent Prompt

Use this prompt for the next implementation pass:

```text
Work in `/Users/chrislacy/clawpilled/clawperator`.

Context:
- The Android APK release pipeline is already live.
- Git tags build signed APKs, publish them to GitHub Releases and Cloudflare R2, and update `https://downloads.clawperator.com/operator/latest.json`.
- The public stable redirect URLs are already working:
  - `https://clawperator.com/operator.apk`
  - `https://clawperator.com/apk`
  - `https://clawperator.com/install.apk`
- The remaining work is to verify and tighten the installer flow, then align the docs with the real live behavior.

Your task:
1. Audit `scripts/install.sh` against the live hosted APK flow.
2. Run it as far end-to-end as possible in this environment.
3. Fix any issues you find in the script.
4. Update the user-facing docs so they accurately reflect the verified install flow.
5. Clearly report what still requires real-device manual validation.

Constraints:
- Be pragmatic. Do not invent enterprise process or extra governance work.
- Do not add speculative architecture.
- Keep the scope limited to installer behavior and user-facing documentation.
- Prefer `https://clawperator.com/operator.apk` as the canonical public install URL unless the code/docs strongly justify otherwise.
- Treat `/apk` and `/install.apk` as convenience aliases unless there is a strong reason to elevate them.

Specific verification goals:
- Confirm `install.sh` resolves `latest.json` correctly.
- Confirm it downloads the APK and checksum correctly.
- Confirm SHA-256 verification works.
- Confirm its behavior when `adb` is:
  - present with one device
  - present with multiple devices
  - absent
- Confirm the script’s failure messages are clear and actionable.
- Confirm the script’s output does not send users to stale GitHub Releases install paths.

Docs to review and update if needed:
- `README.md`
- `docs/first-time-setup.md`
- `docs/troubleshooting.md`
- `docs/RELEASING.md`
- `apps/node/README.md`

Expected output:
- code changes if installer fixes are needed
- doc changes to match real behavior
- a concise summary of:
  - what was verified automatically
  - what was fixed
  - what still needs a real Android device check

Before committing:
- run `./gradlew :app:assembleDebug`
- run `./gradlew unitTest`
- run `npm --prefix apps/node run build`
- run `npm --prefix apps/node run test`
- run any installer-specific checks you need, including `bash -n scripts/install.sh`
```
