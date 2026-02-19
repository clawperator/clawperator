package action.time

import kotlinx.coroutines.flow.Flow

class TimeRepositoryRaw : TimeRepository() {
    override val currentTime: Long
        get() = System.currentTimeMillis()

    override val elapsedRealtime: Long
        get() = error("elapsedRealtime not implemented in TimeRepositoryRaw")

    override val isUsingAutomaticSystemTime: Boolean
        get() = error("isUsingAutomaticSystemTime not implemented in TimeRepositoryRaw")

    override val userChangedSystemTime: Flow<Int>
        get() = error("userChangedSystemTime not implemented in TimeRepositoryRaw")
}
