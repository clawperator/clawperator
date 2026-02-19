package action.devicepackage.util

import action.devicepackage.PackageRepository
import action.devicepackage.PackageRepositorySystem
import action.devicepackage.appinfo.AppInfo
import action.devicepackage.appinfo.AppInfoHandle
import action.devicepackage.model.AppInfoFilter
import action.icon.IconResolver
import action.system.model.ComponentKey
import android.content.Context
import android.os.UserManager
import kotlinx.coroutines.runBlocking

/**
 * Wraps [PackageRepositorySystem] and counts calls to [getDeviceAppInfos] and [getAppInfo]
 * for use in tests without Mockito.
 */
class CountingPackageRepositorySystem(
    context: Context,
    packageInfoRepository: action.devicepackage.PackageInfoRepository,
    iconResolver: IconResolver,
    userManager: UserManager,
    config: action.devicepackage.PackageRepositoryConfig,
) : PackageRepositorySystem(context, packageInfoRepository, iconResolver, userManager, config) {

    var getDeviceAppInfosCallCount: Int = 0
        private set
    var getAppInfoCallCount: Int = 0
        private set

    override suspend fun getDeviceAppInfos(filter: AppInfoFilter?): List<AppInfoHandle> {
        getDeviceAppInfosCallCount++
        return super.getDeviceAppInfos(filter)
    }

    override suspend fun getAppInfo(componentKey: ComponentKey): AppInfo? {
        getAppInfoCallCount++
        return super.getAppInfo(componentKey)
    }
}
