package action.devicepackage.model

import action.devicepackage.appinfo.AppInfo

data class AppInfoResult(
    val appInfo: AppInfo,
    val isPlaceholder: Boolean,
)
