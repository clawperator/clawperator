package action.settings

import kotlinx.coroutines.flow.Flow

interface SettingManager {
    fun onSettingChanged(settingKey: String): Flow<Unit>
}
