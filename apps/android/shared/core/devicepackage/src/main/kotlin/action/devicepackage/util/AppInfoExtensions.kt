package action.devicepackage.util

import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoItemsSyncResolver
import action.icon.IconResolver
import android.graphics.drawable.Drawable

fun AppInfo.resolveIconInfoImmediate(iconResolver: IconResolver): Pair<Drawable, Int> {
    if (this is AppInfoItemsSyncResolver) {
        return resolveIconInfoSync(iconResolver)
    } else {
        throw notAnAppInfoSyncResolverException(this)
    }
}

fun AppInfo.resolveIconHighlightColorImmediate(iconResolver: IconResolver): Int {
    if (this is AppInfoItemsSyncResolver) {
        return resolveIconHighlightColorSync(iconResolver)
    } else {
        throw notAnAppInfoSyncResolverException(this)
    }
}

private fun notAnAppInfoSyncResolverException(appInfo: AppInfo): Exception = UnsupportedOperationException("${appInfo.javaClass.simpleName} must implement AppInfoItemsSyncResolver interface")
