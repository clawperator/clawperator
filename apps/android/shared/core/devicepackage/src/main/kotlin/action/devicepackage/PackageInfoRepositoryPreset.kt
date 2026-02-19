package action.devicepackage

import action.devicepackage.model.DeviceActivityInfo
import action.devicepackage.model.DevicePackageInfo
import action.system.model.ApplicationId
import action.system.model.ComponentKey

class PackageInfoRepositoryPreset(
    private val installedAppIds: List<String> = emptyList(),
) : PackageInfoRepository() {
    var packageInfoProvider: (appId: String) -> DevicePackageInfo? = { null }

    override suspend fun getPackageInfo(applicationId: String) = packageInfoProvider(applicationId)

    override suspend fun getActivityInfo(componentKey: ComponentKey): DeviceActivityInfo? = null

    override suspend fun getExportedActivityInfos(applicationId: String): List<DeviceActivityInfo>? = null

    override suspend fun isInstalled(applicationId: String): Boolean = isInstalledBlocking(applicationId)

    override fun isInstalledBlocking(applicationId: String): Boolean = installedAppIds.contains(applicationId)

    override fun showUninstallAppUi(applicationId: ApplicationId) = Unit
}
