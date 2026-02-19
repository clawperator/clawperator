package action.system.action

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

class SystemActionManagerNoOp : SystemActionManager {
    override fun openNotificationPanel(): Flow<SystemActionState> = flowOf(SystemActionState.Result.Error)

    override fun openQuickSettings(): Flow<SystemActionState> = flowOf(SystemActionState.Result.Error)

    override fun openRecentApps(): Flow<SystemActionState> = flowOf(SystemActionState.Result.Error)

    override fun lockScreen(): Flow<SystemActionState> = flowOf(SystemActionState.Result.Error)
}
