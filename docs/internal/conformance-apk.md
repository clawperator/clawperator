# Conformance Test APK (app-conformance)

The `app-conformance` APK is a dedicated Android app with a deterministic, stable UI designed for testing Clawperator's execution layer without relying on third-party apps.

## Building and Installing

To build the APK:
```bash
./gradlew :apps:android:app-conformance:assembleDebug
```

To install and launch on the connected device:
```bash
adb install apps/android/app-conformance/build/outputs/apk/debug/app-conformance-debug.apk
adb shell am start -n com.clawperator.conformance/clawperator.conformance.MainActivity
```

## UI Structure and Selectors

The app uses Jetpack Compose with stable `testTag` attributes, which are reflected as `resource-id` in the accessibility tree (prefixed with the package name).

### Home Screen
- **Counter Text:** `com.clawperator.conformance:id/txt_counter`
- **Increment Button:** `com.clawperator.conformance:id/btn_increment`
- **Status Text:** `com.clawperator.conformance:id/txt_enabled_state`
- **Status Toggle:** `com.clawperator.conformance:id/tgl_enabled`
- **Open List Button:** `com.clawperator.conformance:id/btn_open_list`

### List Screen
- **Back Button:** `com.clawperator.conformance:id/btn_back`
- **LazyColumn:** `com.clawperator.conformance:id/list_main`
- **List Items:** `com.clawperator.conformance:id/row_0` to `row_199`
- **Item Container:** `com.clawperator.conformance:id/item_row_0`

### Detail Screen
- **Selection Text:** `com.clawperator.conformance:id/txt_selected_row`
- **Back to List Button:** `com.clawperator.conformance:id/btn_back_to_list`

## Use Case: Smoke Testing
You can use the Conformance APK to verify that Clawperator can:
1. `open_app` and `close_app`.
2. `click` on stable nodes.
3. `read_text` from specific elements.
4. `scroll_and_click` through long lists.
5. Verify state changes (e.g., counter increments).
