package action.devicepackage.util

import action.devicepackage.PackageInfoRepository
import action.devicepackage.model.DevicePackageInfo
import action.devicepackage.model.DevicePackageInfoAndroid
import action.devicepackage.model.DeviceActivityInfo
import action.system.model.ApplicationId
import action.system.model.ComponentKey
import android.os.Build
import androidx.core.content.pm.PackageInfoCompat.getLongVersionCode

/**
 * Wraps a [PackageInfoRepository] and allows adding a version offset for specific app IDs
 * so tests can simulate cache invalidation without Mockito.
 */
class VersionOffsetPackageInfoRepository(
    private val delegate: PackageInfoRepository,
) : PackageInfoRepository() {

    private val versionOffsets = mutableMapOf<String, Long>()

    fun setVersionOffset(appId: String, offset: Long) {
        versionOffsets[appId] = offset
    }

    override suspend fun getPackageInfo(applicationId: String): DevicePackageInfo? {
        val real = delegate.getPackageInfo(applicationId) ?: return null
        val offset = versionOffsets[applicationId] ?: 0L
        if (offset == 0L) return real
        val androidInfo = real as? DevicePackageInfoAndroid ?: return real
        val pkg = androidInfo.packageInfo
        val newPkg = android.content.pm.PackageInfo().apply {
            applicationInfo = pkg.applicationInfo
            packageName = pkg.packageName
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                longVersionCode = pkg.longVersionCode + offset
            } else {
                @Suppress("DEPRECATION")
                versionCode = (getLongVersionCode(pkg) + offset).toInt()
            }
        }
        return DevicePackageInfoAndroid(newPkg)
    }

    override fun getStateId() = delegate.getStateId()

    override suspend fun getActivityInfo(componentKey: ComponentKey): DeviceActivityInfo? =
        delegate.getActivityInfo(componentKey)

    override suspend fun getExportedActivityInfos(applicationId: String): List<DeviceActivityInfo>? =
        delegate.getExportedActivityInfos(applicationId)

    override fun isInstalledBlocking(applicationId: String): Boolean =
        delegate.isInstalledBlocking(applicationId)

    override fun showUninstallAppUi(applicationId: ApplicationId) =
        delegate.showUninstallAppUi(applicationId)
}
