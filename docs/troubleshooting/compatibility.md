# Version Compatibility

## Purpose

Define how the CLI checks compatibility with the installed Operator APK, what counts as compatible, which errors can be returned, and how to recover when versions do not align.

## Sources

- Compatibility probe: `apps/node/src/domain/version/compatibility.ts`
- Doctor readiness check: `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- Error codes: `apps/node/src/contracts/errors.ts`

## Compatibility Rule

Current compatibility is exact normalized version equality between:

- CLI version from `package.json`
- installed APK `versionName` from `adb shell dumpsys package <operatorPackage>`

Normalization rule:

- versions are trimmed and any trailing `-d` is removed before comparison

Examples:

| CLI | APK | Compatible |
| --- | --- | --- |
| `0.1.0` | `0.1.0` | yes |
| `0.1.0-d` | `0.1.0` | yes |
| `0.1.1` | `0.1.0` | no |

## How Compatibility Is Checked

Doctor uses the readiness check id:

```text
readiness.version.compatibility
```

That check calls `probeVersionCompatibility()` and converts the result into a `DoctorCheckResult`.

Passing doctor example:

```json
{
  "id": "readiness.version.compatibility",
  "status": "pass",
  "summary": "CLI 0.1.0 is compatible with installed APK 0.1.0.",
  "evidence": {
    "cliVersion": "0.1.0",
    "apkVersion": "0.1.0",
    "apkVersionCode": 1,
    "operatorPackage": "com.clawperator.operator.dev"
  }
}
```

Failing doctor example:

```json
{
  "id": "readiness.version.compatibility",
  "status": "fail",
  "code": "VERSION_INCOMPATIBLE",
  "summary": "CLI and installed APK versions are not compatible.",
  "detail": "CLI version 0.1.1 is not compatible with installed APK version 0.1.0.",
  "evidence": {
    "cliVersion": "0.1.1",
    "apkVersion": "0.1.0",
    "operatorPackage": "com.clawperator.operator"
  }
}
```

## Version Probing Flow

`probeVersionCompatibility()` performs these checks:

1. read CLI version from package metadata
2. parse the CLI version using the strict `x.y.z` compatibility regex after normalization
3. confirm the requested Operator package is installed
4. if the requested package is missing, check whether the alternate known variant is installed
5. read installed package info via adb
6. parse `versionName` and optional `versionCode`
7. compare normalized CLI and APK versions

Important consequences:

- compatibility is not "same major version" or "same minor version"
- it is exact normalized equality

## Error Codes

These are the compatibility-specific codes currently returned from this flow:

| Code | Meaning |
| --- | --- |
| `VERSION_INCOMPATIBLE` | CLI and installed APK versions do not match after normalization |
| `APK_VERSION_UNREADABLE` | package metadata could not provide `versionName` |
| `APK_VERSION_INVALID` | APK version string exists but is not parseable as compatibility version |
| `CLI_VERSION_INVALID` | CLI version metadata is missing or not parseable |

Other closely related codes that may block compatibility checks before version comparison:

| Code | Meaning |
| --- | --- |
| `OPERATOR_NOT_INSTALLED` | expected package is not installed |
| `OPERATOR_VARIANT_MISMATCH` | the other known package variant is installed instead |
| `DEVICE_SHELL_UNAVAILABLE` | adb shell could not read package state |

## Parse Rules

The accepted compatibility format is:

```text
<major>.<minor>.<patch>
```

Examples:

- valid: `0.1.0`
- valid after normalization: `0.1.0-d`
- invalid: `main`
- invalid: `0.1`

## Recovery

### When versions are incompatible

The probe returns remediation guidance to align CLI and APK versions.

Typical recovery options:

1. reinstall the CLI
2. install the matching APK version
3. for debug package workflows, rebuild and reinstall the debug APK from the same checkout

Release install path:

- download the version-matched APK URL generated from the CLI version
- download the matching sha256 URL
- install with `clawperator operator setup --apk ...`

### When the wrong variant is installed

If the debug package is installed but the release package was requested, or vice versa:

- pass the installed package via `--operator-package`
- or reinstall the intended variant

### When CLI metadata is invalid

If `CLI_VERSION_INVALID` occurs:

- reinstall the CLI package

### When APK metadata is unreadable or invalid

If `APK_VERSION_UNREADABLE` or `APK_VERSION_INVALID` occurs:

- reinstall the Operator APK
- rerun `clawperator doctor --json`

## Machine-Checkable Success Condition

Treat compatibility as healthy only when:

- `readiness.version.compatibility.status == "pass"`
- or `clawperator version --check-compat --json` shows `compatible: true`

Do not infer compatibility from app presence alone.
