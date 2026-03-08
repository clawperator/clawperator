# Version Compatibility

Clawperator expects the Node CLI and the installed Android Operator APK to move together.

## Compatibility rule

The CLI and APK are compatible when their `major.minor` versions match.

Examples:

- CLI `0.1.4` and APK `0.1.4` - compatible
- CLI `0.1.4` and APK `0.1.9` - compatible
- CLI `0.1.4` and APK `0.1.4-d` - compatible
- CLI `0.1.4-rc.1` and APK `0.1.4-d` - compatible
- CLI `0.1.4` and APK `0.2.0` - not compatible

Notes:

- Patch differences are allowed.
- The local debug suffix `-d` is ignored for compatibility checks.
- Prerelease suffixes such as `-alpha.1`, `-beta.2`, and `-rc.1` are parsed, but compatibility still depends only on matching `major.minor`.

## Check versions

Print the CLI version:

```bash
clawperator version
```

Check the CLI against the installed APK:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

The compatibility check reports:

- CLI version
- installed APK version
- installed APK versionCode
- receiver package checked
- compatibility verdict
- remediation guidance when versions do not match

`clawperator doctor` also runs this check after confirming the requested receiver package is installed.

## Common mismatch symptoms

When the CLI and APK are out of sync, you may see:

- `VERSION_INCOMPATIBLE` from `clawperator doctor` or `clawperator version --check-compat`
- `RESULT_ENVELOPE_MALFORMED` if the CLI and APK disagree on result shape
- `EXECUTION_ACTION_UNSUPPORTED` when the CLI sends an action the APK does not support yet
- timeouts or handshake failures after a partial upgrade

## Remediation

Upgrade the CLI:

```bash
npm install -g clawperator@latest
```

Install a compatible APK:

```bash
adb install -r <apk_path>
```

If you are using a local debug build, make sure the receiver package matches the installed variant:

- release APK: `com.clawperator.operator`
- debug APK: `com.clawperator.operator.dev`

If the APK version cannot be read, verify the device can return package metadata:

```bash
adb shell dumpsys package <receiverPackage>
```
