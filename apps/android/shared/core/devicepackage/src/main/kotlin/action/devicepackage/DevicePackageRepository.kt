package action.devicepackage

import action.devicepackage.model.DeviceApp
import kotlinx.coroutines.flow.Flow

interface DevicePackageRepository {
    /**
     * Emits a change event whenever the list of device apps changes.
     * Note: currently does NOT update as the apps on a device are updated, deleted, or installed.
     */
    val onDeviceAppsChanged: Flow<Int>

    val allUserFacingDeviceApps: Flow<List<DeviceApp>?>

    val launcherApplicationIds: Flow<List<String>?>

    val setWallpaperApp: Flow<DeviceApp?>
}
