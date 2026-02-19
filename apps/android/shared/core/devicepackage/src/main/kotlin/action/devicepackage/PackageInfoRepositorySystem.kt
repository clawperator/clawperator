package action.devicepackage

import action.devicepackage.model.DeviceActivityInfo
import action.devicepackage.model.DeviceActivityInfoAndroid
import action.devicepackage.model.DevicePackageInfo
import action.devicepackage.model.DevicePackageInfoAndroid
import action.system.model.ApplicationId
import action.system.model.ComponentKey
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.net.toUri

open class PackageInfoRepositorySystem(
    private val context: Context,
) : PackageInfoRepository() {
    private var stateId = 0

    private val packageManager by lazy { context.packageManager }

    override fun getStateId() = ++stateId

    override suspend fun getActivityInfo(componentKey: ComponentKey): DeviceActivityInfo? =
        DeviceActivityInfoAndroid(
            packageManager.getActivityInfo(
                componentKey.asComponentName(),
                0,
            ),
        )

    override suspend fun getPackageInfo(applicationId: String): DevicePackageInfo? = getPackageInfoBlocking(applicationId)

    private fun getPackageInfoBlocking(applicationId: String): DevicePackageInfo? =
        try {
            packageManager
                .getPackageInfo(applicationId, 0)
                .let { DevicePackageInfoAndroid(it) }
        } catch (ex: PackageManager.NameNotFoundException) {
            null
        }

    override suspend fun getExportedActivityInfos(applicationId: String): List<DeviceActivityInfo>? =
        try {
            packageManager
                .getPackageInfo(applicationId, PackageManager.GET_ACTIVITIES)
                .activities
                ?.filter { it.exported }
                ?.map { DeviceActivityInfoAndroid(it) }
                ?.ifEmpty { null }
        } catch (ex: PackageManager.NameNotFoundException) {
            null
        }

    override fun isInstalledBlocking(applicationId: String): Boolean = getPackageInfoBlocking(applicationId) != null

    override fun showUninstallAppUi(applicationId: ApplicationId) {
        val intent =
            Intent(Intent.ACTION_DELETE).apply {
                data = "package:$applicationId".toUri()
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        context.startActivity(intent)
    }
}
