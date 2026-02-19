package action.power

import kotlinx.coroutines.flow.Flow

interface PowerManager {
    val powerSaveMode: Flow<Boolean>

    fun isInteractive(): Boolean

    fun isPowerSaveMode(): Boolean
}
