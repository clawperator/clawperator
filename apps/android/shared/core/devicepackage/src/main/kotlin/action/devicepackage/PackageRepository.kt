package action.devicepackage

import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoHandle
import action.devicepackage.appinfo.AppInfoPreset
import action.devicepackage.model.ActivityData
import action.devicepackage.model.AppInfoFilter
import action.devicepackage.model.AppInfoResult
import action.devicepackage.model.ApplicationData
import action.icon.FallbackIconResolver
import action.system.model.ComponentKey
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.LauncherActivityInfo

interface PackageRepository {
    suspend fun getLauncherAppIds(): Collection<String>

    /**
     * Fetch an [AppInfoHandle] instance for all apps with launcher icon filters on the device.
     * The results are sorted by app name.
     */
    suspend fun getDeviceAppInfos(filter: AppInfoFilter? = null): List<AppInfoHandle>

    /**
     * Fetch all [AppInfo] instances for an [applicationId]
     */
    suspend fun getAppInfos(applicationId: String): List<AppInfo>

    /**
     * Fetch an [AppInfo] instance for an [componentKey]. Fetching will load
     * the title and icon from the system.
     */
    suspend fun getAppInfo(componentKey: ComponentKey): AppInfo?

    suspend fun getDefaultPhoneAppIds(): Collection<String>

    fun getLauncherActivityInfosForAllUsers(): Collection<LauncherActivityInfo>

    fun getIntentActivities(intent: Intent): Collection<ActivityInfo>

    suspend fun getAllApplicationData(
        defaultUserOnly: Boolean,
        includeActivityData: Boolean,
    ): List<ApplicationData>?

    suspend fun getExportedActivityData(applicationId: String): List<ActivityData>?

    fun getComponentEnabledState(componentKey: ComponentKey): ComponentEnabledState

    fun setComponentEnabledState(
        componentKey: ComponentKey,
        state: ComponentEnabledState,
    )
}

/**
 * Call when an AppInfo result is required (such as displaying usage results for an app that is no
 * longer installed). If an app cannot be found on the system, an AppInfo is constructed with fallback
 * data based on [componentKey].
 */
suspend fun PackageRepository.requireAppInfo(
    componentKey: ComponentKey,
    fallbackIconResolver: FallbackIconResolver,
): AppInfoResult {
    val appInfo =
        getAppInfos(componentKey.applicationId).firstOrNull {
            componentKey.isApplicationKey() || componentKey.className == it.getComponentKey().className
        }
    return if (appInfo != null) {
        AppInfoResult(appInfo, false)
    } else {
        AppInfoResult(AppInfoPreset(componentKey, fallbackIconResolver), true)
    }
}
