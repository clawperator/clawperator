package action.devicepackage

import action.appvisibility.AppVisibility
import action.coroutine.flow.combineDistinct
import action.devicepackage.model.DeviceApp
import action.system.model.ApplicationId
import android.content.Context
import kotlinx.coroutines.flow.Flow

class DeviceDefaultAppsRepositoryAndroid(
    private val context: Context,
    private val devicePackageRepository: DevicePackageRepository,
    private val appVisibility: AppVisibility,
) : DeviceDefaultAppsRepository {
    private val allDeviceApps: Flow<List<DeviceApp>?>
        get() = devicePackageRepository.allUserFacingDeviceApps
    private val refresh = appVisibility.isVisible

    private fun getDefaultApp(getApplicationId: () -> ApplicationId?): Flow<DeviceApp?> =
        combineDistinct(
            allDeviceApps,
            refresh,
        ) { deviceApps, _ ->
            val applicationId = getApplicationId()
            deviceApps?.firstOrNull { it.applicationId == applicationId }
        }

    override val alarmApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultAlarmApplicationId() }

    override val audioRecorderApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultAudioRecorderApplicationId() }

    override val browserApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultBrowserApplicationId() }

    override val calendarApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultCalendarApplicationId() }

    override val cameraApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultCameraApplicationId() }

    override val contactsApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultContactsApplicationId() }

    override val documentViewerApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultDocumentViewerApplicationId() }

    override val downloadsApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultDownloadsApplicationId() }

    override val emailApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultEmailApplicationId() }

    override val fileManagerApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultFileManagerApplicationId() }

    override val galleryApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultGalleryApplicationId() }

    override val launcherApplicationId: Flow<String?> =
        combineDistinct(
            devicePackageRepository.launcherApplicationIds,
            refresh,
        ) { launcherApplicationIds, _ ->
            val defaultLauncherApplicationId = context.getDefaultLauncherApplicationId()
            launcherApplicationIds?.firstOrNull { it == defaultLauncherApplicationId }
        }

    override val mapsApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultMapsApplicationId() }

    override val marketplaceApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultMarketplaceApplicationId() }

    override val musicApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultMusicApplicationId() }

    override val phoneApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultDialerApplicationId() }

    override val settingsApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultSettingsApplicationId() }

    override val smsApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultSmsAppApplicationId() }

    override val setWallpaperApp: Flow<DeviceApp?>
        get() = devicePackageRepository.setWallpaperApp

    override val videoPlayerApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultVideoPlayerApplicationId() }

    override val voiceAssistantApp: Flow<DeviceApp?> =
        getDefaultApp { context.getDefaultVoiceAssistantApplicationId() }
}
