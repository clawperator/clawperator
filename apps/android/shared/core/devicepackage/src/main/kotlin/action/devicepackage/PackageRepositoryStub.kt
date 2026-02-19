package action.devicepackage

import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoHandle
import action.devicepackage.model.ActivityData
import action.devicepackage.model.AppInfoFilter
import action.devicepackage.model.ApplicationData
import action.system.model.ComponentKey
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.LauncherActivityInfo

/**
 *
 */
open class PackageRepositoryStub : PackageRepository {
    var launcherAppIdsProvider: () -> Collection<String> = { emptySet() }
    var deviceAppInfosProvider: () -> List<AppInfoHandle> = { emptyList() }
    var appInfosProvider: (appId: String) -> List<AppInfo> = { emptyList() }
    var phoneAppIdsProvider: () -> Collection<String> = { emptyList() }
    var launcherActivityInfosProvider: () -> Collection<LauncherActivityInfo> = { emptyList() }
    var intentActivitiesProvider: () -> Collection<ActivityInfo> = { emptyList() }

    override suspend fun getLauncherAppIds() = launcherAppIdsProvider()

    override suspend fun getDeviceAppInfos(filter: AppInfoFilter?): List<AppInfoHandle> = deviceAppInfosProvider()

    override suspend fun getAppInfos(applicationId: String): List<AppInfo> = appInfosProvider(applicationId)

    override suspend fun getAppInfo(componentKey: ComponentKey): AppInfo? = null

    override suspend fun getDefaultPhoneAppIds(): Collection<String> = phoneAppIdsProvider()

    override fun getLauncherActivityInfosForAllUsers(): Collection<LauncherActivityInfo> = launcherActivityInfosProvider()

    override fun getIntentActivities(intent: Intent): Collection<ActivityInfo> = intentActivitiesProvider()

    override suspend fun getAllApplicationData(
        defaultUserOnly: Boolean,
        includeActivityData: Boolean,
    ): List<ApplicationData>? = null

    override suspend fun getExportedActivityData(applicationId: String): List<ActivityData>? = null

    override fun getComponentEnabledState(componentKey: ComponentKey): ComponentEnabledState = ComponentEnabledState.ComponentEnabledStateDefault

    override fun setComponentEnabledState(
        componentKey: ComponentKey,
        state: ComponentEnabledState,
    ) { }
}
