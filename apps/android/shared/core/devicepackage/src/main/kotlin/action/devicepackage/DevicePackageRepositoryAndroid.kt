package action.devicepackage

import action.coroutine.flow.SequencedChangeTracker
import action.devicepackage.installstate.PackageInstallStateListener
import action.devicepackage.installstate.PackageInstallStateReceiver
import action.devicepackage.model.DeviceApp
import action.devicepackage.model.DeviceApp.DeviceAppIntent
import action.resource.IntentKey
import action.system.model.ComponentKey
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.PackageManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class DevicePackageRepositoryAndroid(
    private val context: Context,
    private val packageRepository: PackageRepository,
    packageInstallStateReceiver: PackageInstallStateReceiver,
    coroutineScopeIo: CoroutineScope,
) : DevicePackageRepository {
    private val packageManager: PackageManager by lazy {
        context.packageManager
    }

    private val _allDeviceApps = MutableStateFlow<List<DeviceApp>?>(null)
    override val allUserFacingDeviceApps: Flow<List<DeviceApp>?>
        get() = _allDeviceApps

    private val _launcherApplicationIds = MutableStateFlow<List<String>?>(null)
    override val launcherApplicationIds: Flow<List<String>?>
        get() = _launcherApplicationIds

    private val _setWallpaperApp = MutableStateFlow<DeviceApp?>(null)
    override val setWallpaperApp: Flow<DeviceApp?>
        get() = _setWallpaperApp

    private val changeTracker = SequencedChangeTracker<Int>()
    override val onDeviceAppsChanged: Flow<Int> = changeTracker.flow

    private val packageInstallStateListener =
        PackageInstallStateListener { _, packageInstallState ->
            coroutineScopeIo.launch {
                refresh()
            }
        }

    private suspend fun refresh() {
        packageRepository.getLauncherActivityInfosForAllUsers().also { launcherActivityInfos ->
            val newDeviceApps =
                launcherActivityInfos.map { launcherActivityInfo: LauncherActivityInfo ->
                    val appInfo = launcherActivityInfo.applicationInfo
                    val isSystemApp = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                    DeviceApp(
                        componentKey =
                            ComponentKey(
                                applicationId = launcherActivityInfo.applicationInfo.packageName,
                                className = launcherActivityInfo.name,
                            ),
                        label = launcherActivityInfo.label.toString(),
                        canBeUninstalled = !isSystemApp,
                    )
                }
            if (newDeviceApps != _allDeviceApps.value) {
                _allDeviceApps.value = newDeviceApps
                changeTracker.emit(changeTracker.hashCode()) // Ensures a unique value each time
            }
        }

        packageRepository.getLauncherAppIds().also { applicationIds ->
            _launcherApplicationIds.value = applicationIds.toList()
        }

        _setWallpaperApp.value = getSetWallpaperApp()
    }

    private suspend fun getSetWallpaperApp(): DeviceApp? {
        val resolveInfo =
            packageManager.resolveActivity(
                Intent(Intent.ACTION_SET_WALLPAPER),
                PackageManager.MATCH_DEFAULT_ONLY,
            )

        return resolveInfo?.activityInfo?.let { activityInfo ->
            val launchIntent =
                Intent(Intent.ACTION_SET_WALLPAPER).apply {
                    component = ComponentName(activityInfo.packageName, activityInfo.name)
                }

            DeviceAppIntent(
                applicationId = activityInfo.packageName,
                label = activityInfo.loadLabel(packageManager).toString(),
                intentKey = IntentKey(launchIntent),
                canBeUninstalled = true,
            )
        }
    }

    init {
        // Register to receive package install state changes for all packages
        packageInstallStateReceiver.register()
        packageInstallStateReceiver.addListener(packageInstallStateListener)

        coroutineScopeIo.launch {
            refresh()
        }
    }
}
