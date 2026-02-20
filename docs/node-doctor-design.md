# Clawperator Doctor v0.1 Design Spec

## 0. Primary Outcome

From a clean Linux/macOS box with only Node installed, `clawperator doctor` must guide an agent or user to a verified state where this succeeds end-to-end:
- Connected Android device is reachable via `adb`.
- Operator APK is installed, running, and ready (Developer options, USB debugging, and Accessibility enabled).
- Node CLI can dispatch an `ACTION_AGENT_COMMAND` and parse exactly one canonical `[Clawperator-Result]` envelope.
- A minimal automation can open `com.android.settings` and confirm it via observation.

---

## 1. Command Shape

### 1.1 Subcommands & Modes
- `clawperator doctor`: Fast, non-destructive checks. No installs. No building. No device mutation beyond safe reads.
- `clawperator doctor --fix`: Best-effort remediation for host-side prerequisites only (packages, PATH, permissions, udev rules). Never enables device settings automatically beyond opening Settings screens.
- `clawperator doctor --full`: Triggers Android build + install + handshake + smoke. Targeted for CI or fresh environment setup.
- `clawperator doctor --json`: Machine-readable report for agents (status, codes, hints, commands to run).
- `clawperator doctor --device-id <serial>`: Required if multiple devices are connected.

### 1.2 Output Contract
Doctor should emit:
- **Human Summary**: Grouped sections (Host, Device, Runtime, Handshake) with status indicators (Green/Yellow/Red).
- **Final Guidance**: A "Next command to run" line.
- **JSON Payload**: (Optional) Stable error codes and metadata for automated recovery.

---

## 2. Checks & Logic

### 2.1 Host: Runtime + PATH
| Check | Failure Code | --fix Action |
|-------|--------------|--------------|
| Node version >= 22 | `NODE_TOO_OLD` | Suggest version manager (nvm/asdf) |
| `adb` presence | `ADB_NOT_FOUND` | Install `platform-tools` |
| `adb` server health | `ADB_SERVER_FAILED` | `adb kill-server && adb start-server` |
| USB Permissions (Linux) | `ADB_NO_USB_PERMISSIONS` | Generate udev rules + reload |

### 2.2 Device Discovery
- **States**: `none` (`NO_DEVICES`), `multiple` (`DEVICE_ID_REQUIRED`), `unauthorized` (`DEVICE_UNAUTHORIZED`), `offline` (`DEVICE_OFFLINE`).
- **Authorization Flow**: Guide user to accept RSA prompt on device.

### 2.3 Device Capability Sanity
- **SDK Level**: `ro.build.version.sdk` (Floor check).
- **Display**: `wm size`, `wm density`.
- **Storage**: `df /data` (Warn if < 500MB).
- **Shell**: `DEVICE_SHELL_UNAVAILABLE`.

### 2.4 Operator APK Presence
- Check for `com.clawperator.operator.dev` (default) or `com.clawperator.operator`.
- Detect variant mismatch (e.g., Release installed but CLI expecting Dev).
- Code: `RECEIVER_NOT_INSTALLED`, `RECEIVER_VARIANT_MISMATCH`.

### 2.5 Operator Readiness ("The 3 Requirements")
- **Developer Options**: `settings get global development_settings_enabled`.
- **USB Debugging**: `settings get global adb_enabled`.
- **Accessibility**: Verified via **Handshake** (not just settings check).

---

## 3. The Handshake (Core Invariant)

The handshake is the only end-to-end proof that the "Brain" (Node) can control the "Hand" (Android).

### 3.1 Handshake Design: `snapshot_ui`
- **Action**: Send a `snapshot_ui` command with a unique `commandId`.
- **Success Criteria**:
  1. Node receives `[Clawperator-Result]` via logcat within 5s.
  2. `commandId` matches.
  3. `status: "success"`.
  4. Payload contains valid UI XML.
- **Failures**: `RESULT_ENVELOPE_TIMEOUT`, `RESULT_ENVELOPE_MALFORMED`, `ACCESSIBILITY_NOT_RUNNING`.

---

## 4. Build & Deploy (`--full`)

- **Host Prereqs**: JDK 17+, `ANDROID_HOME`, Licenses accepted.
- **Build**: `./gradlew :apps:android:app:assembleDebug`.
- **Deploy**: `./gradlew :apps:android:app:installDebug`.
- **Launch**: `adb shell am start -n <receiverPackage>/<MainActivity>`.
- **Process Check**: `adb shell pidof <receiverPackage>`.

---

## 5. Smoke Test: Settings Open

Final verification step:
1. `open_app { applicationId: "com.android.settings" }`.
2. Delay 1s.
3. `snapshot_ui`.
4. Verify `com.android.settings` is in the UI tree.

---

## 6. Data Model (Node)

```typescript
type DoctorStatus = "pass" | "warn" | "fail";

interface DoctorCheckResult {
  id: string;                 // e.g., "device.accessibility"
  status: DoctorStatus;
  code?: string;              // e.g., "ACCESSIBILITY_DISABLED"
  summary: string;
  detail?: string;
  fix?: {
    title: string;
    commands: string[];
  };
}

interface DoctorReport {
  ok: boolean;
  deviceId?: string;
  checks: DoctorCheckResult[];
  nextCommand?: string;
}
```

---

## 7. Implementation Roadmap

1. **Phase 1: Doctor Core**: Orchestrator and basic Host/Device checks.
2. **Phase 2: APK & Readiness**: Package detection and settings-based checks.
3. **Phase 3: Handshake**: Integration with `AndroidBridge` and `LogcatResultReader`.
4. **Phase 4: CLI & Fix**: Wiring flags and human-friendly output.
5. **Phase 5: Build/Full**: Gradle integration.
\n---\n\n*Note: v0.1 Verified on local emulator-5554 (API 34) including full build, install, handshake, and smoke test.*
