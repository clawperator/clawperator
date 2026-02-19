package action.devicepackage

import action.devicepackage.model.DeviceActivityInfo
import action.devicepackage.model.DevicePackageInfo
import action.system.model.ApplicationId
import action.system.model.ComponentKey

class PackageInfoRepositoryNoOp : PackageInfoRepository() {
    var packageInfoProvider: (appId: String) -> DevicePackageInfo? = { null }

    override suspend fun getPackageInfo(applicationId: String) = packageInfoProvider(applicationId)

    override suspend fun getActivityInfo(componentKey: ComponentKey): DeviceActivityInfo? = null

    override suspend fun getExportedActivityInfos(applicationId: String): List<DeviceActivityInfo>? = null

    override fun isInstalledBlocking(applicationId: String): Boolean = false

    override fun showUninstallAppUi(applicationId: ApplicationId) = Unit
}
