package action.activity

import action.context.toast
import action.extensions.getUserHandle
import action.intent.PendingIntentCompat
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.LauncherApps
import android.os.Build
import android.os.FileUriExposedException
import android.os.Process
import android.os.UserManager
import android.util.AndroidRuntimeException

class StartActivityHelper(
    private val context: Context,
    private val userManager: UserManager,
    private val launcherApps: LauncherApps,
) {
    /**
     * Use this when starting an [Activity] from a [Service]. This avoids the system's 5 second
     * delay launching the Activity after a Home button press.
     *
     * https://stackoverflow.com/questions/5600084/
     */
    fun startActivityPendingIntent(intent: Intent): Boolean {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            PendingIntentCompat.getActivity(context, 0, intent, 0)?.send()
            true
        } catch (e: PendingIntent.CanceledException) {
            e.printStackTrace()
            false
        }
    }

    fun startActivity(intent: Intent): Boolean {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        if (intent.action != null) {
            ensureValidAction(intent)
            if (intent.action == Intent.ACTION_CALL) {
                handleStartActivityActionCall(intent)
                return true
            }
        }

        return startActivityImpl(intent, true)
    }

    private val appLoadErrorString: String by lazy {
        "App load error placeholder"
    }

    private fun startActivityImpl(
        intent: Intent,
        showToastOnError: Boolean,
    ): Boolean {
        try {
            val user = intent.getUserHandle(userManager)

            if (user == null || user == Process.myUserHandle()) {
                context.startActivity(intent)
            } else {
                launcherApps.startMainActivity(intent.component, user, intent.sourceBounds, null)
            }
            return true
        } catch (e: SecurityException) {
            showToastIfAllowed(showToastOnError, appLoadErrorString)
            e.printStackTrace()
        } catch (ignored: ActivityNotFoundException) {
            showToastIfAllowed(showToastOnError, appLoadErrorString)
        } catch (ignored: AndroidRuntimeException) {
            showToastIfAllowed(showToastOnError, appLoadErrorString)
        } catch (e: NullPointerException) {
            showToastIfAllowed(showToastOnError, appLoadErrorString)
            e.printStackTrace()
        } catch (e: RuntimeException) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && e is FileUriExposedException) {
//                showToastIfAllowed(showToastOnError, R.string.activity_file_uri_shortcut_error)
            } else {
                throw e
            }
        }
        return false
    }

    private fun showToastIfAllowed(
        allowed: Boolean,
        message: String,
    ) {
        if (allowed) {
            context.toast(message)
        }
    }

    private fun ensureValidAction(intent: Intent) {
        if (intent.action != null) {
            // Samsung's devices create Direct Dial shortcuts with the android.intent.action.CALL_PRIVILEGED
            // action. This requires the CALL_PRIVILEGED permission, which is inaccessible for 3rd party apps.
            // So just change to Intent.ACTION_CALL and all is well. See #190
            if (intent.action == "android.intent.action.CALL_PRIVILEGED") {
                // Note: this will change the actual intent in the ItemInfo instance, but that's fine.
                intent.action = Intent.ACTION_CALL
            }
        }
    }

    private fun handleStartActivityActionCall(intent: Intent) {
        // TODO: For now change the action to ACTION_DIAL which does not require an extra permission
        val dialIntent = Intent(intent)
        dialIntent.action = Intent.ACTION_DIAL
        startActivityImpl(dialIntent, true)
    }
}
