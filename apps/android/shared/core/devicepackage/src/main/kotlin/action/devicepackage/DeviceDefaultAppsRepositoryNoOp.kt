package action.devicepackage

import action.devicepackage.model.DeviceApp
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

class DeviceDefaultAppsRepositoryNoOp : DeviceDefaultAppsRepository {
    override val alarmApp: Flow<DeviceApp?> = flowOf(null)
    override val audioRecorderApp: Flow<DeviceApp?> = flowOf(null)
    override val browserApp: Flow<DeviceApp?> = flowOf(null)
    override val calendarApp: Flow<DeviceApp?> = flowOf(null)
    override val cameraApp: Flow<DeviceApp?> = flowOf(null)
    override val contactsApp: Flow<DeviceApp?> = flowOf(null)
    override val emailApp: Flow<DeviceApp?> = flowOf(null)
    override val downloadsApp: Flow<DeviceApp?> = flowOf(null)
    override val documentViewerApp: Flow<DeviceApp?> = flowOf(null)
    override val fileManagerApp: Flow<DeviceApp?> = flowOf(null)
    override val galleryApp: Flow<DeviceApp?> = flowOf(null)
    override val launcherApplicationId: Flow<String?> = flowOf(null)
    override val mapsApp: Flow<DeviceApp?> = flowOf(null)
    override val marketplaceApp: Flow<DeviceApp?> = flowOf(null)
    override val musicApp: Flow<DeviceApp?> = flowOf(null)
    override val phoneApp: Flow<DeviceApp?> = flowOf(null)
    override val settingsApp: Flow<DeviceApp?> = flowOf(null)
    override val setWallpaperApp: Flow<DeviceApp?> = flowOf(null)
    override val smsApp: Flow<DeviceApp?> = flowOf(null)
    override val videoPlayerApp: Flow<DeviceApp?> = flowOf(null)
    override val voiceAssistantApp: Flow<DeviceApp?> = flowOf(null)
}
