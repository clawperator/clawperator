package action.devicepackage

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo

suspend fun PackageManager.getCreateShortcutResolveInfos(): List<ResolveInfo> {
    val shortcutsIntent = Intent(Intent.ACTION_CREATE_SHORTCUT)
    return queryIntentActivities(shortcutsIntent, 0)
}

val List<ResolveInfo>.filterActivityShortcuts: List<ResolveInfo>
    get() = filter { it.activityInfo != null }

fun ApplicationInfo.isDebuggable(): Boolean = (flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

fun ApplicationInfo.isSystemApp(): Boolean = (flags and ApplicationInfo.FLAG_SYSTEM) != 0
