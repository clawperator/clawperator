package action.packagemanager

import action.buildconfig.BuildUtils.AT_LEAST_ANDROID_12
import action.buildconfig.BuildUtils.AT_LEAST_ANDROID_8
import action.resources.getDrawableForDensityChecked
import android.content.pm.LauncherActivityInfo
import android.content.pm.PackageManager
import android.content.res.Resources
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import androidx.annotation.DrawableRes

/**
 * Resolve a fallback icon [DrawableRes]. See #4953.
 */
fun interface FallbackIconResIdResolver {
    @DrawableRes fun resolveResId(): Int?
}

fun LauncherActivityInfo.getBestIcon(
    packageManager: PackageManager,
    density: Int,
    fallbackIconResIdResolver: FallbackIconResIdResolver? = null,
): Drawable? {
    // the icon specified in the manifest for the activity, or failing that, the application icon
    val resolvedActivityIcon =
        getIcon(density)?.also {
            if (AT_LEAST_ANDROID_8) {
                if (it is AdaptiveIconDrawable) {
                    return it
                }
            } else {
                return it
            }
        }

    // We get here if the resolved icon is not an adaptive icon. In that case, try and find an
    // adaptive icon (see #4953).
    val explicitIconRes = resolveFallbackIconResId(fallbackIconResIdResolver)
    if (explicitIconRes != null && explicitIconRes != 0) {
        getIcon(packageManager, explicitIconRes, density)?.also { return it }
    }

    return resolvedActivityIcon
}

private fun LauncherActivityInfo.resolveFallbackIconResId(
    fallbackIconResIdResolver: FallbackIconResIdResolver?,
): Int? {
    var explicitIconRes: Int? = null

    if (AT_LEAST_ANDROID_12) {
        val activityInfo = activityInfo
        if (activityInfo.icon != 0) {
            explicitIconRes = activityInfo.icon
        }
    }

    if (explicitIconRes == null || explicitIconRes == 0) {
        explicitIconRes = fallbackIconResIdResolver?.resolveResId()
    }

    return explicitIconRes
}

fun LauncherActivityInfo.getBestIconBadged(
    packageManager: PackageManager,
    density: Int,
    fallbackIconResIdResolver: FallbackIconResIdResolver? = null,
): Drawable? =
    getBestIcon(packageManager, density, fallbackIconResIdResolver)
        ?.let { packageManager.getUserBadgedIcon(it, user) }

fun LauncherActivityInfo.getIcon(
    packageManager: PackageManager,
    iconRes: Int,
    density: Int,
): Drawable? {
    try {
        return packageManager
            .getResourcesForApplication(applicationInfo)
            .getDrawableForDensityChecked(iconRes, density, null)
    } catch (ignored: PackageManager.NameNotFoundException) {
    } catch (ignored: Resources.NotFoundException) {
    }
    return null
}
