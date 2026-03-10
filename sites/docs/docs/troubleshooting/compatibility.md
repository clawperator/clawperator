# Version Compatibility

Clawperator expects the Node CLI and the installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) to move together.

## Compatibility rule

The CLI and the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) are compatible when their `major.minor` versions match.

Examples:

- CLI `0.1.4` and app `0.1.4` - compatible
- CLI `0.1.4` and app `0.1.9` - compatible
- CLI `0.1.4` and app `0.1.4-d` - compatible
- CLI `0.1.4-rc.1` and app `0.1.4-d` - compatible
- CLI `0.1.4` and app `0.2.x` - not compatible

Notes:

- Patch differences are allowed.
- The local debug suffix `-d` is ignored for compatibility checks.
- Prerelease suffixes such as `-alpha.1`, `-beta.2`, and `-rc.1` are parsed, but compatibility still depends only on matching `major.minor`.

## Check versions

Print the CLI version:

```bash
clawperator version
```

Check the CLI against the installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md):

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

The compatibility check reports:

- CLI version
- installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version
- installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) `versionCode`
- receiver package checked
- compatibility verdict
- remediation guidance when versions do not match

`clawperator doctor` also runs this check after confirming the requested receiver package is installed.

## Common mismatch symptoms

When the CLI and the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) are out of sync, you may see:

- `VERSION_INCOMPATIBLE` from `clawperator doctor` or `clawperator version --check-compat`
- `RESULT_ENVELOPE_MALFORMED` if the CLI and the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) disagree on result shape
- `EXECUTION_ACTION_UNSUPPORTED` when the CLI sends an action the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) does not support yet
- timeouts or handshake failures after a partial upgrade

## Remediation

Upgrade the CLI:

```bash
npm install -g clawperator@latest
```

Install a compatible [Clawperator Operator Android app](../getting-started/android-operator-apk.md):

```bash
adb install -r <apk_path>
```

If you are using a local debug build, make sure the receiver package matches the installed variant:

- release app package: `com.clawperator.operator`
- debug app package: `com.clawperator.operator.dev`

If the [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version cannot be read, verify the device can return package metadata:

```bash
adb shell dumpsys package <receiverPackage>
```
