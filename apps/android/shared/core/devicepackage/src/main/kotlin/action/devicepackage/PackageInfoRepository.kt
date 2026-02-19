package action.devicepackage

import action.devicepackage.model.DeviceActivityInfo
import action.devicepackage.model.DeviceApplicationInfo
import action.devicepackage.model.DevicePackageInfo
import action.system.model.ApplicationId
import action.system.model.ComponentKey

/**
 * Wrapper for fetching [android.content.pm.PackageInfo] and
 * [android.content.pm.ApplicationInfo] from the system.
 *
 * [PackageInfoRepositoryDefault] caches the results.
 *
 * This class should only be used inside of :devicepackage.
 */
abstract class PackageInfoRepository {
    abstract suspend fun getPackageInfo(applicationId: String): DevicePackageInfo?

    open fun getStateId() = -1

    suspend fun getApplicationInfo(applicationId: String): DeviceApplicationInfo? = getPackageInfo(applicationId)?.applicationInfo

    abstract suspend fun getActivityInfo(componentKey: ComponentKey): DeviceActivityInfo?

    abstract suspend fun getExportedActivityInfos(applicationId: String): List<DeviceActivityInfo>?

    open suspend fun isInstalled(applicationId: String): Boolean = getPackageInfo(applicationId) != null

    // Synchronous call to check if an app is installed. This will cause a stall, and should be
    // used extremely sparingly.
    abstract fun isInstalledBlocking(applicationId: String): Boolean

    abstract fun showUninstallAppUi(applicationId: ApplicationId)
}
