package action.devicepackage.defaultapps.launcher

import action.activity.startActivitySafely
import action.appvisibility.AppVisibility
import action.buildconfig.BuildUtils.AT_LEAST_ANDROID_10
import action.buildconfig.BuildUtils.AT_LEAST_ANDROID_7_1
import action.coroutine.asFlow
import action.coroutine.flow.mapDistinct
import action.device.DeviceModel
import action.devicepackage.defaultapps.DefaultSystemAppStatus
import action.packagemanager.resolveDefaultApplicationIdChecked
import action.system.ui.controller.UiControllerManager
import action.system.ui.controller.currentActivity
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.LauncherApps
import android.content.pm.PackageManager
import android.os.Build.VERSION
import android.provider.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class DefaultLauncherManagerAndroid(
    private val context: Context,
    private val uiControllerManager: UiControllerManager,
    private val deviceModel: DeviceModel,
    appVisibility: AppVisibility,
    coroutineScopeIo: CoroutineScope,
) : DefaultLauncherManager {
    private val packageManager: PackageManager by lazy {
        context.packageManager
    }
    private val activity: Activity?
        get() = uiControllerManager.currentActivity

    override val defaultLauncherStatus: StateFlow<DefaultSystemAppStatus> =
        mapDistinct(
            appVisibility.isVisible,
        ) { _ ->
            getDefaultLauncherStatus(context.packageName)
        }.stateIn(coroutineScopeIo, started = SharingStarted.Eagerly, DefaultSystemAppStatus.Unknown)

    private val canCheckForDefaultLauncher: Boolean
        get() = AT_LEAST_ANDROID_7_1 || !deviceModel.isNativeHuawei
    private val systemLauncherPickerIsAvailable: Boolean
        get() = AT_LEAST_ANDROID_10
    private val _canChangeDefaultLauncher: Boolean
        get() = !(deviceModel.isXiaomi && AT_LEAST_ANDROID_10)
    override val canChangeDefaultLauncher: Flow<Boolean> =
        _canChangeDefaultLauncher.asFlow()

    override fun navigateToSystemLauncherPicker() {
        val activity = activity ?: return
        navigateToSystemLauncherPicker(activity)
    }

    fun navigateToBestSystemLauncherPicker(activity: Activity) {
        if (systemLauncherPickerIsAvailable && navigateToSystemLauncherPicker(activity)) {
            return
        }
        navigateToLegacySystemModal(activity)
    }

    fun getDefaultLauncherStatus(packageName: String): DefaultSystemAppStatus {
        if (!canCheckForDefaultLauncher) return DefaultSystemAppStatus.Unknowable

        // Prioritize package manager checks. See #5010.
        return if (checkIsDefaultLauncherViaPackageManager(packageName)) {
            DefaultSystemAppStatus.Default
        } else if (checkIsDefaultLauncherViaLauncherApps() == true) {
            DefaultSystemAppStatus.Default
        } else {
            DefaultSystemAppStatus.NotDefault
        }
    }

    private fun checkIsDefaultLauncherViaPackageManager(packageName: String): Boolean {
        val intent =
            Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
            }
        return context.packageManager.resolveDefaultApplicationIdChecked(intent) == packageName
    }

    private fun checkIsDefaultLauncherViaLauncherApps(): Boolean? {
        if (AT_LEAST_ANDROID_7_1) {
            val launcherApps = context.getSystemService("launcherapps") as LauncherApps
            return launcherApps.hasShortcutHostPermission()
        }

        return null
    }

    fun navigateToSystemLauncherPicker(activity: Activity): Boolean {
        if (_canChangeDefaultLauncher && systemLauncherPickerIsAvailable) {
            val defaultAppsIntent =
                Intent(Settings.ACTION_HOME_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
            if (packageManager.resolveActivity(defaultAppsIntent, 0) != null) {
                return activity.startActivitySafely(defaultAppsIntent)
            }
        }

        return false
    }

    fun navigateToSystemLauncherPickerFallback(activity: Activity) {
        activity.startActivity(
            Intent(
                if (VERSION.SDK_INT >= 24) {
                    Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS
                } else {
                    Settings.ACTION_SETTINGS
                },
            ),
        )
    }

    fun navigateToLegacySystemModal(activity: Activity) {
        TODO("Implement DefaultLauncherChangeActivity")
//        activity.startActivity(Intent(activity, DefaultLauncherChangeActivity::class.java))
    }
}
