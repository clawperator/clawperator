package action.devicepackage

import action.devicepackage.model.DeviceActivityInfo
import action.devicepackage.model.DevicePackageInfo
import action.log.Log
import action.system.model.ApplicationId
import action.system.model.ComponentKey
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.LauncherApps
import android.os.UserHandle
import androidx.core.net.toUri

/**
 * Provides a simple cache for results.
 *
 * Implements [android.content.pm.LauncherApps.Callback], so if a result is cached
 * and that app is updated/removed, the cache will be cleared
 */
class PackageInfoRepositoryAndroid(
    private val context: Context,
    private val repository: PackageInfoRepositorySystem,
) : PackageInfoRepository() {
    private val cache = HashMap<String, DevicePackageInfo>()

    @Volatile private var cacheGeneration = 0

    @SuppressLint("WrongConstant")
    private var launcherApps: LauncherApps = context.getSystemService("launcherapps") as LauncherApps
    private val launcherAppsCallbacks =
        object : LauncherApps.Callback() {
            override fun onPackagesUnavailable(
                packageNames: Array<out String>?,
                user: UserHandle?,
                replacing: Boolean,
            ) {
                removeFromCache(packageNames)
            }

            override fun onPackageChanged(
                packageName: String?,
                user: UserHandle?,
            ) {
                removeFromCache(packageName)
            }

            override fun onPackagesAvailable(
                packageNames: Array<out String>?,
                user: UserHandle?,
                replacing: Boolean,
            ) {
                removeFromCache(packageNames)
            }

            override fun onPackageAdded(
                packageName: String?,
                user: UserHandle?,
            ) {
                removeFromCache(packageName)
            }

            override fun onPackageRemoved(
                packageName: String?,
                user: UserHandle?,
            ) {
                removeFromCache(packageName)
            }
        }

    init {
        launcherApps.registerCallback(launcherAppsCallbacks)
    }

    override suspend fun getPackageInfo(applicationId: String): DevicePackageInfo? {
        val cached = cache[applicationId]
        if (cached != null) {
            return cached
        }

        val result = repository.getPackageInfo(applicationId)
        if (result != null) {
            cache[applicationId] = result
        }
        return result
    }

    override suspend fun getExportedActivityInfos(applicationId: String): List<DeviceActivityInfo>? = repository.getExportedActivityInfos(applicationId)

    override fun getStateId() = cacheGeneration

    override suspend fun getActivityInfo(componentKey: ComponentKey): DeviceActivityInfo? = repository.getActivityInfo(componentKey)

    override fun isInstalledBlocking(applicationId: String): Boolean = repository.isInstalledBlocking(applicationId)

    override fun showUninstallAppUi(applicationId: ApplicationId) {
        val intent =
            Intent(Intent.ACTION_DELETE).apply {
                data = "package:$applicationId".toUri()
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        context.startActivity(intent)
    }

    private fun removeFromCache(applicationId: String?) {
        if (applicationId != null) {
            removeFromCache(arrayOf(applicationId))
        }
    }

    private fun removeFromCache(applicationIds: Array<out String>?) {
        cacheGeneration++
        applicationIds?.forEach { applicationId ->
            if (cache.containsKey(applicationId)) {
                cache.remove(applicationId)
                Log.d("Removed $applicationId from cache")
            }
        }
    }
}
