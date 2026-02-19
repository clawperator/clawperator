package action.devicepackage.defaultapps.launcher

import action.coroutine.asFlow
import action.devicepackage.defaultapps.DefaultSystemAppStatus
import kotlinx.coroutines.flow.Flow

class DefaultLauncherManagerNoOp : DefaultLauncherManager {
    override val defaultLauncherStatus: Flow<DefaultSystemAppStatus> =
        DefaultSystemAppStatus.NotDefault.asFlow()

    override val canChangeDefaultLauncher: Flow<Boolean> = false.asFlow()

    override fun navigateToSystemLauncherPicker() { }
}
