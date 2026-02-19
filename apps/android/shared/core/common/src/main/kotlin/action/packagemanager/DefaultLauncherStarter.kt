package action.packagemanager

import android.app.Activity
import android.content.Context
import android.content.Intent

/**
 * Helper class to trigger the default launcher Activity
 */
interface DefaultLauncherStarter {
    fun startDefaultLauncher(activity: Activity): Boolean
}

/**
 *
 */
class DefaultLauncherStarterSystem(
    private val context: Context,
) : DefaultLauncherStarter {
        override fun startDefaultLauncher(activity: Activity): Boolean {
            context.packageManager.resolveDefaultLauncherApplicationId()?.let {
                try {
                    activity.startActivity(
                        Intent(Intent.ACTION_MAIN)
                            .addCategory(Intent.CATEGORY_HOME)
                            .setPackage(it),
                    )
                    return true
                } catch (ignored: SecurityException) {
                }
            }
            return false
        }
    }

/**
 *
 */
class DefaultLauncherStarterError : DefaultLauncherStarter {
        override fun startDefaultLauncher(activity: Activity): Boolean = false
    }

/**
 *
 */
class DefaultLauncherStarterStub : DefaultLauncherStarter {
        override fun startDefaultLauncher(activity: Activity): Boolean = true
    }
