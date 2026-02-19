package action.system.window

import action.system.unit.SystemUnitManager
import android.app.Activity
import android.content.Context
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowInsets
import android.view.WindowManager
import androidx.annotation.RequiresApi
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import android.view.WindowManager as WindowManagerSystem

/**
 */
fun Activity.statusBarHeight(
    windowManager: WindowManagerSystem,
    systemUnitManager: SystemUnitManager,
): Dp {
    val rootWindowInsets = window.decorView.rootWindowInsets
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // Prioritize the app's window insets rather than the system's. This is helpful if say
        // returning from a fullscreen app, we don't want calculations in our app to be based on
        // fullscreen.
        rootWindowInsets
            ?.getInsets(WindowInsets.Type.statusBars())
            ?.top
            ?.let { systemUnitManager.pxToDp(it) }
            ?: getStatusBarHeightFromWindowManager(windowManager, systemUnitManager)
    } else {
        // Fallback for older versions using deprecated APIs
        @Suppress("DEPRECATION")
        rootWindowInsets?.systemWindowInsetTop?.let { systemUnitManager.pxToDp(it) }
            ?: getHeightFromResourceCompat("status_bar_height", systemUnitManager)
            ?: 24.dp // Default fallback
    }
}

@RequiresApi(Build.VERSION_CODES.R)
private fun getStatusBarHeightFromWindowManager(
    windowManager: WindowManager,
    systemUnitManager: SystemUnitManager,
): Dp =
    windowManager.currentWindowMetrics
        .windowInsets
        .getInsets(WindowInsets.Type.statusBars())
        .top
        .let { systemUnitManager.pxToDp(it) }

private fun Activity.getStatusBarHeightFromResourceCompat(systemUnitManager: SystemUnitManager): Dp? {
    val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
    return if (resourceId > 0) {
        val heightInPx = resources.getDimensionPixelSize(resourceId)
        systemUnitManager.pxToDp(heightInPx)
    } else {
        null
    }
}

fun Activity.navigationBarHeight(
    windowManager: WindowManagerSystem,
    systemUnitManager: SystemUnitManager,
): Dp {
    val rootWindowInsets = window.decorView.rootWindowInsets
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        rootWindowInsets
            ?.getInsets(WindowInsets.Type.navigationBars())
            ?.bottom
            ?.let { systemUnitManager.pxToDp(it) }
            ?: getNavBarHeightFromWindowManager(windowManager, systemUnitManager)
    } else {
        // Fallback for older versions using deprecated APIs
        @Suppress("DEPRECATION")
        rootWindowInsets?.systemWindowInsetBottom?.let { systemUnitManager.pxToDp(it) }
            ?: getHeightFromResourceCompat("navigation_bar_height", systemUnitManager)
            ?: 16.dp
    }
}

@RequiresApi(Build.VERSION_CODES.R)
private fun getNavBarHeightFromWindowManager(
    windowManager: WindowManager,
    systemUnitManager: SystemUnitManager,
): Dp =
    windowManager.currentWindowMetrics
        .windowInsets
        .getInsets(WindowInsets.Type.navigationBars())
        .bottom
        .let { systemUnitManager.pxToDp(it) }

private fun Activity.getHeightFromResourceCompat(
    resourceName: String,
    systemUnitManager: SystemUnitManager,
): Dp? {
    val resourceId = resources.getIdentifier(resourceName, "dimen", "android")
    return if (resourceId > 0) {
        val heightInPx = resources.getDimensionPixelSize(resourceId)
        systemUnitManager.pxToDp(heightInPx)
    } else {
        null
    }
}

/**
 * Returns the device size in pixels (status / nav bar inclusive).
 */
fun Context.deviceSize(): Pair<Int, Int> {
    val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val displayMetrics = DisplayMetrics()
    val display =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                display
            } catch (_: UnsupportedOperationException) {
                /**
                 * Caused by: java.lang.UnsupportedOperationException: Tried to obtain display from a Context not associated with one. Only visual Contexts (such as Activity or one created with Context#createWindowContext) or ones created with Context#createDisplayContext are associated with displays. Other types of Contexts are typically related to background entities and may return an arbitrary display.
                 */
                windowManager.defaultDisplay
            }
        } else {
            windowManager.defaultDisplay
        }
    display.getRealMetrics(displayMetrics)
    val height = displayMetrics.heightPixels // + systemUnitManager.dpToPx(navigationBarHeight).toInt()
    val width = displayMetrics.widthPixels
    return width to height
}
