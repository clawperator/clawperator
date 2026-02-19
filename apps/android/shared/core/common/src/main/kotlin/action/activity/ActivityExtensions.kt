package action.activity

import action.context.toast
import android.app.Activity
import android.app.WallpaperManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.activity.OnBackPressedCallback
import androidx.annotation.StringRes
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.LifecycleOwner

fun Activity.hardRestart() {
    // Copied from ActionLauncher
    finish()
    startActivity(intent)
    Process.killProcess(Process.myPid())
    startActivity(intent)
}

fun Activity.isNotDestroyedOrFinishing(): Boolean = !isFinishing && !isDestroyed

fun Activity.dismissKeyboard() {
    with(getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager) {
        if (isAcceptingText) {
            currentFocus?.let {
                hideSoftInputFromWindow(it.windowToken, 0)
            }
        }
    }
}

fun Activity.launchSystemWallpaperPicker(
    wallpaperComponentName: ComponentName,
    @StringRes message: Int? = null,
    @StringRes errorMessage: Int? = null,
) {
    try {
        startActivity(
            Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
                .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, wallpaperComponentName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        message?.let { toast(it) }
    } catch (e: ActivityNotFoundException) {
        try {
            startActivity(
                Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            message?.let { toast(it) }
        } catch (e2: ActivityNotFoundException) {
            errorMessage?.let { toast(it) }
        }
    }
}

/**
 * Opens to the "Install unknown apps" system settings page for the current app.
 */
fun Activity.launchManageUnknownAppSourcePermission(): Boolean = launchManageUnknownAppSourcePermission(packageName)

fun Activity.launchManageUnknownAppSourcePermission(packageName: String): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startActivitySafely(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:$packageName")
            },
        )
    } else {
        false
    }

/**
 * Opens to the "Install unknown apps" system settings UI for all device apps.
 */
fun Activity.launchManageUnknownAppSources(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startActivitySafely(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES))
    } else {
        false
    }

fun Activity.startActivitySafely(intent: Intent): Boolean =
    try {
        startActivity(intent)
        true
    } catch (ex: ActivityNotFoundException) {
        false
    } catch (ex: SecurityException) {
        false
    }

fun FragmentActivity.configureBackPressedCallback(
    lifecycleOwner: LifecycleOwner,
    onBackPressed: () -> Unit,
) {
    onBackPressedDispatcher
        .addCallback(
            lifecycleOwner,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    onBackPressed.invoke()
                }
            },
        )
}
