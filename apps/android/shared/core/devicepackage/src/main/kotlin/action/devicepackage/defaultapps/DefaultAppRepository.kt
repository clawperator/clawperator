package action.devicepackage.defaultapps

import action.devicepackage.appinfo.AppInfoHandle

interface DefaultAppRepository {
    val defaultBrowser: AppInfoHandle?
}
