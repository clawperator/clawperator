package action.devicepackage.defaultapps.launcher

import action.devicepackage.defaultapps.DefaultSystemAppStatus
import kotlinx.coroutines.flow.Flow

interface DefaultLauncherManager {
    val defaultLauncherStatus: Flow<DefaultSystemAppStatus>

    val canChangeDefaultLauncher: Flow<Boolean>

    fun navigateToSystemLauncherPicker()
}
