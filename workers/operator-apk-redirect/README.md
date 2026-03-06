# Operator APK Redirect Worker

This Worker serves the stable APK redirect for Clawperator.

Supported public paths:

- `/operator.apk`
- `/apk`
- `/install.apk`

Behavior:

1. Fetch `CLAWPERATOR_APK_METADATA_URL`
2. Read `apk_url` from the JSON payload
3. Return `302` to that immutable versioned APK URL

Expected production environment variable:

- `CLAWPERATOR_APK_METADATA_URL=https://downloads.clawperator.com/operator/latest.json`

Cloudflare dashboard setup:

1. Create Worker `operator-apk-redirect`
2. Add production variable `CLAWPERATOR_APK_METADATA_URL`
3. Deploy the Worker
4. Add routes:
   - `clawperator.com/operator.apk`
   - `clawperator.com/apk`
   - `clawperator.com/install.apk`
