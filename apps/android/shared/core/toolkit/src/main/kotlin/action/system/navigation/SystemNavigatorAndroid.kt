package action.system.navigation

import action.activity.StartActivityHelper
import action.context.createSendEmailIntent
import action.context.launchCustomTabs
import action.context.launchGoogleSearch
import action.context.launchYouTubeVideo
import action.system.model.ComponentKey
import action.system.ui.controller.UiControllerManager
import action.system.ui.controller.currentActivity
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings

class SystemNavigatorAndroid(
    private val context: Context,
    private val uiControllerManager: UiControllerManager,
    private val packageManager: PackageManager,
    private val startActivityHelper: StartActivityHelper,
) : SystemNavigator {
    private val activity: Activity?
        get() = uiControllerManager.currentActivity

    override fun toUrl(url: String) {
        activity?.launchCustomTabs(url)
    }

    override fun toMailTo(
        recipients: List<String>,
        subject: String,
    ): Boolean {
        val intent = createSendEmailIntent(recipients, subject)
        if (intent.resolveActivity(packageManager) != null) {
            activity?.startActivity(intent)
            return true
        }
        return false
    }

    override fun toGoogleSearch(query: String?): Boolean = activity?.launchGoogleSearch(query) ?: false

    override fun toYouTubeVideo(youTubeVideoId: String) {
        activity?.launchYouTubeVideo(youTubeVideoId)
    }

    override fun toSystemAppInfo(componentKey: ComponentKey) {
        val intent =
            Intent().apply {
                setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                addCategory(Intent.CATEGORY_DEFAULT)
                setData(Uri.fromParts("package", componentKey.applicationId, null))
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_HISTORY)
                addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
            }

        startActivityHelper.startActivity(intent)
    }

    override fun toSystemDefaultAppsScreen() {
        // Note: RoleManager will only work if the app itself is a browser
//        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
//            val roleManager = context.getSystemService(RoleManager::class.java)
//            val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_BROWSER)
//            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
//        } else {

        // Fallback for older Android versions
        val intent =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
            } else {
                Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
            }

        startActivityHelper.startActivity(intent)
    }

    override fun toSystemSetAppAsLiveWallpaper(): Boolean {
        throw NotImplementedError("Not implemented on Android")
//        val wallpaperServiceClassName = appPlatformConfig.wallpaperServiceClassName
//            ?: return false
//
//        return activity?.let { activity ->
//            activity.launchSystemWallpaperPicker(ComponentName(activity, wallpaperServiceClassName))
//            true
//        } ?: false
    }

    override fun toVoiceSearch(): Boolean {
        val intent = context.findVoiceSearchIntent()
        if (intent != null) {
            return startActivityHelper.startActivity(intent)
        }
        return false
    }
}
