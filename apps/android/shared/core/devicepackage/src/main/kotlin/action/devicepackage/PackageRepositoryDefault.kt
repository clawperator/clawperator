package action.devicepackage

import action.devicepackage.alias.AppInfoAliasRepository
import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoHandle
import action.devicepackage.model.ActivityData
import action.devicepackage.model.AppInfoFilter
import action.devicepackage.model.ApplicationData
import action.devicepackage.model.DevicePackageInfoAndroid
import action.devicestate.DeviceState
import action.icon.IconResolver
import action.system.model.ComponentKey
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.LauncherActivityInfo
import androidx.core.content.pm.PackageInfoCompat
import java.util.concurrent.ConcurrentHashMap

class PackageRepositoryDefault(
    private val systemRepo: PackageRepositorySystem,
    private val packageInfoRepository: PackageInfoRepository,
    private val appInfoAliasRepository: AppInfoAliasRepository,
    private val iconResolver: IconResolver,
    private val deviceState: DeviceState,
) : PackageRepository {
    private val excludedAppIds =
        listOf<String>(
//        "com.supercell.clashofclans",
//        "com.mind.quiz.brain.out",
//        "com.tripledot.woodoku",
        )

    private val appInfoCache = ConcurrentHashMap<ComponentKey, AppInfo>()

    override suspend fun getLauncherAppIds(): Collection<String> = systemRepo.getLauncherAppIds()

    override suspend fun getDeviceAppInfos(filter: AppInfoFilter?): List<AppInfoHandle> = systemRepo.getDeviceAppInfos(filter)

    override suspend fun getAppInfos(applicationId: String): List<AppInfo> {
        getAppInfo(ComponentKey(applicationId))

        val infos = mutableListOf<AppInfo>()
        val components = systemRepo.getComponents(applicationId).asSequence()
        components.forEach { componentKey ->
            getAppInfo(componentKey)?.also {
                infos.add(it)
            }
        }

        return when (infos.isEmpty()) {
            true -> listOfNotNull(getAppInfo(ComponentKey.applicationKey(applicationId)))
            else -> infos
        }
    }

    override suspend fun getAppInfo(componentKey: ComponentKey): AppInfo? {
        val cached = getCached(componentKey)
        val currentVersion = getAppVersion(componentKey.applicationId)
        if (cached != null && currentVersion == cached.getVersionCode()) {
            return cached
        }

        val appInfoAlias = appInfoAliasRepository.getAppInfo(componentKey)
        if (appInfoAlias != null) {
            return appInfoAlias // TODO consider caching?
        }

        return systemRepo.getAppInfo(componentKey)?.also {
            updateCacheFor(it)
        }
    }

    override suspend fun getDefaultPhoneAppIds(): Collection<String> = systemRepo.getDefaultPhoneAppIds()

    override fun getLauncherActivityInfosForAllUsers(): Collection<LauncherActivityInfo> =
        systemRepo
            .getLauncherActivityInfosForAllUsers()
            .filter {
                !excludedAppIds.contains(it.componentName.packageName)
            }

    override fun getIntentActivities(intent: Intent): Collection<ActivityInfo> =
        systemRepo
            .getIntentActivities(intent)
            .filter {
                !excludedAppIds.contains(it.packageName)
            }

    override suspend fun getAllApplicationData(
        defaultUserOnly: Boolean,
        includeActivityData: Boolean,
    ): List<ApplicationData>? = systemRepo.getAllApplicationData(defaultUserOnly, includeActivityData)

    override suspend fun getExportedActivityData(applicationId: String): List<ActivityData>? = systemRepo.getExportedActivityData(applicationId)

    override fun getComponentEnabledState(componentKey: ComponentKey): ComponentEnabledState = systemRepo.getComponentEnabledState(componentKey)

    override fun setComponentEnabledState(
        componentKey: ComponentKey,
        state: ComponentEnabledState,
    ) = systemRepo.setComponentEnabledState(componentKey, state)

    private fun updateCacheFor(appInfo: AppInfo) {
        appInfoCache[appInfo.getComponentKey()] = appInfo
    }

    private fun getCached(componentKey: ComponentKey): AppInfo? {
        if (!deviceState.isUserUnlocked) return null
        return appInfoCache[componentKey]
    }

    private suspend fun getAppVersion(appId: String): Long {
        val info = packageInfoRepository.getPackageInfo(appId)
        return if (info != null && info is DevicePackageInfoAndroid) {
            PackageInfoCompat.getLongVersionCode(info.packageInfo)
        } else {
            -1
        }
    }
}
