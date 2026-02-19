package action.devicepackage

import action.devicepackage.model.DeviceApp
import kotlinx.coroutines.flow.Flow

interface DeviceDefaultAppsRepository {
    val alarmApp: Flow<DeviceApp?>
    val audioRecorderApp: Flow<DeviceApp?>
    val browserApp: Flow<DeviceApp?>
    val calendarApp: Flow<DeviceApp?>
    val cameraApp: Flow<DeviceApp?>
    val contactsApp: Flow<DeviceApp?>
    val emailApp: Flow<DeviceApp?>
    val downloadsApp: Flow<DeviceApp?>
    val documentViewerApp: Flow<DeviceApp?>
    val fileManagerApp: Flow<DeviceApp?>
    val galleryApp: Flow<DeviceApp?>
    val launcherApplicationId: Flow<String?>
    val mapsApp: Flow<DeviceApp?>
    val marketplaceApp: Flow<DeviceApp?>
    val musicApp: Flow<DeviceApp?>
    val phoneApp: Flow<DeviceApp?>
    val settingsApp: Flow<DeviceApp?>
    val setWallpaperApp: Flow<DeviceApp?>
    val smsApp: Flow<DeviceApp?>
    val videoPlayerApp: Flow<DeviceApp?>
    val voiceAssistantApp: Flow<DeviceApp?>
}
