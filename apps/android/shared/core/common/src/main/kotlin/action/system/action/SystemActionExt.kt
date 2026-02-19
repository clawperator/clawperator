package action.system.action

import android.content.Context
import android.os.IBinder

fun Context.showNotificationsPanel(): Boolean =
    try {
        val statusBarManager = Class.forName("android.app.StatusBarManager")

        val expand =
            try {
                statusBarManager.getMethod("expandNotificationsPanel")
            } catch (ex: NoSuchMethodException) {
                try {
                    statusBarManager.getMethod("expand")
                } catch (ex: NoSuchMethodException) {
                    null
                }
            }
        val service: Any? = getSystemService("statusbar")

        if (service != null && expand != null) {
            expand.invoke(service)
            true
        } else {
            false
        }
    } catch (ex: Exception) {
        ex.printStackTrace()
        false
    }

fun Context.showQuickSettings(): Boolean =
    try {
        val statusBarManager = Class.forName("android.app.StatusBarManager")

        // Look for the "expandSettingsPanel" method
        val expand = statusBarManager.getMethod("expandSettingsPanel")
        val service = getSystemService("statusbar")

        if (service != null) {
            expand.invoke(service)
            true
        } else {
            false
        }
    } catch (ex: Exception) {
        ex.printStackTrace()
        false
    }

/**
 * Try and show the recent apps screen. This doesn't work on recent Android devices.
 */
fun Context.showRecentApps(): Boolean {
    return try {
        // On Samsung Oreo devices, this code runs, but nothing happens. Just early exit. #3120.
//        if (Build.VERSION.SDK_INT >= VERSION_CODES.O && deviceModel.isTouchWiz()) {
//            return false
//        }

        val serviceManagerClass = Class.forName("android.os.ServiceManager")
        val getService = serviceManagerClass.getMethod("getService", String::class.java)

        val binder = getService.invoke(null, "statusbar") as IBinder

        val interfaceDescriptor = binder.interfaceDescriptor ?: return false
        val statusBarClass = Class.forName(interfaceDescriptor)

        val m = statusBarClass.declaredMethods

        // Get the "asInterface" method and create the StatusBar object
        val asInterfaceMethod = statusBarClass.declaredClasses[0].getMethod("asInterface", IBinder::class.java)
        val statusBarObject = asInterfaceMethod.invoke(null, binder)

        val toggleRecentsMethod = statusBarClass.getMethod("toggleRecentApps")
        toggleRecentsMethod.isAccessible = true

        toggleRecentsMethod.invoke(statusBarObject)
        true
    } catch (ex: java.lang.Exception) {
        ex.printStackTrace()
        false
    }
}
