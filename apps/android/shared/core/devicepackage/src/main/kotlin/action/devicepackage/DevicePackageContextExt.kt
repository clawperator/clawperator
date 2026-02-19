package action.devicepackage

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Telephony
import androidx.core.net.toUri

fun Context.getDefaultAlarmApplicationId(): String? {
    val intent = Intent(AlarmClock.ACTION_SET_ALARM)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultAudioRecorderApplicationId(): String? {
    val intent = Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultBrowserApplicationId(): String? {
    val intent = Intent(Intent.ACTION_VIEW, "http://www.google.com".toUri())
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultCalendarApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultCameraApplicationId(): String? {
    val intent = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultContactsApplicationId(): String? {
//    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("content://contacts/people/"))
//    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
//    return resolveInfo?.activityInfo?.packageName
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            data = ContactsContract.Contacts.CONTENT_URI
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultDialerApplicationId(): String? {
    val intent = Intent(Intent.ACTION_DIAL)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultDownloadsApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("content://downloads/my_downloads")
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultDocumentViewerApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse("file:///example.pdf"), "application/pdf")
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultEmailApplicationId(): String? {
    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"))
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultFileManagerApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "*/*"
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultGalleryApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse("content://media/external/images/media/1"), "image/*")
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultLauncherApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_HOME)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultMapsApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("geo:0,0?q=Example")
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultMarketplaceApplicationId(): String? {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.example"))
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultMusicApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse("file:///"), "audio/*")
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultSettingsApplicationId(): String? {
    val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultSmsAppApplicationId(): String? {
    val smsPackage = Telephony.Sms.getDefaultSmsPackage(this)
    if (smsPackage != null) {
        return smsPackage
    }

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("sms:+13335557654"))
    return getLauncherAppForResolveInfos(
        this,
        packageManager.queryIntentActivities(intent, 0),
    )?.firstOrNull()?.activityInfo?.packageName
}

fun Context.getDefaultVideoPlayerApplicationId(): String? {
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse("file:///"), "video/*")
        }
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun Context.getDefaultVoiceAssistantApplicationId(): String? {
    val intent = Intent(Intent.ACTION_ASSIST)
    val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
    return resolveInfo?.activityInfo?.packageName
}

fun getLauncherAppForApplicationIds(
    context: Context,
    applicationId: String,
): List<ResolveInfo>? {
    val intent =
        Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setPackage(applicationId)
    val resolveInfos = context.packageManager.queryIntentActivities(intent, 0)
    if (resolveInfos.size > 0) {
        return resolveInfos
    }
    return null
}

fun getLauncherAppForResolveInfos(
    context: Context,
    resolveInfos: List<ResolveInfo>?,
): List<ResolveInfo>? {
    if (resolveInfos != null && resolveInfos.size > 0) {
        val result = ArrayList<ResolveInfo>()
        for (resolveInfo in resolveInfos) {
            if (resolveInfo.activityInfo != null) {
                val activityInfo = resolveInfo.activityInfo
                val launcherInfos =
                    getLauncherAppForApplicationIds(
                        context,
                        activityInfo.packageName,
                    )
                val rootResolveInfo =
                    getRootResolveInfo(context, activityInfo)

                if (launcherInfos.isNullOrEmpty() || rootResolveInfo == null) {
                    continue
                }

                // Now find an item with a matching root Activity. This ensures for apps with multiple
                // launcher Activities (such as Samsung bundling Dialer and Contacts in the same package),
                // we use the right one. Re #1096.
                for (launcherInfo in launcherInfos) {
                    val launcherRoot =
                        getRootResolveInfo(
                            context,
                            launcherInfo.activityInfo,
                        )
                    if (launcherRoot != null) {
                        if (rootResolveInfo.activityInfo.name == launcherRoot.activityInfo.name) {
                            if (!isResolveInfoOnList(
                                    launcherInfo,
                                    result,
                                )
                            ) {
                                result.add(launcherInfo)
                            }
                        }
                    }
                }
            }
        }
        if (result.size > 0) {
            return result
        }
    }

    return null
}

private fun getRootResolveInfo(
    context: Context,
    activityInfo: ActivityInfo,
): ResolveInfo? {
    var result = activityInfo
    while (result.targetActivity != null && result.targetActivity != result.name) {
        try {
            result =
                context.packageManager.getActivityInfo(
                    ComponentName(result.packageName, result.targetActivity),
                    0,
                )
        } catch (e: PackageManager.NameNotFoundException) {
        }
    }

    val activities =
        context.packageManager.queryIntentActivities(
            Intent().setComponent(ComponentName(result.packageName, result.name)),
            0,
        )
    if (activities.size > 0) {
        return activities[0]
    }

    return null
}

private fun isResolveInfoOnList(
    resolveInfo: ResolveInfo,
    list: List<ResolveInfo>,
): Boolean {
    if (resolveInfo.activityInfo != null) {
        for (i in list) {
            if (i.activityInfo != null &&
                i.activityInfo.name == resolveInfo.activityInfo.name &&
                i.activityInfo.packageName == resolveInfo.activityInfo.packageName
            ) {
                return true
            }
        }
    }
    return false
}
