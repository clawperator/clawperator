package action.devicepackage

import action.devicepackage.model.DeviceApp
import action.system.model.ComponentKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

fun DeviceApp(
    applicationId: String,
    label: String,
): DeviceApp =
    DeviceApp(
        componentKey = ComponentKey(applicationId, ".MainActivity"),
        label = label,
        canBeUninstalled = true,
    )

class DevicePackageRepositoryPreset : DevicePackageRepository {
    override val onDeviceAppsChanged: Flow<Int> = flowOf(-1)

    override val allUserFacingDeviceApps: Flow<List<DeviceApp>?> =
        flowOf(
            emptyList(),
            /**
             * For reasons unknown, using the following causes certain tests in
             * [TileOperationsManagerDefaultTest] to raise a Koin error and not pass. Work around this
             * for now.
             */
//        listOf(
//            DeviceApp("com.google.android.apps.chrome", "Google Chrome"),
//            DeviceApp("com.google.android.apps.docs", "Google Drive"),
//            DeviceApp("com.google.android.apps.fitness", "Google Fit"),
//            DeviceApp("com.google.android.apps.magazines", "Google News"),
//            DeviceApp("com.google.android.apps.maps", "Google Maps"),
//            DeviceApp("com.google.android.apps.messaging", "Messages"),
//            DeviceApp("com.google.android.apps.nexuslauncher", "Pixel Launcher"),
//            DeviceApp("com.google.android.apps.photos", "Google Photos"),
//            DeviceApp("com.google.android.apps.tachyon", "Google Duo"),
//            DeviceApp("com.google.android.apps.translate", "Google Translate"),
//            DeviceApp("com.google.android.apps.turbo", "Google Go"),
//            DeviceApp("com.google.android.apps.walletnfcrel", "Google Pay"),
//            DeviceApp("com.google.android.apps.youtube", "YouTube"),
//            DeviceApp("com.google.android.apps.youtube.kids", "YouTube Kids"),
//            DeviceApp("com.google.android.apps.youtube.music", "YouTube Music"),
//            DeviceApp("com.google.android.calendar", "Google Calendar"),
//        )
        )

    override val launcherApplicationIds: Flow<List<String>?> = flowOf(emptyList())

    override val setWallpaperApp: Flow<DeviceApp?> = flowOf(null)
}
