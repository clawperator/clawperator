package action.packagemanager

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable

fun PackageManager.resolveDefaultApplicationIdChecked(intent: Intent): String? =
    try {
        val resolveInfo = resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        resolveInfo?.activityInfo?.packageName
    } catch (ex: UnsupportedOperationException) {
        // Some Android 7 devices throw exception
        null
    } catch (ex: SecurityException) {
        // An issue on Android 11 HMD / Rockchip devices... (#5032)
        null
    }

/**
 * Returns the applicationId of the default launcher. Will return false if no
 * default launcher has been set (this happens when the user installs a new
 * launcher, and the user has yet to specify a new default).
 */
fun PackageManager.resolveDefaultLauncherApplicationId(): String? {
    resolveActivity(
        Intent("android.intent.action.MAIN")
            .addCategory("android.intent.category.HOME"),
        PackageManager.MATCH_DEFAULT_ONLY,
    )?.let {
        it.activityInfo?.packageName?.let { appId ->
            if (appId != "android") {
                return appId
            }
        }
    }
    return null
}

fun PackageManager.getBestLaunchComponentNameChecked(componentName: ComponentName): ComponentName? =
    getBestLaunchComponentNameChecked(
        Intent(Intent.ACTION_MAIN).apply {
            component = componentName
            addCategory(Intent.CATEGORY_LAUNCHER)
        },
    )

fun PackageManager.getBestLaunchComponentNameChecked(packageName: String): ComponentName? =
    getBestLaunchComponentNameChecked(
        Intent().apply {
            setPackage(packageName)
        },
    )

fun PackageManager.getBestLaunchComponentNameChecked(
    packageName: String?,
    suggestedClassName: String?,
): ComponentName? {
    if (packageName == null || packageName.isEmpty()) return null

    return if (suggestedClassName != null) {
        getBestLaunchComponentNameChecked(ComponentName(packageName, suggestedClassName))
    } else {
        getBestLaunchComponentNameChecked(packageName)
    }
}

/**
 * Given an [intent], find the best [ComponentName] to load that Intent that exists on the device.
 *
 * You have an [intent] and wish to verify any [Intent.getComponent] exists on the device. Useful
 * if using a stale [ComponentName] that may not longer be valid due to an app updating its
 * [Activity] class name.
 *
 * If an [Activity] can't be found, fall back to results of [PackageManager.getLaunchIntentForPackage].
 */
@SuppressLint("QueryPermissionsNeeded")
fun PackageManager.getBestLaunchComponentNameChecked(intent: Intent): ComponentName? {
    return try {
        val component = intent.component
        val packageName = component?.packageName ?: intent.getPackage() ?: return null
        component?.className?.also { desiredClassName ->
            // If a desired class name exists, check there's a matching Activity
            queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
                ?.let { resolveInfos ->
                    resolveInfos
                        .firstOrNull { it.activityInfo?.name == desiredClassName }
                        ?.let { return ComponentName(packageName, desiredClassName) }
                }
        }

        getLaunchIntentForPackage(packageName)?.component
    } catch (ex: PackageManager.NameNotFoundException) {
        null
    }
}

@SuppressLint("QueryPermissionsNeeded")
fun PackageManager.getBestLaunchIntentChecked(packageName: String): Intent? =
    try {
        getLaunchIntentForPackage(packageName)
    } catch (ex: PackageManager.NameNotFoundException) {
        null
    }

fun PackageManager.getApplicationIconChecked(packageName: String): Drawable? =
    try {
        getApplicationIcon(packageName)
    } catch (ignored: PackageManager.NameNotFoundException) {
        null
    }
