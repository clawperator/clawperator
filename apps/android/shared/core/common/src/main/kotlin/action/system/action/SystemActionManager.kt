package action.system.action

import kotlinx.coroutines.flow.Flow

interface SystemActionManager {
    fun openNotificationPanel(): Flow<SystemActionState>

    fun openQuickSettings(): Flow<SystemActionState>

    fun openRecentApps(): Flow<SystemActionState>

    fun lockScreen(): Flow<SystemActionState>
}
