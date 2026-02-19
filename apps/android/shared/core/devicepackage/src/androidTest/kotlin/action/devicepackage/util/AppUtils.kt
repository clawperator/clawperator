package action.devicepackage.util

import android.content.pm.PackageManager

fun getSystemUiAppId() = "com.android.systemui"

fun PackageManager.loadAppLabel(appId: String) =
    getApplicationInfo(appId, 0)
        .loadLabel(this)
